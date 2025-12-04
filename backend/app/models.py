"""
Database models for ISPMAX
"""
from app import db
from datetime import datetime, timedelta
import uuid
import bcrypt

class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class User(db.Model, TimestampMixin):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(20), nullable=False, default='client')
    is_active = db.Column(db.Boolean, default=True)
    email_verified = db.Column(db.Boolean, default=False)
    
    # Security
    mfa_enabled = db.Column(db.Boolean, default=False)
    mfa_secret = db.Column(db.String(32))
    last_login = db.Column(db.DateTime)
    failed_login_attempts = db.Column(db.Integer, default=0)
    
    # Relationships
    isp_id = db.Column(db.String(36), db.ForeignKey('isps.id'))
    client_id = db.Column(db.String(36), db.ForeignKey('clients.id'))
    
    isp = db.relationship('ISP', backref='users')
    client = db.relationship('Client', backref='user', uselist=False)
    
    # Preferences
    preferences = db.Column(db.JSON, default=lambda: {
        'notifications': {'email': True, 'sms': False, 'whatsapp': True},
        'theme': 'light',
        'language': 'es'
    })
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ISP(db.Model, TimestampMixin):
    __tablename__ = 'isps'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    legal_name = db.Column(db.String(200))
    subdomain = db.Column(db.String(50), unique=True, nullable=False, index=True)
    contact_email = db.Column(db.String(120))
    contact_phone = db.Column(db.String(20))
    
    # Configuration
    theme_config = db.Column(db.JSON, default=lambda: {
        'primary_color': '#3b82f6',
        'secondary_color': '#1e40af',
        'logo_url': '/static/logo.png'
    })
    
    # Billing
    currency = db.Column(db.String(3), default='MXN')
    tax_rate = db.Column(db.Float, default=0.16)
    
    # Status
    status = db.Column(db.String(20), default='active')
    
    # Relationships
    plans = db.relationship('Plan', backref='isp', lazy='dynamic')
    routers = db.relationship('MikroTikRouter', backref='isp', lazy='dynamic')
    clients = db.relationship('Client', backref='isp', lazy='dynamic')


class Client(db.Model, TimestampMixin):
    __tablename__ = 'clients'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    isp_id = db.Column(db.String(36), db.ForeignKey('isps.id'), nullable=False)
    plan_id = db.Column(db.String(36), db.ForeignKey('plans.id'))
    
    # Personal info
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), index=True)
    phone = db.Column(db.String(20))
    dni = db.Column(db.String(20))
    
    # Address
    address = db.Column(db.Text)
    city = db.Column(db.String(50))
    state = db.Column(db.String(50))
    zip_code = db.Column(db.String(10))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    
    # Network
    ip_address = db.Column(db.String(45))  # IPv6 compatible
    mac_address = db.Column(db.String(17))
    pppoe_username = db.Column(db.String(50))
    pppoe_password = db.Column(db.String(50))
    
    # Status
    status = db.Column(db.String(20), default='active')  # active, suspended, cancelled
    connection_type = db.Column(db.String(20), default='dhcp')  # dhcp, pppoe, static
    installation_date = db.Column(db.DateTime)
    
    # Billing
    billing_day = db.Column(db.Integer, default=1)  # Day of month for billing
    balance = db.Column(db.Float, default=0.0)
    
    # Relationships
    plan = db.relationship('Plan', backref='clients')
    invoices = db.relationship('Invoice', backref='client', lazy='dynamic')
    tickets = db.relationship('SupportTicket', backref='client', lazy='dynamic')
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'full_name': self.full_name,
            'email': self.email,
            'phone': self.phone,
            'status': self.status,
            'plan': self.plan.name if self.plan else None,
            'ip_address': self.ip_address,
            'balance': self.balance
        }


class Plan(db.Model, TimestampMixin):
    __tablename__ = 'plans'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    isp_id = db.Column(db.String(36), db.ForeignKey('isps.id'), nullable=False)
    
    # Plan details
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    setup_fee = db.Column(db.Float, default=0.0)
    
    # Bandwidth
    download_speed = db.Column(db.Integer)  # Mbps
    upload_speed = db.Column(db.Integer)    # Mbps
    burst_download = db.Column(db.Integer)
    burst_upload = db.Column(db.Integer)
    data_limit = db.Column(db.Integer)  # GB, 0 = unlimited
    
    # QoS
    qos_profile = db.Column(db.String(50))
    priority = db.Column(db.Integer, default=1)  # 1-10, higher = better
    
    # Features
    features = db.Column(db.JSON, default=lambda: {
        'ipv6': True,
        'voip': False,
        'gaming': False,
        'static_ip': False,
        'public_ip': False
    })
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'download_speed': self.download_speed,
            'upload_speed': self.upload_speed,
            'features': self.features
        }


class Invoice(db.Model, TimestampMixin):
    __tablename__ = 'invoices'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = db.Column(db.String(36), db.ForeignKey('clients.id'), nullable=False)
    
    # Invoice details
    invoice_number = db.Column(db.String(50), unique=True, index=True)
    amount = db.Column(db.Float, nullable=False)
    tax_amount = db.Column(db.Float, default=0.0)
    total_amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), default='MXN')
    
    # Dates
    issue_date = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, nullable=False)
    paid_date = db.Column(db.DateTime)
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, paid, overdue, cancelled
    payment_method = db.Column(db.String(20))  # stripe, oxxo, spei, cash
    
    # Payment processing
    stripe_payment_intent = db.Column(db.String(100))
    stripe_invoice_id = db.Column(db.String(100))
    
    # Metadata
    period_start = db.Column(db.DateTime)
    period_end = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    
    # PDF
    pdf_url = db.Column(db.String(255))
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'amount': self.amount,
            'total_amount': self.total_amount,
            'status': self.status,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'paid_date': self.paid_date.isoformat() if self.paid_date else None
        }


class MikroTikRouter(db.Model, TimestampMixin):
    __tablename__ = 'mikrotik_routers'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    isp_id = db.Column(db.String(36), db.ForeignKey('isps.id'), nullable=False)
    
    # Router info
    name = db.Column(db.String(100), nullable=False)
    model = db.Column(db.String(50))
    serial_number = db.Column(db.String(50))
    firmware_version = db.Column(db.String(50))
    
    # Connection
    ip_address = db.Column(db.String(45), nullable=False)
    api_port = db.Column(db.Integer, default=8728)
    ssh_port = db.Column(db.Integer, default=22)
    
    # Credentials (encrypted in production)
    username = db.Column(db.String(50), nullable=False)
    password = db.Column(db.String(100), nullable=False)
    
    # Location
    location = db.Column(db.String(100))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    last_seen = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='online')  # online, offline, maintenance
    
    # Configuration
    config_version = db.Column(db.String(50))
    backup_enabled = db.Column(db.Boolean, default=True)
    backup_schedule = db.Column(db.String(20), default='daily')  # daily, weekly, monthly
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'name': self.name,
            'ip_address': self.ip_address,
            'model': self.model,
            'status': self.status,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None
        }


class SupportTicket(db.Model, TimestampMixin):
    __tablename__ = 'support_tickets'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = db.Column(db.String(36), db.ForeignKey('clients.id'))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    
    # Ticket details
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50))  # technical, billing, general
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, critical
    
    # Status
    status = db.Column(db.String(20), default='open')  # open, in_progress, resolved, closed
    assigned_to = db.Column(db.String(36), db.ForeignKey('users.id'))
    resolution = db.Column(db.Text)
    
    # Timestamps
    resolved_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)
    
    # Relationships
    assigned_agent = db.relationship('User', foreign_keys=[assigned_to])
    creator = db.relationship('User', foreign_keys=[user_id])
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Referral(db.Model, TimestampMixin):
    __tablename__ = 'referrals'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    referrer_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    referred_client_id = db.Column(db.String(36), db.ForeignKey('clients.id'))
    
    # Referral details
    code = db.Column(db.String(20), unique=True, index=True)
    discount_amount = db.Column(db.Float, default=50.0)
    commission_rate = db.Column(db.Float, default=0.10)  # 10%
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, used, expired
    used_at = db.Column(db.DateTime)
    
    # Relationships
    referrer = db.relationship('User', foreign_keys=[referrer_id])
    referred_client = db.relationship('Client', foreign_keys=[referred_client_id])
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'code': self.code,
            'discount_amount': self.discount_amount,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
