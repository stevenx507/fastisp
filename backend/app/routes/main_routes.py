from datetime import datetime, timedelta
from functools import wraps
import random
import secrets

from flask import Blueprint, jsonify, request, Response, current_app
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app.models import Client, User, Subscription, MikroTikRouter, Plan, AuditLog
from app import limiter, cache
import pyotp
from app.services.mikrotik_service import MikroTikService
from app.services.monitoring_service import MonitoringService
from app.tenancy import current_tenant_id, tenant_access_allowed


def _current_user_id():
    identity = get_jwt_identity()
    try:
        return int(identity)
    except (TypeError, ValueError):
        return None


def _slugify(text: str) -> str:
    return ''.join(ch.lower() if ch.isalnum() else '-' for ch in text).strip('-')


def _get_plan_for_request(data, tenant_id):
    plan = None
    if data.get('plan_id'):
        plan = Plan.query.get(data['plan_id'])
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


# In-memory ticket store for demo; replace with DB model in production.
CLIENT_TICKETS: list[dict] = []

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
            metadata=metadata,
            ip_address=getattr(request, "remote_addr", None),
        )
        from app import db
        db.session.add(entry)
        db.session.commit()
    except Exception:
        pass

# Helper para verificar rol de admin
def admin_required():
    def wrapper(fn):
        @jwt_required()
        @wraps(fn)
        def decorator(*args, **kwargs):
            current_user_id = _current_user_id()
            if current_user_id is None:
                return jsonify({"error": "Token de usuario invalido."}), 401
            user = User.query.get(current_user_id)
            tenant_id = current_tenant_id()
            if not user or user.role != 'admin':
                return jsonify({"error": "Acceso denegado. Se requiere rol de administrador."}), 403
            if tenant_id is not None and user.tenant_id not in (None, tenant_id):
                return jsonify({"error": "Acceso denegado para este tenant."}), 403
            return fn(*args, **kwargs)

        return decorator

    return wrapper


# Este Blueprint contiene las rutas principales de la API
main_bp = Blueprint('main_bp', __name__)


@main_bp.route('/health', methods=['GET'])
def api_health():
    return jsonify({'status': 'healthy', 'service': 'ispmax-backend-api'}), 200


@main_bp.route('/dashboard', methods=['GET'])
@jwt_required(optional=True)
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
@jwt_required(optional=True)
def billing_summary():
    tenant_id = current_tenant_id()
    subs = Subscription.query
    if tenant_id is not None:
        subs = subs.filter_by(tenant_id=tenant_id)

    invoices = []
    for s in subs.all():
        invoices.append({
            "id": f"SUB-{s.id}",
            "amount": float(s.amount),
            "due": s.next_charge.isoformat() if s.next_charge else datetime.utcnow().date().isoformat(),
            "status": "paid" if s.status == 'active' else ("overdue" if s.status == 'past_due' else "pending")
        })
    return jsonify({"invoices": invoices, "count": len(invoices)}), 200


@main_bp.route('/connections', methods=['GET'])
@jwt_required(optional=True)
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
@jwt_required(optional=True)
def notifications_feed():
    tenant_id = current_tenant_id()
    alerts = network_alerts().json.get('alerts', [])

    feed = []
    now = datetime.utcnow().isoformat() + "Z"
    for idx, alert in enumerate(alerts[:5], start=1):
        feed.append({"id": idx, "message": f"Alerta {alert['severity']}: {alert['message']}", "time": now, "read": False})
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
        # MFA: si está habilitado, validar código
        if user.mfa_enabled:
            mfa_code = str(data.get('mfa_code') or '').strip()
            if not mfa_code:
                return jsonify({"error": "MFA requerido", "mfa_required": True}), 401
            if not user.mfa_secret:
                return jsonify({"error": "MFA no configurado correctamente"}), 500
            totp = pyotp.TOTP(user.mfa_secret)
            if not totp.verify(mfa_code, valid_window=1):
                return jsonify({"error": "Código MFA inválido", "mfa_required": True}), 401

        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={'tenant_id': user.tenant_id},
        )
        return jsonify({"token": access_token, "user": user.to_dict()}), 200

    return jsonify({"error": "Credenciales incorrectas."}), 401


@main_bp.route('/auth/register', methods=['POST'])
@limiter.limit("5/minute")
def register():
    """
    Registro ligero para demo: crea un usuario cliente y devuelve token inmediato.
    """
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({"error": "Nombre, email y contraseña son requeridos."}), 400

    tenant_id = current_tenant_id()
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "El correo ya está registrado."}), 400

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


@main_bp.route('/auth/google', methods=['POST'])
def google_login():
    """
    Endpoint de demostración para "login con Google": confía en el payload recibido.
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    name = (data.get('name') or 'Usuario Google').strip()
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

    user = User.query.get_or_404(current_user_id)
    tenant_id = current_tenant_id()
    if tenant_id is not None and user.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    # Verificar colisión de correo
    existing = User.query.filter(User.email == email, User.id != user.id).first()
    if existing:
        return jsonify({"error": "El correo ya está en uso."}), 400

    user.name = name
    user.email = email
    # Guardar cambios
    from app import db

    db.session.add(user)
    db.session.commit()

    return jsonify({"user": user.to_dict(), "success": True}), 200


@main_bp.route('/auth/mfa/setup', methods=['GET'])
@jwt_required()
def mfa_setup():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    user = User.query.get_or_404(current_user_id)
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
        return jsonify({"error": "Secret y código son requeridos."}), 400
    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({"error": "Código inválido."}), 400
    user = User.query.get_or_404(current_user_id)
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
    user = User.query.get_or_404(current_user_id)
    if user.mfa_enabled:
        totp = pyotp.TOTP(user.mfa_secret)
        if not code or not totp.verify(code, valid_window=1):
            return jsonify({"error": "Código inválido o faltante."}), 400
    user.mfa_enabled = False
    user.mfa_secret = None
    from app import db
    db.session.add(user)
    db.session.commit()
    return jsonify({"success": True}), 200


@main_bp.route('/subscriptions', methods=['GET'])
@jwt_required(optional=True)
def list_subscriptions():
    tenant_id = current_tenant_id()
    query = Subscription.query
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)
    items = [s.to_dict() for s in query.order_by(Subscription.next_charge.asc()).all()]
    return jsonify({"items": items, "count": len(items)}), 200


@main_bp.route('/plans', methods=['GET'])
@jwt_required(optional=True)
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
        return jsonify({"error": "El correo ya está registrado."}), 400

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
    sub = Subscription.query.get_or_404(subscription_id)
    tenant_id = current_tenant_id()
    if tenant_id is not None and sub.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403
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
    return jsonify({"subscription": sub.to_dict(), "success": True}), 200


@main_bp.route('/subscriptions/<int:subscription_id>/charge', methods=['POST'])
@admin_required()
def charge_subscription(subscription_id):
    sub = Subscription.query.get_or_404(subscription_id)
    tenant_id = current_tenant_id()
    if tenant_id is not None and sub.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403
    sub.status = 'active'
    # avanzar próxima fecha según ciclo
    days = sub.cycle_months * 30
    sub.next_charge = sub.next_charge + timedelta(days=days)
    from app import db

    db.session.add(sub)
    db.session.commit()
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
        # autosuspender si lleva más de 10 días vencido
        if days_overdue >= 10 and sub.status == 'past_due':
            sub.status = 'suspended'
            updated.append(sub.to_dict())
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
@jwt_required(optional=True)
def network_health():
    tenant_id = current_tenant_id()
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

    # Try to enrich with live telemetry (InfluxDB + MikroTik)
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
            score -= max(0, cpu_avg - 70) * 0.2  # penaliza CPU alta
        if mem_usage:
            mem_avg = sum(mem_usage) / len(mem_usage)
            health["memory_avg"] = round(mem_avg, 1)
            score -= max(0, mem_avg - 80) * 0.15

        health["score"] = max(35, min(100, round(score, 1)))
        health["source"] = "influxdb"
    except Exception as exc:
        current_app.logger.info("Network health using fallback: %s", exc)
        score = max(40, min(100, 95 - routers_down * 5))
        health["score"] = score

    return jsonify(health), 200


@main_bp.route('/monitoring/metrics', methods=['GET'])
@jwt_required(optional=True)
def monitoring_metrics():
    """
    Devuelve series de InfluxDB para dashboards (mediante medición y rango).
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
        current_app.logger.error("Error consultando métricas: %s", exc)
        return jsonify({"success": False, "error": "No se pudieron recuperar métricas"}), 502


@main_bp.route('/network/alerts', methods=['GET'])
@jwt_required(optional=True)
def network_alerts():
    tenant_id = current_tenant_id()
    routers_q = MikroTikRouter.query
    subs_q = Subscription.query
    if tenant_id is not None:
        routers_q = routers_q.filter_by(tenant_id=tenant_id)
        subs_q = subs_q.filter_by(tenant_id=tenant_id)
    alerts = []
    for r in routers_q.filter_by(is_active=False).all():
        alerts.append({"id": f"AL-R-{r.id}", "severity": "critical", "scope": "router", "target": r.name, "message": "Router sin respuesta", "since": datetime.utcnow().isoformat() + "Z"})
    for s in subs_q.filter_by(status='past_due').all():
        alerts.append({"id": f"AL-S-{s.id}", "severity": "warning", "scope": "billing", "target": s.customer, "message": "Suscripción vencida", "since": datetime.utcnow().isoformat() + "Z"})
    if not alerts:
        alerts.append({"id": "AL-OK", "severity": "info", "scope": "network", "target": "Red", "message": "Sin alertas críticas", "since": datetime.utcnow().isoformat() + "Z"})
    _audit("network_alerts", entity_type="network", metadata={"count": len(alerts)})
    return jsonify({"alerts": alerts, "count": len(alerts)}), 200


@main_bp.route('/client/portal', methods=['GET'])
@jwt_required()
def client_portal_overview():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    user = User.query.get_or_404(current_user_id)
    client = user.client
    if not client:
        return jsonify({"error": "No existe cliente asociado."}), 404
    tenant_id = current_tenant_id()
    if tenant_id is not None and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403

    invoices = []
    subs_q = Subscription.query.filter_by(email=user.email)
    if tenant_id is not None:
        subs_q = subs_q.filter_by(tenant_id=tenant_id)
    for s in subs_q.all():
        invoices.append({
            "id": f"SUB-{s.id}",
            "amount": float(s.amount),
            "due": s.next_charge.isoformat() if s.next_charge else datetime.utcnow().date().isoformat(),
            "status": s.status
        })

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
    user = User.query.get_or_404(current_user_id)
    tenant_id = current_tenant_id()
    subs = Subscription.query.filter_by(email=user.email)
    if tenant_id is not None:
        subs = subs.filter_by(tenant_id=tenant_id)
    invoices = [
        {
            "id": f"SUB-{s.id}",
            "amount": float(s.amount),
            "due": s.next_charge.isoformat() if s.next_charge else datetime.utcnow().date().isoformat(),
            "status": s.status
        }
        for s in subs.all()
    ]
    return jsonify({"items": invoices, "count": len(invoices)}), 200


@main_bp.route('/client/tickets', methods=['GET'])
@jwt_required()
def client_tickets_list():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    filtered = [t for t in CLIENT_TICKETS if t.get('user_id') == current_user_id]
    return jsonify({"items": filtered, "count": len(filtered)}), 200


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
    if not subject or not description:
        return jsonify({"error": "Asunto y descripción requeridos."}), 400
    ticket = {
        "id": f"CT-{len(CLIENT_TICKETS)+1:04d}",
        "user_id": current_user_id,
        "subject": subject,
        "description": description,
        "status": "open",
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    CLIENT_TICKETS.insert(0, ticket)
    return jsonify({"ticket": ticket, "success": True}), 201


@main_bp.route('/client/diagnostics/run', methods=['POST'])
@jwt_required()
def client_diagnostics():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    payload = {
        "ping_gateway_ms": 8.5,
        "ping_internet_ms": 32.4,
        "packet_loss_pct": 0,
        "pppoe_session": "up",
        "recommendations": [
            "Reinicia tu CPE si la latencia supera 100 ms.",
            "Si continúan problemas, abre ticket y adjunta captura de ping."
        ]
    }
    return jsonify(payload), 200


@main_bp.route('/client/notifications/preferences', methods=['GET', 'POST'])
@jwt_required()
def client_notification_preferences():
    current_user_id = _current_user_id()
    if current_user_id is None:
        return jsonify({"error": "Token de usuario invalido."}), 401
    key = f"notif_pref_{current_user_id}"
    if request.method == 'POST':
        data = request.get_json() or {}
        prefs = {
            "email": bool(data.get('email', True)),
            "whatsapp": bool(data.get('whatsapp', False)),
            "push": bool(data.get('push', False)),
        }
        cache.set(key, prefs, timeout=86400)
        return jsonify({"success": True, "preferences": prefs}), 200
    prefs = cache.get(key) or {"email": True, "whatsapp": False, "push": False}
    return jsonify({"preferences": prefs}), 200


@main_bp.route('/ops/run-job', methods=['POST'])
@admin_required()
def run_background_job():
    data = request.get_json() or {}
    job = (data.get('job') or '').strip().lower()
    if job not in {'backup', 'cleanup_leases', 'rotate_passwords', 'recalc_balances'}:
        return jsonify({"error": "job debe ser backup | cleanup_leases | rotate_passwords | recalc_balances"}), 400
    return jsonify({"success": True, "job": job, "started_at": datetime.utcnow().isoformat() + "Z"}), 200


@main_bp.route('/payments/checkout', methods=['POST'])
@limiter.limit("20/hour")
@jwt_required()
def payments_checkout():
    data = request.get_json() or {}
    amount = float(data.get('amount') or 0)
    currency = (data.get('currency') or 'PEN').upper()
    description = data.get('description') or 'Pago ISPFAST'
    if amount <= 0:
        return jsonify({"error": "Monto inválido"}), 400
    session_id = f"chk_{int(datetime.utcnow().timestamp())}"
    payment_url = f"https://checkout-demo.ispfast.com/pay/{session_id}"
    return jsonify({"success": True, "session_id": session_id, "payment_url": payment_url, "currency": currency, "description": description}), 200


@main_bp.route('/payments/webhook', methods=['POST'])
def payments_webhook():
    event = request.get_json() or {}
    sub_id = event.get('subscription_id')
    status = str(event.get('status') or '').lower()
    if sub_id and status in ('paid', 'succeeded'):
        try:
            sub = Subscription.query.get(int(sub_id))
            if sub:
                sub.status = 'active'
                sub.next_charge = (sub.next_charge or datetime.utcnow().date()) + timedelta(days=sub.cycle_months * 30)
                from app import db
                db.session.add(sub)
                db.session.commit()
        except Exception:
            pass
    return jsonify({"received": event, "success": True}), 200


@main_bp.route('/billing/electronic/send', methods=['POST'])
@admin_required()
def billing_electronic_send():
    data = request.get_json() or {}
    invoice_id = data.get('invoice_id') or 'INV-DEMO'
    country = (data.get('country') or 'PE').upper()
    status = "accepted"
    response = {
        "invoice_id": invoice_id,
        "country": country,
        "status": status,
        "message": "Enviado a SUNAT/DIAN/SAT (demo)"
    }
    return jsonify(response), 200


@main_bp.route('/billing/electronic/status', methods=['GET'])
@jwt_required(optional=True)
def billing_electronic_status():
    invoice_id = request.args.get('invoice_id', 'INV-DEMO')
    return jsonify({"invoice_id": invoice_id, "status": "accepted", "message": "Factura electrónica aceptada (demo)"}), 200


@main_bp.route('/runbooks', methods=['GET'])
@jwt_required(optional=True)
def runbooks():
    books = [
        {"id": "RB-001", "title": "Cliente sin navegación", "steps": ["Ping gateway", "Reiniciar CPE", "Verificar colas", "Abrir ticket si persiste"]},
        {"id": "RB-002", "title": "Alto uso de CPU en RouterOS", "steps": ["Export stats", "Revisar firewall rules", "Limitar conexiones", "Programar mantenimiento"]},
    ]
    return jsonify({"items": books, "count": len(books)}), 200


@main_bp.route('/prometheus/metrics', methods=['GET'])
def prometheus_metrics():
    data = network_health().json
    alerts_count = network_alerts().json.get('count', 0)
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
    with MikroTikService() as mikrotik:
        stats = mikrotik.get_client_dashboard_stats(client)
        return jsonify(stats), 200


@main_bp.route('/clients/map-data', methods=['GET'])
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
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"error": "Usuario no autenticado."}), 401

    client = Client.query.get_or_404(client_id)
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
    usage_data = {
        "labels": [(today - timedelta(days=i)).strftime('%b %d') for i in range(days - 1, -1, -1)],
        "datasets": [
            {
                "label": "Uso de Datos (GB)",
                "data": [random.uniform(5, 25) for _ in range(days)],
                "borderColor": 'rgb(54, 162, 235)',
                "backgroundColor": 'rgba(54, 162, 235, 0.2)',
                "fill": True,
            }
        ],
    }
    return jsonify(usage_data), 200
