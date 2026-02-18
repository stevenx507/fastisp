from __future__ import annotations

from datetime import datetime
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple

import redis
from flask import current_app

from app import celery
from app.models import MikroTikRouter
from app.services.analytics_service import analytics_service
from app.services.mikrotik_service import MikroTikService
from app.services.monitoring_service import MonitoringService
from app.services.noc_automation_service import noc_automation_service


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
