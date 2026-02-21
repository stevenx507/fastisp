from __future__ import annotations

from datetime import datetime
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple

import redis
from flask import current_app
import os
import subprocess

from app import celery
from app.models import MikroTikRouter, Subscription, Client
from app.services.analytics_service import analytics_service
from app.services.mikrotik_service import MikroTikService
from app.services.monitoring_service import MonitoringService
from app.services.noc_automation_service import noc_automation_service
from app.services.olt_script_service import OLTScriptService


def _get_redis_client() -> Optional[redis.Redis]:
    redis_url = current_app.config.get('REDIS_URL')
    if not redis_url:
        return None
    try:
        return redis.from_url(redis_url, decode_responses=True)
    except Exception:
        current_app.logger.warning('Redis unavailable for task locking; continuing without lock.')
        return None


def _try_acquire_lock(lock_key: str, ttl_seconds: int) -> Tuple[Optional[redis.Redis], Optional[str], bool]:
    client = _get_redis_client()
    if client is None:
        return None, None, True

    token = hashlib.sha256(f"{lock_key}:{datetime.utcnow().isoformat()}".encode('utf-8')).hexdigest()
    try:
        acquired = bool(client.set(lock_key, token, nx=True, ex=ttl_seconds))
        return client, token, acquired
    except Exception:
        current_app.logger.warning('Failed to acquire Redis lock; continuing task execution.')
        return None, None, True


def _release_lock(client: Optional[redis.Redis], lock_key: str, token: Optional[str]) -> None:
    if client is None or token is None:
        return
    try:
        current = client.get(lock_key)
        if current == token:
            client.delete(lock_key)
    except Exception:
        current_app.logger.warning('Failed to release Redis task lock: %s', lock_key)


def _send_billing_notification(sub: Subscription, message: str) -> None:
    """Send SMS/WhatsApp notification if Twilio is configured."""
    try:
        sid = current_app.config.get('TWILIO_ACCOUNT_SID')
        token = current_app.config.get('TWILIO_AUTH_TOKEN')
        from_number = current_app.config.get('TWILIO_PHONE_NUMBER')
        if not (sid and token and from_number):
            current_app.logger.info('Twilio not configured; skipping billing notification.')
            return
        to = sub.email  # fallback; ideally phone is stored
        # If email looks like phone (digits), append plus
        if to and to.replace('+', '').isdigit():
            to_number = to if to.startswith('+') else f"+{to}"
        else:
            current_app.logger.info('No phone available for billing notification; skipping.')
            return
        from twilio.rest import Client as TwilioClient

        client = TwilioClient(sid, token)
        client.messages.create(body=message, from_=from_number, to=to_number)
        current_app.logger.info('Billing notification sent to %s', to_number)
    except Exception as exc:
        current_app.logger.warning('Failed to send billing notification: %s', exc)


@celery.task(
    bind=True,
    name='app.tasks.poll_mikrotik_metrics',
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={'max_retries': 3},
)
def poll_mikrotik_metrics(self):
    """Poll active routers, persist metrics and evaluate alert rules."""
    lock_key = f"tasks:poll_mikrotik_metrics:{datetime.utcnow().strftime('%Y%m%d%H%M')}"
    lock_client, lock_token, acquired = _try_acquire_lock(lock_key, ttl_seconds=55)
    if not acquired:
        current_app.logger.info('Skipping poll_mikrotik_metrics because lock is already held.')
        return

    monitoring_service = MonitoringService()
    active_routers = MikroTikRouter.query.filter_by(is_active=True).all()
    current_app.logger.info('Starting metrics poll for %s active routers.', len(active_routers))

    snapshots: List[Dict[str, Any]] = []

    try:
        for router in active_routers:
            mikrotik_service = None
            try:
                mikrotik_service = MikroTikService(router_id=router.id)
                if not mikrotik_service.api:
                    current_app.logger.warning('Could not connect to router %s. Skipping.', router.name)
                    continue

                resources = mikrotik_service.get_router_info()
                if resources:
                    tags = {'router_name': router.name, 'router_id': str(router.id)}
                    fields = {
                        'cpu_load': int(resources.get('cpu_load', 0)),
                        'free_memory': int(resources.get('free_memory', 0)),
                        'total_memory': int(resources.get('total_memory', 0)),
                        'uptime': str(resources.get('uptime', '0s')),
                    }
                    monitoring_service.write_metric('system_resources', fields, tags)

                interfaces = mikrotik_service.get_interface_stats()
                if interfaces:
                    for iface in interfaces:
                        if iface.get('running') and iface.get('type') in ['ether', 'sfp', 'sfp-plus', 'vlan', 'bridge']:
                            tags = {
                                'router_name': router.name,
                                'router_id': str(router.id),
                                'interface_name': iface.get('name'),
                            }
                            fields = {
                                'rx_bytes': int(iface.get('rx_bytes', 0)),
                                'tx_bytes': int(iface.get('tx_bytes', 0)),
                                'rx_packets': int(iface.get('rx_packets', 0)),
                                'tx_packets': int(iface.get('tx_packets', 0)),
                            }
                            monitoring_service.write_metric('interface_traffic', fields, tags)

                health = mikrotik_service.get_system_health()
                alert_result = noc_automation_service.evaluate(router.id, health)
                snapshot = {
                    'router_id': router.id,
                    'router_name': router.name,
                    'health_score': health.get('health_score', 0),
                    'router': health.get('router', {}),
                    'alerts': alert_result.get('alerts', []),
                }
                snapshots.append(snapshot)

                if alert_result.get('alert_count', 0) > 0:
                    current_app.logger.warning(
                        'NOC alerts triggered for router %s: %s',
                        router.name,
                        json.dumps(alert_result, ensure_ascii=True),
                    )

            except Exception as exc:
                current_app.logger.error(
                    'Unexpected error while polling router %s: %s',
                    router.name,
                    exc,
                    exc_info=True,
                )
            finally:
                if mikrotik_service:
                    mikrotik_service.disconnect()

        daily_kpis = analytics_service.build_daily_network_kpis(snapshots)
        current_app.logger.info('Daily KPI snapshot: %s', json.dumps(daily_kpis, ensure_ascii=True))
        current_app.logger.info('Finished metrics poll.')
    finally:
        _release_lock(lock_client, lock_key, lock_token)


@celery.task(name='app.tasks.evaluate_noc_alerts')
def evaluate_noc_alerts() -> Dict[str, Any]:
    """Run NOC rule evaluation on current health snapshots."""
    active_routers = MikroTikRouter.query.filter_by(is_active=True).all()
    total_alerts = 0
    evaluated = 0

    for router in active_routers:
        with MikroTikService(router.id) as service:
            if not service.api:
                continue
            health = service.get_system_health()
            result = noc_automation_service.evaluate(router.id, health)
            evaluated += 1
            total_alerts += result.get('alert_count', 0)

    summary = {
        'evaluated_routers': evaluated,
        'total_alerts': total_alerts,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    }
    current_app.logger.info('NOC evaluation summary: %s', json.dumps(summary, ensure_ascii=True))
    return summary


@celery.task(name='app.tasks.compute_daily_network_kpis')
def compute_daily_network_kpis() -> Dict[str, Any]:
    """Build daily KPI aggregate from current router health state."""
    snapshots = []
    for router in MikroTikRouter.query.filter_by(is_active=True).all():
        with MikroTikService(router.id) as service:
            if not service.api:
                continue
            health = service.get_system_health()
            snapshots.append(
                {
                    'router_id': router.id,
                    'router_name': router.name,
                    'health_score': health.get('health_score', 0),
                    'router': health.get('router', {}),
                    'alerts': [],
                }
            )

    kpis = analytics_service.build_daily_network_kpis(snapshots)
    current_app.logger.info('Daily network KPIs: %s', json.dumps(kpis, ensure_ascii=True))
    return kpis


@celery.task(bind=True, name='app.tasks.execute_router_operation')
def execute_router_operation(self, router_id: int, operation: str, payload: Optional[Dict[str, Any]] = None):
    """Execute idempotent async router operations through worker pool."""
    payload = payload or {}
    lock_key = f"tasks:router_operation:{router_id}:{operation}:{hashlib.sha1(json.dumps(payload, sort_keys=True).encode('utf-8')).hexdigest()}"
    lock_client, lock_token, acquired = _try_acquire_lock(lock_key, ttl_seconds=120)
    if not acquired:
        return {'success': False, 'error': 'Operation is already running'}

    try:
        with MikroTikService(router_id=router_id) as service:
            if not service.api:
                return {'success': False, 'error': 'Could not connect to router'}

            if operation == 'reboot':
                result = service.reboot_router()
                return {'success': bool(result), 'operation': operation}
            if operation == 'backup':
                result = service.backup_configuration(payload.get('name'))
                return {'success': bool(result.get('success')), 'operation': operation, 'details': result}
            if operation == 'execute_script':
                script = payload.get('script', '')
                result = service.execute_script(script)
                return {'success': bool(result.get('success')), 'operation': operation, 'details': result}

            return {'success': False, 'error': f'Unsupported operation: {operation}'}
    finally:
        _release_lock(lock_client, lock_key, lock_token)


@celery.task(name='app.tasks.enforce_billing_status')
def enforce_billing_status() -> Dict[str, Any]:
    """
    Auto-suspende clientes vencidos y reactiva los que volvieron a 'active'.
    Inspirado en cortes automáticos de Wispro/Wisphub.
    """
    today = datetime.utcnow().date()
    updated: List[Dict[str, Any]] = []

    for sub in Subscription.query.all():
        original_status = sub.status
        if sub.next_charge and sub.next_charge < today and sub.status == 'active':
            sub.status = 'past_due'

        client: Optional[Client] = sub.client
        if not client and sub.client_id:
            client = Client.query.get(sub.client_id)

        if sub.status in ('past_due', 'suspended') and client and client.router_id:
            with MikroTikService(client.router_id) as service:
                service.suspend_client(client, reason='billing')
            sub.status = 'suspended'
            _send_billing_notification(sub, f'Tu servicio está suspendido por pago vencido (sub {sub.id}).')
        elif sub.status == 'active' and client and client.router_id:
            with MikroTikService(client.router_id) as service:
                service.activate_client(client)

        if sub.status != original_status:
            updated.append({"subscription_id": sub.id, "from": original_status, "to": sub.status})
        from app import db
        db.session.add(sub)

    from app import db
    db.session.commit()
    summary = {"timestamp": datetime.utcnow().isoformat() + "Z", "updated": updated, "count": len(updated)}
    current_app.logger.info('Billing enforcement summary: %s', json.dumps(summary, ensure_ascii=True))
    return summary


@celery.task(name='app.tasks.run_backups')
def run_backups() -> Dict[str, Any]:
    """
    Backup de base de datos (pg_dump) y config de MikroTik.
    """
    results: Dict[str, Any] = {"pg_dump": None, "mikrotik": [], "olt": []}
    backup_dir = os.environ.get('BACKUP_DIR', '/app/backups')
    os.makedirs(backup_dir, exist_ok=True)

    # DB backup
    try:
        db_url = current_app.config.get('SQLALCHEMY_DATABASE_URI') or os.environ.get('DATABASE_URL')
        pg_dump_path = current_app.config.get('PG_DUMP_PATH', 'pg_dump')
        if db_url and db_url.startswith('postgres'):
            outfile = os.path.join(backup_dir, f"db_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.sql")
            subprocess.check_call([pg_dump_path, db_url, '-f', outfile])
            results["pg_dump"] = outfile
        else:
            results["pg_dump"] = "SKIPPED (no Postgres DATABASE_URL)"
    except Exception as exc:
        current_app.logger.error("Backup DB failed: %s", exc, exc_info=True)
        results["pg_dump"] = f"ERROR: {exc}"

    # MikroTik config backup
    try:
        routers = MikroTikRouter.query.filter_by(is_active=True).all()
        for r in routers:
            with MikroTikService(r.id) as mk:
                res = mk.backup_configuration(name=f"auto_{r.name}_{datetime.utcnow().strftime('%Y%m%d')}")
                results["mikrotik"].append({"router": r.name, "success": bool(res.get('success')), "detail": res})
    except Exception as exc:
        current_app.logger.error("Backup MikroTik failed: %s", exc, exc_info=True)
        results["mikrotik"].append({"error": str(exc)})

    # OLT backup (transcript saved; run_mode simulate by default)
    try:
        olt_service = OLTScriptService()
        devices = olt_service.list_devices()
        for d in devices:
            device_id = d.get("id")
            if not device_id:
                continue
            run_mode = os.environ.get("OLT_BACKUP_MODE", "simulate").lower()
            payload = {"action": "backup_running_config", "payload": {}, "run_mode": run_mode}
            script = olt_service.generate_script(device_id=device_id, action="backup_running_config", payload={})

            # Persist script/quick-connect for auditoría
            fname = os.path.join(backup_dir, f"olt_{device_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.txt")
            with open(fname, "w", encoding="utf-8") as fh:
                fh.write(script.get("script", ""))
                fh.write("\n\nQuick connect:\n")
                quick = script.get("quick_connect", {}) or {}
                for k, v in quick.items():
                    fh.write(f"[{k}] {v}\n")

            # Intento live (opcional, si se configuró run_mode=live)
            live_attempt = None
            if run_mode == "live":
                try:
                    commands = script.get("commands") or script.get("script", "").splitlines()
                    if commands:
                        live_result = olt_service.execute_script(
                            device_id=device_id,
                            commands=commands,
                            run_mode="live",
                            actor="backup_task",
                            source_ip="127.0.0.1",
                        )
                        live_attempt = {"success": live_result.get("success"), "status": live_result.get("status")}
                except Exception as exc2:
                    live_attempt = {"error": str(exc2)}

            results["olt"].append({"olt_device": device_id, "file": fname, "run_mode": run_mode, "live": live_attempt})
    except Exception as exc:
        current_app.logger.error("Backup OLT failed: %s", exc, exc_info=True)
        results.setdefault("olt", []).append({"error": str(exc)})

    return results
