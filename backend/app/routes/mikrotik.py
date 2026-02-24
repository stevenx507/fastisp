"""
MikroTik API endpoints
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.routes.main_routes import admin_required
from app import db
from app.models import MikroTikRouter, Client, Plan, User
from app.services.mikrotik_service import MikroTikService
from app.services.mikrotik_advanced_service import MikroTikAdvancedService
from app.services.ai_diagnostic_service import AIDiagnosticService
from app.services.monitoring_service import monitoring_service
from app.tenancy import current_tenant_id, tenant_access_allowed
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import re
import uuid

mikrotik_bp = Blueprint('mikrotik', __name__)
logger = logging.getLogger(__name__)

# Ephemeral change-control store (router-scoped).
# For production deployments this can be moved to DB or Redis.
ENTERPRISE_CHANGELOG: Dict[str, List[Dict[str, Any]]] = {}
ENTERPRISE_CHANGE_INDEX: Dict[str, Dict[str, Any]] = {}

def _test_router_connection(router: MikroTikRouter) -> bool:
    try:
        with MikroTikService(router.id) as service:
            return bool(service.api)
    except Exception:
        return False

def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(str(value)))
    except Exception:
        return default

def _as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in ('1', 'true', 'yes', 'y', 'on'):
        return True
    if text in ('0', 'false', 'no', 'n', 'off'):
        return False
    return default

def _parse_router_latency_ms(value: Any) -> Optional[float]:
    if value is None:
        return None
    raw = str(value).strip().lower()
    if not raw:
        return None
    if raw.endswith('ms'):
        try:
            return float(raw.replace('ms', '').strip())
        except Exception:
            return None
    if raw.count(':') == 2:
        # RouterOS can report latency as HH:MM:SS.sss
        try:
            h, m, s = raw.split(':')
            seconds = (int(h) * 3600) + (int(m) * 60) + float(s)
            return round(seconds * 1000, 2)
        except Exception:
            return None
    try:
        return float(raw)
    except Exception:
        return None


def _normalize_queue_item(queue: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'id': queue.get('id') or queue.get('.id') or '',
        'name': queue.get('name', ''),
        'target': queue.get('target', ''),
        'max_limit': queue.get('max_limit') or queue.get('max-limit') or '',
        'rate': queue.get('rate', ''),
        'packet_rate': queue.get('packet_rate') or queue.get('packet-rate') or '',
        'queued_bytes': queue.get('queued_bytes') or queue.get('queued-bytes') or '0',
        'queued_packets': queue.get('queued_packets') or queue.get('queued-packets') or '0',
        'disabled': str(queue.get('disabled', 'false')).lower() == 'true' if isinstance(queue.get('disabled'), str) else bool(queue.get('disabled', False)),
        'comment': queue.get('comment', ''),
    }

def _resolve_actor_identity() -> str:
    try:
        identity = get_jwt_identity()
        user = db.session.get(User, identity) if identity else None
        if user:
            name = user.name or f"user-{user.id}"
            if user.email:
                return f"{name} <{user.email}>"
            return name
    except Exception:
        pass
    return "admin"


def _tenant_router_query():
    tenant_id = current_tenant_id()
    query = MikroTikRouter.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    return query


def _router_for_request(router_id: Any) -> Optional[MikroTikRouter]:
    try:
        normalized = int(router_id)
    except (TypeError, ValueError):
        return None
    router = db.session.get(MikroTikRouter, normalized)
    if not router:
        return None
    if not tenant_access_allowed(router.tenant_id):
        return None
    return router


def _pick_value(data: Dict[str, Any], *keys: str):
    for key in keys:
        if key in data:
            return data.get(key)
        alt = key.replace('-', '_')
        if alt in data:
            return data.get(alt)
        alt = key.replace('_', '-')
        if alt in data:
            return data.get(alt)
    return None


def _parse_routeros_version(raw_version: Any) -> tuple[int, int, int]:
    text = str(raw_version or '').strip()
    if not text:
        return (0, 0, 0)
    match = re.search(r'(\d+)\.(\d+)(?:\.(\d+))?', text)
    if not match:
        return (0, 0, 0)
    major = int(match.group(1))
    minor = int(match.group(2))
    patch = int(match.group(3) or 0)
    return (major, minor, patch)


def _version_supports_back_to_home(version: tuple[int, int, int]) -> bool:
    return version >= (7, 12, 0)


def _version_supports_bth_users(version: tuple[int, int, int]) -> bool:
    return version >= (7, 14, 0)


def _get_change_log(router_id: str) -> List[Dict[str, Any]]:
    key = str(router_id)
    if key not in ENTERPRISE_CHANGELOG:
        ENTERPRISE_CHANGELOG[key] = []
    return ENTERPRISE_CHANGELOG[key]

def _build_hardening_runbook(profile: str, site_profile: str) -> Dict[str, List[str]]:
    commands = [
        ':do {/ip service set telnet disabled=yes} on-error={}',
        ':do {/ip service set ftp disabled=yes} on-error={}',
        ':do {/ip service set www disabled=yes} on-error={}',
        ':do {/ip service set api disabled=yes} on-error={}',
        ':do {/ip service set api-ssl disabled=yes} on-error={}'
    ]
    rollback_commands = [
        ':do {/ip service set telnet disabled=no} on-error={}',
        ':do {/ip service set ftp disabled=no} on-error={}',
        ':do {/ip service set www disabled=no} on-error={}',
        ':do {/ip service set api disabled=no} on-error={}',
        ':do {/ip service set api-ssl disabled=no} on-error={}'
    ]

    if profile in ('strict', 'hardened'):
        commands.extend([
            ':do {/ip service set ssh strong-crypto=yes} on-error={}',
            ':do {/ip settings set rp-filter=strict} on-error={}',
            ':do {/ip neighbor discovery-settings set discover-interface-list=none} on-error={}'
        ])
        rollback_commands.extend([
            ':do {/ip settings set rp-filter=loose} on-error={}',
            ':do {/ip neighbor discovery-settings set discover-interface-list=all} on-error={}'
        ])

    if site_profile == 'core':
        commands.extend([
            ':do {/system logging add topics=critical action=memory} on-error={}',
            ':do {/ip firewall filter add chain=input action=drop connection-state=invalid comment="auto-core-invalid"} on-error={}'
        ])
        rollback_commands.extend([
            ':do {/ip firewall filter remove [find comment="auto-core-invalid"]} on-error={}'
        ])
    elif site_profile == 'distribution':
        commands.extend([
            ':do {/ip firewall filter add chain=input action=accept protocol=icmp limit=50,5:packet comment="auto-dist-icmp"} on-error={}',
            ':do {/ip firewall filter add chain=input action=drop protocol=icmp comment="auto-dist-icmp-drop"} on-error={}'
        ])
        rollback_commands.extend([
            ':do {/ip firewall filter remove [find comment="auto-dist-icmp"]} on-error={}',
            ':do {/ip firewall filter remove [find comment="auto-dist-icmp-drop"]} on-error={}'
        ])
    elif site_profile == 'access':
        commands.extend([
            ':do {/interface ethernet switch set 0 drop-if-invalid-or-src-port-not-member-of-vlan-on-ports=yes} on-error={}',
            ':do {/ip firewall filter add chain=forward action=drop connection-state=invalid comment="auto-access-invalid"} on-error={}'
        ])
        rollback_commands.extend([
            ':do {/ip firewall filter remove [find comment="auto-access-invalid"]} on-error={}'
        ])
    elif site_profile == 'hotspot':
        commands.extend([
            ':do {/ip hotspot profile set [find default=yes] split-user-domain=no} on-error={}',
            ':do {/ip firewall filter add chain=forward action=drop protocol=tcp dst-port=25 comment="auto-hotspot-smtp"} on-error={}'
        ])
        rollback_commands.extend([
            ':do {/ip firewall filter remove [find comment="auto-hotspot-smtp"]} on-error={}'
        ])

    return {'commands': commands, 'rollback_commands': rollback_commands}

def _register_change(
    router_id: str,
    actor: str,
    category: str,
    profile: str,
    site_profile: str,
    commands: List[str],
    rollback_commands: List[str],
    status: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    change_id = f"CHG-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    entry = {
        'change_id': change_id,
        'router_id': str(router_id),
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'actor': actor,
        'category': category,
        'profile': profile,
        'site_profile': site_profile,
        'status': status,
        'commands': commands,
        'rollback_commands': rollback_commands,
        'metadata': metadata or {}
    }
    log = _get_change_log(str(router_id))
    log.insert(0, entry)
    del log[250:]
    ENTERPRISE_CHANGE_INDEX[change_id] = entry
    return entry

@mikrotik_bp.route('/routers', methods=['GET'])
@admin_required()
def get_routers():
    """Get all MikroTik routers"""
    try:
        routers = _tenant_router_query().order_by(MikroTikRouter.name.asc()).all()
        return jsonify({
            'success': True,
            'routers': [r.to_dict() for r in routers]
        }), 200
    except Exception as e:
        logger.error(f"Error getting routers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers', methods=['POST'])
@admin_required()
def create_router():
    data = request.get_json() or {}
    name = str(data.get('name') or '').strip()
    ip_address = str(data.get('ip_address') or '').strip()
    username = str(data.get('username') or '').strip()
    password = str(data.get('password') or '').strip()

    if not name:
        return jsonify({'success': False, 'error': 'name is required'}), 400
    if not ip_address:
        return jsonify({'success': False, 'error': 'ip_address is required'}), 400
    if not username:
        return jsonify({'success': False, 'error': 'username is required'}), 400
    if not password:
        return jsonify({'success': False, 'error': 'password is required'}), 400

    try:
        api_port = int(data.get('api_port') or 8728)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'api_port must be integer'}), 400
    if api_port < 1 or api_port > 65535:
        return jsonify({'success': False, 'error': 'api_port must be between 1 and 65535'}), 400

    duplicate = _tenant_router_query().filter_by(ip_address=ip_address).first()
    if duplicate:
        return jsonify({'success': False, 'error': 'A router with this IP already exists'}), 409

    router = MikroTikRouter(
        name=name,
        ip_address=ip_address,
        username=username,
        api_port=api_port,
        is_active=_as_bool(data.get('is_active'), default=True),
        tenant_id=current_tenant_id(),
    )
    router.password = password
    db.session.add(router)
    db.session.commit()

    test_connection = _as_bool(data.get('test_connection'), default=True)
    reachable = _test_router_connection(router) if test_connection else None
    return jsonify(
        {
            'success': True,
            'router': router.to_dict(),
            'connection_tested': test_connection,
            'reachable': reachable,
        }
    ), 201

@mikrotik_bp.route('/routers/<router_id>', methods=['GET'])
@admin_required()
def get_router(router_id):
    """Get specific router details"""
    try:
        router = _router_for_request(router_id)
        if not router:
            return jsonify({'success': False, 'error': 'Router not found'}), 404
        
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            
            router_info = service.get_router_info()
            interface_stats = service.get_interface_stats()
        
        return jsonify({
            'success': True,
            'router': router.to_dict(),
            'info': router_info,
            'interfaces': interface_stats
        }), 200
    except Exception as e:
        logger.error(f"Error getting router {router_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers/<router_id>', methods=['PATCH'])
@admin_required()
def update_router(router_id):
    router = _router_for_request(router_id)
    if not router:
        return jsonify({'success': False, 'error': 'Router not found'}), 404

    data = request.get_json() or {}
    changed = []

    if 'name' in data:
        name = str(data.get('name') or '').strip()
        if not name:
            return jsonify({'success': False, 'error': 'name cannot be empty'}), 400
        router.name = name
        changed.append('name')

    if 'ip_address' in data:
        ip_address = str(data.get('ip_address') or '').strip()
        if not ip_address:
            return jsonify({'success': False, 'error': 'ip_address cannot be empty'}), 400
        duplicate = _tenant_router_query().filter(
            MikroTikRouter.ip_address == ip_address,
            MikroTikRouter.id != router.id,
        ).first()
        if duplicate:
            return jsonify({'success': False, 'error': 'A router with this IP already exists'}), 409
        router.ip_address = ip_address
        changed.append('ip_address')

    if 'username' in data:
        username = str(data.get('username') or '').strip()
        if not username:
            return jsonify({'success': False, 'error': 'username cannot be empty'}), 400
        router.username = username
        changed.append('username')

    if 'password' in data:
        password = str(data.get('password') or '').strip()
        if password:
            router.password = password
            changed.append('password')

    if 'api_port' in data:
        try:
            api_port = int(data.get('api_port'))
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'api_port must be integer'}), 400
        if api_port < 1 or api_port > 65535:
            return jsonify({'success': False, 'error': 'api_port must be between 1 and 65535'}), 400
        router.api_port = api_port
        changed.append('api_port')

    if 'is_active' in data:
        router.is_active = _as_bool(data.get('is_active'), default=True)
        changed.append('is_active')

    db.session.add(router)
    db.session.commit()
    return jsonify({'success': True, 'router': router.to_dict(), 'updated_fields': changed}), 200


@mikrotik_bp.route('/routers/<router_id>', methods=['DELETE'])
@admin_required()
def delete_router(router_id):
    router = _router_for_request(router_id)
    if not router:
        return jsonify({'success': False, 'error': 'Router not found'}), 404

    clients_query = Client.query.filter_by(router_id=router.id)
    tenant_id = current_tenant_id()
    if tenant_id is not None:
        clients_query = clients_query.filter_by(tenant_id=tenant_id)
    linked_clients = clients_query.count()
    if linked_clients > 0:
        return jsonify(
            {
                'success': False,
                'error': 'Router has linked clients and cannot be deleted',
                'linked_clients': linked_clients,
            }
        ), 409

    db.session.delete(router)
    db.session.commit()
    return jsonify({'success': True, 'deleted_id': str(router.id)}), 200


@mikrotik_bp.route('/routers/<router_id>/quick-connect', methods=['GET'])
@admin_required()
def router_quick_connect(router_id):
    router = _router_for_request(router_id)
    if not router:
        return jsonify({'success': False, 'error': 'Router not found'}), 404

    allowed_mgmt = str(request.args.get('allowed_mgmt') or 'YOUR_PUBLIC_IP/32').strip() or 'YOUR_PUBLIC_IP/32'
    wg_endpoint = str(request.args.get('wg_endpoint') or 'vpn.fastisp.cloud:51820').strip() or 'vpn.fastisp.cloud:51820'
    wg_server_public_key = str(
        request.args.get('wg_server_public_key') or '<WIREGUARD_SERVER_PUBLIC_KEY>'
    ).strip() or '<WIREGUARD_SERVER_PUBLIC_KEY>'
    wg_allowed_subnets = str(
        request.args.get('wg_allowed_subnets') or '10.250.0.0/16,10.251.0.0/16'
    ).strip() or '10.250.0.0/16,10.251.0.0/16'
    bth_user = str(request.args.get('bth_user') or 'noc-vps').strip() or 'noc-vps'
    bth_allow_lan = _as_bool(request.args.get('bth_allow_lan'), default=True)
    bth_private_key = str(request.args.get('bth_private_key') or '<BASE64_WG_PRIVATE_KEY>').strip() or '<BASE64_WG_PRIVATE_KEY>'

    wg_endpoint_host = wg_endpoint
    wg_endpoint_port = 51820
    if ':' in wg_endpoint:
        host_part, port_part = wg_endpoint.rsplit(':', 1)
        try:
            wg_endpoint_port = int(port_part)
            wg_endpoint_host = host_part
        except ValueError:
            wg_endpoint_host = wg_endpoint
            wg_endpoint_port = 51820

    router_peer_ip = f'10.250.{int(router.id) % 250}.2/32'
    scripts = {
        'direct_api_script': (
            f"/ip service set api disabled=no port={router.api_port}\n"
            "/ip service set ssh disabled=no port=22\n"
            f"/ip firewall address-list add list=fastisp-management address={allowed_mgmt} comment=\"FastISP NOC\"\n"
            f"/ip firewall filter add chain=input action=accept protocol=tcp dst-port={router.api_port},22 src-address-list=fastisp-management comment=\"FastISP remote access\"\n"
            "/ip firewall filter add chain=input action=drop protocol=tcp dst-port=22,8728,8729 in-interface-list=WAN comment=\"Drop unmanaged remote\"\n"
        ),
        'wireguard_site_to_vps_script': (
            "/interface/wireguard add name=wg-fastisp listen-port=13231 comment=\"FastISP NOC tunnel\"\n"
            f"/ip/address/add address={router_peer_ip} interface=wg-fastisp comment=\"FastISP tunnel\"\n"
            f"/interface/wireguard/peers/add interface=wg-fastisp public-key=\"{wg_server_public_key}\" endpoint-address={wg_endpoint_host} endpoint-port={wg_endpoint_port} allowed-address={wg_allowed_subnets} persistent-keepalive=25s\n"
            "/ip/firewall/filter add chain=input action=accept protocol=udp dst-port=13231 comment=\"Allow WireGuard\"\n"
        ),
        'windows_login': f"ssh {router.username}@{router.ip_address} -p 22",
        'linux_login': f"ssh {router.username}@{router.ip_address} -p 22",
    }

    back_to_home = {
        'reachable': False,
        'routeros_version': None,
        'supported': None,
        'bth_users_supported': None,
        'ddns_enabled': None,
        'back_to_home_vpn': None,
        'vpn_status': None,
        'vpn_dns_name': None,
        'vpn_interface': None,
        'vpn_port': None,
        'users': [],
        'scripts': {
            'enable_script': (
                '/ip/cloud/set ddns-enabled=yes update-time=yes\n'
                '/ip/cloud/set back-to-home-vpn=enabled\n'
                '/ip/cloud/print\n'
            ),
            'add_vps_user_script': (
                f'/ip/cloud/back-to-home-users/add name="{bth_user}" private-key="{bth_private_key}" '
                f'allow-lan={"yes" if bth_allow_lan else "no"} comment="FastISP VPS" disabled=no\n'
                f'/interface/wireguard/peers/show-client-config {bth_user}\n'
            ),
            'generate_private_key_hint': 'wg genkey | base64 -w0',
        },
        'limitations': [
            'Back To Home por relay puede tener mas latencia que un túnel WireGuard sitio-a-sitio.',
            'Para administracion masiva de routers desde VPS, WireGuard dedicado sigue siendo recomendado.',
        ],
    }

    try:
        with MikroTikService(router.id) as service:
            if service.api:
                back_to_home['reachable'] = True
                router_info = service.get_router_info() or {}
                version_text = (
                    _pick_value(router_info, 'firmware', 'version', 'routeros_version')
                    or _pick_value(router_info, 'routeros-version', 'routeros_version')
                    or ''
                )
                version_tuple = _parse_routeros_version(version_text)
                supports_bth = _version_supports_back_to_home(version_tuple)
                supports_bth_users = _version_supports_bth_users(version_tuple)
                back_to_home['routeros_version'] = str(version_text or '') or None
                back_to_home['supported'] = supports_bth
                back_to_home['bth_users_supported'] = supports_bth_users

                cloud_rows = service.api.get_resource('/ip/cloud').get()
                cloud_info = cloud_rows[0] if isinstance(cloud_rows, list) and cloud_rows else {}
                back_to_home['ddns_enabled'] = _as_bool(_pick_value(cloud_info, 'ddns-enabled', 'ddns_enabled'), default=False)
                back_to_home['back_to_home_vpn'] = str(
                    _pick_value(cloud_info, 'back-to-home-vpn', 'back_to_home_vpn') or ''
                ).strip() or None
                back_to_home['vpn_status'] = str(
                    _pick_value(cloud_info, 'back-to-home-vpn-status', 'back_to_home_vpn_status') or ''
                ).strip() or None
                back_to_home['vpn_dns_name'] = str(
                    _pick_value(cloud_info, 'dns-name', 'dns_name', 'back-to-home-dns-name', 'back_to_home_dns_name') or ''
                ).strip() or None
                back_to_home['vpn_interface'] = str(
                    _pick_value(cloud_info, 'back-to-home-interface', 'back_to_home_interface') or ''
                ).strip() or None
                back_to_home['vpn_port'] = str(
                    _pick_value(cloud_info, 'back-to-home-vpn-port', 'back_to_home_vpn_port') or ''
                ).strip() or None

                if supports_bth_users:
                    try:
                        users_api = service.api.get_resource('/ip/cloud/back-to-home-users')
                        raw_users = users_api.get()
                        normalized_users = []
                        for item in (raw_users or [])[:30]:
                            normalized_users.append(
                                {
                                    'name': str(_pick_value(item, 'name') or ''),
                                    'allow_lan': _as_bool(_pick_value(item, 'allow-lan', 'allow_lan'), default=False),
                                    'disabled': _as_bool(_pick_value(item, 'disabled'), default=False),
                                    'expires': str(_pick_value(item, 'expires') or ''),
                                }
                            )
                        back_to_home['users'] = normalized_users
                    except Exception as users_exc:
                        back_to_home['users_error'] = str(users_exc)
                else:
                    back_to_home['scripts']['add_vps_user_script'] = (
                        '# RouterOS < 7.14: crea el peer Back To Home desde la app MikroTik\n'
                        '# e importa el perfil WireGuard en tu VPS para acceso remoto.\n'
                    )
    except Exception as exc:
        back_to_home['error'] = str(exc)

    guidance = {
        'back_to_home': [
            'Si, Back To Home puede funcionar aun con IP privadas porque usa relay/nube de MikroTik.',
            'Para uso desde VPS, RouterOS 7.14+ permite usuarios BTH y perfil WireGuard exportable.',
            'Para NOC masivo y menor latencia, preferir WireGuard site-to-site dedicado.',
        ],
        'notes': [
            'No expongas API/SSH sin ACL. Usa solo IPs de gestion o VPN privada.',
            'Para despliegues masivos: preferir WireGuard site-to-site entre POP y VPS.',
            'Registra cada cambio en auditoria antes de activar modo live.',
        ],
    }
    return jsonify({'success': True, 'router': router.to_dict(), 'scripts': scripts, 'guidance': guidance, 'back_to_home': back_to_home}), 200

@mikrotik_bp.route('/validate-config', methods=['POST'])
@admin_required()
def validate_config():
    """Validate client and plan configuration prior to provisioning"""
    try:
        data = request.get_json()
        client_id = data.get('client_id')
        router_id = data.get('router_id')
        plan_id = data.get('plan_id')
        issues = []

        client = db.session.get(Client, client_id) if client_id else None
        router = db.session.get(MikroTikRouter, router_id) if router_id else None
        plan = db.session.get(Plan, plan_id) if plan_id else (client.plan if client else None)

        if not client:
            issues.append('Client not found')
        if not router:
            issues.append('Router not found')
        if not plan:
            issues.append('Plan not found')

        if client and client.connection_type not in ['dhcp', 'pppoe', 'static']:
            issues.append('Invalid connection type')
        if client and client.connection_type in ['dhcp', 'static'] and not client.ip_address:
            issues.append('Missing client IP address for DHCP/Static')
        if client and client.connection_type == 'pppoe' and not (client.pppoe_username and client.pppoe_password):
            issues.append('Missing PPPoE credentials')

        ok = len(issues) == 0
        return jsonify({'success': ok, 'issues': issues}), (200 if ok else 400)
    except Exception as e:
        logger.error(f"Error validating config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/provision', methods=['POST'])
@admin_required()
def provision_client():
    """Provision a new client on MikroTik"""
    try:
        data = request.get_json()
        client_id = data.get('client_id')
        router_id = data.get('router_id')
        
        if not client_id or not router_id:
            return jsonify({'success': False, 'error': 'Missing client_id or router_id'}), 400
        
        client = db.session.get(Client, client_id)
        router = db.session.get(MikroTikRouter, router_id)
        
        if not client:
            return jsonify({'success': False, 'error': 'Client not found'}), 404
        if not router:
            return jsonify({'success': False, 'error': 'Router not found'}), 404
        
        with MikroTikService(router_id) as service:
            results = service.provision_client(client, client.plan, data.get('config', {}))
        
        if results.get('success'):
            client.status = 'active'
            db.session.commit()
        
        return jsonify(results), (200 if results.get('success') else 500)
    except Exception as e:
        logger.error(f"Error provisioning client: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/clients/<client_id>/suspend', methods=['POST'])
@admin_required()
def suspend_client(client_id):
    """Suspend client access"""
    try:
        data = request.get_json()
        reason = data.get('reason', 'non-payment')
        
        client = db.session.get(Client, client_id)
        if not client:
            return jsonify({'success': False, 'error': 'Client not found'}), 404
        
        if not client.router_id:
            return jsonify({'success': False, 'error': 'Client does not have an associated router'}), 400

        router = db.session.get(MikroTikRouter, client.router_id)
        if not router or not router.is_active:
            return jsonify({'success': False, 'error': 'No active router found for this client'}), 404
        
        with MikroTikService(router.id) as service:
            success = service.suspend_client(client, reason)
        
        if success:
            client.status = 'suspended'
            db.session.commit()
            return jsonify({'success': True, 'message': f'Client suspended: {reason}'}), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to suspend client'}), 500
    except Exception as e:
        logger.error(f"Error suspending client: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/clients/<client_id>/activate', methods=['POST'])
@admin_required()
def activate_client(client_id):
    """Activate suspended client"""
    try:
        client = db.session.get(Client, client_id)
        if not client:
            return jsonify({'success': False, 'error': 'Client not found'}), 404
        
        if not client.router_id:
            return jsonify({'success': False, 'error': 'Client does not have an associated router'}), 400

        router = db.session.get(MikroTikRouter, client.router_id)
        if not router or not router.is_active:
            return jsonify({'success': False, 'error': 'No active router found for this client'}), 404
        
        with MikroTikService(router.id) as service:
            success = service.activate_client(client)
        
        if success:
            client.status = 'active'
            db.session.commit()
            return jsonify({'success': True, 'message': 'Client activated'}), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to activate client'}), 500
    except Exception as e:
        logger.error(f"Error activating client: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/clients/<client_id>/update-speed', methods=['POST'])
@admin_required()
def update_client_speed(client_id):
    """Update client speed/plan"""
    try:
        data = request.get_json()
        plan_id = data.get('plan_id')
        
        client = db.session.get(Client, client_id)
        if not client:
            return jsonify({'success': False, 'error': 'Client not found'}), 404
        
        new_plan = db.session.get(Plan, plan_id)
        if not new_plan:
            return jsonify({'success': False, 'error': 'Plan not found'}), 404
        
        if not client.router_id:
            return jsonify({'success': False, 'error': 'Client does not have an associated router'}), 400

        router = db.session.get(MikroTikRouter, client.router_id)
        if not router or not router.is_active:
            return jsonify({'success': False, 'error': 'No active router found for this client'}), 404
        
        with MikroTikService(router.id) as service:
            success = service.update_client_speed(client, new_plan)
        
        if success:
            client.plan_id = plan_id
            db.session.commit()
            return jsonify({'success': True, 'message': f'Speed updated to {new_plan.name}'}), 200
        else:
            return jsonify({'success': False, 'error': 'Failed to update speed'}), 500
    except Exception as e:
        logger.error(f"Error updating client speed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/health', methods=['GET'])
@admin_required()
def get_router_health(router_id):
    """Get router health status"""
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            health = service.get_system_health()
        return jsonify({'success': True, 'health': health}), 200
    except Exception as e:
        logger.error(f"Error getting router health: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/queues', methods=['GET'])
@admin_required()
def get_router_queues(router_id):
    """Get router queue statistics"""
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            queues = service.get_queue_stats()
        return jsonify({'success': True, 'queues': queues}), 200
    except Exception as e:
        logger.error(f"Error getting router queues: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers/<router_id>/queues/toggle', methods=['POST'])
@admin_required()
def toggle_router_queue(router_id):
    data = request.get_json() or {}
    queue_id = str(data.get('id') or '').strip()
    disable = _as_bool(data.get('disable'), default=False)
    if not queue_id:
        return jsonify({'success': False, 'error': 'Queue id is required'}), 400

    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            success = service.toggle_queue_status(queue_id, disable)
        if not success:
            return jsonify({'success': False, 'error': 'Queue not found or update failed'}), 404
        return jsonify({'success': True, 'queue_id': queue_id, 'disabled': disable}), 200
    except Exception as e:
        logger.error(f"Error toggling queue status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers/<router_id>/queues/update-limit', methods=['PUT'])
@admin_required()
def update_router_queue_limit(router_id):
    data = request.get_json() or {}
    queue_id = str(data.get('id') or '').strip()
    download = str(data.get('download') or '').strip()
    upload = str(data.get('upload') or '').strip()
    if not queue_id or not download or not upload:
        return jsonify({'success': False, 'error': 'id, download and upload are required'}), 400

    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            success = service.update_queue_limit(queue_id, download, upload)
        if not success:
            return jsonify({'success': False, 'error': 'Queue not found or update failed'}), 404
        return jsonify({'success': True, 'queue_id': queue_id, 'max_limit': f'{upload}M/{download}M'}), 200
    except Exception as e:
        logger.error(f"Error updating queue limit: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers/<router_id>/queues/update-comment', methods=['PUT'])
@admin_required()
def update_router_queue_comment(router_id):
    data = request.get_json() or {}
    queue_id = str(data.get('id') or '').strip()
    comment = '' if data.get('comment') is None else str(data.get('comment'))
    if not queue_id:
        return jsonify({'success': False, 'error': 'Queue id is required'}), 400

    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            success = service.update_queue_comment(queue_id, comment)
        if not success:
            return jsonify({'success': False, 'error': 'Queue not found or update failed'}), 404
        return jsonify({'success': True, 'queue_id': queue_id, 'comment': comment}), 200
    except Exception as e:
        logger.error(f"Error updating queue comment: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers/<router_id>/queues', methods=['POST'])
@admin_required()
def create_router_queue(router_id):
    data = request.get_json() or {}
    name = str(data.get('name') or '').strip()
    target = str(data.get('target') or '').strip()
    download = str(data.get('download') or '').strip()
    upload = str(data.get('upload') or '').strip()
    if not name or not target or not download or not upload:
        return jsonify({'success': False, 'error': 'name, target, download and upload are required'}), 400

    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            result = service.create_simple_queue(name=name, target=target, download_speed=download, upload_speed=upload)
        if not result.get('success'):
            return jsonify({'success': False, 'error': result.get('error') or 'Queue creation failed'}), 400
        queue = _normalize_queue_item(result.get('queue') or {})
        return jsonify({'success': True, 'queue': queue}), 201
    except Exception as e:
        logger.error(f"Error creating queue: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers/<router_id>/queues', methods=['DELETE'])
@admin_required()
def delete_router_queue(router_id):
    data = request.get_json() or {}
    queue_id = str(data.get('id') or '').strip()
    if not queue_id:
        return jsonify({'success': False, 'error': 'Queue id is required'}), 400

    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            success = service.delete_queue(queue_id)
        if not success:
            return jsonify({'success': False, 'error': 'Queue not found or delete failed'}), 404
        return jsonify({'success': True, 'queue_id': queue_id}), 200
    except Exception as e:
        logger.error(f"Error deleting queue: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/connections', methods=['GET'])
@admin_required()
def get_router_connections(router_id):
    """Get active connections"""
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            connections = service.get_active_connections()
        return jsonify({'success': True, 'connections': connections}), 200
    except Exception as e:
        logger.error(f"Error getting connections: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/backup', methods=['POST'])
@admin_required()
def backup_router(router_id):
    """Backup router configuration"""
    try:
        data = request.get_json()
        backup_name = data.get('name')
        
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            result = service.backup_configuration(backup_name)
        return jsonify(result), 200 if result.get('success') else 500
    except Exception as e:
        logger.error(f"Error backing up router: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/test-connection', methods=['GET'])
@admin_required()
def test_connection(router_id):
    """Test connectivity to specified router"""
    try:
        router = db.session.get(MikroTikRouter, router_id)
        if not router:
            return jsonify({'success': False, 'error': 'Router not found'}), 404
        ok = _test_router_connection(router)
        return jsonify({'success': ok}), (200 if ok else 502)
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/reboot', methods=['POST'])
@admin_required()
def reboot_router(router_id):
    """Reboot MikroTik router"""
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            success = service.reboot_router()
        return jsonify({'success': success}), 200 if success else 500
    except Exception as e:
        logger.error(f"Error rebooting router: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/execute-script', methods=['POST'])
@admin_required()
def execute_script(router_id):
    """Execute script on router"""
    try:
        data = request.get_json()
        script_content = data.get('script')
        
        if not script_content:
            return jsonify({'success': False, 'error': 'No script provided'}), 400
        
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            result = service.execute_script(script_content)
        return jsonify(result), (200 if result.get('success') else 500)
    except Exception as e:
        logger.error(f"Error executing script: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/hotspot', methods=['POST'])
@admin_required()
def configure_hotspot(router_id):
    """Configure hotspot on router"""
    try:
        data = request.get_json()
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            success = service.configure_hotspot(data)
        return jsonify({'success': success}), 200 if success else 500
    except Exception as e:
        logger.error(f"Error configuring hotspot: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/multi-wan', methods=['POST'])
@admin_required()
def configure_multi_wan(router_id):
    """Configure multi-WAN on router"""
    try:
        data = request.get_json()
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            success = service.configure_multi_wan(data)
        return jsonify({'success': success}), 200 if success else 500
    except Exception as e:
        logger.error(f"Error configuring multi-WAN: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/wireless/clients', methods=['GET'])
@admin_required()
def get_wireless_clients(router_id):
    """List wireless registration-table clients"""
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            reg = service.api.get_resource('/interface/wireless/registration-table')
            clients = reg.get()
        # Normalize boolean strings
        for c in clients:
            if 'authenticated' in c:
                c['authenticated'] = (c.get('authenticated') == 'true')
        return jsonify({'success': True, 'clients': clients}), 200
    except Exception as e:
        logger.error(f"Error getting wireless clients: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/dhcp/leases', methods=['GET'])
@admin_required()
def get_dhcp_leases(router_id):
    """List DHCP leases"""
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            dhcp_api = service.api.get_resource('/ip/dhcp-server/lease')
            leases = dhcp_api.get()
        return jsonify({'success': True, 'leases': leases}), 200
    except Exception as e:
        logger.error(f"Error getting DHCP leases: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/interfaces/<interface_name>/toggle', methods=['POST'])
@admin_required()
def toggle_interface(router_id, interface_name):
    """Enable/disable an interface"""
    try:
        data = request.get_json() or {}
        enabled = data.get('enabled')
        if enabled is None:
            return jsonify({'success': False, 'error': 'Missing enabled flag'}), 400
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            iface_api = service.api.get_resource('/interface')
            matches = iface_api.get(name=interface_name)
            if not matches:
                return jsonify({'success': False, 'error': 'Interface not found'}), 404
            iface_id = matches[0].get('.id') or matches[0].get('id')
            iface_api.set(id=iface_id, disabled='no' if enabled else 'yes')
        return jsonify({'success': True, 'interface': interface_name, 'enabled': bool(enabled)}), 200
    except Exception as e:
        logger.error(f"Error toggling interface: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/ping', methods=['POST'])
@admin_required()
def ping_host(router_id):
    """Run ping from router to target host"""
    try:
        data = request.get_json() or {}
        target = data.get('target')
        count = int(data.get('count', 4))
        if not target:
            return jsonify({'success': False, 'error': 'Missing target'}), 400
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            ping_api = service.api.get_resource('/tool/ping')
            # Some API clients require call, others support get with params
            try:
                result = ping_api.call('ping', {'address': target, 'count': str(count)})
            except Exception:
                result = ping_api.get(address=target, count=str(count))
        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        logger.error(f"Error running ping: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/logs', methods=['GET'])
@admin_required()
def get_logs(router_id):
    """Fetch router logs with optional topic and limit"""
    try:
        topic = request.args.get('topic')
        limit = request.args.get('limit', 100, type=int)

        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            
            logs = service.get_logs(topic=topic, limit=limit)

        return jsonify({'success': True, 'logs': logs}), 200
    except Exception as e:
        logger.error(f"Error fetching logs for router {router_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<int:router_id>/ai-diagnose', methods=['GET'])
@admin_required()
def get_ai_diagnosis(router_id):
    """Get an AI-powered network diagnosis for a specific router."""
    try:
        # Verificar que el router existe
        router = db.session.get(MikroTikRouter, router_id)
        if not router:
            return jsonify({'success': False, 'error': 'Router not found'}), 404

        # Instanciar y ejecutar el servicio de diagnostico
        ai_service = AIDiagnosticService(router_id=router_id)
        diagnosis_result = ai_service.run_diagnosis()

        if "error" in diagnosis_result:
            return jsonify({'success': False, 'error': diagnosis_result['error']}), 500

        return jsonify({'success': True, 'diagnosis': diagnosis_result}), 200

    except ValueError as ve:
        logger.warning(f"Value error during AI diagnosis for router {router_id}: {ve}")
        return jsonify({'success': False, 'error': str(ve)}), 404
    except Exception as e:
        logger.error(f"Error getting AI diagnosis for router {router_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@mikrotik_bp.route('/routers/<router_id>/resources', methods=['GET'])
@admin_required()
def get_resources(router_id):
    """Get system resource info (identity, model, memory, cpu, etc.)"""
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            info = service.get_router_info()
        return jsonify({'success': True, 'info': info}), 200
    except Exception as e:
        logger.error(f"Error getting resources: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Disabled: discovery service not implemented
# @mikrotik_bp.route('/discover', methods=['GET'])
# @jwt_required()
# def discover_routers():
#     """Discover MikroTik routers in network"""
#     try:
#         from app.services.autoprovision_service import AutoProvisionService
#         service = AutoProvisionService()
#         routers = service.discover_mikrotik_network()
#         
#         return jsonify({
#             'success': True,
#             'routers': routers,
#             'count': len(routers)
#         }), 200
#     except Exception as e:
#         logger.error(f"Error discovering routers: {e}")
#         return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/advanced/provision', methods=['POST'])
@admin_required()
def advanced_provision():
    """Advanced provisioning with v6/v7 support"""
    try:
        data = request.get_json()
        router_id = data.get('router_id')
        client_id = data.get('client_id')
        
        if not router_id or not client_id:
            return jsonify({'success': False, 'error': 'Missing router_id or client_id'}), 400
        
        router = db.session.get(MikroTikRouter, router_id)
        client = db.session.get(Client, client_id)
        
        if not router:
            return jsonify({'success': False, 'error': 'Router not found'}), 404
        if not client:
            return jsonify({'success': False, 'error': 'Client not found'}), 404
        
        # Use advanced service
        with MikroTikAdvancedService(router.id) as service:
            results = service.provision_client(client, client.plan)
        
        if results.get('success'):
            client.status = 'active'
            db.session.commit()
        
        return jsonify(results), (200 if results.get('success') else 500)
    except Exception as e:
        logger.error(f"Error in advanced provisioning: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<int:router_id>/metrics', methods=['GET'])
@admin_required()
def get_router_metrics(router_id):
    """
    Get historical metrics for a specific router from InfluxDB.
    Query params:
    - measurement: The name of the measurement (e.g., 'system_resources', 'interface_traffic'). Required.
    - range: The time range to query (e.g., '-1h', '-6h', '-24h'). Defaults to '-1h'.
    - interface: The name of the interface to filter by (for 'interface_traffic' measurement).
    """
    try:
        # Check if router exists
        router = db.session.get(MikroTikRouter, router_id)
        if not router:
            return jsonify({'success': False, 'error': 'Router not found'}), 404

        # Get and validate query parameters
        measurement = request.args.get('measurement')
        if not measurement:
            return jsonify({'success': False, 'error': 'Query parameter "measurement" is required.'}), 400
        
        time_range = request.args.get('range', '-1h')
        interface_name = request.args.get('interface')

        # Build tags for the query
        tags = {'router_id': str(router_id)}
        if interface_name and measurement == 'interface_traffic':
            tags['interface_name'] = interface_name
        
        # Query InfluxDB
        metrics_data = monitoring_service.query_metrics(
            measurement=measurement,
            time_range=time_range,
            tags=tags
        )

        return jsonify({'success': True, 'metrics': metrics_data}), 200

    except Exception as e:
        logger.error(f"Error getting historical metrics for router {router_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'An internal error occurred while fetching metrics.'}), 500

@mikrotik_bp.route('/routers/<router_id>/enterprise/snapshot', methods=['GET'])
@admin_required()
def get_enterprise_snapshot(router_id):
    """
    Enterprise snapshot for NOC/SRE use cases.
    Returns a consolidated health, security and capacity report.
    """
    try:
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500

            router_info = service.get_router_info()
            health = service.get_system_health()
            interfaces = service.get_interface_stats()
            queues = service.get_queue_stats()
            connections = service.get_active_connections()
            filter_rules = service.get_firewall_rules()
            nat_rules = service.get_nat_rules()
            mangle_rules = service.get_mangle_rules()
            recent_logs = service.get_logs(limit=40)

            ip_services: List[Dict[str, Any]] = []
            try:
                ip_service_api = service.api.get_resource('/ip/service')
                for item in ip_service_api.get():
                    ip_services.append({
                        'name': item.get('name', 'unknown'),
                        'port': str(item.get('port', '')),
                        'disabled': str(item.get('disabled', 'false')).lower() == 'true',
                        'address': item.get('address', ''),
                        'certificate': item.get('certificate', '')
                    })
            except Exception as service_error:
                logger.warning(f"Could not get /ip/service for router {router_id}: {service_error}")

            dhcp_summary = {'total': 0, 'bound': 0, 'waiting': 0}
            try:
                leases = service.api.get_resource('/ip/dhcp-server/lease').get()
                dhcp_summary['total'] = len(leases)
                for lease in leases:
                    status = str(lease.get('status', '')).lower()
                    if status == 'bound':
                        dhcp_summary['bound'] += 1
                    if status in ('waiting', 'offered'):
                        dhcp_summary['waiting'] += 1
            except Exception as dhcp_error:
                logger.warning(f"Could not get DHCP leases for router {router_id}: {dhcp_error}")

            ppp_summary = {'active': 0}
            try:
                ppp_active = service.api.get_resource('/ppp/active').get()
                ppp_summary['active'] = len(ppp_active)
            except Exception as ppp_error:
                logger.warning(f"Could not get PPP active sessions for router {router_id}: {ppp_error}")

            scheduler_summary = {'total': 0, 'backup_jobs': 0}
            try:
                schedulers = service.api.get_resource('/system/scheduler').get()
                scheduler_summary['total'] = len(schedulers)
                scheduler_summary['backup_jobs'] = len([
                    s for s in schedulers
                    if 'backup' in str(s.get('name', '')).lower() or 'backup' in str(s.get('on-event', '')).lower()
                ])
            except Exception as scheduler_error:
                logger.warning(f"Could not get scheduler data for router {router_id}: {scheduler_error}")

        enriched_interfaces = []
        for item in interfaces:
            rx = _to_int(item.get('rx_bytes'))
            tx = _to_int(item.get('tx_bytes'))
            enriched_interfaces.append({
                'name': item.get('name', 'unknown'),
                'type': item.get('type', 'unknown'),
                'running': bool(item.get('running')),
                'rx_bytes': rx,
                'tx_bytes': tx,
                'traffic_bytes': rx + tx
            })
        top_interfaces = sorted(enriched_interfaces, key=lambda x: x['traffic_bytes'], reverse=True)[:8]
        interface_summary = {
            'total': len(enriched_interfaces),
            'running': len([i for i in enriched_interfaces if i.get('running')]),
            'down': len([i for i in enriched_interfaces if not i.get('running')])
        }

        busy_queues = []
        for queue in queues:
            rate = str(queue.get('rate', '')).strip().lower()
            is_disabled = bool(queue.get('disabled'))
            if is_disabled:
                continue
            if rate and rate not in ('0', '0/0', '0/0bps', '0bps/0bps'):
                busy_queues.append(queue)

        queue_summary = {
            'total': len(queues),
            'active': len([q for q in queues if not q.get('disabled')]),
            'disabled': len([q for q in queues if q.get('disabled')]),
            'busy': len(busy_queues)
        }

        connection_summary = {
            'total': len(connections),
            'dhcp': len([c for c in connections if c.get('type') == 'dhcp']),
            'pppoe': len([c for c in connections if c.get('type') == 'pppoe'])
        }

        firewall_summary = {
            'filter_total': len(filter_rules),
            'filter_disabled': len([r for r in filter_rules if str(r.get('disabled', 'false')).lower() == 'true']),
            'nat_total': len(nat_rules),
            'nat_disabled': len([r for r in nat_rules if str(r.get('disabled', 'false')).lower() == 'true']),
            'mangle_total': len(mangle_rules),
            'mangle_disabled': len([r for r in mangle_rules if str(r.get('disabled', 'false')).lower() == 'true'])
        }

        insecure_service_names = {'telnet', 'ftp', 'www', 'api', 'api-ssl'}
        insecure_services = [
            svc.get('name')
            for svc in ip_services
            if svc.get('name') in insecure_service_names and not svc.get('disabled')
        ]

        health_score = _to_int((health or {}).get('health_score'), 0)
        recommendations: List[str] = []
        if health_score < 85:
            recommendations.append('El health score esta por debajo de 85. Revisar CPU, memoria e interfaces.')
        if interface_summary['down'] > 0:
            recommendations.append(f'Hay {interface_summary["down"]} interfaces caidas. Validar enlaces criticos.')
        if len(insecure_services) > 0:
            recommendations.append('Se detectaron servicios de gestion inseguros habilitados. Aplicar hardening.')
        if scheduler_summary['backup_jobs'] == 0:
            recommendations.append('No hay tareas de backup automaticas detectadas en /system scheduler.')
        if dhcp_summary['waiting'] > 20:
            recommendations.append('Hay muchas leases DHCP en estado waiting/offered. Revisar pool y conflictos.')
        if queue_summary['busy'] > 30:
            recommendations.append('Numero alto de colas ocupadas. Considerar optimizacion de QoS/PCQ.')

        normalized_logs = [
            {
                'time': entry.get('time', ''),
                'topics': entry.get('topics', ''),
                'message': entry.get('message', '')
            }
            for entry in recent_logs[:20]
        ]

        snapshot = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'router': router_info,
            'health_score': health_score,
            'issues': (health or {}).get('issues', []),
            'interface_summary': interface_summary,
            'queue_summary': queue_summary,
            'connection_summary': connection_summary,
            'firewall_summary': firewall_summary,
            'dhcp_summary': dhcp_summary,
            'ppp_summary': ppp_summary,
            'scheduler_summary': scheduler_summary,
            'insecure_services': insecure_services,
            'services': ip_services,
            'top_interfaces': top_interfaces,
            'recent_logs': normalized_logs,
            'recommendations': recommendations
        }
        return jsonify({'success': True, 'snapshot': snapshot}), 200
    except Exception as e:
        logger.error(f"Error getting enterprise snapshot for router {router_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/enterprise/hardening', methods=['POST'])
@admin_required()
def apply_enterprise_hardening(router_id):
    """
    Apply security hardening runbook to router management services.
    """
    try:
        data = request.get_json() or {}
        dry_run = _as_bool(data.get('dry_run'), default=True)
        profile = str(data.get('profile', 'baseline')).strip().lower()
        if profile not in ('baseline', 'strict', 'hardened'):
            profile = 'baseline'
        site_profile = str(data.get('site_profile', 'access')).strip().lower()
        if site_profile not in ('core', 'distribution', 'access', 'hotspot'):
            site_profile = 'access'
        auto_rollback = _as_bool(data.get('auto_rollback'), default=True)

        runbook = _build_hardening_runbook(profile, site_profile)
        commands = runbook['commands']
        rollback_commands = runbook['rollback_commands']
        actor = _resolve_actor_identity()
        dry_status = 'dry-run'

        if dry_run:
            change = _register_change(
                router_id=router_id,
                actor=actor,
                category='hardening',
                profile=profile,
                site_profile=site_profile,
                commands=commands,
                rollback_commands=rollback_commands,
                status=dry_status,
                metadata={'auto_rollback': auto_rollback}
            )
            return jsonify({
                'success': True,
                'dry_run': True,
                'profile': profile,
                'site_profile': site_profile,
                'commands': commands,
                'rollback_commands': rollback_commands,
                'change_id': change['change_id'],
                'message': 'Dry-run generado. No se aplicaron cambios.'
            }), 200

        change = _register_change(
            router_id=router_id,
            actor=actor,
            category='hardening',
            profile=profile,
            site_profile=site_profile,
            commands=commands,
            rollback_commands=rollback_commands,
            status='in-progress',
            metadata={'auto_rollback': auto_rollback}
        )

        rollback_result = None
        with MikroTikService(router_id) as service:
            if not service.api:
                change['status'] = 'failed'
                change['metadata']['error'] = 'Could not connect to router'
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            result = service.execute_script('\n'.join(commands))
            success = bool(result.get('success'))
            if success:
                change['status'] = 'applied'
            else:
                change['status'] = 'failed'
                change['metadata']['error'] = result.get('error')
                if auto_rollback:
                    rollback_result = service.execute_script('\n'.join(rollback_commands))
                    rollback_ok = bool(rollback_result.get('success'))
                    change['status'] = 'rolled-back' if rollback_ok else 'rollback-failed'
                    change['metadata']['rollback_result'] = rollback_result

        return jsonify({
            'success': success,
            'dry_run': False,
            'profile': profile,
            'site_profile': site_profile,
            'commands': commands,
            'rollback_commands': rollback_commands,
            'change_id': change['change_id'],
            'result': result.get('result', ''),
            'error': result.get('error'),
            'rollback_result': rollback_result,
            'message': 'Hardening aplicado correctamente.' if success else 'No se pudo aplicar hardening.'
        }), (200 if success else 500)
    except Exception as e:
        logger.error(f"Error applying hardening for router {router_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/enterprise/hardening/profiles', methods=['GET'])
@admin_required()
def get_hardening_profiles(router_id):
    """
    Return available hardening profiles by router/site role.
    """
    try:
        profiles = {
            'router_profiles': [
                {'id': 'baseline', 'label': 'Baseline', 'description': 'Desactiva servicios inseguros de gestion.'},
                {'id': 'strict', 'label': 'Strict', 'description': 'Baseline + cifrado fuerte y aislamiento de descubrimiento.'},
                {'id': 'hardened', 'label': 'Hardened', 'description': 'Perfil reforzado para produccion critica.'}
            ],
            'site_profiles': [
                {'id': 'core', 'label': 'Core', 'description': 'Nucleo de red con mayor control de proteccion.'},
                {'id': 'distribution', 'label': 'Distribution', 'description': 'Enlaces de distribucion con politica de ICMP controlada.'},
                {'id': 'access', 'label': 'Access', 'description': 'Nodos de acceso para clientes finales.'},
                {'id': 'hotspot', 'label': 'Hotspot', 'description': 'Portal cautivo y control de trafico de acceso publico.'}
            ]
        }
        return jsonify({'success': True, 'profiles': profiles, 'router_id': str(router_id)}), 200
    except Exception as e:
        logger.error(f"Error getting hardening profiles for router {router_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/enterprise/change-log', methods=['GET'])
@admin_required()
def get_enterprise_change_log(router_id):
    """
    Get enterprise change log for a router.
    """
    try:
        limit = max(1, min(200, _to_int(request.args.get('limit', 50), 50)))
        status_filter = str(request.args.get('status', '')).strip().lower()
        data = list(_get_change_log(router_id))
        if status_filter:
            data = [item for item in data if str(item.get('status', '')).lower() == status_filter]
        return jsonify({'success': True, 'changes': data[:limit]}), 200
    except Exception as e:
        logger.error(f"Error getting change-log for router {router_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/enterprise/rollback/<change_id>', methods=['POST'])
@admin_required()
def rollback_enterprise_change(router_id, change_id):
    """
    Rollback a previously registered enterprise change.
    """
    try:
        entry = ENTERPRISE_CHANGE_INDEX.get(change_id)
        if not entry or str(entry.get('router_id')) != str(router_id):
            return jsonify({'success': False, 'error': 'Change not found for this router'}), 404

        rollback_commands = entry.get('rollback_commands') or []
        if not rollback_commands:
            return jsonify({'success': False, 'error': 'Rollback commands not available for this change'}), 400

        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500
            result = service.execute_script('\n'.join(rollback_commands))

        ok = bool(result.get('success'))
        entry['status'] = 'rolled-back' if ok else 'rollback-failed'
        entry['rolled_back_at'] = datetime.utcnow().isoformat() + 'Z'
        entry['rolled_back_by'] = _resolve_actor_identity()
        entry['metadata'] = entry.get('metadata', {})
        entry['metadata']['manual_rollback_result'] = result

        return jsonify({
            'success': ok,
            'change_id': change_id,
            'status': entry['status'],
            'result': result.get('result', ''),
            'error': result.get('error')
        }), (200 if ok else 500)
    except Exception as e:
        logger.error(f"Error rolling back change {change_id} for router {router_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@mikrotik_bp.route('/routers/<router_id>/enterprise/failover-test', methods=['POST'])
@admin_required()
def run_enterprise_failover_test(router_id):
    """
    Execute failover test by pinging multiple targets from the router.
    """
    try:
        data = request.get_json() or {}
        raw_targets = data.get('targets') or ['1.1.1.1', '8.8.8.8', '9.9.9.9']
        if not isinstance(raw_targets, list):
            raw_targets = [str(raw_targets)]
        targets = [str(t).strip() for t in raw_targets if str(t).strip()][:8]
        if len(targets) == 0:
            return jsonify({'success': False, 'error': 'No valid targets provided'}), 400

        count = max(1, min(20, _to_int(data.get('count', 4), 4)))

        probe_results: List[Dict[str, Any]] = []
        with MikroTikService(router_id) as service:
            if not service.api:
                return jsonify({'success': False, 'error': 'Could not connect to router'}), 500

            ping_api = service.api.get_resource('/tool/ping')
            for target in targets:
                try:
                    try:
                        result = ping_api.call('ping', {'address': target, 'count': str(count)})
                    except Exception:
                        result = ping_api.get(address=target, count=str(count))

                    if not isinstance(result, list):
                        result = [result]

                    success_probes = 0
                    latency_values: List[float] = []
                    for row in result:
                        row_text = str(row.get('status', '') or row.get('time', '')).lower()
                        timeout = 'timeout' in row_text
                        if not timeout:
                            success_probes += 1
                        latency_ms = _parse_router_latency_ms(row.get('time'))
                        if latency_ms is not None:
                            latency_values.append(latency_ms)

                    packet_loss = round(((count - success_probes) / float(count)) * 100, 2)
                    avg_latency = round(sum(latency_values) / len(latency_values), 2) if latency_values else None
                    status = 'ok' if packet_loss <= 20 else ('warning' if packet_loss <= 50 else 'critical')

                    probe_results.append({
                        'target': target,
                        'total_probes': count,
                        'success_probes': success_probes,
                        'packet_loss': packet_loss,
                        'avg_latency_ms': avg_latency,
                        'status': status
                    })
                except Exception as probe_error:
                    probe_results.append({
                        'target': target,
                        'total_probes': count,
                        'success_probes': 0,
                        'packet_loss': 100,
                        'avg_latency_ms': None,
                        'status': 'critical',
                        'error': str(probe_error)
                    })

        critical_count = len([r for r in probe_results if r.get('status') == 'critical'])
        warning_count = len([r for r in probe_results if r.get('status') == 'warning'])
        overall_status = 'ok'
        if critical_count > 0:
            overall_status = 'critical'
        elif warning_count > 0:
            overall_status = 'warning'

        return jsonify({
            'success': True,
            'report': {
                'generated_at': datetime.utcnow().isoformat() + 'Z',
                'overall_status': overall_status,
                'targets': probe_results
            }
        }), 200
    except Exception as e:
        logger.error(f"Error running failover test for router {router_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500
