"""
OLT enterprise API endpoints (ZTE, Huawei, VSOL)
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.models import User, AuditLog
from app.routes.main_routes import admin_required
from app.services.olt_script_service import OLTScriptService
from app.tenancy import current_tenant_id

olt_bp = Blueprint("olt", __name__)

# Plantillas de servicio por vendor (demo)
SERVICE_TEMPLATES = {
    "zte": [
        {"id": "zte-line-100m", "label": "ZTE 100M", "line_profile": "LINE-100M", "srv_profile": "SRV-INTERNET"},
        {"id": "zte-line-200m", "label": "ZTE 200M", "line_profile": "LINE-200M", "srv_profile": "SRV-INTERNET"},
    ],
    "huawei": [
        {"id": "hw-100m", "label": "Huawei 100M", "line_profile": "line-profile_100M", "srv_profile": "srv-profile_internet"},
        {"id": "hw-300m", "label": "Huawei 300M", "line_profile": "line-profile_300M", "srv_profile": "srv-profile_internet"},
    ],
    "vsol": [
        {"id": "vsol-50m", "label": "VSOL 50M", "line_profile": "VSOL50M", "srv_profile": "Internet"},
        {"id": "vsol-100m", "label": "VSOL 100M", "line_profile": "VSOL100M", "srv_profile": "Internet"},
    ],
}


def _as_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "y", "on")


def _resolve_actor_identity():
    current_identity = get_jwt_identity()
    if current_identity is None:
        return "system"
    try:
        user = User.query.get(current_identity)
    except Exception:
        user = None
    if user:
        return user.email or f"user:{user.id}"
    return f"user:{current_identity}"


def _audit(action: str, entity_type: str = None, entity_id: str = None, metadata=None):
    try:
        tenant_id = current_tenant_id()
        user_id = get_jwt_identity()
        log = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata=metadata,
            ip_address=getattr(request, "remote_addr", None),
        )
        from app import db

        db.session.add(log)
        db.session.commit()
    except Exception:
        # avoid breaking flow because of audit failure
        pass


@olt_bp.route("/vendors", methods=["GET"])
@admin_required()
def list_vendors():
    service = OLTScriptService()
    return jsonify({"success": True, "vendors": service.list_vendors()}), 200


@olt_bp.route("/service-templates", methods=["GET"])
@admin_required()
def service_templates():
    vendor = (request.args.get("vendor") or "").strip().lower()
    if vendor and vendor in SERVICE_TEMPLATES:
        return jsonify({"success": True, "vendor": vendor, "templates": SERVICE_TEMPLATES[vendor]}), 200
    return jsonify({"success": True, "templates": SERVICE_TEMPLATES}), 200


@olt_bp.route("/devices", methods=["GET"])
@admin_required()
def list_devices():
    vendor = request.args.get("vendor")
    service = OLTScriptService()
    return jsonify({"success": True, "devices": service.list_devices(vendor=vendor)}), 200


@olt_bp.route("/devices/<device_id>/snapshot", methods=["GET"])
@admin_required()
def get_snapshot(device_id):
    service = OLTScriptService()
    result = service.get_snapshot(device_id)
    _audit("olt_snapshot", entity_type="olt", entity_id=device_id, metadata={"success": result.get("success")})
    return jsonify(result), (200 if result.get("success") else 404)


@olt_bp.route("/devices/test-connection", methods=["POST"])
@admin_required()
def test_connection():
    data = request.get_json() or {}
    device_id = str(data.get("device_id", "")).strip()
    if not device_id:
        return jsonify({"success": False, "error": "device_id is required"}), 400
    timeout = float(data.get("timeout", 2.5) or 2.5)
    timeout = max(0.5, min(timeout, 10.0))

    service = OLTScriptService()
    result = service.test_connection(device_id=device_id, timeout_seconds=timeout)
    _audit("olt_test_connection", entity_type="olt", entity_id=device_id, metadata={"success": result.get("success"), "latency_ms": result.get("latency_ms")})
    return jsonify(result), (200 if result.get("success") else 502)


@olt_bp.route("/devices/<device_id>/script/generate", methods=["POST"])
@admin_required()
def generate_script(device_id):
    data = request.get_json() or {}
    action = str(data.get("action", "")).strip().lower()
    if not action:
        return jsonify({"success": False, "error": "action is required"}), 400
    payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}

    service = OLTScriptService()
    result = service.generate_script(device_id=device_id, action=action, payload=payload)
    _audit("olt_generate_script", entity_type="olt", entity_id=device_id, metadata={"action": action, "success": result.get("success")})
    return jsonify(result), (200 if result.get("success") else 400)


@olt_bp.route("/devices/<device_id>/script/execute", methods=["POST"])
@admin_required()
def execute_script(device_id):
    data = request.get_json() or {}
    commands = data.get("commands")
    if not isinstance(commands, list):
        return jsonify({"success": False, "error": "commands must be an array"}), 400
    run_mode = str(data.get("run_mode", "simulate")).strip().lower()
    if run_mode == "live" and not _as_bool(data.get("live_confirm")):
        return (
            jsonify(
                {
                    "success": False,
                    "error": "live_confirm is required for live mode",
                }
            ),
            400,
        )

    service = OLTScriptService()
    result = service.execute_script(
        device_id=device_id,
        commands=commands,
        run_mode=run_mode,
        actor=_resolve_actor_identity(),
        source_ip=request.remote_addr,
    )
    _audit("olt_execute_script", entity_type="olt", entity_id=device_id, metadata={"run_mode": run_mode, "success": result.get("success"), "commands": len(commands)})
    if result.get("success"):
        return jsonify(result), 200
    return jsonify(result), (502 if run_mode == "live" else 400)


@olt_bp.route("/audit-log", methods=["GET"])
@admin_required()
def get_audit_log():
    try:
        limit = int(request.args.get("limit", 50) or 50)
    except Exception:
        limit = 50
    limit = max(1, min(200, limit))
    service = OLTScriptService()
    return jsonify({"success": True, "entries": service.list_audit_log(limit=limit)}), 200


@olt_bp.route("/devices/<device_id>/quick-connect-script", methods=["POST"])
@admin_required()
def quick_connect_script(device_id):
    data = request.get_json() or {}
    action = str(data.get("action", "show_pon_summary")).strip().lower()
    payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}
    platform = str(data.get("platform", "windows")).strip().lower()
    if platform not in ("windows", "linux"):
        platform = "windows"

    service = OLTScriptService()
    generated = service.generate_script(device_id=device_id, action=action, payload=payload)
    if not generated.get("success"):
        return jsonify(generated), 400

    quick = generated.get("quick_connect", {})
    script = quick.get(platform) or quick.get("windows") or ""
    return jsonify(
        {
            "success": True,
            "device": generated.get("device"),
            "action": action,
            "platform": platform,
            "script": script,
            "commands": generated.get("commands", []),
        }
    ), 200


@olt_bp.route("/devices/<device_id>/autofind-onu", methods=["GET"])
@admin_required()
def autofind_onu(device_id):
    """
    Simula descubrimiento de ONU para aprobación.
    """
    sample = [
        {"serial": "ZTEG00000001", "vendor": "zte", "signal": -18.2, "rx_power": -19.5},
        {"serial": "48575443ABCDEF01", "vendor": "huawei", "signal": -20.0, "rx_power": -21.3},
        {"serial": "VSOL00000001", "vendor": "vsol", "signal": -17.5, "rx_power": -18.7},
    ]
    _audit("olt_autofind_onu", entity_type="olt", entity_id=device_id, metadata={"count": len(sample)})
    return jsonify({"success": True, "device_id": device_id, "pending_onu": sample}), 200


@olt_bp.route("/devices/<device_id>/authorize-onu", methods=["POST"])
@admin_required()
def authorize_onu(device_id):
    data = request.get_json() or {}
    serial = str(data.get("serial") or "").strip()
    vlan = int(data.get("vlan") or 120)
    profile = data.get("profile") or "LINE-100M"
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400
    _audit("olt_authorize_onu", entity_type="onu", entity_id=serial, metadata={"device_id": device_id, "vlan": vlan})
    return jsonify({"success": True, "device_id": device_id, "serial": serial, "vlan": vlan, "profile": profile, "message": "ONU autorizada (demo)"}), 200


@olt_bp.route("/devices/<device_id>/pon-power", methods=["GET"])
@admin_required()
def pon_power(device_id):
    """Monitorea potencia óptica por ONU (demo)."""
    sample = [
        {"serial": "ZTEG00000001", "rx_dbm": -19.2, "olt_port": "1/1/1", "status": "ok"},
        {"serial": "48575443ABCDEF01", "rx_dbm": -23.4, "olt_port": "1/1/2", "status": "low"},
        {"serial": "VSOL00000001", "rx_dbm": -16.8, "olt_port": "1/1/3", "status": "ok"},
    ]
    _audit("olt_pon_power", entity_type="olt", entity_id=device_id, metadata={"count": len(sample)})
    return jsonify({"success": True, "device_id": device_id, "onus": sample, "thresholds": {"low": -23, "critical": -27}}), 200


@olt_bp.route("/devices/<device_id>/onu/suspend", methods=["POST"])
@admin_required()
def suspend_onu(device_id):
    data = request.get_json() or {}
    serial = str(data.get("serial") or "").strip()
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400
    _audit("olt_suspend_onu", entity_type="onu", entity_id=serial, metadata={"device_id": device_id})
    return jsonify({"success": True, "device_id": device_id, "serial": serial, "message": "ONU suspendida (demo)"}), 200


@olt_bp.route("/devices/<device_id>/onu/activate", methods=["POST"])
@admin_required()
def activate_onu(device_id):
    data = request.get_json() or {}
    serial = str(data.get("serial") or "").strip()
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400
    _audit("olt_activate_onu", entity_type="onu", entity_id=serial, metadata={"device_id": device_id})
    return jsonify({"success": True, "device_id": device_id, "serial": serial, "message": "ONU reactivada (demo)"}), 200


@olt_bp.route("/devices/<device_id>/onu/reboot", methods=["POST"])
@admin_required()
def reboot_onu(device_id):
    data = request.get_json() or {}
    serial = str(data.get("serial") or "").strip()
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400
    _audit("olt_reboot_onu", entity_type="onu", entity_id=serial, metadata={"device_id": device_id})
    return jsonify({"success": True, "device_id": device_id, "serial": serial, "message": "ONU reiniciada (demo)"}), 200


@olt_bp.route("/devices/<device_id>/tr069/reprovision", methods=["POST"])
@admin_required()
def tr069_reprovision(device_id):
    data = request.get_json() or {}
    host = data.get("host") or "acs.demo.local"
    ssid = data.get("ssid") or "ISPFAST_WIFI"
    key = data.get("key") or "ClaveFuerte2026"
    _audit("olt_tr069_reprovision", entity_type="olt", entity_id=device_id, metadata={"acs": host})
    return jsonify({"success": True, "device_id": device_id, "acs": host, "ssid": ssid, "key": key, "message": "TR-069 reprovision enviado (demo)"}), 200


@olt_bp.route("/devices/<device_id>/quick-login", methods=["GET"])
@admin_required()
def quick_login(device_id):
    """
    Devuelve un comando de conexion rapida (ssh/telnet) para Windows/Linux.
    """
    platform = str(request.args.get("platform", "windows")).strip().lower()
    if platform not in ("windows", "linux"):
        platform = "windows"
    service = OLTScriptService()
    try:
        connect = service.quick_login_command(device_id=device_id, platform=platform)
        return jsonify({"success": True, "platform": platform, "command": connect}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 404


@olt_bp.route("/tr064/test", methods=["POST"])
@admin_required()
def tr064_test():
    """
    Prueba de conectividad TR-064/ACS (demo). En produccion se debe reemplazar por llamado real.
    """
    data = request.get_json() or {}
    host = str(data.get("host", "")).strip()
    if not host:
        return jsonify({"success": False, "message": "Host requerido"}), 400
    port = int(data.get("port") or 7547)
    vendor = (data.get("vendor") or "huawei").lower()
    # Demo: siempre responde OK con latencia simulada
    return jsonify({"success": True, "message": f"TR-064 OK ({vendor}) {host}:{port}", "latency_ms": 12}), 200
