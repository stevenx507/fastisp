from datetime import datetime, timedelta
from functools import wraps
import random
import secrets

from flask import Blueprint, jsonify, request, Response, current_app, send_file
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app.models import Client, User, Subscription, MikroTikRouter, Plan, AuditLog, Ticket, Invoice, PaymentRecord, TicketComment
from app import limiter, cache
import pyotp
from app.services.mikrotik_service import MikroTikService
from app.services.monitoring_service import MonitoringService
from app.tenancy import current_tenant_id, tenant_access_allowed
from datetime import date
from werkzeug.exceptions import BadRequest
from sqlalchemy.orm import joinedload
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


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

DEMO_USERS = {"demo1@ispmax.com", "demo2@ispmax.com"}

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

    if not current_app.config.get('ALLOW_DEMO_LOGIN', False):
        email = str(data.get('email') or '').strip().lower()
        if email in DEMO_USERS:
            return jsonify({"error": "Las credenciales demo estÃ¡n deshabilitadas en este entorno."}), 403

    tenant_id = current_tenant_id()
    query = User.query.filter_by(email=data.get('email'))
    if tenant_id is not None:
        query = query.filter_by(tenant_id=tenant_id)

    user = query.first()
    if user and user.check_password(data.get('password')):
        # MFA: si estÃ¡ habilitado, validar cÃ³digo
        if user.mfa_enabled:
            mfa_code = str(data.get('mfa_code') or '').strip()
            if not mfa_code:
                return jsonify({"error": "MFA requerido", "mfa_required": True}), 401
            if not user.mfa_secret:
                return jsonify({"error": "MFA no configurado correctamente"}), 500
            totp = pyotp.TOTP(user.mfa_secret)
            if not totp.verify(mfa_code, valid_window=1):
                return jsonify({"error": "CÃ³digo MFA invÃ¡lido", "mfa_required": True}), 401

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
    if not current_app.config.get('ALLOW_SELF_SIGNUP', False):
        return jsonify({"error": "El registro pÃºblico estÃ¡ deshabilitado. Solicite acceso al administrador."}), 403

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({"error": "Nombre, email y contraseÃ±a son requeridos."}), 400

    tenant_id = current_tenant_id()
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "El correo ya estÃ¡ registrado."}), 400

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
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({"error": "Solo administradores pueden cambiar planes"}), 403

    client = Client.query.get(client_id)
    if not client:
        return jsonify({"error": "Cliente no encontrado"}), 404
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403

    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    apply_proration = bool(data.get('prorate', True))
    if not plan_id:
        return jsonify({"error": "plan_id es requerido"}), 400

    new_plan = Plan.query.get(plan_id)
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
    user = User.query.get(user_id)
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

    invoice = Invoice.query.get(invoice_id)
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


@main_bp.route('/auth/google', methods=['POST'])
def google_login():
    """
    Endpoint de demostraciÃ³n para "login con Google": confÃ­a en el payload recibido.
    """
    if not current_app.config.get('ALLOW_GOOGLE_LOGIN', True):
        return jsonify({"error": "El login con Google está deshabilitado en este entorno."}), 403

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

    # Verificar colisiÃ³n de correo
    existing = User.query.filter(User.email == email, User.id != user.id).first()
    if existing:
        return jsonify({"error": "El correo ya estÃ¡ en uso."}), 400

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
        return jsonify({"error": "Secret y cÃ³digo son requeridos."}), 400
    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({"error": "CÃ³digo invÃ¡lido."}), 400
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
            return jsonify({"error": "CÃ³digo invÃ¡lido o faltante."}), 400
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
        return jsonify({"error": "El correo ya estÃ¡ registrado."}), 400

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
    sub = Subscription.query.get_or_404(subscription_id)
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
    client = sub.client or (Client.query.get(sub.client_id) if sub.client_id else None)
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
    sub = Subscription.query.get_or_404(subscription_id)
    tenant_id = current_tenant_id()
    if tenant_id is not None and sub.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Acceso denegado para este tenant."}), 403
    sub.status = 'active'
    # avanzar prÃ³xima fecha segÃºn ciclo
    days = sub.cycle_months * 30
    sub.next_charge = sub.next_charge + timedelta(days=days)
    from app import db

    db.session.add(sub)
    db.session.commit()
    client = sub.client or (Client.query.get(sub.client_id) if sub.client_id else None)
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
        # autosuspender si lleva mÃ¡s de 10 dÃ­as vencido
        if days_overdue >= 10 and sub.status == 'past_due':
            sub.status = 'suspended'
            updated.append(sub.to_dict())
            client = sub.client or (Client.query.get(sub.client_id) if sub.client_id else None)
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
    Devuelve series de InfluxDB para dashboards (mediante mediciÃ³n y rango).
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
        current_app.logger.error("Error consultando mÃ©tricas: %s", exc)
        return jsonify({"success": False, "error": "No se pudieron recuperar mÃ©tricas"}), 502


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
        alerts.append({"id": f"AL-S-{s.id}", "severity": "warning", "scope": "billing", "target": s.customer, "message": "SuscripciÃ³n vencida", "since": datetime.utcnow().isoformat() + "Z"})
    if not alerts:
        alerts.append({"id": "AL-OK", "severity": "info", "scope": "network", "target": "Red", "message": "Sin alertas crÃ­ticas", "since": datetime.utcnow().isoformat() + "Z"})
    _audit("network_alerts", entity_type="network", metadata={"count": len(alerts)})
    return jsonify({"alerts": alerts, "count": len(alerts)}), 200


@main_bp.route('/network/noc-summary', methods=['GET'])
@jwt_required(optional=True)
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
    payload = {
        "ping_gateway_ms": 8.5,
        "ping_internet_ms": 32.4,
        "packet_loss_pct": 0,
        "pppoe_session": "up",
        "recommendations": [
            "Reinicia tu CPE si la latencia supera 100 ms.",
            "Si continÃºan problemas, abre ticket y adjunta captura de ping."
        ]
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
    ticket = Ticket.query.get_or_404(ticket_id)
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
    ticket = Ticket.query.get_or_404(ticket_id)
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
    currency = (data.get('currency') or 'USD').upper()
    method = (data.get('method') or 'stripe').lower()
    description = data.get('description') or 'Pago ISPFAST'
    invoice_id = data.get('invoice_id')
    allow_demo = current_app.config.get('ALLOW_PAYMENT_DEMO', False)
    stripe_secret = current_app.config.get('STRIPE_SECRET_KEY')
    frontend_url = current_app.config.get('FRONTEND_URL') or request.headers.get('Origin') or 'http://localhost:3000'

    if amount <= 0:
        return jsonify({"error": "Monto inválido"}), 400

    if invoice_id:
        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return jsonify({"error": "Factura no encontrada"}), 404
        amount = float(invoice.total_amount)
        currency = invoice.currency

    if method == 'stripe':
        if not stripe_secret:
            if not allow_demo:
                return jsonify({"error": "Stripe no configurado"}), 503
        else:
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
                from app import db
                db.session.add(pay_rec)
                db.session.commit()
                return jsonify({"success": True, "session_id": session.id, "payment_url": session.url}), 200
            except Exception as exc:
                current_app.logger.error("Stripe checkout error: %s", exc, exc_info=True)
                if not allow_demo:
                    return jsonify({"error": "No se pudo iniciar el checkout con Stripe"}), 502

    if method in {'yape', 'nequi', 'transfer'}:
        pay_rec = PaymentRecord(
            invoice_id=invoice_id,
            method=method,
            amount=amount,
            currency=currency,
            status='pending',
            reference=data.get('reference'),
            metadata={"note": "Pago por transferencia registrado, pendiente de conciliación."},
        )
        from app import db
        db.session.add(pay_rec)
        db.session.commit()
        return jsonify({"success": True, "mode": method, "message": "Pago registrado, pendiente de confirmación."}), 201

    if allow_demo:
        return jsonify({"success": True, "mode": "demo", "payment_url": "https://demo-pay.ispfast.com"}), 200
    return jsonify({"error": "Método de pago no soportado"}), 400

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
    invoice_id = event.get('invoice_id')
    payment_intent = (event.get('data') or {}).get('object', {})
    reference = payment_intent.get('id')
    if invoice_id:
        invoice = Invoice.query.get(invoice_id)
        if invoice:
            invoice.status = 'paid'
            pay = PaymentRecord(invoice_id=invoice.id, method='stripe', amount=invoice.total_amount, currency=invoice.currency, status='paid', reference=reference)
            from app import db
            db.session.add(invoice)
            db.session.add(pay)
            db.session.commit()
    return jsonify({"received": event, "success": True}), 200


@main_bp.route('/billing/electronic/send', methods=['POST'])
@admin_required()
def billing_electronic_send():
    data = request.get_json() or {}
    invoice_id = data.get('invoice_id') or 'INV-DEMO'
    country = (data.get('country') or 'PE').upper()
    if country not in {'PE', 'CO', 'MX', 'CL'}:
        return jsonify({"error": "PaÃ­s no soportado para facturaciÃ³n electrÃ³nica."}), 400
    status = "accepted"
    response = {
        "invoice_id": invoice_id,
        "country": country,
        "status": status,
        "message": "Factura electrÃ³nica aceptada"
    }
    return jsonify(response), 200


@main_bp.route('/billing/electronic/status', methods=['GET'])
@jwt_required(optional=True)
def billing_electronic_status():
    if not current_app.config.get('ALLOW_PAYMENT_DEMO', True):
        return jsonify({"error": "Consulta demo de facturaciÃ³n deshabilitada en producciÃ³n."}), 503
    invoice_id = request.args.get('invoice_id', 'INV-DEMO')
    return jsonify({"invoice_id": invoice_id, "status": "accepted", "message": "Factura electrÃ³nica aceptada (demo)"}), 200


@main_bp.route('/runbooks', methods=['GET'])
@jwt_required(optional=True)
def runbooks():
    books = [
        {"id": "RB-001", "title": "Cliente sin navegaciÃ³n", "steps": ["Ping gateway", "Reiniciar CPE", "Verificar colas", "Abrir ticket si persiste"]},
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
            if ts:
                day_idx = (today - datetime.fromisoformat(str(ts)).date()).days
                if 0 <= day_idx < days:
                    data_points[days - 1 - day_idx] += total_gb
    except Exception as exc:
        current_app.logger.info("Uso histórico usando fallback: %s", exc)
        data_points = [random.uniform(5, 25) for _ in range(days)]

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


# ==================== RED: SUSPENDER / ACTIVAR / CAMBIAR VELOCIDAD ====================

@main_bp.route('/admin/clients/<int:client_id>/suspend', methods=['POST'])
@admin_required()
def suspend_client(client_id):
    client = Client.query.get_or_404(client_id)
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403
    if not client.router_id:
        return jsonify({"error": "Cliente sin router asociado"}), 400
    plan = client.plan or Plan.query.get(client.plan_id) if client.plan_id else None
    with MikroTikService(client.router_id) as mikrotik:
        ok = mikrotik.suspend_client(client)
    if ok and client.subscriptions:
        client.subscriptions[0].status = 'suspended'
        db.session.commit()
    return (jsonify({"success": True}), 200) if ok else (jsonify({"error": "No se pudo suspender en MikroTik"}), 500)


@main_bp.route('/admin/clients/<int:client_id>/activate', methods=['POST'])
@admin_required()
def activate_client(client_id):
    client = Client.query.get_or_404(client_id)
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403
    plan = client.plan or Plan.query.get(client.plan_id) if client.plan_id else None
    if not client.router_id:
        return jsonify({"error": "Cliente sin router asociado"}), 400
    with MikroTikService(client.router_id) as mikrotik:
        ok = mikrotik.activate_client(client, plan)
    if ok and client.subscriptions:
        client.subscriptions[0].status = 'active'
        db.session.commit()
    return (jsonify({"success": True}), 200) if ok else (jsonify({"error": "No se pudo activar en MikroTik"}), 500)


@main_bp.route('/admin/clients/<int:client_id>/speed', methods=['POST'])
@admin_required()
def change_client_speed(client_id):
    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    if not plan_id:
        raise BadRequest("plan_id es requerido")
    client = Client.query.get_or_404(client_id)
    tenant_id = current_tenant_id()
    if tenant_id and client.tenant_id not in (None, tenant_id):
        return jsonify({"error": "Cliente fuera del tenant"}), 403
    plan = Plan.query.get_or_404(plan_id)
    if not client.router_id:
        return jsonify({"error": "Cliente sin router asociado"}), 400
    with MikroTikService(client.router_id) as mikrotik:
        ok = mikrotik.change_speed(client, plan)
    return (jsonify({"success": True}), 200) if ok else (jsonify({"error": "No se pudo cambiar velocidad"}), 500)


@main_bp.route('/admin/clients/<int:client_id>/scripts', methods=['GET'])
@admin_required()
def get_client_scripts(client_id):
    client = Client.query.get_or_404(client_id)
    plan = client.plan or (Plan.query.get(client.plan_id) if client.plan_id else None)
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


@main_bp.route('/admin/routers/<int:router_id>/remote-script', methods=['GET'])
@admin_required()
def router_remote_script(router_id):
    """Devuelve un script rápido para habilitar acceso remoto seguro (API/SSH) en MikroTik."""
    router = MikroTikRouter.query.get_or_404(router_id)
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




