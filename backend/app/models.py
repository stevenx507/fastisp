from datetime import datetime

from cryptography.fernet import Fernet
from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash

from app import db

def _get_fernet():
    """Helper to get Fernet instance for encryption/decryption."""
    key = current_app.config['ENCRYPTION_KEY']
    # If the key is bytes, use it directly. If it's a string, encode it.
    if isinstance(key, str):
        key = key.encode('utf-8')
    return Fernet(key)


class Tenant(db.Model):
    __tablename__ = 'tenants'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(80), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    users = db.relationship('User', back_populates='tenant')
    clients = db.relationship('Client', back_populates='tenant')
    plans = db.relationship('Plan', back_populates='tenant')
    routers = db.relationship('MikroTikRouter', back_populates='tenant')
    tickets = db.relationship('Ticket', back_populates='tenant')

    def to_dict(self):
        return {
            'id': self.id,
            'slug': self.slug,
            'name': self.name,
            'is_active': self.is_active,
        }


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='client')  # 'client' or 'admin'
    name = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), index=True)
    mfa_enabled = db.Column(db.Boolean, default=False, nullable=False)
    mfa_secret = db.Column(db.String(128))

    # Relationship to Client
    client = db.relationship('Client', back_populates='user', uselist=False, cascade="all, delete-orphan")
    tenant = db.relationship('Tenant', back_populates='users')
    tickets = db.relationship('Ticket', back_populates='user')

    def set_password(self, password):
        """Hashes and sets the user's password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Checks if the provided password matches the stored hash."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Serializes the User object to a dictionary."""
        user_data = {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'tenant_id': self.tenant_id,
            'mfa_enabled': self.mfa_enabled,
        }
        if self.role == 'client' and self.client and self.client.plan:
            user_data['plan'] = self.client.plan.name
            user_data['client_id'] = self.client.id
        return user_data

    def __repr__(self):
        return f'<User {self.email}>'


class Subscription(db.Model):
    __tablename__ = 'subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    customer = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    plan = db.Column(db.String(30), nullable=False)  # Mensual, Trimestral, Semestral, Anual
    cycle_months = db.Column(db.Integer, nullable=False, default=1)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='active')  # active, past_due, trial, suspended, cancelled
    currency = db.Column(db.String(8), nullable=False, default='USD')
    country = db.Column(db.String(4), nullable=True)
    tax_percent = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    next_charge = db.Column(db.Date, nullable=False)
    method = db.Column(db.String(30), nullable=False, default='manual')
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), index=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    client = db.relationship('Client', back_populates='subscriptions')
    invoices = db.relationship('Invoice', back_populates='subscription', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'customer': self.customer,
            'email': self.email,
            'plan': self.plan,
            'cycle_months': self.cycle_months,
            'amount': float(self.amount),
            'status': self.status,
            'currency': self.currency,
            'country': self.country,
            'tax_percent': float(self.tax_percent),
            'next_charge': self.next_charge.isoformat() if self.next_charge else None,
            'method': self.method,
            'tenant_id': self.tenant_id,
            'client_id': self.client_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class Client(db.Model):
    __tablename__ = 'clients'
    __table_args__ = (
        db.Index('ix_clients_tenant_router', 'tenant_id', 'router_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    ip_address = db.Column(db.String(45))
    mac_address = db.Column(db.String(17))
    connection_type = db.Column(db.String(20), default='dhcp') # dhcp, pppoe, static
    pppoe_username = db.Column(db.String(80))
    pppoe_password = db.Column(db.String(80))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('plans.id'))
    router_id = db.Column(db.Integer, db.ForeignKey('mikrotik_routers.id'))
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), index=True)

    user = db.relationship('User', back_populates='client')
    plan = db.relationship('Plan', back_populates='clients')
    router = db.relationship('MikroTikRouter', back_populates='clients')
    tenant = db.relationship('Tenant', back_populates='clients')
    subscriptions = db.relationship('Subscription', back_populates='client')
    tickets = db.relationship('Ticket', back_populates='client')

    def to_dict(self):
        """Serializes the Client object to a dictionary."""
        return {
            'id': self.id,
            'name': self.full_name,
            'ip_address': self.ip_address,
            'mac_address': self.mac_address,
            'connection_type': self.connection_type,
            'plan_name': self.plan.name if self.plan else None,
            'tenant_id': self.tenant_id,
        }


class Plan(db.Model):
    __tablename__ = 'plans'
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='uq_plan_tenant_name'),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    download_speed = db.Column(db.Integer, nullable=False) # In Mbps
    upload_speed = db.Column(db.Integer, nullable=False) # In Mbps
    price = db.Column(db.Float)
    features = db.Column(db.JSON)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), index=True)

    tenant = db.relationship('Tenant', back_populates='plans')
    clients = db.relationship('Client', back_populates='plan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'download_speed': self.download_speed,
            'upload_speed': self.upload_speed,
            'price': self.price,
            'tenant_id': self.tenant_id,
        }


class MikroTikRouter(db.Model):
    __tablename__ = 'mikrotik_routers'
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'ip_address', name='uq_router_tenant_ip'),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    username = db.Column(db.String(80), nullable=False)
    _password_encrypted = db.Column(db.LargeBinary, nullable=False, name='password') # Stored as encrypted bytes
    api_port = db.Column(db.Integer, default=8728)
    is_active = db.Column(db.Boolean, default=True)
    last_seen = db.Column(db.DateTime)
    alert_config = db.Column(db.JSON, nullable=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), index=True)

    tenant = db.relationship('Tenant', back_populates='routers')
    clients = db.relationship('Client', back_populates='router')

    @property
    def password(self):
        """Decrypts and returns the router's password."""
        if self._password_encrypted:
            try:
                fernet = _get_fernet()
                return fernet.decrypt(self._password_encrypted).decode('utf-8')
            except Exception as e:
                current_app.logger.error(f"Error decrypting MikroTik router password for {self.name}: {e}")
                return None
        return None

    @password.setter
    def password(self, plaintext_password):
        """Encrypts the plaintext password and stores it."""
        if plaintext_password:
            fernet = _get_fernet()
            self._password_encrypted = fernet.encrypt(plaintext_password.encode('utf-8'))
        else:
            self._password_encrypted = None

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'ip_address': self.ip_address,
            'status': 'online' if self.is_active else 'offline', # Simplified status
            'tenant_id': self.tenant_id,
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    action = db.Column(db.String(120), nullable=False)
    entity_type = db.Column(db.String(120), nullable=True)
    entity_id = db.Column(db.String(120), nullable=True)
    # "metadata" is reserved in SQLAlchemy Declarative; keep column name but expose as meta
    meta = db.Column('metadata', db.JSON, nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship('User')
    tenant = db.relationship('Tenant')

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "metadata": self.meta,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Ticket(db.Model):
    __tablename__ = 'tickets'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), index=True, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True, nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), index=True, nullable=True)
    subject = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='open', nullable=False)  # open, in_progress, resolved, closed
    priority = db.Column(db.String(20), default='medium', nullable=False)  # low, medium, high, urgent
    assigned_to = db.Column(db.String(120), nullable=True)
    sla_due_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = db.relationship('Tenant', back_populates='tickets')
    user = db.relationship('User', back_populates='tickets')
    client = db.relationship('Client', back_populates='tickets')
    comments = db.relationship('TicketComment', back_populates='ticket', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "client_id": self.client_id,
            "subject": self.subject,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "assigned_to": self.assigned_to,
            "sla_due_at": self.sla_due_at.isoformat() if self.sla_due_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TicketComment(db.Model):
    __tablename__ = 'ticket_comments'
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), index=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    comment = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    ticket = db.relationship('Ticket', back_populates='comments')
    user = db.relationship('User')

    def to_dict(self):
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "user_id": self.user_id,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "author": self.user.email if self.user else None,
        }


class Invoice(db.Model):
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.id'), index=True, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(8), nullable=False, default='USD')
    tax_percent = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, paid, cancelled
    due_date = db.Column(db.Date, nullable=False)
    country = db.Column(db.String(4), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    subscription = db.relationship('Subscription', back_populates='invoices')
    payments = db.relationship('PaymentRecord', back_populates='invoice', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "subscription_id": self.subscription_id,
            "amount": float(self.amount),
            "currency": self.currency,
            "tax_percent": float(self.tax_percent),
            "total_amount": float(self.total_amount),
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "country": self.country,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PaymentRecord(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), index=True, nullable=False)
    method = db.Column(db.String(30), nullable=False, default='manual')  # stripe, yape, nequi, transfer
    reference = db.Column(db.String(120), nullable=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(8), nullable=False, default='USD')
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, paid, failed
    meta = db.Column('metadata', db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    invoice = db.relationship('Invoice', back_populates='payments')

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_id": self.invoice_id,
            "method": self.method,
            "reference": self.reference,
            "amount": float(self.amount),
            "currency": self.currency,
            "status": self.status,
            "metadata": self.meta,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
