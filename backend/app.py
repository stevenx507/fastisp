!pip install Flask-SQLAlchemy Flask-CORS Flask-JWT-Extended routeros-api Werkzeug stripe

import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import datetime
import routeros_api
from werkzeug.security import generate_password_hash, check_password_hash
import stripe

# --- CONFIGURACIÓN ---
app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ispmax.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'super-secret-ispmax-key')
app.config['STRIPE_API_KEY'] = os.getenv('STRIPE_KEY')

db = SQLAlchemy(app)
jwt = JWTManager(app)

# --- MODELOS (models.py) ---
class Router(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    host = db.Column(db.String(50))
    user = db.Column(db.String(50))
    password = db.Column(db.String(50))
    port = db.Column(db.Integer, default=8728)
    is_active = db.Column(db.Boolean, default=True)

class Plan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    download_speed = db.Column(db.Integer) # Mbps
    upload_speed = db.Column(db.Integer)   # Mbps
    price = db.Column(db.Float)
    currency = db.Column(db.String(3), default='MXN')
    burst_limit = db.Column(db.String(20), default='0/0') # Burst dinámico

class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    password_hash = db.Column(db.String(200))
    ip_address = db.Column(db.String(20))
    mac_address = db.Column(db.String(20))
    status = db.Column(db.String(20), default='active') # active, suspended
    router_id = db.Column(db.Integer, db.ForeignKey('router.id'))
    plan_id = db.Column(db.Integer, db.ForeignKey('plan.id'))
    balance = db.Column(db.Float, default=0.0)

    plan = db.relationship('Plan')
    router = db.relationship('Router')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# --- SERVICIO MIKROTIK (services/mikrotik.py) ---
class MikroTikService:
    def __init__(self, router_id):
        self.router_db = Router.query.get(router_id)
        self.connection = None
        self.api = None

    def connect(self):
        if not self.router_db: raise Exception("Router no encontrado")
        try:
            self.connection = routeros_api.RouterOsApiPool(
                self.router_db.host,
                username=self.router_db.user,
                password=self.router_db.password,
                port=self.router_db.port,
                plaintext_login=True
            )
            self.api = self.connection.get_api()
        except Exception as e:
            print(f"Error conectando a MikroTik: {e}")
            raise

    def disconnect(self):
        if self.connection: self.connection.disconnect()

    def provision_client(self, client):
        """Crea Queue, DHCP Lease y Firewall Address List"""
        self.connect()
        try:
            # 1. Simple Queue con Burst (QoS Avanzado)
            max_limit = f"{client.plan.upload_speed}M/{client.plan.download_speed}M"
            # Burst: 2x velocidad por 16s
            burst_limit = f"{client.plan.upload_speed*2}M/{client.plan.download_speed*2}M"

            queues = self.api.get_resource('/queue/simple')
            # Verificar si existe y actualizar o crear
            existing = queues.get(name=client.name)

            payload = {
                'name': client.name,
                'target': client.ip_address,
                'max-limit': max_limit,
                'burst-limit': burst_limit,
                'burst-threshold': max_limit, # Start burst when below max
                'burst-time': '16s/16s',
                'comment': f"ISPMAX-{client.id}"
            }

            if existing:
                queues.set(id=existing[0]['id'], **payload)
            else:
                queues.add(**payload)

            # 2. DHCP Lease
            leases = self.api.get_resource('/ip/dhcp-server/lease')
            existing_lease = leases.get(address=client.ip_address)
            lease_payload = {
                'address': client.ip_address,
                'mac-address': client.mac_address,
                'comment': client.name,
                'server': 'defconf' # Asumiendo nombre server
            }
            if existing_lease:
                leases.set(id=existing_lease[0]['id'], **lease_payload)
            else:
                leases.add(**lease_payload)

        finally:
            self.disconnect()

    def toggle_service(self, client, enable):
        """Corte por impago usando Address Lists"""
        self.connect()
        try:
            fw_list = self.api.get_resource('/ip/firewall/address-list')
            existing = fw_list.get(list='MOROSOS', address=client.ip_address)

            if not enable: # Suspender (Agregar a lista MOROSOS)
                if not existing:
                    fw_list.add(list='MOROSOS', address=client.ip_address, comment=f"Corte-{client.name}")
            else: # Activar (Remover de lista MOROSOS)
                if existing:
                    fw_list.remove(id=existing[0]['id'])
        finally:
            self.disconnect()

# --- RUTAS API ---

@app.route('/api/clients/provision/<int:client_id>', methods=['POST'])
@jwt_required()
def provision(client_id):
    client = Client.query.get_or_404(client_id)
    try:
        mk = MikroTikService(client.router_id)
        mk.provision_client(client)
        return jsonify({"msg": "Cliente aprovisionado en MikroTik correctamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clients/suspend/<int:client_id>', methods=['POST'])
@jwt_required()
def suspend(client_id):
    client = Client.query.get_or_404(client_id)
    try:
        mk = MikroTikService(client.router_id)
        mk.toggle_service(client, enable=False)
        client.status = 'suspended'
        db.session.commit()
        return jsonify({"msg": "Servicio suspendido (Corte por impago)"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    # Demo login (en prod buscar en DB)
    if data.get('email') == 'admin@ispmax.com' and data.get('password') == 'admin':
        token = create_access_token(identity='admin')
        return jsonify(access_token=token)
    return jsonify({"msg": "Bad credentials"}), 401

# Inicializar DB
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
