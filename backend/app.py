from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token
from flask_cors import CORS
from flask_mail import Mail, Message
import routeros_api
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'ispmax2025')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ispmax.db')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'ispmaxjwt2025')
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', 'no-reply@ispmax.com')

CORS(app)
db = SQLAlchemy(app)
jwt = JWTManager(app)
mail = Mail(app)

class Client(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    ip_address = db.Column(db.String(15))
    mac_address = db.Column(db.String(17))
    plan_speed = db.Column(db.Integer, default=100)
    plan_price = db.Column(db.Float, default=450.0)
    is_active = db.Column(db.Boolean, default=True)

class MikroTikService:
    def __init__(self):
        try:
            connection = routeros_api.RouterOsApiPool(
                host=os.getenv('MIKROTIK_HOST', '192.168.88.1'),
                username=os.getenv('MIKROTIK_USER', 'admin'),
                password=os.getenv('MIKROTIK_PASS', ''),
                port=8728,
                use_ssl=False,
                plaintext_login=True
            )
            self.api = connection.get_api()
        except:
            self.api = None

    def setup_client(self, client):
        if not self.api:
            return
        script = f"""
        /queue simple
        add name="{client.username}" target={client.ip_address} max-limit={client.plan_speed}M/{client.plan_speed}M burst-limit={int(client.plan_speed*1.5)}M burst-time=30s comment="ISPMAX"
        /ip dhcp-server lease
        add address={client.ip_address} mac-address={client.mac_address or '00:00:00:00:00:00'} comment="{client.username}"
        """
        try:
            self.api.get_resource('/script').add(name='temp', source=script)
            self.api.get_resource('/script').call('run', {'name': 'temp'})
        except:
            pass

mikrotik = MikroTikService()

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    client = Client(
        username=data['username'],
        email=data['email'],
        ip_address=data['ip_address'],
        mac_address=data.get('mac_address'),
        plan_speed=data['plan_speed'],
        plan_price=data['plan_speed'] * 4.5
    )
    db.session.add(client)
    db.session.commit()
    mikrotik.setup_client(client)
    return jsonify({"msg": "Cliente creado con éxito"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    client = Client.query.filter_by(email=data['email']).first()
    if client:
        token = create_access_token(identity=client.id)
        return jsonify({"token": token, "client": client.username})
    return jsonify({"error": "Credenciales inválidas"}), 401

@app.route('/api/client/<int:id>')
def get_client(id):
    client = Client.query.get(id)
    if client:
        return jsonify({
            "username": client.username,
            "plan_speed": client.plan_speed,
            "ip_address": client.ip_address
        })
    return jsonify({"error": "Cliente no encontrado"}), 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000)
