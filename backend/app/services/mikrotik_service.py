"""
MikroTik Management Service
Handles all MikroTik router operations for ISPMAX
"""
import routeros_api
from typing import Dict, List, Optional, Any, Tuple
import logging
import ipaddress
import re
from datetime import datetime, timedelta
from app.models import Client, Plan, MikroTikRouter
from app import db, cache
import json

logger = logging.getLogger(__name__)

class MikroTikService:
    """Main MikroTik service for ISPMAX"""
    
    def __init__(self, router_id: str = None):
        self.router = None
        self.api = None
        if router_id:
            self.connect_to_router(router_id)
    
    def connect_to_router(self, router_id: str) -> bool:
        """Connect to specific router by ID"""
        try:
            self.router = MikroTikRouter.query.get(router_id)
            if not self.router:
                logger.error(f"Router {router_id} not found")
                return False
            
            return self._connect(self.router.ip_address, self.router.username, 
                               self.router.password, self.router.api_port)
        except Exception as e:
            logger.error(f"Error connecting to router {router_id}: {e}")
            return False
    
    def _connect(self, ip: str, username: str, password: str, port: int = 8728) -> bool:
        """Establish connection to MikroTik router"""
        try:
            self.connection = routeros_api.RouterOsApiPool(
                host=ip,
                username=username,
                password=password,
                port=port,
                plaintext_login=True,
                use_ssl=False,
                timeout=10
            )
            self.api = self.connection.get_api()
            logger.info(f"Connected to MikroTik {ip}")
            
            # Update last seen
            if self.router:
                self.router.last_seen = datetime.utcnow()
                db.session.commit()
            
            return True
        except Exception as e:
            logger.error(f"Connection failed to {ip}: {e}")
            return False
    
    # ==================== CLIENT MANAGEMENT ====================
    
    def provision_client(self, client: Client, plan: Plan, config: Dict = None) -> Dict:
        """
        Provision a new client on MikroTik
        
        Args:
            client: Client model instance
            plan: Plan model instance
            config: Additional configuration options
        
        Returns:
            Dict with success status and details
        """
        results = {
            'success': False,
            'steps': {},
            'errors': [],
            'warnings': []
        }
        
        try:
            # Step 1: Configure IP address
            if client.connection_type == 'pppoe':
                results['steps']['pppoe'] = self._configure_pppoe(client, plan)
            elif client.ip_address:
                results['steps']['ip'] = self._configure_static_ip(client)
            
            # Step 2: DHCP lease if MAC provided
            if client.mac_address:
                results['steps']['dhcp'] = self._create_dhcp_lease(client)
            
            # Step 3: QoS configuration
            results['steps']['qos'] = self._configure_qos(client, plan)
            
            # Step 4: Firewall rules
            results['steps']['firewall'] = self._configure_firewall_rules(client, plan)
            
            # Step 5: WiFi configuration (if applicable)
            results['steps']['wifi'] = self._configure_wifi(client, config)
            
            # Step 6: Apply features (IPv6, Gaming, VoIP)
            results['steps']['features'] = self._apply_plan_features(client, plan)
            
            # Check overall success
            successful_steps = [k for k, v in results['steps'].items() if v]
            results['success'] = len(successful_steps) > 0
            
            if results['success']:
                logger.info(f"Client {client.full_name} provisioned successfully")
                results['message'] = f"Cliente provisionado: {', '.join(successful_steps)}"
            else:
                results['message'] = "Fallo en el provisionamiento"
                
        except Exception as e:
            logger.error(f"Error provisioning client {client.id}: {e}")
            results['errors'].append(str(e))
        
        return results
    
    def _configure_pppoe(self, client: Client, plan: Plan) -> bool:
        """Configure PPPoE connection for client"""
        try:
            pppoe_api = self.api.get_resource('/ppp/secret')
            
            # Check if PPPoE profile exists
            profile_name = f"profile_{plan.name.lower().replace(' ', '_')}"
            profile_api = self.api.get_resource('/ppp/profile')
            profiles = profile_api.get()
            
            if not any(p.get('name') == profile_name for p in profiles):
                # Create PPPoE profile
                profile_api.add(
                    name=profile_name,
                    local_address="10.0.0.1",
                    remote_address=f"10.0.0.{client.id[-3:]}",
                    rate_limit=f"{plan.download_speed}M/{plan.upload_speed}M"
                )
            
            # Add PPPoE secret
            pppoe_api.add(
                name=client.pppoe_username,
                password=client.pppoe_password,
                service="pppoe",
                profile=profile_name,
                comment=f"Cliente: {client.full_name}",
                disabled="no"
            )
            
            return True
        except Exception as e:
            logger.error(f"Error configuring PPPoE: {e}")
            return False
    
    def _configure_static_ip(self, client: Client) -> bool:
        """Configure static IP for client"""
        try:
            # Add IP address to bridge
            ip_api = self.api.get_resource('/ip/address')
            ip_api.add(
                address=f"{client.ip_address}/32",
                interface="bridge-local",
                comment=f"Cliente: {client.full_name}"
            )
            
            # Add to address list for easy management
            address_list_api = self.api.get_resource('/ip/firewall/address-list')
            address_list_api.add(
                list="active_clients",
                address=client.ip_address,
                comment=f"Cliente: {client.full_name}"
            )
            
            return True
        except Exception as e:
            logger.error(f"Error configuring static IP: {e}")
            return False
    
    def _create_dhcp_lease(self, client: Client) -> bool:
        """Create DHCP lease for client"""
        try:
            dhcp_api = self.api.get_resource('/ip/dhcp-server/lease')
            
            # Check if lease already exists
            existing = dhcp_api.get(mac_address=client.mac_address)
            if existing:
                logger.info(f"DHCP lease already exists for {client.mac_address}")
                return True
            
            dhcp_api.add(
                address=client.ip_address,
                mac_address=client.mac_address,
                comment=f"Cliente: {client.full_name}",
                server="dhcp1",
                disabled="no"
            )
            
            return True
        except Exception as e:
            logger.error(f"Error creating DHCP lease: {e}")
            return False
    
    # ==================== QoS CONFIGURATION ====================
    
    def _configure_qos(self, client: Client, plan: Plan) -> bool:
        """Configure QoS for client based on plan"""
        try:
            queue_api = self.api.get_resource('/queue/simple')
            
            # Determine target (IP or PPPoE)
            target = client.ip_address if client.ip_address else client.pppoe_username
            
            # Configure burst if available
            burst_config = ""
            if plan.burst_download and plan.burst_upload:
                burst_config = f" burst-limit={plan.burst_download}M/{plan.burst_upload}M" \
                             f" burst-threshold={plan.download_speed * 0.8}M/{plan.upload_speed * 0.8}M" \
                             f" burst-time=30s"
            
            queue_api.add(
                name=f"client_{client.id}",
                target=target,
                max_limit=f"{plan.download_speed}M/{plan.upload_speed}M",
                comment=f"Cliente: {client.full_name} - Plan: {plan.name}"
            )
            
            # Apply burst configuration if exists
            if burst_config:
                queue_api.set(
                    **{"burst-limit": f"{plan.burst_download}M/{plan.burst_upload}M",
                       "burst-threshold": f"{plan.download_speed * 0.8}M/{plan.upload_speed * 0.8}M",
                       "burst-time": "30s"},
                    name=f"client_{client.id}"
                )
            
            return True
        except Exception as e:
            logger.error(f"Error configuring QoS: {e}")
            return False
    
    # ==================== FIREWALL RULES ====================
    
    def _configure_firewall_rules(self, client: Client, plan: Plan) -> bool:
        """Configure firewall rules for client"""
        try:
            firewall_api = self.api.get_resource('/ip/firewall/filter')
            
            # Allow client traffic
            firewall_api.add(
                chain="forward",
                src_address=client.ip_address,
                action="accept",
                comment=f"Permitir cliente: {client.full_name}"
            )
            
            # Block dangerous ports
            dangerous_ports = "135,137,138,139,445,1433,1434,3389,5432,5900"
            firewall_api.add(
                chain="forward",
                src_address=client.ip_address,
                protocol="tcp",
                dst_port=dangerous_ports,
                action="drop",
                comment=f"Bloquear puertos peligrosos: {client.full_name}"
            )
            
            # Rate limiting
            firewall_api.add(
                chain="forward",
                src_address=client.ip_address,
                connection_limit=1000,32,
                action="drop",
                comment=f"Rate limit: {client.full_name}"
            )
            
            return True
        except Exception as e:
            logger.error(f"Error configuring firewall: {e}")
            return False
    
    # ==================== WIFI CONFIGURATION ====================
    
    def _configure_wifi(self, client: Client, config: Dict = None) -> bool:
        """Configure WiFi for client CPE"""
        try:
            # Check if wireless interface exists
            wireless_api = self.api.get_resource('/interface/wireless')
            interfaces = wireless_api.get()
            
            if not interfaces:
                logger.info("No wireless interfaces, skipping WiFi config")
                return True
            
            # Default WiFi configuration
            wifi_config = config or {
                'ssid_prefix': 'ISPMAX',
                'security': 'wpa2',
                'band': '2ghz-b/g/n',
                'channel': 'auto'
            }
            
            ssid = f"{wifi_config['ssid_prefix']}_{client.full_name.split()[0]}"
            
            # Configure first wireless interface
            wireless_api.set(
                numbers="0",
                disabled="no",
                ssid=ssid,
                band=wifi_config['band'],
                frequency="auto",
                channel_width="20/40mhz"
            )
            
            # Configure security
            security_api = self.api.get_resource('/interface/wireless/security-profiles')
            security_api.add(
                name=f"profile_{client.id}",
                authentication_types="wpa2-psk",
                mode="dynamic-keys",
                wpa2_pre_shared_key=wifi_config.get('password', 'SecurePass123')
            )
            
            wireless_api.set(
                numbers="0",
                security_profile=f"profile_{client.id}"
            )
            
            return True
        except Exception as e:
            logger.error(f"Error configuring WiFi: {e}")
            return False
    
    # ==================== PLAN FEATURES ====================
    
    def _apply_plan_features(self, client: Client, plan: Plan) -> bool:
        """Apply special features based on plan"""
        try:
            features_applied = []
            
            # IPv6 configuration
            if plan.features.get('ipv6'):
                if self._configure_ipv6(client):
                    features_applied.append('ipv6')
            
            # Gaming optimization
            if plan.features.get('gaming'):
                if self._configure_gaming_optimization(client):
                    features_applied.append('gaming')
            
            # VoIP optimization
            if plan.features.get('voip'):
                if self._configure_voip_optimization(client):
                    features_applied.append('voip')
            
            return len(features_applied) > 0
        except Exception as e:
            logger.error(f"Error applying plan features: {e}")
            return False
    
    def _configure_ipv6(self, client: Client) -> bool:
        """Configure IPv6 for client"""
        try:
            # Enable IPv6 on interface
            ipv6_api = self.api.get_resource('/ipv6/address')
            ipv6_api.add(
                address=f"2001:db8::{client.id[-8:]}/64",
                interface="bridge-local",
                comment=f"IPv6 Cliente: {client.full_name}"
            )
            return True
        except Exception as e:
            logger.error(f"Error configuring IPv6: {e}")
            return False
    
    def _configure_gaming_optimization(self, client: Client) -> bool:
        """Configure gaming optimization"""
        try:
            mangle_api = self.api.get_resource('/ip/firewall/mangle')
            
            # Mark gaming traffic
            mangle_api.add(
                chain="prerouting",
                src_address=client.ip_address,
                protocol="tcp",
                dst_port="27015-27030,3478-3479,4379-4380",
                action="mark-packet",
                new_packet_mark="gaming_traffic",
                passthrough="yes",
                comment=f"Gaming optimization: {client.full_name}"
            )
            
            return True
        except Exception as e:
            logger.error(f"Error configuring gaming optimization: {e}")
            return False
    
    # ==================== CLIENT MANAGEMENT ====================
    
    def suspend_client(self, client: Client, reason: str = "non-payment") -> bool:
        """Suspend client access"""
        try:
            # Disable queue
            queue_api = self.api.get_resource('/queue/simple')
            queue_api.set(disabled="yes", name=f"client_{client.id}")
            
            # Add to suspended list
            address_list_api = self.api.get_resource('/ip/firewall/address-list')
            address_list_api.add(
                list="suspended_clients",
                address=client.ip_address,
                comment=f"Suspendido: {client.full_name} - Razón: {reason}"
            )
            
            # Block traffic
            firewall_api = self.api.get_resource('/ip/firewall/filter')
            firewall_api.add(
                chain="forward",
                src_address=client.ip_address,
                action="drop",
                comment=f"Cliente suspendido: {client.full_name}"
            )
            
            logger.info(f"Client {client.full_name} suspended: {reason}")
            return True
        except Exception as e:
            logger.error(f"Error suspending client: {e}")
            return False
    
    def activate_client(self, client: Client) -> bool:
        """Activate suspended client"""
        try:
            # Enable queue
            queue_api = self.api.get_resource('/queue/simple')
            queue_api.set(disabled="no", name=f"client_{client.id}")
            
            # Remove from suspended list
            address_list_api = self.api.get_resource('/ip/firewall/address-list')
            address_list_api.remove(address_list_api.get(list="suspended_clients", address=client.ip_address)[0]['id'])
            
            # Remove block rule
            firewall_api = self.api.get_resource('/ip/firewall/filter')
            rules = firewall_api.get(comment=f"Cliente suspendido: {client.full_name}")
            for rule in rules:
                firewall_api.remove(id=rule['id'])
            
            logger.info(f"Client {client.full_name} activated")
            return True
        except Exception as e:
            logger.error(f"Error activating client: {e}")
            return False
    
    def update_client_speed(self, client: Client, new_plan: Plan) -> bool:
        """Update client speed/plan"""
        try:
            queue_api = self.api.get_resource('/queue/simple')
            queue_api.set(
                max_limit=f"{new_plan.download_speed}M/{new_plan.upload_speed}M",
                name=f"client_{client.id}"
            )
            
            # Update burst if exists
            if new_plan.burst_download and new_plan.burst_upload:
                queue_api.set(
                    burst_limit=f"{new_plan.burst_download}M/{new_plan.burst_upload}M",
                    burst_threshold=f"{new_plan.download_speed * 0.8}M/{new_plan.upload_speed * 0.8}M",
                    name=f"client_{client.id}"
                )
            
            logger.info(f"Client {client.full_name} speed updated to {new_plan.name}")
            return True
        except Exception as e:
            logger.error(f"Error updating client speed: {e}")
            return False
    
    # ==================== ROUTER MANAGEMENT ====================
    
    def get_router_info(self) -> Dict:
        """Get router information and status"""
        try:
            system_resource = self.api.get_resource('/system/resource')
            system_identity = self.api.get_resource('/system/identity')
            system_routerboard = self.api.get_resource('/system/routerboard')
            
            info = system_resource.get()[0]
            identity = system_identity.get()[0]
            routerboard = system_routerboard.get()[0] if system_routerboard.get() else {}
            
            return {
                'identity': identity.get('name', 'Unknown'),
                'model': routerboard.get('model', 'Unknown'),
                'serial_number': routerboard.get('serial-number', 'Unknown'),
                'firmware': info.get('version', 'Unknown'),
                'uptime': info.get('uptime', 'Unknown'),
                'cpu_load': info.get('cpu-load', 'Unknown'),
                'memory_usage': info.get('free-memory', 'Unknown'),
                'total_memory': info.get('total-memory', 'Unknown'),
                'board_name': info.get('board-name', 'Unknown')
            }
        except Exception as e:
            logger.error(f"Error getting router info: {e}")
            return {}
    
    def get_interface_stats(self) -> List[Dict]:
        """Get interface statistics"""
        try:
            interface_api = self.api.get_resource('/interface')
            interfaces = interface_api.get()
            
            stats = []
            for interface in interfaces:
                stats.append({
                    'name': interface.get('name'),
                    'type': interface.get('type'),
                    'mtu': interface.get('mtu'),
                    'mac_address': interface.get('mac-address'),
                    'running': interface.get('running') == 'true',
                    'rx_bytes': interface.get('rx-byte', '0'),
                    'tx_bytes': interface.get('tx-byte', '0'),
                    'rx_packets': interface.get('rx-packet', '0'),
                    'tx_packets': interface.get('tx-packet', '0')
                })
            
            return stats
        except Exception as e:
            logger.error(f"Error getting interface stats: {e}")
            return []
    
    def get_queue_stats(self) -> List[Dict]:
        """Get queue statistics"""
        try:
            queue_api = self.api.get_resource('/queue/simple')
            queues = queue_api.get()
            
            stats = []
            for queue in queues[:50]:  # Limit to first 50 queues
                stats.append({
                    'name': queue.get('name', ''),
                    'target': queue.get('target', ''),
                    'max_limit': queue.get('max-limit', ''),
                    'rate': queue.get('rate', ''),
                    'packet_rate': queue.get('packet-rate', ''),
                    'queued_bytes': queue.get('queued-bytes', '0'),
                    'queued_packets': queue.get('queued-packets', '0'),
                    'disabled': queue.get('disabled') == 'true'
                })
            
            return stats
        except Exception as e:
            logger.error(f"Error getting queue stats: {e}")
            return []
    
    def get_active_connections(self) -> List[Dict]:
        """Get active connections/leases"""
        try:
            connections = []
            
            # DHCP leases
            dhcp_api = self.api.get_resource('/ip/dhcp-server/lease')
            leases = dhcp_api.get()
            for lease in leases:
                if lease.get('status') == 'bound':
                    connections.append({
                        'type': 'dhcp',
                        'address': lease.get('address'),
                        'mac_address': lease.get('mac-address'),
                        'host_name': lease.get('host-name', ''),
                        'status': lease.get('status'),
                        'expires': lease.get('expires-after')
                    })
            
            # PPPoE connections
            pppoe_api = self.api.get_resource('/ppp/active')
            pppoe_connections = pppoe_api.get()
            for conn in pppoe_connections:
                connections.append({
                    'type': 'pppoe',
                    'name': conn.get('name'),
                    'address': conn.get('address'),
                    'uptime': conn.get('uptime'),
                    'service': conn.get('service')
                })
            
            return connections
        except Exception as e:
            logger.error(f"Error getting active connections: {e}")
            return []
    
    # ==================== ADVANCED FEATURES ====================
    
    def configure_hotspot(self, config: Dict) -> bool:
        """Configure hotspot with captive portal"""
        try:
            # Hotspot profile
            profile_api = self.api.get_resource('/ip/hotspot/profile')
            profile_api.add(
                name=config.get('name', 'ISPMAX-Hotspot'),
                html_directory="hotspot",
                login_by="http-chap",
                http_cookie_lifetime=config.get('session_time', '1d')
            )
            
            # Hotspot server
            hotspot_api = self.api.get_resource('/ip/hotspot')
            hotspot_api.add(
                name=config.get('name', 'ISPMAX-Hotspot'),
                interface=config.get('interface', 'bridge-hotspot'),
                address_pool=config.get('pool', 'hotspot-pool'),
                profile=config.get('name', 'ISPMAX-Hotspot')
            )
            
            # User profiles
            user_profile_api = self.api.get_resource('/ip/hotspot/user/profile')
            user_profile_api.add(
                name="1hour",
                address_pool="hotspot-pool",
                rate_limit="2M/1M",
                keepalive_timeout="1h"
            )
            
            # Wall garden (allowed sites without login)
            walled_garden_api = self.api.get_resource('/ip/hotspot/walled-garden')
            for site in config.get('allowed_sites', ['*.stripe.com', '*.google.com']):
                walled_garden_api.add(dst_host=site)
            
            logger.info(f"Hotspot {config.get('name')} configured")
            return True
        except Exception as e:
            logger.error(f"Error configuring hotspot: {e}")
            return False
    
    def configure_multi_wan(self, config: Dict) -> bool:
        """Configure multi-WAN with failover"""
        try:
            # Create route for each WAN
            route_api = self.api.get_resource('/ip/route')
            
            for i, wan in enumerate(config.get('wan_interfaces', [])):
                distance = 1 if i == 0 else 2  # Primary and backup
                route_api.add(
                    dst_address="0.0.0.0/0",
                    gateway=wan.get('gateway'),
                    distance=distance,
                    check_gateway="ping",
                    comment=f"WAN {i+1}: {wan.get('interface')}"
                )
            
            # Configure load balancing if enabled
            if config.get('load_balancing'):
                route_api.add(
                    dst_address="0.0.0.0/0",
                    gateway=",".join([w.get('gateway') for w in config.get('wan_interfaces')]),
                    distance=1,
                    comment="ECMP Load Balancing"
                )
            
            logger.info("Multi-WAN configured")
            return True
        except Exception as e:
            logger.error(f"Error configuring multi-WAN: {e}")
            return False
    
    def backup_configuration(self, backup_name: str = None) -> Dict:
        """Backup router configuration"""
        try:
            if not backup_name:
                backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            backup_api = self.api.get_resource('/system/backup')
            result = backup_api.add(name=backup_name, password="")
            
            # Also export configuration
            export_api = self.api.get_resource('/export')
            export = export_api.get(file=backup_name)
            
            return {
                'success': True,
                'backup_name': backup_name,
                'export': export[0].get('contents', '') if export else ''
            }
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            return {'success': False, 'error': str(e)}
    
    def restore_configuration(self, backup_name: str) -> bool:
        """Restore router from backup"""
        try:
            backup_api = self.api.get_resource('/system/backup')
            backup_api.call('load', {'name': backup_name})
            logger.info(f"Configuration restored from {backup_name}")
            return True
        except Exception as e:
            logger.error(f"Error restoring backup: {e}")
            return False
    
    def reboot_router(self) -> bool:
        """Reboot MikroTik router"""
        try:
            system_api = self.api.get_resource('/system')
            system_api.call('reboot', {})
            logger.info("Router reboot initiated")
            return True
        except Exception as e:
            logger.error(f"Error rebooting router: {e}")
            return False
    
    def execute_script(self, script_content: str) -> Dict:
        """Execute script on router"""
        try:
            script_api = self.api.get_resource('/system/script')
            
            # Create temporary script
            script_name = f"temp_script_{datetime.now().strftime('%H%M%S')}"
            script_api.add(name=script_name, source=script_content)
            
            # Execute script
            result = script_api.call('run', {'id': script_name})
            
            # Remove temporary script
            script_api.remove(id=script_name)
            
            return {
                'success': True,
                'result': result
            }
        except Exception as e:
            logger.error(f"Error executing script: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_system_health(self) -> Dict:
        """Get comprehensive system health"""
        try:
            health = {
                'timestamp': datetime.utcnow().isoformat(),
                'router': self.get_router_info(),
                'interfaces': self.get_interface_stats(),
                'queues': len(self.get_queue_stats()),
                'connections': len(self.get_active_connections()),
                'health_score': 100  # Will be calculated
            }
            
            # Calculate health score
            issues = []
            
            # Check CPU
            cpu_load = int(health['router'].get('cpu_load', '0').replace('%', ''))
            if cpu_load > 80:
                issues.append(f"CPU high: {cpu_load}%")
            
            # Check memory
            free_mem = int(health['router'].get('memory_usage', 0))
            total_mem = int(health['router'].get('total_memory', 1))
            memory_usage = ((total_mem - free_mem) / total_mem) * 100
            if memory_usage > 85:
                issues.append(f"Memory high: {memory_usage:.1f}%")
            
            # Check interfaces
            for interface in health['interfaces']:
                if not interface['running'] and interface['type'] != 'bridge':
                    issues.append(f"Interface down: {interface['name']}")
            
            # Adjust health score
            if issues:
                health['health_score'] = max(0, 100 - (len(issues) * 10))
                health['issues'] = issues
            else:
                health['issues'] = []
            
            return health
        except Exception as e:
            logger.error(f"Error getting system health: {e}")
            return {'error': str(e)}
    
    def disconnect(self):
        """Disconnect from router"""
        try:
            if hasattr(self, 'connection'):
                self.connection.disconnect()
                logger.info("Disconnected from router")
        except:
            pass
