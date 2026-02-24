from datetime import datetime, timedelta
from functools import wraps
import hashlib
import hmac
import json
import secrets
import string
import time

from flask import Blueprint, jsonify, request, Response, current_app
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app.models import Client, User, Subscription, MikroTikRouter, Plan, AuditLog, Ticket, Invoice, PaymentRecord, TicketComment, Tenant
from app import limiter, cache, db
import pyotp
import requests
from app.services.mikrotik_service import MikroTikService
from app.services.monitoring_service import MonitoringService
from app.tenancy import current_tenant_id, tenant_access_allowed
from datetime import date
from werkzeug.exceptions import BadRequest
from sqlalchemy.orm import joinedload
from sqlalchemy import or_
import subprocess
import os
from flask_mail import Message
from flask import send_from_directory
from pathlib import Path


def _current_user_id():
    identity = get_jwt_identity()
    try:
        return int(identity)
    except (TypeError, ValueError):
        return None


def _slugify(text: str) -> str:
    return ''.join(ch.lower() if ch.isalnum() else '-' for ch in text).strip('-')


def _parse_iso_datetime(value) -> datetime | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if raw.endswith('Z'):
        raw = raw.replace('Z', '+00:00')
    try:
        return datetime.fromisoformat(raw)
    except Exception:
        return None



def _parse_int(value) -> int | None:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _parse_bool(value) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        if value in (0, 1):
            return bool(value)
        return None
    token = str(value or '').strip().lower()
    if token in {'1', 'true', 'yes', 'y', 'on'}:
        return True
    if token in {'0', 'false', 'no', 'n', 'off'}:
        return False
    return None


def _password_rotation_dry_run_enabled() -> bool:
    parsed = _parse_bool(current_app.config.get('ROTATE_PASSWORDS_DRY_RUN'))
    if parsed is None:
        return False
    return parsed


def _password_rotation_length() -> int:
    default_length = 24
    try:
        configured = int(current_app.config.get('PASSWORD_ROTATION_LENGTH', default_length))
    except (TypeError, ValueError):
        configured = default_length
    return max(16, min(configured, 64))


def _generate_router_password(length: int | None = None) -> str:
    target_length = length or _password_rotation_length()
    target_length = max(16, target_length)

    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    symbols = '-_@%#'
    all_chars = lowercase + uppercase + digits + symbols

    password_chars = [
        secrets.choice(lowercase),
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    for _ in range(target_length - len(password_chars)):
        password_chars.append(secrets.choice(all_chars))
    secrets.SystemRandom().shuffle(password_chars)
    return ''.join(password_chars)


def _mask_secret(value: str | None) -> str:
    token = str(value or '')
    if len(token) <= 4:
        return '*' * len(token)
    return f"{token[:2]}***{token[-2:]}"


def _backup_dir_path() -> Path:
    configured = (
        current_app.config.get('BACKUP_DIR')
        or os.environ.get('BACKUP_DIR')
        or '/app/backups'
    )
    backup_dir = str(configured).strip() or '/app/backups'
    return Path(backup_dir).expanduser().resolve()


def _ensure_backup_dir() -> Path:
    base = _backup_dir_path()
    base.mkdir(parents=True, exist_ok=True)
    return base


def _is_safe_backup_name(name: str | None) -> bool:
    candidate = str(name or '').strip()
    if not candidate:
        return False
    # Reject directory traversal and nested paths explicitly.
    return Path(candidate).name == candidate and '/' not in candidate and '\\' not in candidate


def _backup_sha256(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open('rb') as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _backup_item_payload(file_path: Path, include_hash: bool = False) -> dict:
    stat_info = file_path.stat()
    payload = {
        "name": file_path.name,
        "size": stat_info.st_size,
        "modified": datetime.utcfromtimestamp(stat_info.st_mtime).isoformat(),
    }
    if include_hash:
        payload["sha256"] = _backup_sha256(file_path)
    return payload


def _normalized_retention_days(raw_value, default_days: int = 14) -> int:
    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        parsed = default_days
    return max(1, min(parsed, 365))


def _retention_days_for_tenant(tenant_id) -> int:
    defaults = {"backup_retention_days": 14}
    try:
        defaults = _default_system_settings()
    except Exception:
        pass
    overrides = _load_cached_dict(_system_settings_key(tenant_id))
    raw_value = overrides.get('backup_retention_days', defaults.get('backup_retention_days', 14))
    return _normalized_retention_days(raw_value, default_days=int(defaults.get('backup_retention_days', 14)))


def _prune_backup_directory(retention_days: int, base: Path | None = None) -> dict:
    safe_days = _normalized_retention_days(retention_days)
    backup_dir = base or _backup_dir_path()
    if not backup_dir.exists():
        return {
            "retention_days": safe_days,
            "cutoff": (datetime.utcnow() - timedelta(days=safe_days)).isoformat(),
            "scanned": 0,
            "removed": 0,
            "failed": 0,
            "removed_files": [],
            "errors": [],
        }

    cutoff = datetime.utcnow() - timedelta(days=safe_days)
    scanned = 0
    removed = 0
    failed = 0
    removed_files = []
    errors = []

    for file_path in backup_dir.iterdir():
        if not file_path.is_file() or file_path.is_symlink():
            continue
        scanned += 1
        try:
            modified = datetime.utcfromtimestamp(file_path.stat().st_mtime)
            if modified < cutoff:
                file_path.unlink()
                removed += 1
                removed_files.append(file_path.name)
        except Exception as exc:
            failed += 1
            errors.append({"name": file_path.name, "error": str(exc)})

    return {
        "retention_days": safe_days,
        "cutoff": cutoff.isoformat(),
        "scanned": scanned,
        "removed": removed,
        "failed": failed,
        "removed_files": removed_files,
        "errors": errors,
    }


def _parse_stripe_signature_header(signature_header: str) -> tuple[int | None, list[str]]:
    timestamp = None
    signatures: list[str] = []
    for part in str(signature_header or "").split(","):
        key, sep, value = part.partition("=")
        if not sep:
            continue
        key = key.strip()
        value = value.strip()
        if key == "t":
            timestamp = _parse_int(value)
        elif key == "v1" and value:
            signatures.append(value)
    return timestamp, signatures


def _verify_stripe_signature(payload: bytes, signature_header: str, secret: str, tolerance_seconds: int = 300) -> bool:
    timestamp, signatures = _parse_stripe_signature_header(signature_header)
    if timestamp is None or not signatures or not secret:
        return False

    now = int(time.time())
    if tolerance_seconds > 0 and abs(now - timestamp) > tolerance_seconds:
        return False

    try:
        payload_text = payload.decode('utf-8')
    except Exception:
        return False

    signed_payload = f"{timestamp}.{payload_text}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, sig) for sig in signatures)


def _extract_webhook_payment_context(event: dict) -> dict:
    event_type = str(event.get("type") or "").strip().lower()
    data = event.get("data")
    obj = data.get("object") if isinstance(data, dict) else {}
    obj = obj if isinstance(obj, dict) else {}
    metadata = obj.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}

    invoice_id = metadata.get("invoice_id") or event.get("invoice_id")
    subscription_id = metadata.get("subscription_id") or event.get("subscription_id")
    session_id = obj.get("id")
    payment_intent = obj.get("payment_intent")
    event_id = event.get("id")
    event_status = str(event.get("status") or "").strip().lower()

    normalized_status = event_status
    if event_type in {"checkout.session.completed", "payment_intent.succeeded", "charge.succeeded"}:
        normalized_status = "paid"
    elif event_type in {"payment_intent.payment_failed", "charge.failed"}:
        normalized_status = "failed"
    elif normalized_status in {"succeeded", "success"}:
        normalized_status = "paid"

    candidate_references = []
    for ref in (payment_intent, session_id, event_id):
        token = str(ref or "").strip()
        if token and token not in candidate_references:
            candidate_references.append(token)

    return {
        "event_type": event_type,
        "normalized_status": normalized_status,
        "invoice_id": _parse_int(invoice_id),
        "subscription_id": _parse_int(subscription_id),
        "session_id": str(session_id or "").strip() or None,
        "payment_intent": str(payment_intent or "").strip() or None,
        "event_id": str(event_id or "").strip() or None,
        "candidate_references": candidate_references,
    }


def _get_plan_for_request(data, tenant_id):
    plan = None
    if data.get('plan_id'):
        plan = db.session.get(Plan, data['plan_id'])
    elif data.get('plan_name'):
        query = Plan.query.filter_by(name=data['plan_name'])
        if tenant_id is not None:
            query = query.filter_by(tenant_id=tenant_id)
        plan = query.first()
        if not plan:
            plan = Plan(
                name=data['plan_name'],
                download_speed=int(data.get('download_speed') or 50),
                upload_speed=int(data.get('upload_speed') or 10),
                price=float(data.get('plan_cost') or 0),
                tenant_id=tenant_id,
            )
    return plan


def _client_invoice_payload(invoice: Invoice) -> dict:
    payload = invoice.to_dict()
    # Backward-compatible aliases consumed by existing client portal UI.
    payload["due"] = payload.get("due_date")
    payload["total"] = payload.get("total_amount")
    return payload


def _get_user_invoice_items(user: User, tenant_id) -> list[dict]:
    query = Invoice.query.join(Subscription, Invoice.subscription_id == Subscription.id)
    if tenant_id is not None:
        query = query.filter(Subscription.tenant_id == tenant_id)

    if user.client:
        query = query.filter(
            or_(
                Subscription.client_id == user.client.id,
                Subscription.email == user.email,
            )
        )
    else:
        query = query.filter(Subscription.email == user.email)

    return [
        _client_invoice_payload(invoice)
        for invoice in query.order_by(Invoice.created_at.desc()).all()
    ]


STAFF_ALLOWED_ROLES = {"admin", "tech", "support", "billing", "noc", "operator"}
PLATFORM_ADMIN_ROLE = "platform_admin"
STAFF_ALLOWED_STATUS = {"active", "on_leave", "inactive"}
STAFF_ALLOWED_SHIFTS = {"day", "night", "mixed"}
INSTALLATION_ALLOWED_STATUS = {"pending", "scheduled", "in_progress", "completed", "cancelled"}
SCREEN_ALERT_ALLOWED_STATUS = {"draft", "active", "paused", "expired"}
SCREEN_ALERT_ALLOWED_SEVERITY = {"info", "warning", "critical", "success"}
SCREEN_ALERT_ALLOWED_AUDIENCE = {"all", "active", "overdue", "suspended"}
EXTRA_SERVICE_ALLOWED_STATUS = {"active", "disabled"}
HOTSPOT_VOUCHER_ALLOWED_STATUS = {"generated", "sold", "used", "expired", "cancelled"}
SYSTEM_ALLOWED_JOBS = {"backup", "cleanup_leases", "rotate_passwords", "recalc_balances"}
TICKET_ALLOWED_PRIORITIES = {"low", "medium", "high", "urgent"}


def _tenant_cache_key(prefix: str, tenant_id) -> str:
    scoped = tenant_id if tenant_id is not None else "global"
    return f"{prefix}:{scoped}"


def _staff_meta_key(tenant_id) -> str:
    return _tenant_cache_key("admin_staff_meta", tenant_id)


def _notifications_history_key(tenant_id) -> str:
    return _tenant_cache_key("admin_notifications_history", tenant_id)


def _installations_key(tenant_id) -> str:
    return _tenant_cache_key("admin_installations", tenant_id)


def _screen_alerts_key(tenant_id) -> str:
    return _tenant_cache_key("admin_screen_alerts", tenant_id)


def _extra_services_key(tenant_id) -> str:
    return _tenant_cache_key("admin_extra_services", tenant_id)


def _hotspot_vouchers_key(tenant_id) -> str:
    return _tenant_cache_key("admin_hotspot_vouchers", tenant_id)


def _system_settings_key(tenant_id) -> str:
    return _tenant_cache_key("admin_system_settings", tenant_id)


def _system_jobs_key(tenant_id) -> str:
    return _tenant_cache_key("admin_system_jobs", tenant_id)


def _load_staff_meta(tenant_id) -> dict:
    return cache.get(_staff_meta_key(tenant_id)) or {}


def _save_staff_meta(tenant_id, metadata: dict) -> None:
    cache.set(_staff_meta_key(tenant_id), metadata, timeout=86400 * 30)


def _load_notification_history(tenant_id) -> list[dict]:
    return cache.get(_notifications_history_key(tenant_id)) or []


def _save_notification_history(tenant_id, history: list[dict]) -> None:
    cache.set(_notifications_history_key(tenant_id), history[:200], timeout=86400 * 30)


def _load_cached_list(key: str) -> list[dict]:
    return cache.get(key) or []


def _save_cached_list(key: str, items: list[dict], max_items: int = 500) -> None:
    cache.set(key, items[:max_items], timeout=86400 * 30)


def _load_cached_dict(key: str) -> dict:
    return cache.get(key) or {}


def _save_cached_dict(key: str, data: dict) -> None:
    cache.set(key, data, timeout=86400 * 30)


def _iso_utc_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _ticket_assignee_counts(tenant_id) -> dict[str, int]:
    query = Ticket.query.filter(Ticket.status.in_(("open", "in_progress")))
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    counts: dict[str, int] = {}
    for ticket in query.all():
        assigned = (ticket.assigned_to or "").strip().lower()
        if not assigned:
            continue
        counts[assigned] = counts.get(assigned, 0) + 1
    return counts


def _serialize_staff_member(user: User, metadata: dict, assigned_counts: dict[str, int]) -> dict:
    zone = str(metadata.get("zone") or "general")
    status = str(metadata.get("status") or "active")
    shift = str(metadata.get("shift") or "day")
    phone = str(metadata.get("phone") or "")
    last_seen = metadata.get("last_seen_at") or (user.created_at.isoformat() if user.created_at else None)
    email_key = (user.email or "").strip().lower()
    name_key = (user.name or "").strip().lower()
    open_tickets = assigned_counts.get(email_key, 0)
    if name_key and name_key != email_key:
        open_tickets += assigned_counts.get(name_key, 0)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "mfa_enabled": bool(user.mfa_enabled),
        "zone": zone,
        "status": status if status in STAFF_ALLOWED_STATUS else "active",
        "shift": shift if shift in STAFF_ALLOWED_SHIFTS else "day",
        "phone": phone,
        "open_tickets": open_tickets,
        "last_seen_at": last_seen,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _audit(action: str, entity_type: str = None, entity_id: str = None, metadata=None):
    try:
        tenant_id = current_tenant_id()
        user_id = _current_user_id()
        entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            meta=metadata,
            ip_address=getattr(request, "remote_addr", None),
        )
        from app import db
        db.session.add(entry)
        db.session.commit()
    except Exception:
        pass


def _notify_incident(message: str, severity: str = "info"):
    """Send push notification to PagerDuty/Telegram if configured."""
    pd_key = current_app.config.get('PAGERDUTY_ROUTING_KEY')
    tg_token = current_app.config.get('TELEGRAM_BOT_TOKEN')
    tg_chat = current_app.config.get('TELEGRAM_CHAT_ID')
    wp_token = current_app.config.get('WONDERPUSH_ACCESS_TOKEN')
    wp_app = current_app.config.get('WONDERPUSH_APPLICATION_ID')
    if pd_key:
        try:
            import requests
            payload = {
                "routing_key": pd_key,
                "event_action": "trigger",
                "payload": {
                    "summary": message,
                    "severity": "critical" if severity == "critical" else "warning" if severity == "warning" else "info",
                    "source": "ispfast-api",
                },
            }
            requests.post("https://events.pagerduty.com/v2/enqueue", json=payload, timeout=5)
        except Exception:
            current_app.logger.warning("PagerDuty notify failed")
    if tg_token and tg_chat:
        try:
            import requests
            requests.post(f"https://api.telegram.org/bot{tg_token}/sendMessage",
                          data={"chat_id": tg_chat, "text": message[:4000]}, timeout=5)
        except Exception:
            current_app.logger.warning("Telegram notify failed")
    if wp_token and wp_app:
        try:
            import requests
            payload = {
                "targetSegmentIds": ["all"],
                "notification": {"alert": message, "url": current_app.config.get('FRONTEND_URL')}
            }
            requests.post(
                "https://api.wonderpush.com/v1/deliveries",
                params={"applicationId": wp_app},
                headers={"Authorization": f"Bearer {wp_token}"},
                json=payload,
                timeout=5
            )
        except Exception:
            current_app.logger.warning("WonderPush notify failed")

# Helper para verificar rol de admin
def admin_required():
    def wrapper(fn):
        @jwt_required()
        @wraps(fn)
        def decorator(*args, **kwargs):
            current_user_id = _current_user_id()
            if current_user_id is None:
                return jsonify({"error": "Token de usuario invalido."}), 401
            user = db.session.get(User, current_user_id)
            tenant_id = current_tenant_id()
            if not user or user.role != 'admin':
                return jsonify({"error": "Acceso denegado. Se requiere rol de administrador."}), 403
            if tenant_id is not None and user.tenant_id not in (None, tenant_id):
                return jsonify({"error": "Acceso denegado para este tenant."}), 403
            return fn(*args, **kwargs)

        return decorator

    return wrapper


def platform_admin_required():
    def wrapper(fn):
        @jwt_required()
        @wraps(fn)
        def decorator(*args, **kwargs):
            current_user_id = _current_user_id()
            if current_user_id is None:
                return jsonify({"error": "Token de usuario invalido."}), 401
            user = db.session.get(User, current_user_id)
            if not user or user.role != PLATFORM_ADMIN_ROLE:
                return jsonify({"error": "Acceso denegado. Se requiere rol platform_admin."}), 403
            tenant_id = current_tenant_id()
            if tenant_id is not None:
                return jsonify({"error": "Admin total solo disponible en host master/global."}), 403
            return fn(*args, **kwargs)

        return decorator

    return wrapper


def staff_required():
    def wrapper(fn):
        @jwt_required()
        @wraps(fn)
        def decorator(*args, **kwargs):
            current_user_id = _current_user_id()
            if current_user_id is None:
                return jsonify({"error": "Token de usuario invalido."}), 401
            user = db.session.get(User, current_user_id)
            tenant_id = current_tenant_id()
            if not user or user.role not in STAFF_ALLOWED_ROLES:
                return jsonify({"error": "Acceso denegado. Se requiere rol operativo."}), 403
            if tenant_id is not None and user.tenant_id not in (None, tenant_id):
                return jsonify({"error": "Acceso denegado para este tenant."}), 403
            return fn(*args, **kwargs)

        return decorator

    return wrapper


def _serialize_tenant_platform_item(tenant: Tenant) -> dict:
    users_total = User.query.filter_by(tenant_id=tenant.id).count()
    admin_total = User.query.filter_by(tenant_id=tenant.id, role='admin').count()
    clients_total = Client.query.filter_by(tenant_id=tenant.id).count()
    routers_total = MikroTikRouter.query.filter_by(tenant_id=tenant.id).count()
    subs_total = Subscription.query.filter_by(tenant_id=tenant.id).count()
    active_subs = Subscription.query.filter_by(tenant_id=tenant.id, status='active').count()
    suspended_subs = Subscription.query.filter_by(tenant_id=tenant.id, status='suspended').count()
    return {
        "id": tenant.id,
        "slug": tenant.slug,
        "name": tenant.name,
        "is_active": bool(tenant.is_active),
        "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        "users_total": users_total,
        "admins_total": admin_total,
        "clients_total": clients_total,
        "routers_total": routers_total,
        "subscriptions_total": subs_total,
        "subscriptions_active": active_subs,
        "subscriptions_suspended": suspended_subs,
    }


def _platform_admin_exists() -> bool:
    return User.query.filter_by(role=PLATFORM_ADMIN_ROLE).first() is not None


def _build_network_alert_items(tenant_id) -> list[dict]:
    routers_q = MikroTikRouter.query
    subs_q = Subscription.query
    if tenant_id is not None:
        routers_q = routers_q.filter_by(tenant_id=tenant_id)
        subs_q = subs_q.filter_by(tenant_id=tenant_id)

    alerts: list[dict] = []
    now_iso = _iso_utc_now()

    for router in routers_q.filter_by(is_active=False).all():
        alerts.append(
            {
                "id": f"AL-R-{router.id}",
                "severity": "critical",
                "scope": "router",
                "target": router.name,
                "message": "Router sin respuesta",
                "since": now_iso,
            }
        )

    for sub in subs_q.filter_by(status='past_due').all():
        alerts.append(
            {
                "id": f"AL-S-{sub.id}",
                "severity": "warning",
                "scope": "billing",
                "target": sub.customer,
                "message": "Suscripcion vencida",
                "since": now_iso,
            }
        )

    if not alerts:
        alerts.append(
            {
                "id": "AL-OK",
                "severity": "info",
                "scope": "network",
                "target": "Red",
                "message": "Sin alertas criticas",
                "since": now_iso,
            }
        )
    return alerts


def _build_network_health_payload(tenant_id) -> dict:
    routers_q = MikroTikRouter.query
    if tenant_id is not None:
        routers_q = routers_q.filter_by(tenant_id=tenant_id)
    routers_ok = routers_q.filter_by(is_active=True).count()
    routers_down = routers_q.filter_by(is_active=False).count()

    clients_q = Client.query
    if tenant_id is not None:
        clients_q = clients_q.filter_by(tenant_id=tenant_id)
    clients_total = clients_q.count()

    health = {
        "routers_ok": routers_ok,
        "routers_down": routers_down,
        "clients_total": clients_total,
        "olt_ok": 4,
        "olt_alert": 1,
        "latency_ms": 12 + routers_down,
        "packet_loss": round(0.2 + routers_down * 0.3, 2),
        "last_updated": datetime.utcnow().isoformat(),
        "source": "fallback",
    }

    try:
        monitoring = MonitoringService()
        resources = monitoring.query_metrics('system_resources', time_range='-30m')
        cpu_samples = []
        mem_usage = []
        for point in resources:
            cpu = point.get('cpu_load')
            free_mem = point.get('free_memory')
            total_mem = point.get('total_memory')
            if cpu is not None:
                try:
                    cpu_samples.append(float(str(cpu).replace('%', '').strip()))
                except Exception:
                    pass
            if free_mem is not None and total_mem not in (None, 0):
                try:
                    usage = (float(total_mem) - float(free_mem)) / float(total_mem) * 100
                    mem_usage.append(usage)
                except Exception:
                    pass

        score = 95 - (routers_down * 8)
        if cpu_samples:
            cpu_avg = sum(cpu_samples) / len(cpu_samples)
            health["cpu_avg"] = round(cpu_avg, 1)
            score -= max(0, cpu_avg - 70) * 0.2
        if mem_usage:
            mem_avg = sum(mem_usage) / len(mem_usage)
            health["memory_avg"] = round(mem_avg, 1)
            score -= max(0, mem_avg - 80) * 0.15

        health["score"] = max(35, min(100, round(score, 1)))
        health["source"] = "influxdb"
    except Exception as exc:
        current_app.logger.info("Network health using fallback: %s", exc)
        health["score"] = max(40, min(100, 95 - routers_down * 5))

    return health


def _build_client_notifications(user: User, tenant_id) -> list[dict]:
    notifications: list[dict] = []
    now_iso = _iso_utc_now()

    tickets_q = Ticket.query.filter(Ticket.status.in_(("open", "in_progress")))
    if tenant_id is not None:
        tickets_q = tickets_q.filter_by(tenant_id=tenant_id)
    if user.client:
        tickets_q = tickets_q.filter_by(client_id=user.client.id)
    else:
        tickets_q = tickets_q.filter_by(user_id=user.id)
    open_tickets = tickets_q.count()
    if open_tickets:
        notifications.append(
            {
                "id": f"NT-TICKETS-{user.id}",
                "message": f"Tienes {open_tickets} ticket(s) abiertos",
                "time": now_iso,
                "read": False,
            }
        )

    today = datetime.utcnow().date()
    invoices = _get_user_invoice_items(user, tenant_id)
    overdue = 0
    pending = 0
    for invoice in invoices:
        status = str(invoice.get("status") or "").lower()
        if status not in {"pending", "overdue"}:
            continue
        pending += 1
        due_dt = _parse_iso_datetime(invoice.get("due_date") or invoice.get("due"))
        if due_dt and due_dt.date() < today:
            overdue += 1

    if overdue:
        notifications.append(
            {
                "id": f"NT-INVOICE-OVERDUE-{user.id}",
                "message": f"Tienes {overdue} factura(s) vencida(s)",
                "time": now_iso,
                "read": False,
            }
        )
    elif pending:
        notifications.append(
            {
                "id": f"NT-INVOICE-PENDING-{user.id}",
                "message": f"Tienes {pending} factura(s) pendiente(s)",
                "time": now_iso,
                "read": False,
            }
        )

    if not notifications:
        notifications.append(
            {
                "id": f"NT-INFO-{user.id}",
                "message": "Sin novedades en tu cuenta.",
                "time": now_iso,
                "read": False,
            }
        )

    return notifications[:5]


# Este Blueprint contiene las rutas principales de la API
main_bp = Blueprint('main_bp', __name__)


@main_bp.route('/health', methods=['GET'])
def api_health():
    return jsonify({'status': 'healthy', 'service': 'ispmax-backend-api'}), 200


@main_bp.route('/dashboard', methods=['GET'])
@staff_required()
def dashboard_overview():
    tenant_id = current_tenant_id()

    clients_q = Client.query
    if tenant_id is not None:
        clients_q = clients_q.filter_by(tenant_id=tenant_id)
    clients_count = clients_q.count()

    routers_q = MikroTikRouter.query
    if tenant_id is not None:
        routers_q = routers_q.filter_by(tenant_id=tenant_id)
    routers_ok = routers_q.filter_by(is_active=True).count()
    routers_down = routers_q.filter_by(is_active=False).count()

    subs_q = Subscription.query
    if tenant_id is not None:
        subs_q = subs_q.filter_by(tenant_id=tenant_id)
    paid_today = sum(float(s.amount) for s in subs_q.filter_by(status='active').all())
    pending_amount = sum(float(s.amount) for s in subs_q.filter(Subscription.status.in_(['past_due', 'trial'])).all())

    overview = {
        "uptime": "99.9%",
        "currentSpeed": f"{max(30, routers_ok*5 + 50)} Mbps",
        "totalDownload": f"{clients_count * 120:.2f} GiB",
        "totalUpload": f"{clients_count * 45:.2f} GiB"
    }
    tickets = {"today": routers_down, "pending": max(routers_down, 0), "month": routers_down * 3}
    finance = {"paid_today": round(paid_today, 2), "pending": round(pending_amount, 2)}
    _audit("dashboard_view", entity_type="dashboard", metadata={"tenant_id": tenant_id, "routers_down": routers_down})
    return jsonify({"overview": overview, "tickets": tickets, "finance": finance, "clients": clients_count, "routers": {"ok": routers_ok, "down": routers_down}}), 200


@main_bp.route('/billing', methods=['GET'])
@staff_required()
def billing_summary():
    tenant_id = current_tenant_id()
    subs = Subscription.query
    if tenant_id is not None:
        subs = subs.filter_by(tenant_id=tenant_id)

    invoices = []
    for s in subs.all():
        inv_total = float(s.amount) * (1 + float(s.tax_percent or 0) / 100)
        invoices.append({
            "id": f"SUB-{s.id}",
            "amount": float(s.amount),
            "tax_percent": float(s.tax_percent or 0),
            "total": round(inv_total, 2),
            "currency": s.currency,
            "due": s.next_charge.isoformat() if s.next_charge else datetime.utcnow().date().isoformat(),
            "status": "paid" if s.status == 'active' else ("overdue" if s.status == 'past_due' else "pending"),
            "method": s.method,
        })
    return jsonify({"invoices": invoices, "count": len(invoices)}), 200


@main_bp.route('/connections', methods=['GET'])
@staff_required()
def connections_summary():
    tenant_id = current_tenant_id()
    query = Client.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)

    items = []
    for client in query.all():
        status = 'active'
        if client.connection_type == 'pppoe':
            status = 'active'
        elif client.connection_type == 'dhcp':
            status = 'idle'
        elif client.connection_type == 'static':
            status = 'active'
        if client.router and not client.router.is_active:
            status = 'offline'

        items.append({
            "id": str(client.id),
            "ip": client.ip_address or '',
            "mac": client.mac_address or '',
            "status": status
        })
    return jsonify({"items": items, "count": len(items)}), 200


@main_bp.route('/notifications', methods=['GET'])
@jwt_required()
def notifications_feed():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401

    user = db.session.get(User, current_user_id)
    tenant_id = current_tenant_id()
    if not user:
        return jsonify({"error": "Token de usuario invalido."}), 401
    if tenant_id is not None and user.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    if user.role in STAFF_ALLOWED_ROLES:
        alerts = _build_network_alert_items(tenant_id)
        now = _iso_utc_now()
        feed = []
        for idx, alert in enumerate(alerts[:5], start=1):
            feed.append(
                {
                    "id": idx,
                    "message": f"Alerta {alert['severity']}: {alert['message']}",
                    "time": now,
                    "read": False,
                }
            )
    else:
        feed = _build_client_notifications(user, tenant_id)

    return jsonify({"notifications": feed, "count": len(feed)}), 200


@main_bp.route('/auth/login', methods=['POST'])
@limiter.limit("10/minute")
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email y contrasena son requeridos."}), 400

    tenant_id = current_tenant_id()
    query = User.query.filter_by(email=data.get('email'))
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)

    user = query.first()
    if user and user.check_password(data.get('password')):
        # MFA: si esta habilitado, validar codigo
        if user.mfa_enabled:
            mfa_code = str(data.get('mfa_code') or '').strip()
            if not mfa_code:
                return jsonify({"error": "MFA requerido", "mfa_required": True}), 401
            if not user.mfa_secret:
                return jsonify({"error": "MFA no configurado correctamente"}), 500
            totp = pyotp.TOTP(user.mfa_secret)
            if not totp.verify(mfa_code, valid_window=1):
                return jsonify({"error": "Codigo MFA invalido", "mfa_required": True}), 401

        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={'tenant_id': user.tenant_id},
        )
        return jsonify({"token": access_token, "user": user.to_dict()}), 200

    return jsonify({"error": "Credenciales incorrectas."}), 401


@main_bp.route('/platform/bootstrap/status', methods=['GET'])
@limiter.limit("30/minute")
def platform_bootstrap_status():
    tenant_id = current_tenant_id()
    platform_admin_exists = _platform_admin_exists()
    token_configured = bool(str(current_app.config.get('PLATFORM_BOOTSTRAP_TOKEN') or '').strip())
    master_context = tenant_id is None
    bootstrap_allowed = master_context and token_configured and not platform_admin_exists
    return jsonify(
        {
            "master_context": master_context,
            "token_configured": token_configured,
            "platform_admin_exists": platform_admin_exists,
            "bootstrap_allowed": bootstrap_allowed,
        }
    ), 200


@main_bp.route('/platform/bootstrap', methods=['POST'])
@limiter.limit("5/minute")
def platform_bootstrap():
    if current_tenant_id() is not None:
        return jsonify({"error": "Bootstrap solo disponible en host master/global."}), 403

    configured_token = str(current_app.config.get('PLATFORM_BOOTSTRAP_TOKEN') or '').strip()
    if not configured_token:
        return jsonify({"error": "PLATFORM_BOOTSTRAP_TOKEN no configurado en servidor."}), 403

    if _platform_admin_exists():
        return jsonify({"error": "Ya existe un platform_admin. Bootstrap cerrado."}), 409

    data = request.get_json() or {}
    provided_token = str(
        data.get('token')
        or request.headers.get('X-Platform-Bootstrap-Token')
        or ''
    ).strip()
    if not provided_token or not hmac.compare_digest(provided_token, configured_token):
        return jsonify({"error": "Token de bootstrap invalido."}), 403

    name = str(data.get('name') or '').strip()
    email = str(data.get('email') or '').strip().lower()
    password = str(data.get('password') or '')
    if not name or not email or not password:
        return jsonify({"error": "name, email y password son requeridos."}), 400
    if len(password) < 10:
        return jsonify({"error": "password debe tener al menos 10 caracteres."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email ya existe."}), 409

    user = User(
        name=name,
        email=email,
        role=PLATFORM_ADMIN_ROLE,
        tenant_id=None,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify(
        {
            "success": True,
            "message": "Platform admin creado correctamente.",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "tenant_id": user.tenant_id,
            },
        }
    ), 201


@main_bp.route('/platform/overview', methods=['GET'])
@platform_admin_required()
def platform_overview():
    tenants_total = Tenant.query.count()
    tenants_active = Tenant.query.filter_by(is_active=True).count()
    tenants_inactive = max(0, tenants_total - tenants_active)
    users_total = User.query.count()
    clients_total = Client.query.count()
    routers_total = MikroTikRouter.query.count()
    subscriptions_total = Subscription.query.count()
    subscriptions_active = Subscription.query.filter_by(status='active').count()

    payload = {
        "tenants_total": tenants_total,
        "tenants_active": tenants_active,
        "tenants_inactive": tenants_inactive,
        "users_total": users_total,
        "clients_total": clients_total,
        "routers_total": routers_total,
        "subscriptions_total": subscriptions_total,
        "subscriptions_active": subscriptions_active,
    }
    return jsonify(payload), 200


@main_bp.route('/platform/tenants', methods=['GET'])
@platform_admin_required()
def platform_list_tenants():
    tenants = Tenant.query.order_by(Tenant.created_at.desc()).all()
    items = [_serialize_tenant_platform_item(tenant) for tenant in tenants]
    return jsonify({"items": items, "count": len(items)}), 200


@main_bp.route('/platform/tenants', methods=['POST'])
@platform_admin_required()
def platform_create_tenant():
    data = request.get_json() or {}
    name = str(data.get('name') or '').strip()
    slug_raw = str(data.get('slug') or '').strip().lower()

    if not name:
        return jsonify({"error": "name es requerido"}), 400

    slug = _slugify(slug_raw or name)
    if not slug:
        return jsonify({"error": "slug invalido"}), 400

    duplicate = Tenant.query.filter_by(slug=slug).first()
    if duplicate:
        return jsonify({"error": "slug ya existe"}), 409

    is_active = _parse_bool(data.get('is_active'))
    tenant = Tenant(
        slug=slug,
        name=name,
        is_active=True if is_active is None else bool(is_active),
    )
    db.session.add(tenant)
    db.session.flush()

    created_admin = None
    admin_email = str(data.get('admin_email') or '').strip().lower()
    admin_name = str(data.get('admin_name') or 'Admin ISP').strip() or 'Admin ISP'
    if admin_email:
        if User.query.filter_by(email=admin_email).first():
            db.session.rollback()
            return jsonify({"error": "admin_email ya existe"}), 409
        admin_password = str(data.get('admin_password') or '').strip() or secrets.token_urlsafe(12)
        admin_user = User(
            name=admin_name,
            email=admin_email,
            role='admin',
            tenant_id=tenant.id,
        )
        admin_user.set_password(admin_password)
        db.session.add(admin_user)
        created_admin = {
            "email": admin_email,
            "name": admin_name,
            "role": "admin",
            "password": admin_password,
        }

    db.session.commit()
    payload = {
        "success": True,
        "tenant": _serialize_tenant_platform_item(tenant),
    }
    if created_admin:
        payload["admin"] = created_admin
    return jsonify(payload), 201


@main_bp.route('/platform/tenants/<int:tenant_id>', methods=['PATCH'])
@platform_admin_required()
def platform_update_tenant(tenant_id):
    tenant = db.session.get(Tenant, tenant_id)
    if not tenant:
        return jsonify({"error": "Tenant no encontrado"}), 404

    data = request.get_json() or {}
    changed = False

    if 'name' in data:
        name = str(data.get('name') or '').strip()
        if not name:
            return jsonify({"error": "name invalido"}), 400
        tenant.name = name
        changed = True

    if 'slug' in data:
        slug = _slugify(str(data.get('slug') or '').strip().lower())
        if not slug:
            return jsonify({"error": "slug invalido"}), 400
        duplicate = Tenant.query.filter(Tenant.id != tenant.id, Tenant.slug == slug).first()
        if duplicate:
            return jsonify({"error": "slug ya existe"}), 409
        tenant.slug = slug
        changed = True

    if 'is_active' in data:
        parsed = _parse_bool(data.get('is_active'))
        if parsed is None:
            return jsonify({"error": "is_active debe ser booleano"}), 400
        tenant.is_active = parsed
        changed = True

    if changed:
        db.session.add(tenant)
        db.session.commit()

    return jsonify({"success": True, "tenant": _serialize_tenant_platform_item(tenant)}), 200


@main_bp.route('/platform/tenants/<int:tenant_id>/admins', methods=['POST'])
@platform_admin_required()
def platform_create_tenant_admin(tenant_id):
    tenant = db.session.get(Tenant, tenant_id)
    if not tenant:
        return jsonify({"error": "Tenant no encontrado"}), 404

    data = request.get_json() or {}
    email = str(data.get('email') or '').strip().lower()
    name = str(data.get('name') or 'Admin ISP').strip() or 'Admin ISP'
    if not email:
        return jsonify({"error": "email es requerido"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email ya existe"}), 409

    password = str(data.get('password') or '').strip() or secrets.token_urlsafe(12)
    user = User(
        name=name,
        email=email,
        role='admin',
        tenant_id=tenant.id,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "tenant_id": tenant.id,
        "admin": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "password": password,
        },
    }), 201


@main_bp.route('/auth/register', methods=['POST'])
@limiter.limit("5/minute")
def register():
    """
    Registro publico: crea un usuario cliente y devuelve token inmediato.
    """
    if not current_app.config.get('ALLOW_SELF_SIGNUP', False):
        return jsonify({"error": "El registro publico esta deshabilitado. Solicite acceso al administrador."}), 403

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({"error": "Nombre, email y contrasena son requeridos."}), 400

    tenant_id = current_tenant_id()
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "El correo ya esta registrado."}), 400

    user = User(
        name=name,
        email=email,
        role='client',
        tenant_id=tenant_id,
    )
    user.set_password(password)
    from app import db

    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id), additional_claims={'tenant_id': user.tenant_id})
    return jsonify({"token": access_token, "user": user.to_dict()}), 201


@main_bp.route('/admin/clients/<int:client_id>/change_plan', methods=['POST'])
@jwt_required()
def change_plan(client_id):
    """Cambio de plan con prorrateo opcional y nueva factura."""
    user_id = _current_user_id()
    user = db.session.get(User, user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Solo administradores pueden cambiar planes"}), 403

    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({"error": "Cliente no encontrado"}), 404
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403

    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    apply_proration = _parse_bool(data.get('prorate', True))
    if not plan_id:
        return jsonify({"error": "plan_id es requerido"}), 400
    if apply_proration is None:
        return jsonify({"error": "prorate debe ser booleano"}), 400

    new_plan = db.session.get(Plan, plan_id)
    if not new_plan:
        return jsonify({"error": "Plan no encontrado"}), 404

    # Buscar suscripción activa
    subscription = Subscription.query.filter_by(client_id=client.id).order_by(Subscription.created_at.desc()).first()
    today = date.today()
    proration_amount = 0.0
    tax_percent = float(subscription.tax_percent) if subscription else 0.0

    if subscription:
        # calcular prorrateo simple basado en días restantes del ciclo
        days_in_cycle = max(subscription.cycle_months * 30, 1)
        days_left = max((subscription.next_charge - today).days if subscription.next_charge else 0, 0)
        delta = (new_plan.price or 0) - float(subscription.amount)
        proration_amount = round(delta * days_left / days_in_cycle, 2) if apply_proration else 0.0

        # actualizar suscripción al nuevo plan/precio
        subscription.plan = new_plan.name
        subscription.amount = new_plan.price or 0
        subscription.currency = subscription.currency or 'USD'
        subscription.updated_at = datetime.utcnow()
    else:
        # crear suscripción si no existe
        subscription = Subscription(
            customer=client.full_name,
            email=user.email,
            plan=new_plan.name,
            cycle_months=1,
            amount=new_plan.price or 0,
            status='active',
            currency='USD',
            tax_percent=0,
            next_charge=today,
            method='manual',
            client_id=client.id,
            tenant_id=client.tenant_id,
        )
        db.session.add(subscription)

    # Cambiar plan del cliente
    client.plan_id = new_plan.id

    invoice_total = (float(new_plan.price or 0) + (proration_amount if proration_amount > 0 else 0))
    invoice = Invoice(
        subscription=subscription,
        amount=invoice_total,
        currency=subscription.currency or 'USD',
        tax_percent=tax_percent,
        total_amount=invoice_total * (1 + tax_percent / 100),
        status='pending' if invoice_total > 0 else 'paid',
        due_date=today,
        country=subscription.country,
    )
    db.session.add(invoice)
    db.session.flush()

    if proration_amount != 0:
        payment = PaymentRecord(
            invoice=invoice,
            method='proration',
            reference=f'proration-{client.id}-{invoice.id}',
            amount=abs(proration_amount),
            currency=invoice.currency,
            status='pending' if proration_amount > 0 else 'paid',
            meta={'delta': proration_amount},
        )
        db.session.add(payment)

    db.session.commit()

    return jsonify({
        "client": client.to_dict(),
        "subscription": subscription.to_dict(),
        "invoice": invoice.to_dict(),
        "proration_amount": proration_amount,
    }), 200


@main_bp.route('/admin/payments/manual', methods=['POST'])
@jwt_required()
def manual_payment():
    """Registra un pago manual (Yape/Nequi/transferencia) contra una factura."""
    user_id = _current_user_id()
    user = db.session.get(User, user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Solo administradores pueden registrar pagos"}), 403

    data = request.get_json() or {}
    invoice_id = data.get('invoice_id')
    amount = data.get('amount')
    method = data.get('method', 'manual')
    reference = data.get('reference')
    meta = data.get('metadata')

    if not invoice_id or amount is None:
        return jsonify({"error": "invoice_id y amount son requeridos"}), 400

    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        return jsonify({"error": "Factura no encontrada"}), 404

    tenant_id = current_tenant_id()
    if tenant_id and invoice.subscription and invoice.subscription.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Factura fuera del tenant"}), 403

    payment = PaymentRecord(
        invoice=invoice,
        method=method,
        reference=reference,
        amount=amount,
        currency=invoice.currency,
        status='paid',
        meta=meta,
    )
    invoice.status = 'paid'
    db.session.add(payment)
    db.session.commit()

    return jsonify({"invoice": invoice.to_dict(), "payment": payment.to_dict()}), 201


def _verify_google_credential(credential: str) -> dict:
    google_client_id = (current_app.config.get('GOOGLE_CLIENT_ID') or '').strip()
    if not google_client_id:
        raise BadRequest("GOOGLE_CLIENT_ID no está configurado en el backend.")

    try:
        resp = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
            timeout=5,
        )
    except requests.RequestException as exc:
        raise BadRequest(f"No se pudo validar el token de Google: {exc}") from exc

    if resp.status_code != 200:
        raise BadRequest("Token de Google inválido o expirado.")

    payload = resp.json()
    aud = (payload.get('aud') or '').strip()
    issuer = (payload.get('iss') or '').strip()
    email = (payload.get('email') or '').strip().lower()
    email_verified = str(payload.get('email_verified') or '').strip().lower()
    name = (payload.get('name') or payload.get('given_name') or 'Usuario Google').strip()

    if aud != google_client_id:
        raise BadRequest("El token no corresponde al GOOGLE_CLIENT_ID configurado.")
    if issuer not in {'accounts.google.com', 'https://accounts.google.com'}:
        raise BadRequest("Issuer de Google inválido.")
    if email_verified not in {'true', '1'}:
        raise BadRequest("La cuenta de Google no está verificada.")
    if not email:
        raise BadRequest("No se pudo obtener email desde el token de Google.")

    return {"email": email, "name": name}


@main_bp.route('/auth/google', methods=['POST'])
def google_login():
    """Google login with server-side ID token verification."""
    if not current_app.config.get('ALLOW_GOOGLE_LOGIN', True):
        return jsonify({"error": "El login con Google está deshabilitado en este entorno."}), 403

    data = request.get_json() or {}
    credential = (data.get('credential') or '').strip()

    try:
        if credential:
            payload = _verify_google_credential(credential)
            email = payload["email"]
            name = payload["name"]
        elif current_app.config.get('ALLOW_INSECURE_GOOGLE_LOGIN', False):
            email = (data.get('email') or '').strip().lower()
            name = (data.get('name') or 'Usuario Google').strip()
        else:
            return jsonify({"error": "Credential de Google requerida."}), 400
    except BadRequest as exc:
        return jsonify({"error": str(exc)}), 400

    if not email:
        return jsonify({"error": "Email es requerido."}), 400

    tenant_id = current_tenant_id()
    user = User.query.filter_by(email=email).first()
    if not user:
        # crea un usuario cliente por defecto
        user = User(
          name=name or 'Usuario Google',
          email=email,
          role='client',
          tenant_id=tenant_id,
        )
        user.set_password(secrets.token_hex(8))
        from app import db

        db.session.add(user)
        db.session.commit()

    # si el usuario pertenece a otro tenant, denegar
    if tenant_id is not None and user.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    access_token = create_access_token(identity=str(user.id), additional_claims={'tenant_id': user.tenant_id})
    return jsonify({"token": access_token, "user": user.to_dict(), "provider": "google"}), 200


@main_bp.route('/auth/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401

    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()

    if not name or not email:
        return jsonify({"error": "Nombre y correo son requeridos."}), 400

    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado."}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and user.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    # Verificar colision de correo
    existing = User.query.filter(User.email == email, User.id != user.id).first()
    if existing:
        return jsonify({"error": "El correo ya esta en uso."}), 400

    user.name = name
    user.email = email
    # Guardar cambios
    from app import db

    db.session.add(user)
    db.session.commit()

    return jsonify({"user": user.to_dict(), "success": True}), 200


@main_bp.route('/auth/password', methods=['POST'])
@jwt_required()
def update_password():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401

    data = request.get_json() or {}
    current_password = str(data.get('current_password') or '')
    new_password = str(data.get('new_password') or '')

    if not current_password or not new_password:
        return jsonify({"error": "Contraseña actual y nueva contraseña son requeridas."}), 400
    if len(new_password) < 8:
        return jsonify({"error": "La nueva contraseña debe tener al menos 8 caracteres."}), 400

    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado."}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and user.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    if not user.check_password(current_password):
        return jsonify({"error": "La contraseña actual es incorrecta."}), 400
    if user.check_password(new_password):
        return jsonify({"error": "La nueva contraseña debe ser diferente a la actual."}), 400

    user.set_password(new_password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"success": True}), 200


@main_bp.route('/auth/mfa/setup', methods=['GET'])
@jwt_required()
def mfa_setup():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado."}), 404
    secret = user.mfa_secret or pyotp.random_base32()
    issuer = "ISPFAST"
    provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=issuer)
    return jsonify({"secret": secret, "provisioning_uri": provisioning_uri, "issuer": issuer}), 200


@main_bp.route('/auth/mfa/enable', methods=['POST'])
@jwt_required()
def mfa_enable():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    data = request.get_json() or {}
    code = str(data.get('code') or '').strip()
    secret = str(data.get('secret') or '').strip()
    if not code or not secret:
        return jsonify({"error": "Secret y codigo son requeridos."}), 400
    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({"error": "Codigo invalido."}), 400
    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado."}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and user.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403
    user.mfa_secret = secret
    user.mfa_enabled = True
    from app import db
    db.session.add(user)
    db.session.commit()
    return jsonify({"success": True}), 200


@main_bp.route('/auth/mfa/disable', methods=['POST'])
@jwt_required()
def mfa_disable():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    data = request.get_json() or {}
    code = str(data.get('code') or '').strip()
    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado."}), 404
    if user.mfa_enabled:
        totp = pyotp.TOTP(user.mfa_secret)
        if not code or not totp.verify(code, valid_window=1):
            return jsonify({"error": "Codigo invalido o faltante."}), 400
    user.mfa_enabled = False
    user.mfa_secret = None
    from app import db
    db.session.add(user)
    db.session.commit()
    return jsonify({"success": True}), 200


@main_bp.route('/subscriptions', methods=['GET'])
@staff_required()
def list_subscriptions():
    tenant_id = current_tenant_id()
    query = Subscription.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    items = [s.to_dict() for s in query.order_by(Subscription.next_charge.asc()).all()]
    return jsonify({"items": items, "count": len(items)}), 200


@main_bp.route('/plans', methods=['GET'])
@staff_required()
def list_plans():
    tenant_id = current_tenant_id()
    query = Plan.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    plans = [
        {
            "id": p.id,
            "name": p.name,
            "download_speed": p.download_speed,
            "upload_speed": p.upload_speed,
            "price": p.price
        }
        for p in query.order_by(Plan.name.asc()).all()
    ]
    return jsonify({"items": plans, "count": len(plans)}), 200


@main_bp.route('/plans', methods=['POST'])
@admin_required()
def create_plan():
    data = request.get_json() or {}
    required = ['name', 'download_speed', 'upload_speed']
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Faltan campos: {', '.join(missing)}"}), 400
    tenant_id = current_tenant_id()
    plan = Plan(
        name=data['name'],
        download_speed=int(data['download_speed']),
        upload_speed=int(data['upload_speed']),
        price=float(data.get('price') or 0),
        tenant_id=tenant_id
    )
    from app import db
    db.session.add(plan)
    db.session.commit()
    return jsonify({"plan": plan.to_dict(), "success": True}), 201


@main_bp.route('/clients', methods=['POST'])
@admin_required()
def create_client():
    data = request.get_json() or {}
    required = ['name', 'email', 'connection_type']
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"error": f"Faltan campos: {', '.join(missing)}"}), 400

    tenant_id = current_tenant_id()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "El correo ya esta registrado."}), 400

    plan = _get_plan_for_request(data, tenant_id)

    # Crear usuario
    user = User(
        name=data['name'],
        email=data['email'],
        role='client',
        tenant_id=tenant_id,
    )
    password = data.get('password') or secrets.token_hex(4)
    user.set_password(password)

    connection_type = data.get('connection_type', 'dhcp')
    ppp_user = data.get('pppoe_username')
    ppp_pass = data.get('pppoe_password')
    if connection_type == 'pppoe':
        base = _slugify(data['name']) or 'cliente'
        if not ppp_user:
            ppp_user = f"{base[:12]}{secrets.randbelow(9999):04d}"
        if not ppp_pass:
            ppp_pass = secrets.token_hex(4)

    client = Client(
        full_name=data['name'],
        ip_address=data.get('ip_address'),
        mac_address=data.get('mac_address'),
        connection_type=connection_type,
        pppoe_username=ppp_user,
        pppoe_password=ppp_pass,
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        plan=plan,
        router_id=data.get('router_id'),
        tenant_id=tenant_id,
        user=user
    )
    from app import db
    db.session.add(user)
    db.session.add(client)
    if plan and plan.id is None:
        db.session.add(plan)
    db.session.commit()

    provision_result = None
    if data.get('provision') and client.router_id and plan:
        with MikroTikService(client.router_id) as mk:
            if mk.api or mk.connect_to_router(client.router_id):
                provision_result = mk.provision_client(client, plan, data.get('config') or {})
            else:
                provision_result = {"success": False, "error": "No se pudo conectar al router."}

    payload = {"client": client.to_dict(), "user": user.to_dict(), "success": True, "password": password}
    if provision_result:
        payload["provision"] = provision_result
    return jsonify(payload), 201


@main_bp.route('/subscriptions', methods=['POST'])
@admin_required()
def create_subscription():
    data = request.get_json() or {}
    required = ['customer', 'email', 'plan', 'cycle_months', 'amount', 'next_charge', 'method']
    missing = [k for k in required if k not in data or data[k] in (None, '')]
    if missing:
        return jsonify({"error": f"Faltan campos: {', '.join(missing)}"}), 400

    tenant_id = current_tenant_id()
    subscription = Subscription(
        customer=data['customer'],
        email=data['email'],
        plan=data['plan'],
        cycle_months=int(data['cycle_months']),
        amount=float(data['amount']),
        status=data.get('status', 'active'),
        next_charge=datetime.fromisoformat(data['next_charge']).date(),
        method=data['method'],
        client_id=int(data['client_id']) if data.get('client_id') else None,
        tenant_id=tenant_id,
    )
    from app import db

    db.session.add(subscription)
    db.session.commit()
    return jsonify({"subscription": subscription.to_dict(), "success": True}), 201


@main_bp.route('/subscriptions/<int:subscription_id>', methods=['PUT', 'PATCH'])
@admin_required()
def update_subscription(subscription_id):
    data = request.get_json() or {}
    sub = db.session.get(Subscription, subscription_id)
    if not sub:
        return jsonify({"error": "Suscripcion no encontrada"}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and sub.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403
    prev_status = sub.status
    for field in ['customer', 'email', 'plan', 'method', 'status']:
        if field in data:
            setattr(sub, field, data[field])
    if 'cycle_months' in data:
        sub.cycle_months = int(data['cycle_months'])
    if 'amount' in data:
        sub.amount = float(data['amount'])
    if 'next_charge' in data:
        sub.next_charge = datetime.fromisoformat(data['next_charge']).date()

    from app import db

    db.session.add(sub)
    db.session.commit()

    # Sincronizar estado con router si hay cliente asociado
    client = sub.client or (db.session.get(Client, sub.client_id) if sub.client_id else None)
    if client and client.router_id and sub.status != prev_status:
        with MikroTikService(client.router_id) as mk:
            if sub.status == 'active':
                mk.activate_client(client)
            elif sub.status in ('past_due', 'suspended'):
                mk.suspend_client(client, reason='billing')

    return jsonify({"subscription": sub.to_dict(), "success": True}), 200


@main_bp.route('/subscriptions/<int:subscription_id>/charge', methods=['POST'])
@admin_required()
def charge_subscription(subscription_id):
    sub = db.session.get(Subscription, subscription_id)
    if not sub:
        return jsonify({"error": "Suscripcion no encontrada"}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and sub.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403
    sub.status = 'active'
    # avanzar proxima fecha segun ciclo
    days = sub.cycle_months * 30
    sub.next_charge = sub.next_charge + timedelta(days=days)
    from app import db

    db.session.add(sub)
    db.session.commit()
    client = sub.client or (db.session.get(Client, sub.client_id) if sub.client_id else None)
    if client and client.router_id:
        with MikroTikService(client.router_id) as mk:
            mk.activate_client(client)
    return jsonify({"subscription": sub.to_dict(), "success": True}), 200


@main_bp.route('/subscriptions/run-reminders', methods=['POST'])
@admin_required()
def run_subscription_reminders():
    today = datetime.utcnow().date()
    tenant_id = current_tenant_id()
    query = Subscription.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)

    updated = []
    for sub in query.all():
        days_overdue = (today - sub.next_charge).days if sub.next_charge else 0
        if sub.next_charge < today and sub.status == 'active':
            sub.status = 'past_due'
            updated.append(sub.to_dict())
        # autosuspender si lleva mas de 10 dias vencido
        if days_overdue >= 10 and sub.status == 'past_due':
            sub.status = 'suspended'
            updated.append(sub.to_dict())
            client = sub.client or (db.session.get(Client, sub.client_id) if sub.client_id else None)
            if client and client.router_id:
                with MikroTikService(client.router_id) as mk:
                    mk.suspend_client(client, reason='billing')
    if updated:
        from app import db
        db.session.commit()
    return jsonify({"updated": updated, "count": len(updated)}), 200


@main_bp.route('/subscriptions/auto-enforce', methods=['POST'])
@admin_required()
def enforce_subscription_status():
    """Suspende suscripciones vencidas y reactiva pagadas."""
    tenant_id = current_tenant_id()
    today = datetime.utcnow().date()
    query = Subscription.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)

    suspended = 0
    reactivated = 0
    for sub in query.all():
        days_overdue = (today - sub.next_charge).days if sub.next_charge else 0
        if sub.status == 'past_due' and days_overdue >= 10:
            sub.status = 'suspended'
            suspended += 1
        if sub.status in ('past_due', 'suspended') and days_overdue <= 0:
            sub.status = 'active'
            reactivated += 1
    from app import db
    db.session.commit()
    _audit("subscriptions_auto_enforce", entity_type="subscription", metadata={"suspended": suspended, "reactivated": reactivated})
    return jsonify({"success": True, "suspended": suspended, "reactivated": reactivated}), 200


@main_bp.route('/network/health', methods=['GET'])
@staff_required()
def network_health():
    tenant_id = current_tenant_id()
    return jsonify(_build_network_health_payload(tenant_id)), 200


@main_bp.route('/monitoring/metrics', methods=['GET'])
@staff_required()
def monitoring_metrics():
    """
    Devuelve series de InfluxDB para dashboards (mediante medicion y rango).
    Ejemplo: /monitoring/metrics?measurement=system_resources&range=-2h&router_id=1
    """
    measurement = (request.args.get('measurement') or '').strip()
    if not measurement:
        return jsonify({"error": "measurement is required"}), 400

    time_range = request.args.get('range') or '-1h'
    tags = {}
    for key in ('router_id', 'interface_name', 'site'):
        if request.args.get(key):
            tags[key] = request.args.get(key)

    try:
        monitoring = MonitoringService()
        series = monitoring.query_metrics(measurement, time_range=time_range, tags=tags or None)
        latest = monitoring.latest_point(measurement, tags=tags or None)
        return jsonify({
            "success": True,
            "measurement": measurement,
            "time_range": time_range,
            "tags": tags,
            "latest": latest,
            "series": series,
        }), 200
    except Exception as exc:
        current_app.logger.error("Error consultando metricas: %s", exc)
        return jsonify({"success": False, "error": "No se pudieron recuperar metricas"}), 502


@main_bp.route('/network/alerts', methods=['GET'])
@staff_required()
def network_alerts():
    tenant_id = current_tenant_id()
    alerts = _build_network_alert_items(tenant_id)
    _audit("network_alerts", entity_type="network", metadata={"count": len(alerts)})
    return jsonify({"alerts": alerts, "count": len(alerts)}), 200


@main_bp.route('/network/noc-summary', methods=['GET'])
@staff_required()
def network_noc_summary():
    tenant_id = current_tenant_id()
    routers_q = MikroTikRouter.query
    subs_q = Subscription.query
    tickets_q = Ticket.query
    if tenant_id is not None:
        routers_q = routers_q.filter_by(tenant_id=tenant_id)
        subs_q = subs_q.filter_by(tenant_id=tenant_id)
        tickets_q = tickets_q.filter_by(tenant_id=tenant_id)

    ok = routers_q.filter_by(is_active=True).count()
    down = routers_q.filter_by(is_active=False).count()
    suspended = subs_q.filter(Subscription.status.in_(('suspended', 'past_due'))).count()
    tickets_open = tickets_q.filter(Ticket.status.in_(('open', 'in_progress'))).count()

    active_alerts = down + suspended
    uptime = max(95.0, 99.9 - down * 0.5)

    return jsonify({
        "uptime": f"{uptime:.2f}%",
        "routers": {"ok": ok, "down": down},
        "suspended_clients": suspended,
        "active_alerts": active_alerts,
        "tickets_open": tickets_open,
    }), 200


@main_bp.route('/client/portal', methods=['GET'])
@jwt_required()
def client_portal_overview():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404
    client = user.client
    if not client:
        return jsonify({"error": "No existe cliente asociado."}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    invoices = _get_user_invoice_items(user, tenant_id)

    overview = {
        "plan": client.plan.name if client.plan else None,
        "router": client.router.name if client.router else None,
        "connection_type": client.connection_type,
        "ip_address": client.ip_address,
        "status": "active",
        "invoices": invoices,
        "support_links": {
            "open_ticket": "/client/tickets",
            "diagnostics": "/client/diagnostics/run"
        }
    }
    _audit("client_portal", entity_type="client_portal", entity_id=client.id, metadata={"invoices": len(invoices)})
    return jsonify(overview), 200


@main_bp.route('/client/invoices', methods=['GET'])
@jwt_required()
def client_invoices():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404
    tenant_id = current_tenant_id()
    invoices = _get_user_invoice_items(user, tenant_id)
    return jsonify({"items": invoices, "count": len(invoices)}), 200


@main_bp.route('/client/tickets', methods=['GET'])
@jwt_required()
def client_tickets_list():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    tenant_id = current_tenant_id()
    query = Ticket.query.filter_by(user_id=current_user_id)
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    tickets = query.order_by(Ticket.created_at.desc()).all()
    return jsonify({"items": [t.to_dict() for t in tickets], "count": len(tickets)}), 200


@main_bp.route('/client/tickets', methods=['POST'])
@jwt_required()
@limiter.limit("20/hour")
def client_tickets_create():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip()
    description = (data.get('description') or '').strip()
    priority = (data.get('priority') or 'medium').strip().lower()
    if not subject or not description:
        return jsonify({"error": "Asunto y descripción requeridos."}), 400
    tenant_id = current_tenant_id()
    client = Client.query.filter_by(user_id=current_user_id).first()
    ticket = Ticket(
        tenant_id=tenant_id,
        user_id=current_user_id,
        client_id=client.id if client else None,
        subject=subject,
        description=description,
        priority=priority if priority in {'low', 'medium', 'high', 'urgent'} else 'medium',
        status='open',
        sla_due_at=datetime.utcnow() + timedelta(hours=24 if priority != 'urgent' else 4),
    )
    from app import db

    db.session.add(ticket)
    db.session.commit()
    _notify_incident(f"Nuevo ticket #{ticket.id}: {subject}", severity="warning")
    return jsonify({"ticket": ticket.to_dict(), "success": True}), 201


@main_bp.route('/client/diagnostics/run', methods=['POST'])
@jwt_required()
def client_diagnostics():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    tenant_id = current_tenant_id()

    client_query = Client.query.filter_by(user_id=current_user_id)
    if tenant_id is not None:
        client_query = client_query.filter_by(tenant_id=tenant_id)
    client = client_query.first_or_404("Cliente no encontrado.")

    ping_gateway_ms = None
    ping_internet_ms = None
    packet_loss_pct = 0.0
    connection_up = False
    router_online = bool(client.router.is_active) if client.router else True

    if client.router_id:
        with MikroTikService(client.router_id) as mikrotik:
            if mikrotik.api:
                active_connections = mikrotik.get_active_connections()
                for conn in active_connections:
                    ctype = str(conn.get('type') or '').lower()
                    addr = str(conn.get('address') or '')
                    mac = str(conn.get('mac_address') or '').lower()
                    name = str(conn.get('name') or '')

                    if client.connection_type == 'pppoe' and client.pppoe_username:
                        if ctype == 'pppoe' and name == client.pppoe_username:
                            connection_up = True
                            break
                    elif client.ip_address and addr == client.ip_address:
                        connection_up = True
                        break
                    elif client.mac_address and mac and mac == client.mac_address.lower():
                        connection_up = True
                        break

        try:
            monitoring = MonitoringService()
            tags = {'router_id': str(client.router_id)}
            latest_router = monitoring.latest_point('router_stats', tags=tags)

            if latest_router:
                for key in ('ping_gateway_ms', 'gateway_latency_ms', 'latency_ms', 'ping_ms'):
                    if latest_router.get(key) is not None:
                        ping_gateway_ms = float(latest_router.get(key))
                        break
                for key in ('ping_internet_ms', 'wan_latency_ms', 'latency_ms', 'ping_ms'):
                    if latest_router.get(key) is not None:
                        ping_internet_ms = float(latest_router.get(key))
                        break
                for key in ('packet_loss_pct', 'loss_pct'):
                    if latest_router.get(key) is not None:
                        packet_loss_pct = float(latest_router.get(key))
                        break
        except Exception as exc:
            current_app.logger.info("Client diagnostics telemetry fallback: %s", exc)

    if ping_gateway_ms is None:
        ping_gateway_ms = 8.0 if router_online else 0.0
    if ping_internet_ms is None:
        ping_internet_ms = 30.0 if router_online else 0.0

    recommendations = []
    if not router_online:
        recommendations.append("El router principal aparece fuera de linea. Verifica energia y enlace uplink.")
    if not connection_up:
        recommendations.append("No se detecta sesion activa del cliente. Reinicia CPE y valida PPPoE/DHCP.")
    if packet_loss_pct > 2:
        recommendations.append("Hay perdida de paquetes elevada. Prueba conexion por cable y revisa interferencia WiFi.")
    if ping_internet_ms > 120:
        recommendations.append("Latencia alta hacia internet. Ejecuta speedtest y abre ticket con captura de resultados.")
    if not recommendations:
        recommendations.append("Enlace estable. Si percibes cortes, abre ticket y adjunta hora exacta del incidente.")

    payload = {
        "ping_gateway_ms": round(float(ping_gateway_ms), 1),
        "ping_internet_ms": round(float(ping_internet_ms), 1),
        "packet_loss_pct": round(max(0.0, float(packet_loss_pct)), 2),
        "pppoe_session": "up" if connection_up else "down",
        "recommendations": recommendations,
    }
    return jsonify(payload), 200


@main_bp.route('/tickets', methods=['GET'])
@admin_required()
def tickets_admin_list():
    tenant_id = current_tenant_id()
    status = (request.args.get('status') or '').strip().lower()
    priority = (request.args.get('priority') or '').strip().lower()
    try:
        limit = int(request.args.get('limit', 100) or 100)
    except Exception:
        limit = 100
    limit = max(1, min(limit, 200))

    query = Ticket.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=priority)

    tickets = query.order_by(Ticket.created_at.desc()).limit(limit).all()
    return jsonify({"items": [t.to_dict() for t in tickets], "count": len(tickets)}), 200


@main_bp.route('/tickets/<int:ticket_id>', methods=['PATCH'])
@admin_required()
def tickets_admin_update(ticket_id):
    tenant_id = current_tenant_id()
    ticket = db.session.get(Ticket, ticket_id)
    if not ticket:
        return jsonify({"error": "Ticket no encontrado"}), 404
    if tenant_id is not None and ticket.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    data = request.get_json() or {}
    status = (data.get('status') or ticket.status).strip().lower()
    priority = (data.get('priority') or ticket.priority).strip().lower()
    assigned_to = (data.get('assigned_to') or ticket.assigned_to or '').strip() or None

    if status not in {'open', 'in_progress', 'resolved', 'closed'}:
        return jsonify({"error": "status inválido"}), 400
    if priority not in {'low', 'medium', 'high', 'urgent'}:
        return jsonify({"error": "priority inválido"}), 400

    ticket.status = status
    ticket.priority = priority
    ticket.assigned_to = assigned_to
    if 'sla_due_at' in data:
        try:
            ticket.sla_due_at = datetime.fromisoformat(data['sla_due_at'])
        except Exception:
            pass

    from app import db

    db.session.add(ticket)
    db.session.commit()
    _notify_incident(f"Ticket #{ticket.id} actualizado: status={status}, assigned={assigned_to}", severity="info")
    return jsonify({"ticket": ticket.to_dict(), "success": True}), 200


@main_bp.route('/tickets/<int:ticket_id>/comments', methods=['POST'])
@jwt_required()
def ticket_add_comment(ticket_id):
    ticket = db.session.get(Ticket, ticket_id)
    if not ticket:
        return jsonify({"error": "Ticket no encontrado"}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and ticket.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403
    data = request.get_json() or {}
    text = (data.get('comment') or '').strip()
    if not text:
        return jsonify({"error": "El comentario es requerido."}), 400
    comment = TicketComment(ticket_id=ticket_id, user_id=_current_user_id(), comment=text)
    from app import db
    db.session.add(comment)
    db.session.commit()
    _notify_incident(f"Nuevo comentario en ticket #{ticket.id}", severity="info")
    return jsonify({"comment": comment.to_dict(), "success": True}), 201


@main_bp.route('/tickets/<int:ticket_id>/comments', methods=['GET'])
@jwt_required()
def ticket_list_comments(ticket_id):
    ticket = db.session.get(Ticket, ticket_id)
    if not ticket:
        return jsonify({"error": "Ticket no encontrado"}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and ticket.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    current_user_id = _current_user_id()
    user = db.session.get(User, current_user_id) if current_user_id else None
    if user and user.role != 'admin' and ticket.user_id not in (None, current_user_id):
        return jsonify({"error": "No tienes permiso para ver los comentarios de este ticket."}), 403

    comments = (
        TicketComment.query
        .filter_by(ticket_id=ticket_id)
        .order_by(TicketComment.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify({"items": [c.to_dict() for c in comments], "count": len(comments)}), 200


@main_bp.route('/client/notifications/preferences', methods=['GET', 'POST'])
@jwt_required()
def client_notification_preferences():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    key = f"notif_pref_{current_user_id}"
    if request.method == 'POST':
        data = request.get_json() or {}
        defaults = {"email": True, "whatsapp": False, "push": False}
        prefs = {}
        for channel, default_value in defaults.items():
            parsed = _parse_bool(data.get(channel, default_value))
            if parsed is None:
                return jsonify({"error": f"{channel} debe ser booleano"}), 400
            prefs[channel] = parsed
        cache.set(key, prefs, timeout=86400)
        return jsonify({"success": True, "preferences": prefs}), 200
    prefs = cache.get(key) or {"email": True, "whatsapp": False, "push": False}
    return jsonify({"preferences": prefs}), 200


@main_bp.route('/ops/run-job', methods=['POST'])
@admin_required()
def run_background_job():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}
    job = (data.get('job') or '').strip().lower()
    if job not in SYSTEM_ALLOWED_JOBS:
        return jsonify({"error": "job debe ser backup | cleanup_leases | rotate_passwords | recalc_balances"}), 400
    payload, code = _run_system_job_request(job, tenant_id, _current_user_id())
    return jsonify(payload), code


@main_bp.route('/payments/checkout', methods=['POST'])
@limiter.limit("20/hour")
@jwt_required()
def payments_checkout():
    data = request.get_json() or {}
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no autenticado."}), 401

    amount = float(data.get('amount') or 0)
    currency = (data.get('currency') or 'USD').upper()
    method = (data.get('method') or 'stripe').lower()
    description = data.get('description') or 'Pago ISPFAST'
    invoice_id = _parse_int(data.get('invoice_id'))
    stripe_secret = current_app.config.get('STRIPE_SECRET_KEY')
    frontend_url = current_app.config.get('FRONTEND_URL') or request.headers.get('Origin') or 'http://localhost:3000'

    if method in {'stripe', 'yape', 'nequi', 'transfer'} and not invoice_id:
        return jsonify({"error": "invoice_id es requerido para este metodo de pago"}), 400

    if not invoice_id and amount <= 0:
        return jsonify({"error": "Monto inválido"}), 400

    invoice = None
    if invoice_id:
        invoice = db.session.get(Invoice, invoice_id)
        if not invoice:
            return jsonify({"error": "Factura no encontrada"}), 404
        tenant_id = current_tenant_id()
        sub_tenant = invoice.subscription.tenant_id if invoice.subscription else None
        if tenant_id is not None and sub_tenant not in (None, tenant_id):
            return jsonify({"error": "Acceso denegado para este tenant."}), 403
        if user.role != 'admin':
            user_client_id = user.client.id if user.client else None
            sub_client_id = invoice.subscription.client_id if invoice.subscription else None
            sub_email = (invoice.subscription.email if invoice.subscription else '') or ''
            if user_client_id and sub_client_id == user_client_id:
                pass
            elif sub_email.strip().lower() == (user.email or '').strip().lower():
                pass
            else:
                return jsonify({"error": "No tienes permiso para pagar esta factura"}), 403
        amount = float(invoice.total_amount)
        currency = invoice.currency

    if amount <= 0:
        return jsonify({"error": "Monto inválido"}), 400

    if method == 'stripe':
        if not stripe_secret:
            return jsonify({"error": "Stripe no configurado"}), 503

        try:
            import stripe
            stripe.api_key = stripe_secret
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price_data": {
                            "currency": currency.lower(),
                            "unit_amount": int(amount * 100),
                            "product_data": {"name": description},
                        },
                        "quantity": 1,
                    }
                ],
                mode="payment",
                success_url=f"{frontend_url}/pagos/exito?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{frontend_url}/pagos/cancelado",
                metadata={"invoice_id": invoice_id or "", "tenant_id": current_tenant_id() or "public"},
            )
            pay_rec = PaymentRecord(invoice_id=invoice_id, method='stripe', amount=amount, currency=currency, status='pending', reference=session.id)
            db.session.add(pay_rec)
            db.session.commit()
            return jsonify({"success": True, "session_id": session.id, "payment_url": session.url}), 200
        except Exception as exc:
            current_app.logger.error("Stripe checkout error: %s", exc, exc_info=True)
            return jsonify({"error": "No se pudo iniciar el checkout con Stripe"}), 502

    if method in {'yape', 'nequi', 'transfer'}:
        pay_rec = PaymentRecord(
            invoice_id=invoice_id,
            method=method,
            amount=amount,
            currency=currency,
            status='pending',
            reference=data.get('reference'),
            meta={"note": "Pago por transferencia registrado, pendiente de conciliacion."},
        )
        db.session.add(pay_rec)
        db.session.commit()
        return jsonify({"success": True, "mode": method, "message": "Pago registrado, pendiente de confirmación."}), 201

    return jsonify({"error": "Método de pago no soportado"}), 400

@main_bp.route('/payments/webhook', methods=['POST'])
def payments_webhook():
    webhook_secret = (current_app.config.get('STRIPE_WEBHOOK_SECRET') or '').strip()
    if not webhook_secret:
        return jsonify({"success": False, "error": "Stripe webhook secret no configurado"}), 503

    payload = request.get_data(cache=False, as_text=False) or b""
    signature_header = request.headers.get('Stripe-Signature', '')
    if not _verify_stripe_signature(payload, signature_header, webhook_secret):
        return jsonify({"success": False, "error": "Firma de webhook invalida"}), 400

    try:
        event = json.loads(payload.decode('utf-8'))
    except Exception:
        return jsonify({"success": False, "error": "Payload JSON invalido"}), 400
    if not isinstance(event, dict):
        return jsonify({"success": False, "error": "Evento de webhook invalido"}), 400

    ctx = _extract_webhook_payment_context(event)
    status = ctx.get("normalized_status")
    invoice_id = ctx.get("invoice_id")
    sub_id = ctx.get("subscription_id")
    candidate_refs = ctx.get("candidate_references") or []

    if status in {'paid', 'succeeded'} and sub_id:
        sub = db.session.get(Subscription, sub_id)
        if sub:
            sub.status = 'active'
            sub.next_charge = (sub.next_charge or datetime.utcnow().date()) + timedelta(days=sub.cycle_months * 30)
            db.session.add(sub)

    invoice = db.session.get(Invoice, invoice_id) if invoice_id else None
    payment = None
    if candidate_refs:
        payment = (
            PaymentRecord.query
            .filter(
                PaymentRecord.method == 'stripe',
                PaymentRecord.reference.in_(candidate_refs),
            )
            .order_by(PaymentRecord.created_at.desc())
            .first()
        )

    reference = (
        ctx.get("payment_intent")
        or ctx.get("session_id")
        or ctx.get("event_id")
    )

    if invoice and status in {'paid', 'succeeded'}:
        invoice.status = 'paid'
        db.session.add(invoice)

        if payment:
            if payment.status != 'paid':
                payment.status = 'paid'
            if reference and payment.reference != reference:
                payment.reference = reference
            if payment.invoice_id != invoice.id:
                payment.invoice_id = invoice.id
            db.session.add(payment)
        else:
            payment = PaymentRecord(
                invoice_id=invoice.id,
                method='stripe',
                amount=invoice.total_amount,
                currency=invoice.currency,
                status='paid',
                reference=reference,
                meta={
                    "event_id": ctx.get("event_id"),
                    "event_type": ctx.get("event_type"),
                    "source": "webhook",
                },
            )
            db.session.add(payment)

    db.session.commit()
    return jsonify(
        {
            "success": True,
            "event_type": ctx.get("event_type"),
            "invoice_found": bool(invoice),
            "payment_record_id": payment.id if payment else None,
        }
    ), 200


@main_bp.route('/billing/electronic/send', methods=['POST'])
@admin_required()
def billing_electronic_send():
    data = request.get_json() or {}
    invoice_id = data.get('invoice_id')
    if not invoice_id:
        return jsonify({"error": "invoice_id es requerido."}), 400

    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        return jsonify({"error": "Factura no encontrada."}), 404

    tenant_id = current_tenant_id()
    sub_tenant = invoice.subscription.tenant_id if invoice.subscription else None
    if tenant_id is not None and sub_tenant not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    country = (data.get('country') or 'PE').upper()
    if country not in {'PE', 'CO', 'MX', 'CL'}:
        return jsonify({"error": "Pais no soportado para facturacion electronica."}), 400

    invoice.country = country
    db.session.add(invoice)
    db.session.commit()

    status = "accepted" if invoice.status == "paid" else ("rejected" if invoice.status == "cancelled" else "processing")
    response = {
        "invoice_id": invoice.id,
        "country": country,
        "status": status,
        "message": "Factura electronica aceptada" if status == "accepted" else (
            "Factura electronica en proceso" if status == "processing" else "Factura electronica rechazada"
        ),
    }
    return jsonify(response), 200


@main_bp.route('/billing/electronic/status', methods=['GET'])
@staff_required()
def billing_electronic_status():
    invoice_id = request.args.get('invoice_id')
    if not invoice_id:
        return jsonify({"error": "invoice_id es requerido."}), 400

    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        return jsonify({"error": "Factura no encontrada."}), 404

    tenant_id = current_tenant_id()
    sub_tenant = invoice.subscription.tenant_id if invoice.subscription else None
    if tenant_id is not None and sub_tenant not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    status = "accepted" if invoice.status == "paid" else ("rejected" if invoice.status == "cancelled" else "processing")
    return jsonify(
        {
            "invoice_id": invoice.id,
            "country": invoice.country or (invoice.subscription.country if invoice.subscription else None),
            "status": status,
            "message": "Factura electronica aceptada" if status == "accepted" else (
                "Factura electronica en proceso" if status == "processing" else "Factura electronica rechazada"
            ),
        }
    ), 200


@main_bp.route('/runbooks', methods=['GET'])
@staff_required()
def runbooks():
    books = [
        {"id": "RB-001", "title": "Cliente sin navegacion", "steps": ["Ping gateway", "Reiniciar CPE", "Verificar colas", "Abrir ticket si persiste"]},
        {"id": "RB-002", "title": "Alto uso de CPU en RouterOS", "steps": ["Export stats", "Revisar firewall rules", "Limitar conexiones", "Programar mantenimiento"]},
    ]
    return jsonify({"items": books, "count": len(books)}), 200


@main_bp.route('/prometheus/metrics', methods=['GET'])
def prometheus_metrics():
    tenant_id = current_tenant_id()
    data = _build_network_health_payload(tenant_id)
    alerts_count = len(_build_network_alert_items(tenant_id))
    content = [
        "# HELP ispfast_network_health_score Health score",
        "# TYPE ispfast_network_health_score gauge",
        f"ispfast_network_health_score {data.get('score', 0)}",
        "# HELP ispfast_alerts_total Total alertas activas",
        "# TYPE ispfast_alerts_total gauge",
        f"ispfast_alerts_total {alerts_count}",
    ]
    return Response("\n".join(content) + "\n", mimetype="text/plain")


@main_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    tenant_id = current_tenant_id()

    query = Client.query.filter_by(user_id=current_user_id)
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)

    client = query.first_or_404()
    with MikroTikService(client.router_id) as mikrotik:
        stats = mikrotik.get_client_dashboard_stats(client)
        return jsonify(stats), 200


@main_bp.route('/clients/map-data', methods=['GET'])
@staff_required()
def get_clients_for_map():
    mikrotik = MikroTikService()
    client_data = mikrotik.get_all_clients_with_location()
    return jsonify(client_data), 200


@main_bp.route('/clients/<int:client_id>/reboot-cpe', methods=['POST'])
@jwt_required()
def reboot_client_cpe(client_id):
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    user = db.session.get(User, current_user_id)
    if not user:
        return jsonify({"error": "Usuario no autenticado."}), 401

    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({"error": "Cliente no encontrado"}), 404
    if not tenant_access_allowed(client.tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    if user.role != 'admin' and client.user_id != current_user_id:
        return jsonify({"error": "No tienes permiso para reiniciar este equipo."}), 403

    if not client.router_id:
        return jsonify({"error": "El cliente no tiene un router asociado."}), 400

    with MikroTikService(client.router_id) as mikrotik:
        success, message = mikrotik.reboot_client_cpe(client)
        if success:
            return jsonify({"success": True, "message": message}), 200
        return jsonify({"error": message}), 400


@main_bp.route('/clients/<int:client_id>/history', methods=['GET'])
@admin_required()
def get_client_history(client_id):
    with MikroTikService() as mikrotik:
        history = mikrotik.get_client_event_history(client_id)
        return jsonify(sorted(history, key=lambda x: x['timestamp'], reverse=True)), 200


@main_bp.route('/clients/usage-history', methods=['GET'])
@jwt_required()
def get_usage_history():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    tenant_id = current_tenant_id()

    query = Client.query.filter_by(user_id=current_user_id)
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    query.first_or_404("Cliente no encontrado.")

    range_str = request.args.get('range', '30d')
    days = 30
    if range_str == '7d':
        days = 7
    elif range_str == '90d':
        days = 90

    today = datetime.utcnow().date()
    labels = [(today - timedelta(days=i)).strftime('%b %d') for i in range(days - 1, -1, -1)]

    data_points = [0.0] * days
    try:
        client = query.first()
        tags = {}
        if client and client.router_id:
            tags['router_id'] = str(client.router_id)
        monitoring = MonitoringService()
        series = monitoring.query_metrics('interface_traffic', time_range=f'-{days}d', tags=tags or None)
        # Aggregate bytes to GB per day if available
        for point in series:
            ts = point.get('_time') or point.get('time')
            rx = float(point.get('rx_bytes', 0) or 0)
            tx = float(point.get('tx_bytes', 0) or 0)
            total_gb = (rx + tx) / (1024**3)
            parsed_ts = _parse_iso_datetime(ts)
            if parsed_ts:
                day_idx = (today - parsed_ts.date()).days
                if 0 <= day_idx < days:
                    data_points[days - 1 - day_idx] += total_gb
    except Exception as exc:
        current_app.logger.info("Uso histórico usando fallback: %s", exc)
        data_points = [0.0] * days

    usage_data = {
        "labels": labels,
        "datasets": [
            {
                "label": "Uso de Datos (GB)",
                "data": [round(v, 2) for v in data_points],
                "borderColor": 'rgb(54, 162, 235)',
                "backgroundColor": 'rgba(54, 162, 235, 0.2)',
                "fill": True,
            }
        ],
    }
    return jsonify(usage_data), 200


@main_bp.route('/admin/routers/usage', methods=['GET'])
@admin_required()
def admin_router_usage():
    """
    Métricas resumidas por router (requiere Influx con measurement 'interface_traffic' y tag router_id).
    Devuelve rx/tx en Mbps y, si existe 'router_stats', cpu/mem.
    """
    tenant_id = current_tenant_id()
    monitoring = MonitoringService()

    traffic = monitoring.query_metrics(
        'interface_traffic',
        time_range='-15m',
        tags={'tenant_id': str(tenant_id)} if tenant_id else None,
    )

    router_map = {}
    for point in traffic:
        rid = point.get('router_id') or point.get('router')
        if not rid:
            continue
        rx = float(point.get('rx_bytes', 0) or 0)
        tx = float(point.get('tx_bytes', 0) or 0)
        entry = router_map.setdefault(rid, {'router_id': rid, 'rx_mbps': 0.0, 'tx_mbps': 0.0})
        entry['rx_mbps'] += rx * 8 / 1_000_000
        entry['tx_mbps'] += tx * 8 / 1_000_000

    stats = monitoring.query_metrics(
        'router_stats',
        time_range='-15m',
        tags={'tenant_id': str(tenant_id)} if tenant_id else None,
    )
    for point in stats:
        rid = point.get('router_id') or point.get('router')
        if not rid:
            continue
        entry = router_map.setdefault(rid, {'router_id': rid, 'rx_mbps': 0.0, 'tx_mbps': 0.0})
        if point.get('cpu') is not None:
            entry['cpu'] = point.get('cpu')
        if point.get('cpu_percent') is not None:
            entry['cpu'] = point.get('cpu_percent')
        if point.get('mem') is not None:
            entry['mem'] = point.get('mem')
        if point.get('mem_percent') is not None:
            entry['mem'] = point.get('mem_percent')

    result = list(router_map.values())
    return jsonify({"items": result, "count": len(result)}), 200


@main_bp.route('/admin/clients', methods=['GET'])
@admin_required()
def admin_list_clients():
    tenant_id = current_tenant_id()
    query = Client.query.options(joinedload(Client.plan))
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    clients = []
    for c in query.all():
        subs = c.subscriptions or []
        status = subs[0].status if subs else 'active'
        clients.append({
            "id": c.id,
            "name": c.full_name,
            "ip_address": c.ip_address,
            "plan": c.plan.name if c.plan else None,
            "plan_id": c.plan_id,
            "router_id": c.router_id,
            "status": status,
        })
    return jsonify({"items": clients, "count": len(clients)}), 200


@main_bp.route('/admin/clients', methods=['POST'])
@admin_required()
def admin_create_client():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    ip = (data.get('ip_address') or '').strip() or None
    connection_type = (data.get('connection_type') or 'pppoe').strip().lower()
    plan_id = data.get('plan_id')
    router_id = data.get('router_id')
    if not name:
        return jsonify({"error": "name es requerido"}), 400
    if not plan_id:
        return jsonify({"error": "plan_id es requerido"}), 400
    plan = db.session.get(Plan, plan_id)
    if not plan:
        return jsonify({"error": "Plan no encontrado"}), 404
    router = db.session.get(MikroTikRouter, router_id) if router_id else None
    tenant_id = current_tenant_id()
    if tenant_id:
        if router and router.tenant_id not in (None, tenant_id):
            return jsonify({"error": "Router fuera del tenant"}), 403
        if plan.tenant_id not in (None, tenant_id):
            return jsonify({"error": "Plan fuera del tenant"}), 403
    client = Client(
        full_name=name,
        ip_address=ip,
        connection_type=connection_type,
        plan_id=plan.id,
        router_id=router.id if router else None,
        tenant_id=tenant_id,
        pppoe_username=data.get('pppoe_username'),
        pppoe_password=data.get('pppoe_password'),
    )
    from app import db
    db.session.add(client)
    db.session.commit()
    return jsonify({"client": client.to_dict()}), 201


# ==================== RED: SUSPENDER / ACTIVAR / CAMBIAR VELOCIDAD ====================

@main_bp.route('/admin/clients/<int:client_id>/suspend', methods=['POST'])
@admin_required()
def suspend_client(client_id):
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({"error": "Cliente no encontrado"}), 404
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403
    if not client.router_id:
        return jsonify({"error": "Cliente sin router asociado"}), 400
    plan = client.plan or db.session.get(Plan, client.plan_id) if client.plan_id else None
    with MikroTikService(client.router_id) as mikrotik:
        ok = mikrotik.suspend_client(client)
    if ok and client.subscriptions:
        client.subscriptions[0].status = 'suspended'
        db.session.commit()
        _notify_incident(f"Suspendido cliente {client.full_name}", severity="warning")
        _notify_client(client, "Aviso de suspensión", "Tu servicio ha sido suspendido por pago pendiente. Regulariza para reactivarlo.")
    return (jsonify({"success": True}), 200) if ok else (jsonify({"error": "No se pudo suspender en MikroTik"}), 500)


@main_bp.route('/admin/clients/<int:client_id>/activate', methods=['POST'])
@admin_required()
def activate_client(client_id):
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({"error": "Cliente no encontrado"}), 404
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403
    plan = client.plan or db.session.get(Plan, client.plan_id) if client.plan_id else None
    if not client.router_id:
        return jsonify({"error": "Cliente sin router asociado"}), 400
    with MikroTikService(client.router_id) as mikrotik:
        ok = mikrotik.activate_client(client, plan)
    if ok and client.subscriptions:
        client.subscriptions[0].status = 'active'
        db.session.commit()
        _notify_incident(f"Reactivado cliente {client.full_name}", severity="info")
        _notify_client(client, "Servicio reactivado", "Tu servicio ha sido reactivado. Gracias por ponerte al día.")
    return (jsonify({"success": True}), 200) if ok else (jsonify({"error": "No se pudo activar en MikroTik"}), 500)


@main_bp.route('/admin/clients/<int:client_id>/speed', methods=['POST'])
@admin_required()
def change_client_speed(client_id):
    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    if not plan_id:
        raise BadRequest("plan_id es requerido")
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({"error": "Cliente no encontrado"}), 404
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403
    plan = db.session.get(Plan, plan_id)
    if not plan:
        return jsonify({"error": "Plan no encontrado"}), 404
    if not client.router_id:
        return jsonify({"error": "Cliente sin router asociado"}), 400
    with MikroTikService(client.router_id) as mikrotik:
        ok = mikrotik.change_speed(client, plan)
    return (jsonify({"success": True}), 200) if ok else (jsonify({"error": "No se pudo cambiar velocidad"}), 500)


@main_bp.route('/admin/clients/<int:client_id>/scripts', methods=['GET'])
@admin_required()
def get_client_scripts(client_id):
    client = db.session.get(Client, client_id)
    if not client:
        return jsonify({"error": "Cliente no encontrado"}), 404
    plan = client.plan or (db.session.get(Plan, client.plan_id) if client.plan_id else None)
    if not plan:
        return jsonify({"error": "Plan no encontrado"}), 400
    ppp_profile = f"profile_{plan.name.lower().replace(' ','_')}"
    scripts = {
        "provision_pppoe": f"""/ppp/profile/add name={ppp_profile} rate-limit={plan.download_speed}M/{plan.upload_speed}M
/ppp/secret/add name={client.pppoe_username or f'user{client.id}'} password={client.pppoe_password or 'changeme'} service=pppoe profile={ppp_profile} comment=\"{client.full_name}\"
""",
        "suspend": f"""/ppp/secret/set [find name={client.pppoe_username or f'user{client.id}'}] disabled=yes comment=\"suspended\"
/ip/firewall/address-list/add list=suspended address={client.ip_address or '0.0.0.0'} comment=\"{client.full_name}\"
""",
        "activate": f"""/ppp/secret/set [find name={client.pppoe_username or f'user{client.id}'}] disabled=no comment=\"{client.full_name}\"
/ip/firewall/address-list/remove [find list=suspended address={client.ip_address or '0.0.0.0'}]
""",
    }
    return jsonify({"client": client.to_dict(), "scripts": scripts}), 200


@main_bp.route('/admin/routers/<int:router_id>/backup', methods=['POST'])
@admin_required()
def backup_router(router_id):
    with MikroTikService(router_id) as mikrotik:
        filename = mikrotik.export_backup()
    if not filename:
        return jsonify({"error": "No se pudo generar backup"}), 500
    return jsonify({"success": True, "filename": filename}), 200


@main_bp.route('/admin/backups/db', methods=['POST'])
@admin_required()
def backup_db():
    """Ejecuta pg_dump y guarda en el directorio configurado."""
    tenant_id = current_tenant_id()
    base = _ensure_backup_dir()
    ts = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    backup_name = f"db-backup-{ts}.sql"
    file_path = base / backup_name
    database_url = (
        current_app.config.get('SQLALCHEMY_DATABASE_URI')
        or os.environ.get('DATABASE_URL')
    )
    if not database_url or not str(database_url).startswith('postgres'):
        return jsonify({"error": "Backup DB requiere SQLALCHEMY_DATABASE_URI Postgres"}), 503

    pg_dump_path = current_app.config.get('PG_DUMP_PATH', 'pg_dump')
    try:
        cmd = [pg_dump_path, database_url]
        with file_path.open('w', encoding='utf-8') as f:
            subprocess.check_call(cmd, stdout=f)
        retention_days = _retention_days_for_tenant(tenant_id)
        prune_result = _prune_backup_directory(retention_days, base=base)
        return jsonify(
            {
                "success": True,
                "filename": backup_name,
                "retention_days": retention_days,
                "prune": prune_result,
            }
        ), 200
    except Exception as e:
        current_app.logger.error("No se pudo generar backup DB: %s", e, exc_info=True)
        return jsonify({"error": f"No se pudo generar backup DB: {e}"}), 500


@main_bp.route('/admin/backups/list', methods=['GET'])
@admin_required()
def list_backups():
    tenant_id = current_tenant_id()
    base = _backup_dir_path()
    files = []
    if base.exists():
        for file_path in sorted(
            (item for item in base.iterdir() if item.is_file()),
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        ):
            files.append(_backup_item_payload(file_path))
    retention_days = _retention_days_for_tenant(tenant_id)
    return jsonify(
        {
            "items": files,
            "count": len(files),
            "directory": str(base),
            "retention_days": retention_days,
        }
    ), 200


@main_bp.route('/admin/backups/prune', methods=['POST'])
@admin_required()
def prune_backups():
    tenant_id = current_tenant_id()
    data = request.get_json(silent=True) or {}
    requested_days = data.get('retention_days')

    if requested_days is None:
        retention_days = _retention_days_for_tenant(tenant_id)
    else:
        try:
            retention_days = int(requested_days)
        except (TypeError, ValueError):
            return jsonify({"error": "retention_days debe ser entero"}), 400
        if retention_days < 1 or retention_days > 365:
            return jsonify({"error": "retention_days debe estar entre 1 y 365"}), 400

    result = _prune_backup_directory(retention_days)
    return jsonify({"success": True, "prune": result}), 200


@main_bp.route('/admin/backups/download', methods=['GET'])
@admin_required()
def download_backup():
    name = request.args.get('name')
    if not _is_safe_backup_name(name):
        return jsonify({"error": "name requerido"}), 400
    base = _backup_dir_path()
    if not base.exists():
        return jsonify({"error": "backup no encontrado"}), 404

    file_path = (base / name).resolve()
    if file_path.parent != base or not file_path.exists() or not file_path.is_file() or file_path.is_symlink():
        return jsonify({"error": "backup no encontrado"}), 404
    return send_from_directory(directory=str(base), path=file_path.name, as_attachment=True)


@main_bp.route('/admin/backups/verify', methods=['GET'])
@admin_required()
def verify_backups():
    base = _backup_dir_path()
    requested_name = (request.args.get('name') or '').strip()
    if requested_name and not _is_safe_backup_name(requested_name):
        return jsonify({"error": "name invalido"}), 400

    if not base.exists():
        if requested_name:
            return jsonify({"error": "backup no encontrado"}), 404
        return jsonify({"valid": True, "count": 0, "items": []}), 200

    if requested_name:
        target = (base / requested_name).resolve()
        if target.parent != base or not target.exists() or not target.is_file() or target.is_symlink():
            return jsonify({"error": "backup no encontrado"}), 404
        targets = [target]
    else:
        targets = sorted(
            (item for item in base.iterdir() if item.is_file() and not item.is_symlink()),
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        )

    items = []
    all_valid = True
    for file_path in targets:
        try:
            payload = _backup_item_payload(file_path, include_hash=True)
            issues = []
            if payload["size"] <= 0:
                issues.append("empty_file")
            payload["valid"] = len(issues) == 0
            payload["issues"] = issues
        except Exception as exc:
            payload = {
                "name": file_path.name,
                "valid": False,
                "issues": [f"read_error:{exc}"],
            }
        items.append(payload)
        all_valid = all_valid and bool(payload.get("valid"))

    return jsonify({"valid": all_valid, "count": len(items), "items": items}), 200


# ==================== ADMIN: STAFF / INVENTORY / NOTIFICATIONS ====================

@main_bp.route('/admin/staff', methods=['GET'])
@admin_required()
def admin_staff_list():
    tenant_id = current_tenant_id()
    query = User.query.filter(User.role != 'client')
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    users = query.order_by(User.name.asc()).all()

    metadata_map = _load_staff_meta(tenant_id)
    assigned_counts = _ticket_assignee_counts(tenant_id)

    items = []
    for user in users:
        meta = metadata_map.get(str(user.id), {})
        items.append(_serialize_staff_member(user, meta, assigned_counts))

    role_filter = (request.args.get('role') or '').strip().lower()
    status_filter = (request.args.get('status') or '').strip().lower()
    search = (request.args.get('q') or '').strip().lower()

    if role_filter:
        items = [item for item in items if str(item.get("role", "")).lower() == role_filter]
    if status_filter:
        items = [item for item in items if str(item.get("status", "")).lower() == status_filter]
    if search:
        items = [
            item for item in items
            if search in str(item.get("name", "")).lower()
            or search in str(item.get("email", "")).lower()
            or search in str(item.get("zone", "")).lower()
        ]

    _audit("staff_list", entity_type="staff", metadata={"count": len(items), "tenant_id": tenant_id})
    return jsonify({"items": items, "count": len(items)}), 200


@main_bp.route('/admin/staff', methods=['POST'])
@admin_required()
def admin_staff_create():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    role = (data.get('role') or 'tech').strip().lower()

    if not name or not email:
        return jsonify({"error": "name y email son requeridos"}), 400
    if role not in STAFF_ALLOWED_ROLES:
        return jsonify({"error": f"role invalido. permitidos: {', '.join(sorted(STAFF_ALLOWED_ROLES))}"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Ya existe un usuario con ese email"}), 409

    supplied_password = (data.get('password') or '').strip()
    temporary_password = supplied_password or secrets.token_urlsafe(10)
    mfa_enabled = _parse_bool(data.get('mfa_enabled', False))
    if mfa_enabled is None:
        return jsonify({"error": "mfa_enabled debe ser booleano"}), 400

    user = User(
        name=name,
        email=email,
        role=role,
        tenant_id=tenant_id,
        mfa_enabled=mfa_enabled,
    )
    if user.mfa_enabled:
        user.mfa_secret = pyotp.random_base32()
    user.set_password(temporary_password)

    db.session.add(user)
    db.session.commit()

    status = str(data.get('status') or 'active').strip().lower()
    shift = str(data.get('shift') or 'day').strip().lower()
    metadata_map = _load_staff_meta(tenant_id)
    metadata_map[str(user.id)] = {
        "zone": str(data.get('zone') or 'general').strip() or 'general',
        "phone": str(data.get('phone') or '').strip(),
        "status": status if status in STAFF_ALLOWED_STATUS else "active",
        "shift": shift if shift in STAFF_ALLOWED_SHIFTS else "day",
        "last_seen_at": _iso_utc_now(),
    }
    _save_staff_meta(tenant_id, metadata_map)

    item = _serialize_staff_member(user, metadata_map[str(user.id)], {})
    response = {"staff": item, "success": True}
    if not supplied_password:
        response["temporary_password"] = temporary_password
    _audit("staff_create", entity_type="staff", entity_id=user.id, metadata={"email": user.email, "role": user.role})
    return jsonify(response), 201


@main_bp.route('/admin/staff/<int:staff_id>', methods=['PATCH'])
@admin_required()
def admin_staff_update(staff_id):
    tenant_id = current_tenant_id()
    user = db.session.get(User, staff_id)
    if not user:
        return jsonify({"error": "Usuario de staff no encontrado"}), 404
    if tenant_id is not None and user.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    data = request.get_json() or {}
    if 'name' in data:
        name = str(data.get('name') or '').strip()
        if not name:
            return jsonify({"error": "name no puede estar vacio"}), 400
        user.name = name

    if 'role' in data:
        role = str(data.get('role') or '').strip().lower()
        if role not in STAFF_ALLOWED_ROLES:
            return jsonify({"error": f"role invalido. permitidos: {', '.join(sorted(STAFF_ALLOWED_ROLES))}"}), 400
        user.role = role

    if 'mfa_enabled' in data:
        mfa_enabled = _parse_bool(data.get('mfa_enabled'))
        if mfa_enabled is None:
            return jsonify({"error": "mfa_enabled debe ser booleano"}), 400
        user.mfa_enabled = mfa_enabled
        if mfa_enabled and not user.mfa_secret:
            user.mfa_secret = pyotp.random_base32()
        if not mfa_enabled:
            user.mfa_secret = None

    if data.get('password'):
        user.set_password(str(data.get('password')))

    metadata_map = _load_staff_meta(tenant_id)
    current_meta = metadata_map.get(str(user.id), {})
    if 'zone' in data:
        current_meta['zone'] = str(data.get('zone') or '').strip() or 'general'
    if 'phone' in data:
        current_meta['phone'] = str(data.get('phone') or '').strip()
    if 'status' in data:
        status = str(data.get('status') or '').strip().lower()
        if status not in STAFF_ALLOWED_STATUS:
            return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(STAFF_ALLOWED_STATUS))}"}), 400
        current_meta['status'] = status
    if 'shift' in data:
        shift = str(data.get('shift') or '').strip().lower()
        if shift not in STAFF_ALLOWED_SHIFTS:
            return jsonify({"error": f"shift invalido. permitidos: {', '.join(sorted(STAFF_ALLOWED_SHIFTS))}"}), 400
        current_meta['shift'] = shift
    if data.get('touch_last_seen'):
        current_meta['last_seen_at'] = _iso_utc_now()

    metadata_map[str(user.id)] = current_meta
    _save_staff_meta(tenant_id, metadata_map)

    db.session.add(user)
    db.session.commit()

    item = _serialize_staff_member(user, current_meta, _ticket_assignee_counts(tenant_id))
    _audit("staff_update", entity_type="staff", entity_id=user.id, metadata={"changes": list(data.keys())})
    return jsonify({"staff": item, "success": True}), 200


@main_bp.route('/admin/inventory/summary', methods=['GET'])
@admin_required()
def admin_inventory_summary():
    tenant_id = current_tenant_id()

    clients_query = Client.query.options(joinedload(Client.plan))
    routers_query = MikroTikRouter.query
    if tenant_id is not None:
        clients_query = clients_query.filter_by(tenant_id=tenant_id)
        routers_query = routers_query.filter_by(tenant_id=tenant_id)

    clients = clients_query.all()
    routers_count = routers_query.count()
    clients_count = len(clients)

    defaults = [
        {
            "sku": "ONU-GPON",
            "name": "ONU GPON",
            "category": "onu",
            "total": max(30, clients_count + 20),
            "assigned": clients_count,
            "reorder_point": 15,
            "unit": "units",
        },
        {
            "sku": "CPE-DUAL",
            "name": "Router CPE Dual Band",
            "category": "cpe",
            "total": max(40, clients_count + 35),
            "assigned": clients_count,
            "reorder_point": 20,
            "unit": "units",
        },
        {
            "sku": "ROUTER-CORE",
            "name": "MikroTik Core Router",
            "category": "router",
            "total": max(8, routers_count + 3),
            "assigned": routers_count,
            "reorder_point": 3,
            "unit": "units",
        },
        {
            "sku": "FIBER-SM",
            "name": "Fibra Monomodo",
            "category": "fiber",
            "total": max(80.0, round(clients_count * 0.11 + 40.0, 1)),
            "assigned": round(clients_count * 0.065, 1),
            "reorder_point": 25.0,
            "unit": "km",
        },
    ]

    items = []
    alerts = []
    for raw in defaults:
        available = round(max(0, raw["total"] - raw["assigned"]), 1 if raw["unit"] == "km" else 0)
        if available <= raw["reorder_point"] * 0.5:
            level = "critical"
        elif available <= raw["reorder_point"]:
            level = "warning"
        else:
            level = "ok"
        item = {
            **raw,
            "available": available,
            "status": level,
            "updated_at": _iso_utc_now(),
        }
        items.append(item)
        if level != "ok":
            alerts.append({
                "sku": raw["sku"],
                "name": raw["name"],
                "level": level,
                "available": available,
                "reorder_point": raw["reorder_point"],
            })

    plan_distribution_map: dict[str, int] = {}
    for client in clients:
        plan_name = client.plan.name if client.plan else "Sin plan"
        plan_distribution_map[plan_name] = plan_distribution_map.get(plan_name, 0) + 1
    plan_distribution = [
        {"plan": plan, "clients": count}
        for plan, count in sorted(plan_distribution_map.items(), key=lambda item: item[1], reverse=True)[:8]
    ]

    summary = {
        "clients_total": clients_count,
        "routers_total": routers_count,
        "stock_items": len(items),
        "low_stock_items": len(alerts),
        "available_units": round(sum(float(item["available"]) for item in items), 1),
        "updated_at": _iso_utc_now(),
    }
    _audit("inventory_summary", entity_type="inventory", metadata=summary)
    return jsonify({
        "summary": summary,
        "items": items,
        "alerts": alerts,
        "plan_distribution": plan_distribution,
    }), 200


@main_bp.route('/admin/notifications/history', methods=['GET'])
@admin_required()
def admin_notifications_history():
    tenant_id = current_tenant_id()
    try:
        limit = int(request.args.get('limit', 50) or 50)
    except Exception:
        limit = 50
    limit = max(1, min(limit, 200))
    history = _load_notification_history(tenant_id)
    return jsonify({"items": history[:limit], "count": min(len(history), limit)}), 200


@main_bp.route('/admin/notifications/send', methods=['POST'])
@admin_required()
def admin_notifications_send():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    message = (data.get('message') or '').strip()
    if not title or not message:
        return jsonify({"error": "title y message son requeridos"}), 400

    channel = (data.get('channel') or 'push').strip().lower()
    if channel not in {'push', 'email', 'whatsapp', 'system'}:
        return jsonify({"error": "channel invalido: push | email | whatsapp | system"}), 400

    audience = (data.get('audience') or 'all').strip().lower()
    if audience not in {'all', 'active', 'overdue', 'suspended'}:
        return jsonify({"error": "audience invalido: all | active | overdue | suspended"}), 400

    router_id_raw = data.get('router_id')
    router_id = None
    if router_id_raw not in (None, ''):
        try:
            router_id = int(router_id_raw)
        except Exception:
            return jsonify({"error": "router_id debe ser numerico"}), 400
    plan_name = (data.get('plan') or '').strip().lower()

    clients_query = Client.query.options(joinedload(Client.plan), joinedload(Client.subscriptions))
    if tenant_id is not None:
        clients_query = clients_query.filter_by(tenant_id=tenant_id)
    if router_id:
        clients_query = clients_query.filter_by(router_id=router_id)

    selected_clients = []
    for client in clients_query.all():
        if plan_name:
            client_plan = (client.plan.name if client.plan else "").strip().lower()
            if client_plan != plan_name:
                continue
        status = "active"
        if client.subscriptions:
            status = (client.subscriptions[0].status or "active").strip().lower()
        if audience == 'active' and status not in {'active', 'trial'}:
            continue
        if audience == 'overdue' and status != 'past_due':
            continue
        if audience == 'suspended' and status != 'suspended':
            continue
        selected_clients.append(client)

    entry = {
        "id": secrets.token_hex(8),
        "title": title,
        "message": message,
        "channel": channel,
        "audience": audience,
        "plan": plan_name or None,
        "router_id": router_id,
        "target_count": len(selected_clients),
        "status": "sent",
        "created_by": _current_user_id(),
        "sent_at": _iso_utc_now(),
    }

    history = _load_notification_history(tenant_id)
    history.insert(0, entry)
    _save_notification_history(tenant_id, history)
    _notify_incident(f"Notificacion masiva ({channel}) enviada: {title} -> {len(selected_clients)} destinos", severity="info")
    _audit("notification_send", entity_type="notification", entity_id=entry["id"], metadata=entry)

    return jsonify({"success": True, "notification": entry}), 201


# ==================== ADMIN: FINANCE / INSTALLATIONS / CONTENT / SYSTEM ====================

@main_bp.route('/admin/finance/summary', methods=['GET'])
@admin_required()
def admin_finance_summary():
    tenant_id = current_tenant_id()
    now = datetime.utcnow()
    today = now.date()

    subscriptions_query = Subscription.query
    invoices_query = Invoice.query.join(Subscription, Invoice.subscription_id == Subscription.id)
    payments_query = PaymentRecord.query.join(Invoice, PaymentRecord.invoice_id == Invoice.id).join(
        Subscription, Invoice.subscription_id == Subscription.id
    )

    if tenant_id is not None:
        subscriptions_query = subscriptions_query.filter(Subscription.tenant_id == tenant_id)
        invoices_query = invoices_query.filter(Subscription.tenant_id == tenant_id)
        payments_query = payments_query.filter(Subscription.tenant_id == tenant_id)

    subscriptions = subscriptions_query.all()
    invoices = invoices_query.order_by(Invoice.created_at.desc()).all()
    payments = payments_query.order_by(PaymentRecord.created_at.desc()).all()

    active_status = {"active", "trial"}
    mrr = round(sum(float(sub.amount or 0) for sub in subscriptions if sub.status in active_status), 2)
    arr = round(mrr * 12, 2)

    pending_invoices = [invoice for invoice in invoices if invoice.status == 'pending']
    overdue_invoices = [invoice for invoice in pending_invoices if invoice.due_date and invoice.due_date < today]
    pending_balance = round(sum(float(invoice.total_amount or 0) for invoice in pending_invoices), 2)
    overdue_balance = round(sum(float(invoice.total_amount or 0) for invoice in overdue_invoices), 2)

    paid_this_month = round(
        sum(
            float(payment.amount or 0)
            for payment in payments
            if payment.status == 'paid'
            and payment.created_at
            and payment.created_at.year == now.year
            and payment.created_at.month == now.month
        ),
        2,
    )
    pending_this_month = round(
        sum(
            float(invoice.total_amount or 0)
            for invoice in pending_invoices
            if invoice.due_date and invoice.due_date.year == now.year and invoice.due_date.month == now.month
        ),
        2,
    )
    denominator = paid_this_month + pending_this_month
    collection_rate = round((paid_this_month / denominator) * 100, 2) if denominator > 0 else 100.0

    overdue_clients = [sub for sub in subscriptions if sub.status == 'past_due']
    suspended_clients = [sub for sub in subscriptions if sub.status == 'suspended']
    top_debtors = [
        {
            "subscription_id": sub.id,
            "customer": sub.customer,
            "amount": float(sub.amount or 0),
            "status": sub.status,
            "next_charge": sub.next_charge.isoformat() if sub.next_charge else None,
        }
        for sub in sorted(overdue_clients + suspended_clients, key=lambda row: float(row.amount or 0), reverse=True)[:10]
    ]

    aging = {
        "current": 0.0,
        "days_1_30": 0.0,
        "days_31_60": 0.0,
        "days_61_90": 0.0,
        "days_90_plus": 0.0,
    }
    for invoice in pending_invoices:
        amount = float(invoice.total_amount or 0)
        if not invoice.due_date:
            aging["current"] += amount
            continue
        days_overdue = (today - invoice.due_date).days
        if days_overdue <= 0:
            aging["current"] += amount
        elif days_overdue <= 30:
            aging["days_1_30"] += amount
        elif days_overdue <= 60:
            aging["days_31_60"] += amount
        elif days_overdue <= 90:
            aging["days_61_90"] += amount
        else:
            aging["days_90_plus"] += amount
    aging = {bucket: round(value, 2) for bucket, value in aging.items()}

    cursor = date(today.year, today.month, 1)
    months: list[date] = []
    for _ in range(6):
        months.append(cursor)
        prev_year = cursor.year
        prev_month = cursor.month - 1
        if prev_month == 0:
            prev_month = 12
            prev_year -= 1
        cursor = date(prev_year, prev_month, 1)
    months.reverse()

    cashflow_map: dict[str, dict] = {}
    for month_point in months:
        key = month_point.strftime('%Y-%m')
        cashflow_map[key] = {"label": month_point.strftime('%b %Y'), "paid": 0.0, "pending": 0.0}

    for payment in payments:
        if payment.status != 'paid' or not payment.created_at:
            continue
        key = payment.created_at.strftime('%Y-%m')
        if key in cashflow_map:
            cashflow_map[key]["paid"] += float(payment.amount or 0)

    for invoice in pending_invoices:
        if not invoice.due_date:
            continue
        key = invoice.due_date.strftime('%Y-%m')
        if key in cashflow_map:
            cashflow_map[key]["pending"] += float(invoice.total_amount or 0)

    cashflow = [
        {"label": row["label"], "paid": round(row["paid"], 2), "pending": round(row["pending"], 2)}
        for row in cashflow_map.values()
    ]

    recent_invoices = []
    for invoice in invoices[:20]:
        subscription = invoice.subscription
        recent_invoices.append(
            {
                "id": invoice.id,
                "customer": subscription.customer if subscription else None,
                "status": invoice.status,
                "currency": invoice.currency,
                "amount": float(invoice.amount or 0),
                "total_amount": float(invoice.total_amount or 0),
                "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
            }
        )

    summary = {
        "mrr": mrr,
        "arr": arr,
        "pending_balance": pending_balance,
        "overdue_balance": overdue_balance,
        "paid_this_month": paid_this_month,
        "pending_this_month": pending_this_month,
        "collection_rate": collection_rate,
        "subscriptions_total": len(subscriptions),
        "invoices_total": len(invoices),
        "overdue_clients": len(overdue_clients),
        "suspended_clients": len(suspended_clients),
        "updated_at": _iso_utc_now(),
    }

    _audit("finance_summary", entity_type="finance", metadata=summary)
    return jsonify(
        {
            "summary": summary,
            "aging": aging,
            "cashflow": cashflow,
            "top_debtors": top_debtors,
            "recent_invoices": recent_invoices,
        }
    ), 200


def _default_installations(tenant_id) -> list[dict]:
    clients_query = Client.query.options(joinedload(Client.plan), joinedload(Client.router))
    if tenant_id is not None:
        clients_query = clients_query.filter_by(tenant_id=tenant_id)
    clients = clients_query.order_by(Client.id.asc()).limit(12).all()

    staff_query = User.query.filter(User.role.in_(("tech", "support", "admin", "noc")))
    if tenant_id is not None:
        staff_query = staff_query.filter_by(tenant_id=tenant_id)
    technicians = [user.email for user in staff_query.order_by(User.name.asc()).all()]
    if not technicians:
        technicians = ["pendiente@ispfast.local"]

    statuses = ["pending", "scheduled", "in_progress", "completed"]
    now = datetime.utcnow()
    items: list[dict] = []
    for index, client in enumerate(clients, start=1):
        status = statuses[index % len(statuses)]
        scheduled_at = (now + timedelta(days=index % 6, hours=(index % 4) * 2)).replace(microsecond=0)
        checklist = {
            "onu_registered": status == "completed",
            "cpe_configured": status in {"in_progress", "completed"},
            "signal_validated": status == "completed",
            "speedtest_ok": status == "completed",
        }
        items.append(
            {
                "id": f"inst-{client.id}",
                "client_id": client.id,
                "client_name": client.full_name,
                "plan": client.plan.name if client.plan else None,
                "router": client.router.name if client.router else None,
                "address": client.ip_address or "Sin direccion",
                "status": status,
                "priority": "high" if index % 5 == 0 else "normal",
                "technician": technicians[index % len(technicians)],
                "scheduled_for": scheduled_at.isoformat() + "Z",
                "notes": "Instalacion programada automaticamente",
                "checklist": checklist,
                "created_at": _iso_utc_now(),
                "updated_at": _iso_utc_now(),
            }
        )
    return items


@main_bp.route('/admin/installations', methods=['GET'])
@admin_required()
def admin_installations_list():
    tenant_id = current_tenant_id()
    key = _installations_key(tenant_id)
    items = _load_cached_list(key)
    if not items:
        items = _default_installations(tenant_id)
        _save_cached_list(key, items, max_items=400)

    status_filter = (request.args.get('status') or '').strip().lower()
    technician_filter = (request.args.get('technician') or '').strip().lower()
    if status_filter:
        items = [item for item in items if str(item.get("status", "")).lower() == status_filter]
    if technician_filter:
        items = [
            item for item in items if technician_filter in str(item.get("technician", "")).lower()
        ]

    summary = {status: 0 for status in INSTALLATION_ALLOWED_STATUS}
    for item in items:
        state = str(item.get("status") or "pending")
        summary[state] = summary.get(state, 0) + 1
    return jsonify({"items": items, "count": len(items), "summary": summary}), 200


@main_bp.route('/admin/installations', methods=['POST'])
@admin_required()
def admin_installations_create():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}

    client_id = data.get('client_id')
    client_name = (data.get('client_name') or '').strip()
    client = None
    if client_id:
        client = db.session.get(Client, client_id)
        if not client:
            return jsonify({"error": "Cliente no encontrado"}), 404
        if tenant_id is not None and client.tenant_id not in (None, tenant_id):
            return jsonify({"error": "Cliente fuera del tenant"}), 403
        client_name = client.full_name

    if not client_name:
        return jsonify({"error": "client_name o client_id es requerido"}), 400

    status = (data.get('status') or 'scheduled').strip().lower()
    if status not in INSTALLATION_ALLOWED_STATUS:
        return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(INSTALLATION_ALLOWED_STATUS))}"}), 400

    raw_scheduled = (data.get('scheduled_for') or '').strip()
    if raw_scheduled:
        try:
            scheduled_for = datetime.fromisoformat(raw_scheduled.replace('Z', '+00:00')).replace(microsecond=0)
        except Exception:
            return jsonify({"error": "scheduled_for debe ser ISO date-time"}), 400
    else:
        scheduled_for = datetime.utcnow().replace(microsecond=0) + timedelta(days=1)

    entry = {
        "id": secrets.token_hex(8),
        "client_id": client.id if client else None,
        "client_name": client_name,
        "plan": client.plan.name if client and client.plan else (data.get('plan') or None),
        "router": client.router.name if client and client.router else (data.get('router') or None),
        "address": (data.get('address') or (client.ip_address if client else '') or 'Sin direccion').strip(),
        "status": status,
        "priority": (data.get('priority') or 'normal').strip().lower(),
        "technician": (data.get('technician') or '').strip() or "pendiente@ispfast.local",
        "scheduled_for": scheduled_for.isoformat() + "Z",
        "notes": (data.get('notes') or '').strip(),
        "checklist": {
            "onu_registered": False,
            "cpe_configured": False,
            "signal_validated": False,
            "speedtest_ok": False,
        },
        "created_at": _iso_utc_now(),
        "updated_at": _iso_utc_now(),
    }

    key = _installations_key(tenant_id)
    items = _load_cached_list(key)
    items.insert(0, entry)
    _save_cached_list(key, items, max_items=400)
    _audit("installation_create", entity_type="installation", entity_id=entry["id"], metadata=entry)
    return jsonify({"success": True, "installation": entry}), 201


@main_bp.route('/admin/installations/<string:installation_id>', methods=['PATCH'])
@admin_required()
def admin_installations_update(installation_id):
    tenant_id = current_tenant_id()
    key = _installations_key(tenant_id)
    items = _load_cached_list(key)
    entry = next((item for item in items if str(item.get("id")) == installation_id), None)
    if not entry:
        return jsonify({"error": "Instalacion no encontrada"}), 404

    data = request.get_json() or {}
    if 'status' in data:
        status = str(data.get('status') or '').strip().lower()
        if status not in INSTALLATION_ALLOWED_STATUS:
            return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(INSTALLATION_ALLOWED_STATUS))}"}), 400
        entry['status'] = status
    if 'priority' in data:
        entry['priority'] = str(data.get('priority') or 'normal').strip().lower() or 'normal'
    if 'technician' in data:
        entry['technician'] = str(data.get('technician') or '').strip() or "pendiente@ispfast.local"
    if 'address' in data:
        entry['address'] = str(data.get('address') or '').strip() or entry.get('address')
    if 'notes' in data:
        entry['notes'] = str(data.get('notes') or '').strip()
    if 'scheduled_for' in data:
        raw_scheduled = str(data.get('scheduled_for') or '').strip()
        if raw_scheduled:
            try:
                scheduled_for = datetime.fromisoformat(raw_scheduled.replace('Z', '+00:00')).replace(microsecond=0)
            except Exception:
                return jsonify({"error": "scheduled_for debe ser ISO date-time"}), 400
            entry['scheduled_for'] = scheduled_for.isoformat() + "Z"
    if 'checklist' in data and isinstance(data.get('checklist'), dict):
        checklist = entry.get('checklist') or {}
        for key_name, value in data['checklist'].items():
            parsed = _parse_bool(value)
            if parsed is None:
                return jsonify({"error": f"checklist.{key_name} debe ser booleano"}), 400
            checklist[str(key_name)] = parsed
        entry['checklist'] = checklist

    if entry.get('status') == 'completed':
        entry['completed_at'] = entry.get('completed_at') or _iso_utc_now()
    entry['updated_at'] = _iso_utc_now()

    _save_cached_list(key, items, max_items=400)
    _audit("installation_update", entity_type="installation", entity_id=installation_id, metadata={"changes": list(data.keys())})
    return jsonify({"success": True, "installation": entry}), 200


def _default_screen_alerts() -> list[dict]:
    now = _iso_utc_now()
    return [
        {
            "id": secrets.token_hex(8),
            "title": "Mantenimiento programado",
            "message": "Habra ventana de mantenimiento de 01:00 a 02:00.",
            "severity": "info",
            "audience": "all",
            "status": "active",
            "starts_at": now,
            "ends_at": None,
            "impressions": 0,
            "acknowledged": 0,
            "created_by": None,
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": secrets.token_hex(8),
            "title": "Recordatorio de pago",
            "message": "Clientes con saldo pendiente evitaran corte regularizando hoy.",
            "severity": "warning",
            "audience": "overdue",
            "status": "draft",
            "starts_at": now,
            "ends_at": None,
            "impressions": 0,
            "acknowledged": 0,
            "created_by": None,
            "created_at": now,
            "updated_at": now,
        },
    ]


@main_bp.route('/admin/screen-alerts', methods=['GET'])
@admin_required()
def admin_screen_alerts_list():
    tenant_id = current_tenant_id()
    key = _screen_alerts_key(tenant_id)
    items = _load_cached_list(key)
    if not items:
        items = _default_screen_alerts()
        _save_cached_list(key, items, max_items=400)

    status_filter = (request.args.get('status') or '').strip().lower()
    if status_filter:
        items = [item for item in items if str(item.get("status") or "").lower() == status_filter]

    summary = {status: 0 for status in SCREEN_ALERT_ALLOWED_STATUS}
    for item in items:
        state = str(item.get("status") or "draft")
        summary[state] = summary.get(state, 0) + 1

    return jsonify({"items": items, "count": len(items), "summary": summary}), 200


@main_bp.route('/admin/screen-alerts', methods=['POST'])
@admin_required()
def admin_screen_alerts_create():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    message = (data.get('message') or '').strip()
    if not title or not message:
        return jsonify({"error": "title y message son requeridos"}), 400

    severity = (data.get('severity') or 'info').strip().lower()
    if severity not in SCREEN_ALERT_ALLOWED_SEVERITY:
        return jsonify({"error": f"severity invalido. permitidos: {', '.join(sorted(SCREEN_ALERT_ALLOWED_SEVERITY))}"}), 400

    audience = (data.get('audience') or 'all').strip().lower()
    if audience not in SCREEN_ALERT_ALLOWED_AUDIENCE:
        return jsonify({"error": f"audience invalido. permitidos: {', '.join(sorted(SCREEN_ALERT_ALLOWED_AUDIENCE))}"}), 400

    status = (data.get('status') or 'draft').strip().lower()
    if status not in SCREEN_ALERT_ALLOWED_STATUS:
        return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(SCREEN_ALERT_ALLOWED_STATUS))}"}), 400

    now = _iso_utc_now()
    entry = {
        "id": secrets.token_hex(8),
        "title": title,
        "message": message,
        "severity": severity,
        "audience": audience,
        "status": status,
        "starts_at": (data.get('starts_at') or now),
        "ends_at": data.get('ends_at'),
        "impressions": 0,
        "acknowledged": 0,
        "created_by": _current_user_id(),
        "created_at": now,
        "updated_at": now,
    }

    key = _screen_alerts_key(tenant_id)
    items = _load_cached_list(key)
    items.insert(0, entry)
    _save_cached_list(key, items, max_items=400)
    _audit("screen_alert_create", entity_type="screen_alert", entity_id=entry["id"], metadata=entry)
    return jsonify({"success": True, "alert": entry}), 201


@main_bp.route('/admin/screen-alerts/<string:alert_id>', methods=['PATCH'])
@admin_required()
def admin_screen_alerts_update(alert_id):
    tenant_id = current_tenant_id()
    key = _screen_alerts_key(tenant_id)
    items = _load_cached_list(key)
    entry = next((item for item in items if str(item.get("id")) == alert_id), None)
    if not entry:
        return jsonify({"error": "Alerta no encontrada"}), 404

    data = request.get_json() or {}
    if 'title' in data:
        title = str(data.get('title') or '').strip()
        if not title:
            return jsonify({"error": "title no puede estar vacio"}), 400
        entry['title'] = title
    if 'message' in data:
        message = str(data.get('message') or '').strip()
        if not message:
            return jsonify({"error": "message no puede estar vacio"}), 400
        entry['message'] = message
    if 'severity' in data:
        severity = str(data.get('severity') or '').strip().lower()
        if severity not in SCREEN_ALERT_ALLOWED_SEVERITY:
            return jsonify({"error": f"severity invalido. permitidos: {', '.join(sorted(SCREEN_ALERT_ALLOWED_SEVERITY))}"}), 400
        entry['severity'] = severity
    if 'audience' in data:
        audience = str(data.get('audience') or '').strip().lower()
        if audience not in SCREEN_ALERT_ALLOWED_AUDIENCE:
            return jsonify({"error": f"audience invalido. permitidos: {', '.join(sorted(SCREEN_ALERT_ALLOWED_AUDIENCE))}"}), 400
        entry['audience'] = audience
    if 'status' in data:
        status = str(data.get('status') or '').strip().lower()
        if status not in SCREEN_ALERT_ALLOWED_STATUS:
            return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(SCREEN_ALERT_ALLOWED_STATUS))}"}), 400
        entry['status'] = status
    if 'starts_at' in data:
        entry['starts_at'] = data.get('starts_at')
    if 'ends_at' in data:
        entry['ends_at'] = data.get('ends_at')
    if 'impressions_delta' in data:
        entry['impressions'] = max(0, int(entry.get('impressions') or 0) + int(data.get('impressions_delta') or 0))
    if 'acknowledged_delta' in data:
        entry['acknowledged'] = max(0, int(entry.get('acknowledged') or 0) + int(data.get('acknowledged_delta') or 0))

    entry['updated_at'] = _iso_utc_now()
    _save_cached_list(key, items, max_items=400)
    _audit("screen_alert_update", entity_type="screen_alert", entity_id=alert_id, metadata={"changes": list(data.keys())})
    return jsonify({"success": True, "alert": entry}), 200


def _default_extra_services(tenant_id) -> list[dict]:
    clients_query = Client.query
    if tenant_id is not None:
        clients_query = clients_query.filter_by(tenant_id=tenant_id)
    clients_count = clients_query.count()
    now = _iso_utc_now()
    return [
        {
            "id": "svc-iptv",
            "name": "IPTV Premium",
            "category": "tv",
            "description": "Canales HD y catch-up basico",
            "monthly_price": 9.9,
            "one_time_fee": 0.0,
            "status": "active",
            "subscribers": max(0, round(clients_count * 0.22)),
            "updated_at": now,
        },
        {
            "id": "svc-voip",
            "name": "Linea VoIP",
            "category": "voice",
            "description": "Numero fijo virtual con llamadas locales",
            "monthly_price": 5.5,
            "one_time_fee": 8.0,
            "status": "active",
            "subscribers": max(0, round(clients_count * 0.13)),
            "updated_at": now,
        },
        {
            "id": "svc-ipfixa",
            "name": "IP Publica Fija",
            "category": "ip",
            "description": "Direccion IP estatica para negocios",
            "monthly_price": 14.0,
            "one_time_fee": 20.0,
            "status": "active",
            "subscribers": max(0, round(clients_count * 0.09)),
            "updated_at": now,
        },
        {
            "id": "svc-backup4g",
            "name": "Backup LTE",
            "category": "redundancy",
            "description": "Failover movil para continuidad basica",
            "monthly_price": 17.5,
            "one_time_fee": 25.0,
            "status": "disabled",
            "subscribers": max(0, round(clients_count * 0.04)),
            "updated_at": now,
        },
    ]


@main_bp.route('/admin/extra-services', methods=['GET'])
@admin_required()
def admin_extra_services_list():
    tenant_id = current_tenant_id()
    key = _extra_services_key(tenant_id)
    items = _load_cached_list(key)
    if not items:
        items = _default_extra_services(tenant_id)
        _save_cached_list(key, items, max_items=300)

    status_filter = (request.args.get('status') or '').strip().lower()
    if status_filter:
        items = [item for item in items if str(item.get("status") or "").lower() == status_filter]

    summary = {
        "services_total": len(items),
        "active_services": sum(1 for item in items if item.get("status") == "active"),
        "subscribers_total": sum(int(item.get("subscribers") or 0) for item in items),
        "mrr_estimated": round(
            sum(float(item.get("monthly_price") or 0) * int(item.get("subscribers") or 0) for item in items), 2
        ),
    }
    return jsonify({"items": items, "count": len(items), "summary": summary}), 200


@main_bp.route('/admin/extra-services', methods=['POST'])
@admin_required()
def admin_extra_services_create():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"error": "name es requerido"}), 400

    status = (data.get('status') or 'active').strip().lower()
    if status not in EXTRA_SERVICE_ALLOWED_STATUS:
        return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(EXTRA_SERVICE_ALLOWED_STATUS))}"}), 400

    entry = {
        "id": secrets.token_hex(8),
        "name": name,
        "category": (data.get('category') or 'other').strip().lower(),
        "description": (data.get('description') or '').strip(),
        "monthly_price": round(float(data.get('monthly_price') or 0), 2),
        "one_time_fee": round(float(data.get('one_time_fee') or 0), 2),
        "status": status,
        "subscribers": int(data.get('subscribers') or 0),
        "updated_at": _iso_utc_now(),
    }

    key = _extra_services_key(tenant_id)
    items = _load_cached_list(key)
    items.insert(0, entry)
    _save_cached_list(key, items, max_items=300)
    _audit("extra_service_create", entity_type="extra_service", entity_id=entry["id"], metadata=entry)
    return jsonify({"success": True, "service": entry}), 201


@main_bp.route('/admin/extra-services/<string:service_id>', methods=['PATCH'])
@admin_required()
def admin_extra_services_update(service_id):
    tenant_id = current_tenant_id()
    key = _extra_services_key(tenant_id)
    items = _load_cached_list(key)
    entry = next((item for item in items if str(item.get("id")) == service_id), None)
    if not entry:
        return jsonify({"error": "Servicio no encontrado"}), 404

    data = request.get_json() or {}
    if 'name' in data:
        name = str(data.get('name') or '').strip()
        if not name:
            return jsonify({"error": "name no puede estar vacio"}), 400
        entry['name'] = name
    if 'category' in data:
        entry['category'] = str(data.get('category') or 'other').strip().lower() or 'other'
    if 'description' in data:
        entry['description'] = str(data.get('description') or '').strip()
    if 'monthly_price' in data:
        entry['monthly_price'] = round(float(data.get('monthly_price') or 0), 2)
    if 'one_time_fee' in data:
        entry['one_time_fee'] = round(float(data.get('one_time_fee') or 0), 2)
    if 'subscribers' in data:
        entry['subscribers'] = max(0, int(data.get('subscribers') or 0))
    if 'status' in data:
        status = str(data.get('status') or '').strip().lower()
        if status not in EXTRA_SERVICE_ALLOWED_STATUS:
            return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(EXTRA_SERVICE_ALLOWED_STATUS))}"}), 400
        entry['status'] = status

    entry['updated_at'] = _iso_utc_now()
    _save_cached_list(key, items, max_items=300)
    _audit("extra_service_update", entity_type="extra_service", entity_id=service_id, metadata={"changes": list(data.keys())})
    return jsonify({"success": True, "service": entry}), 200


@main_bp.route('/admin/hotspot/vouchers', methods=['GET'])
@admin_required()
def admin_hotspot_vouchers_list():
    tenant_id = current_tenant_id()
    key = _hotspot_vouchers_key(tenant_id)
    items = _load_cached_list(key)

    status_filter = (request.args.get('status') or '').strip().lower()
    if status_filter:
        items = [item for item in items if str(item.get("status") or "").lower() == status_filter]

    summary = {status: 0 for status in HOTSPOT_VOUCHER_ALLOWED_STATUS}
    revenue_estimated = 0.0
    for item in items:
        state = str(item.get("status") or "generated")
        summary[state] = summary.get(state, 0) + 1
        if state in {"sold", "used"}:
            revenue_estimated += float(item.get("price") or 0)
    return jsonify(
        {
            "items": items[:300],
            "count": len(items),
            "summary": summary,
            "revenue_estimated": round(revenue_estimated, 2),
        }
    ), 200


@main_bp.route('/admin/hotspot/vouchers', methods=['POST'])
@admin_required()
def admin_hotspot_vouchers_create():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}

    try:
        quantity = int(data.get('quantity') or 1)
    except Exception:
        quantity = 1
    quantity = max(1, min(quantity, 200))

    profile = (data.get('profile') or 'basic').strip().lower() or 'basic'
    duration_minutes = max(5, int(data.get('duration_minutes') or 60))
    data_limit_mb = max(0, int(data.get('data_limit_mb') or 0))
    price = round(float(data.get('price') or 0), 2)
    expires_days = max(1, int(data.get('expires_days') or 7))
    now = datetime.utcnow().replace(microsecond=0)

    key = _hotspot_vouchers_key(tenant_id)
    items = _load_cached_list(key)
    created = []
    for _ in range(quantity):
        code_prefix = ''.join(ch for ch in profile.upper() if ch.isalnum())[:3] or 'VCH'
        code = f"{code_prefix}-{secrets.token_hex(3).upper()}"
        entry = {
            "id": secrets.token_hex(8),
            "code": code,
            "profile": profile,
            "duration_minutes": duration_minutes,
            "data_limit_mb": data_limit_mb,
            "price": price,
            "status": "generated",
            "assigned_to": None,
            "created_at": _iso_utc_now(),
            "expires_at": (now + timedelta(days=expires_days)).isoformat() + "Z",
            "used_at": None,
        }
        items.insert(0, entry)
        created.append(entry)

    _save_cached_list(key, items, max_items=1000)
    _audit(
        "hotspot_vouchers_create",
        entity_type="hotspot_voucher",
        metadata={"quantity": quantity, "profile": profile, "price": price},
    )
    return jsonify({"success": True, "items": created, "count": len(created)}), 201


@main_bp.route('/admin/hotspot/vouchers/<string:voucher_id>', methods=['PATCH'])
@admin_required()
def admin_hotspot_vouchers_update(voucher_id):
    tenant_id = current_tenant_id()
    key = _hotspot_vouchers_key(tenant_id)
    items = _load_cached_list(key)
    entry = next((item for item in items if str(item.get("id")) == voucher_id), None)
    if not entry:
        return jsonify({"error": "Voucher no encontrado"}), 404

    data = request.get_json() or {}
    if 'status' in data:
        status = str(data.get('status') or '').strip().lower()
        if status not in HOTSPOT_VOUCHER_ALLOWED_STATUS:
            return jsonify({"error": f"status invalido. permitidos: {', '.join(sorted(HOTSPOT_VOUCHER_ALLOWED_STATUS))}"}), 400
        entry['status'] = status
        if status == 'used':
            entry['used_at'] = entry.get('used_at') or _iso_utc_now()
    if 'assigned_to' in data:
        entry['assigned_to'] = str(data.get('assigned_to') or '').strip() or None
    if 'expires_at' in data:
        entry['expires_at'] = data.get('expires_at')

    _save_cached_list(key, items, max_items=1000)
    _audit("hotspot_voucher_update", entity_type="hotspot_voucher", entity_id=voucher_id, metadata={"changes": list(data.keys())})
    return jsonify({"success": True, "voucher": entry}), 200


def _default_system_settings() -> dict:
    return {
        "portal_maintenance_mode": False,
        "auto_suspend_overdue": True,
        "notifications_push_enabled": bool(current_app.config.get('WONDERPUSH_ACCESS_TOKEN')),
        "notifications_email_enabled": bool(current_app.config.get('MAIL_SERVER')),
        "allow_self_signup": bool(current_app.config.get('ALLOW_SELF_SIGNUP', False)),
        "default_ticket_priority": "medium",
        "backup_retention_days": 14,
        "metrics_poll_interval_sec": 60,
    }


def _recalculate_invoice_balances(tenant_id) -> dict:
    invoices_q = Invoice.query.options(
        joinedload(Invoice.payments),
        joinedload(Invoice.subscription),
    )
    if tenant_id is not None:
        invoices_q = invoices_q.join(Subscription, Invoice.subscription_id == Subscription.id).filter(
            Subscription.tenant_id == tenant_id
        )

    scanned = 0
    updated = 0
    for invoice in invoices_q.all():
        if str(invoice.status or '').lower() == 'cancelled':
            continue

        paid_total = 0.0
        for payment in invoice.payments:
            if str(payment.status or '').lower() == 'paid':
                paid_total += float(payment.amount or 0)

        expected_status = 'paid' if paid_total >= float(invoice.total_amount or 0) else 'pending'
        if invoice.status != expected_status:
            invoice.status = expected_status
            updated += 1
        scanned += 1

    db.session.commit()
    return {"scanned": scanned, "updated": updated, "timestamp": _iso_utc_now()}


def _cleanup_leases_for_tenant(tenant_id) -> dict:
    today = date.today()
    subscriptions_q = Subscription.query
    if tenant_id is not None:
        subscriptions_q = subscriptions_q.filter_by(tenant_id=tenant_id)

    scanned = 0
    updated = 0
    failed = 0
    changes = []

    for sub in subscriptions_q.all():
        scanned += 1
        original_status = sub.status

        if sub.next_charge and sub.next_charge < today and sub.status == 'active':
            sub.status = 'past_due'

        client = sub.client or (db.session.get(Client, sub.client_id) if sub.client_id else None)
        if sub.status in ('past_due', 'suspended') and client and client.router_id:
            try:
                with MikroTikService(client.router_id) as service:
                    service.suspend_client(client)
                sub.status = 'suspended'
            except Exception:
                failed += 1
        elif sub.status == 'active' and client and client.router_id:
            try:
                with MikroTikService(client.router_id) as service:
                    service.activate_client(client)
            except Exception:
                failed += 1

        if sub.status != original_status:
            updated += 1
            changes.append({"subscription_id": sub.id, "from": original_status, "to": sub.status})
        db.session.add(sub)

    db.session.commit()
    return {
        "tenant_id": tenant_id,
        "scanned": scanned,
        "updated": updated,
        "failed": failed,
        "changes": changes[:200],
        "timestamp": _iso_utc_now(),
    }


def _rotate_mikrotik_passwords(tenant_id) -> tuple[str, dict]:
    routers_q = MikroTikRouter.query.filter_by(is_active=True)
    if tenant_id is not None:
        routers_q = routers_q.filter_by(tenant_id=tenant_id)
    routers = routers_q.order_by(MikroTikRouter.id.asc()).all()

    if not routers:
        return 'skipped', {
            "message": "No hay routers activos para rotar password.",
            "total": 0,
            "rotated": 0,
            "failed": 0,
            "items": [],
        }

    dry_run = _password_rotation_dry_run_enabled()
    results = []
    rotated = 0
    failed = 0
    length = _password_rotation_length()
    default_username = str(current_app.config.get('MIKROTIK_DEFAULT_USERNAME') or '').strip()

    for router in routers:
        username = str(router.username or default_username).strip()
        if not username:
            failed += 1
            results.append(
                {
                    "router_id": router.id,
                    "router_name": router.name,
                    "status": "failed",
                    "error": "username no configurado",
                }
            )
            continue

        new_password = _generate_router_password(length)
        if dry_run:
            rotated += 1
            results.append(
                {
                    "router_id": router.id,
                    "router_name": router.name,
                    "username": username,
                    "status": "dry_run",
                    "preview": _mask_secret(new_password),
                }
            )
            continue

        try:
            with MikroTikService(router.id) as service:
                outcome = service.rotate_api_password(username=username, new_password=new_password)
        except Exception as exc:
            outcome = {"success": False, "error": str(exc)}

        if outcome.get("success"):
            router.password = new_password
            db.session.add(router)
            db.session.commit()
            rotated += 1
            results.append(
                {
                    "router_id": router.id,
                    "router_name": router.name,
                    "username": username,
                    "status": "rotated",
                }
            )
        else:
            db.session.rollback()
            failed += 1
            results.append(
                {
                    "router_id": router.id,
                    "router_name": router.name,
                    "username": username,
                    "status": "failed",
                    "error": str(outcome.get("error") or "unknown_error"),
                }
            )

    summary = {
        "total": len(routers),
        "rotated": rotated,
        "failed": failed,
        "dry_run": dry_run,
        "items": results,
    }

    if dry_run:
        summary["message"] = "Rotacion ejecutada en modo dry_run. No se aplicaron cambios."
        return 'skipped', summary

    if failed > 0 and rotated == 0:
        return 'failed', summary
    if failed > 0:
        return 'completed_with_errors', summary
    return 'completed', summary


def _execute_system_job(job: str, tenant_id) -> tuple[str, dict]:
    try:
        if job == 'backup':
            from app.services.backup_service import run_backups as run_full_backups
            return 'completed', run_full_backups()
        if job == 'cleanup_leases':
            return 'completed', _cleanup_leases_for_tenant(tenant_id)
        if job == 'recalc_balances':
            return 'completed', _recalculate_invoice_balances(tenant_id)
        if job == 'rotate_passwords':
            return _rotate_mikrotik_passwords(tenant_id)
        return 'failed', {"error": f"job no soportado: {job}"}
    except Exception as exc:
        current_app.logger.error("System job execution failed for %s: %s", job, exc, exc_info=True)
        return 'failed', {"error": str(exc)}


def _run_system_job_request(job: str, tenant_id, requested_by) -> tuple[dict, int]:
    entry = {
        "id": secrets.token_hex(8),
        "job": job,
        "status": "started",
        "requested_by": requested_by,
        "started_at": _iso_utc_now(),
    }

    status, result = _execute_system_job(job, tenant_id)
    entry["status"] = status
    entry["finished_at"] = _iso_utc_now()
    entry["result"] = result

    key = _system_jobs_key(tenant_id)
    jobs = _load_cached_list(key)
    jobs.insert(0, entry)
    _save_cached_list(key, jobs, max_items=200)

    severity_map = {
        "completed": "info",
        "skipped": "info",
        "completed_with_errors": "warning",
        "failed": "critical",
    }
    severity = severity_map.get(status, "warning")
    _notify_incident(f"Job administrativo ejecutado: {job} -> {status}", severity=severity)
    _audit("system_job_run", entity_type="system_job", entity_id=entry["id"], metadata=entry)

    if status == 'failed':
        return {"success": False, "job": entry}, 500
    return {"success": True, "job": entry}, 200


@main_bp.route('/admin/system/settings', methods=['GET'])
@admin_required()
def admin_system_settings_get():
    tenant_id = current_tenant_id()
    defaults = _default_system_settings()
    overrides = _load_cached_dict(_system_settings_key(tenant_id))
    settings = {**defaults, **overrides}

    routers_query = MikroTikRouter.query
    tickets_query = Ticket.query.filter(Ticket.status.in_(("open", "in_progress")))
    if tenant_id is not None:
        routers_query = routers_query.filter_by(tenant_id=tenant_id)
        tickets_query = tickets_query.filter_by(tenant_id=tenant_id)
    routers_down = routers_query.filter_by(is_active=False).count()
    routers_up = routers_query.filter_by(is_active=True).count()

    jobs = _load_cached_list(_system_jobs_key(tenant_id))[:20]
    return jsonify(
        {
            "settings": settings,
            "health": {
                "routers_up": routers_up,
                "routers_down": routers_down,
                "tickets_open": tickets_query.count(),
                "timestamp": _iso_utc_now(),
            },
            "jobs": jobs,
        }
    ), 200


@main_bp.route('/admin/system/settings', methods=['POST'])
@admin_required()
def admin_system_settings_update():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}
    incoming = data.get('settings') if isinstance(data.get('settings'), dict) else data

    allowed = {
        "portal_maintenance_mode": "bool",
        "auto_suspend_overdue": "bool",
        "notifications_push_enabled": "bool",
        "notifications_email_enabled": "bool",
        "allow_self_signup": "bool",
        "default_ticket_priority": "str",
        "backup_retention_days": "int",
        "metrics_poll_interval_sec": "int",
    }
    integer_limits = {
        "backup_retention_days": (1, 365),
        "metrics_poll_interval_sec": (15, 3600),
    }

    overrides = _load_cached_dict(_system_settings_key(tenant_id))
    for key_name, key_type in allowed.items():
        if key_name not in incoming:
            continue
        raw_value = incoming.get(key_name)
        if key_type == "bool":
            parsed = _parse_bool(raw_value)
            if parsed is None:
                return jsonify({"error": f"{key_name} debe ser booleano"}), 400
            overrides[key_name] = parsed
        elif key_type == "int":
            try:
                parsed_int = int(raw_value)
            except (TypeError, ValueError):
                return jsonify({"error": f"{key_name} debe ser entero"}), 400
            minimum, maximum = integer_limits.get(key_name, (-2**31, 2**31 - 1))
            if parsed_int < minimum or parsed_int > maximum:
                return jsonify({"error": f"{key_name} debe estar entre {minimum} y {maximum}"}), 400
            overrides[key_name] = parsed_int
        else:
            text_value = str(raw_value or '').strip().lower()
            if key_name == "default_ticket_priority" and text_value not in TICKET_ALLOWED_PRIORITIES:
                return jsonify(
                    {"error": f"default_ticket_priority invalido. permitidos: {', '.join(sorted(TICKET_ALLOWED_PRIORITIES))}"}
                ), 400
            overrides[key_name] = text_value

    _save_cached_dict(_system_settings_key(tenant_id), overrides)
    settings = {**_default_system_settings(), **overrides}
    _audit("system_settings_update", entity_type="system_settings", metadata={"changes": list(incoming.keys())})
    return jsonify({"success": True, "settings": settings}), 200


@main_bp.route('/admin/system/jobs/history', methods=['GET'])
@admin_required()
def admin_system_jobs_history():
    tenant_id = current_tenant_id()
    jobs = _load_cached_list(_system_jobs_key(tenant_id))
    try:
        limit = int(request.args.get('limit', 50) or 50)
    except Exception:
        limit = 50
    try:
        offset = int(request.args.get('offset', 0) or 0)
    except Exception:
        offset = 0
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    status_filter = str(request.args.get('status') or '').strip().lower()
    job_filter = str(request.args.get('job') or '').strip().lower()

    filtered = jobs
    if status_filter:
        filtered = [item for item in filtered if str(item.get('status') or '').lower() == status_filter]
    if job_filter:
        filtered = [item for item in filtered if str(item.get('job') or '').lower() == job_filter]

    page = filtered[offset:offset + limit]
    return jsonify(
        {
            "items": page,
            "count": len(page),
            "total": len(filtered),
            "offset": offset,
            "limit": limit,
            "has_more": (offset + len(page)) < len(filtered),
        }
    ), 200


@main_bp.route('/admin/system/jobs/run', methods=['POST'])
@admin_required()
def admin_system_jobs_run():
    tenant_id = current_tenant_id()
    data = request.get_json() or {}
    job = (data.get('job') or '').strip().lower()
    if job not in SYSTEM_ALLOWED_JOBS:
        return jsonify({"error": f"job debe ser {' | '.join(sorted(SYSTEM_ALLOWED_JOBS))}"}), 400
    payload, code = _run_system_job_request(job, tenant_id, _current_user_id())
    return jsonify(payload), code


# ==================== TICKETS CON SLA ====================

def _sla_due(priority: str) -> datetime:
    now = datetime.utcnow()
    if priority == 'urgent':
        return now + timedelta(hours=2)
    if priority == 'high':
        return now + timedelta(hours=4)
    if priority == 'medium':
        return now + timedelta(hours=24)
    return now + timedelta(hours=48)


@main_bp.route('/tickets', methods=['POST'])
@jwt_required()
def create_ticket():
    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip()
    description = (data.get('description') or '').strip()
    priority = (data.get('priority') or 'medium').lower()
    if not subject or not description:
        return jsonify({"error": "subject y description son requeridos"}), 400
    user_id = _current_user_id()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404
    tenant_id = current_tenant_id()
    ticket = Ticket(
        subject=subject,
        description=description,
        priority=priority,
        status='open',
        user_id=user_id,
        client_id=user.client.id if user.client else None,
        tenant_id=tenant_id,
        sla_due_at=_sla_due(priority),
    )
    db.session.add(ticket)
    db.session.commit()
    _notify_incident(f"Nuevo ticket: {subject}", severity="warning")
    return jsonify({"ticket": ticket.to_dict()}), 201


def _notify_client(client: Client, subject: str, body: str):
    """Envía correo y push si hay configuración."""
    try:
        mail = current_app.extensions.get('mail')
        if mail and client.user and client.user.email:
            msg = Message(subject=subject, recipients=[client.user.email], body=body, sender=current_app.config.get('MAIL_DEFAULT_SENDER'))
            mail.send(msg)
    except Exception:
        current_app.logger.warning("No se pudo enviar correo al cliente")

    wp_token = current_app.config.get('WONDERPUSH_ACCESS_TOKEN')
    wp_app = current_app.config.get('WONDERPUSH_APPLICATION_ID')
    if wp_token and wp_app:
        try:
            import requests
            payload = {
                "targetSegmentIds": ["all"],
                "notification": {"alert": body[:120], "url": current_app.config.get('FRONTEND_URL')}
            }
            requests.post(
                "https://api.wonderpush.com/v1/deliveries",
                params={"applicationId": wp_app},
                headers={"Authorization": f"Bearer {wp_token}"},
                json=payload,
                timeout=5
            )
        except Exception:
            current_app.logger.warning("No se pudo enviar push al cliente")


@main_bp.route('/admin/routers/<int:router_id>/remote-script', methods=['GET'])
@admin_required()
def router_remote_script(router_id):
    """Devuelve un script rápido para habilitar acceso remoto seguro (API/SSH) en MikroTik."""
    router = db.session.get(MikroTikRouter, router_id)
    if not router:
        return jsonify({"error": "Router no encontrado"}), 404
    api_user = f"fastisp-{router_id}"
    api_pass = f"{router.password or 'CambiarEstaClave'}"
    api_port = 8728
    ssh_port = 22
    script = f"""/ip service set api disabled=no port={api_port}
/ip service set ssh disabled=no port={ssh_port}
/user add name="{api_user}" password="{api_pass}" group=full comment="Acceso remoto FastISP" disabled=no
/ip firewall address-list add list=fastisp-remote address=YOUR_PUBLIC_IP/32 comment="Autorizar IP de gestión"
/ip firewall filter add chain=input action=accept protocol=tcp dst-port={api_port} src-address-list=fastisp-remote comment="API FastISP"
/ip firewall filter add chain=input action=accept protocol=tcp dst-port={ssh_port} src-address-list=fastisp-remote comment="SSH FastISP"
"""
    return jsonify({
        "router": {
            "id": router.id,
            "name": router.name,
            "ip": router.ip_address,
            "api_user": api_user,
            "api_port": api_port,
            "ssh_port": ssh_port,
        },
        "script": script,
        "note": "Reemplaza YOUR_PUBLIC_IP/32 por la IP de gestión permitida antes de ejecutar en MikroTik."
    }), 200




