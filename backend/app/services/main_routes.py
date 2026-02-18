from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.services.mikrotik_service import MikroTikService
from app.models import User, Client, MikroTikRouter
from datetime import datetime, timedelta
import random

# Helper para verificar rol de admin
def admin_required():
    def wrapper(fn):
        @jwt_required()
        def decorator(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if user and user.role == 'admin':
                return fn(*args, **kwargs)
            else:
                return jsonify({"error": "Acceso denegado. Se requiere rol de administrador."}), 403
        return decorator
    return wrapper

# Este Blueprint contendrá las rutas principales de la API
main_bp = Blueprint('main_bp', __name__)

# --- ENDPOINTS DE API ---

@main_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email y contraseña son requeridos."}), 400

    user = User.query.filter_by(email=data.get('email')).first()

    # Asumiendo que el modelo User tiene un método `check_password`
    if user and user.check_password(data.get('password')):
        # El identity del token puede ser el ID del usuario o su email
        access_token = create_access_token(identity=user.id)
        return jsonify({
            "token": access_token,
            "user": user.to_dict() # Asumiendo que el modelo User tiene un método `to_dict`
        }), 200
    
    return jsonify({"error": "Credenciales incorrectas."}), 401

@main_bp.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    current_user_id = get_jwt_identity()
    client = Client.query.filter_by(user_id=current_user_id).first_or_404()
    mikrotik = MikroTikService()
    try:
        # El método get_client_dashboard_stats simula los datos, pero está listo para ser real
        stats = mikrotik.get_client_dashboard_stats(client)
        return jsonify(stats), 200
    finally:
        mikrotik.disconnect()

@main_bp.route('/api/clients/map-data', methods=['GET'])
def get_clients_for_map():
    mikrotik = MikroTikService()
    client_data = mikrotik.get_all_clients_with_location()
    return jsonify(client_data), 200

@main_bp.route('/api/clients/<int:client_id>/reboot-cpe', methods=['POST'])
@admin_required()
def reboot_client_cpe(client_id):
    client = Client.query.get_or_404(client_id)
    if not client.router_id:
        return jsonify({"error": "El cliente no tiene un router asociado."}), 400

    mikrotik = None
    try:
        mikrotik = MikroTikService()
        success, message = mikrotik.reboot_client_cpe(client)
        if success:
            return jsonify({"message": message}), 200
        else:
            return jsonify({"error": message}), 400
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/clients/<int:client_id>/history', methods=['GET'])
@admin_required()
def get_client_history(client_id):
    mikrotik = None
    try:
        mikrotik = MikroTikService()
        history = mikrotik.get_client_event_history(client_id)
        return jsonify(sorted(history, key=lambda x: x['timestamp'], reverse=True)), 200
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/main/reboot', methods=['POST'])
@jwt_required() # Permite al cliente reiniciar su propio router principal
def reboot_main_router():
    # Asume que el router principal tiene un ID conocido, por ejemplo 'main_router'
    mikrotik = None
    try:
        router = MikroTikRouter.query.filter_by(name="Router Principal").first_or_404()
        mikrotik = MikroTikService(router.id)
        if mikrotik.reboot_router():
            return jsonify({"message": "El router principal se está reiniciando."}), 200
        return jsonify({"error": "No se pudo reiniciar el router."}), 500
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/clients/usage-history', methods=['GET'])
@jwt_required()
def get_usage_history():
    current_user_id = get_jwt_identity()
    # Asegurarse de que el usuario es un cliente
    Client.query.filter_by(user_id=current_user_id).first_or_404("Cliente no encontrado.")

    # Obtener el rango de la query string, con un valor por defecto de 30 días
    range_str = request.args.get('range', '30d')
    days = 30
    if range_str == '7d':
        days = 7
    elif range_str == '90d':
        days = 90

    # Simula datos de uso diario para el rango solicitado
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
        ]
    }
    return jsonify(usage_data), 200


# Endpoints para MikroTikManagement (simulados)
@main_bp.route('/api/mikrotik/routers', methods=['GET'])
@admin_required()
def get_routers():
    routers_db = MikroTikRouter.query.all()
    routers = [r.to_dict() for r in routers_db] # Asume método to_dict()
    return jsonify({"success": True, "routers": routers})

@main_bp.route('/api/mikrotik/routers/<router_id>/health', methods=['GET'])
@admin_required()
def get_router_health(router_id):
    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        health = mikrotik.get_system_health()
        return jsonify({"success": True, "health": health})
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/queues', methods=['GET'])
@admin_required()
def get_router_queues(router_id):
    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        queues = mikrotik.get_queue_stats()
        return jsonify({"success": True, "queues": queues})
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/connections', methods=['GET'])
@admin_required()
def get_router_connections(router_id):
    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        connections = mikrotik.get_active_connections()
        return jsonify({"success": True, "connections": connections})
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/queues/toggle', methods=['POST'])
@admin_required()
def toggle_router_queue(router_id):
    data = request.get_json()
    queue_id = data.get('id')
    disable = data.get('disable')

    if not queue_id or disable is None:
        return jsonify({"success": False, "error": "Se requiere el ID de la cola y el estado."}), 400

    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        
        success = mikrotik.toggle_queue_status(queue_id, disable)
        return jsonify({"success": success})
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/connections', methods=['DELETE'])
@admin_required()
def delete_router_connection(router_id):
    data = request.get_json()
    connection_id = data.get('id')
    connection_type = data.get('type')

    if not connection_id or not connection_type:
        return jsonify({"success": False, "error": "Se requiere el ID y el tipo de la conexión."}), 400

    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        
        success = mikrotik.delete_active_connection(connection_id, connection_type)
        return jsonify({"success": success})
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/queues', methods=['DELETE'])
@admin_required()
def delete_router_queue(router_id):
    data = request.get_json()
    queue_id = data.get('id')

    if not queue_id:
        return jsonify({"success": False, "error": "Se requiere el ID de la cola."}), 400

    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        
        success = mikrotik.delete_queue(queue_id)
        return jsonify({"success": success})
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/queues/update-limit', methods=['PUT'])
@admin_required()
def update_router_queue_limit(router_id):
    data = request.get_json()
    queue_id = data.get('id')
    download_speed = data.get('download')
    upload_speed = data.get('upload')

    if not all([queue_id, download_speed, upload_speed]):
        return jsonify({"success": False, "error": "Se requiere ID de cola, velocidad de subida y bajada."}), 400

    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        
        success = mikrotik.update_queue_limit(queue_id, download_speed, upload_speed)
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "error": "No se pudo actualizar el límite de la cola en el router."}), 500
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/queues', methods=['POST'])
@admin_required()
def create_router_queue(router_id):
    data = request.get_json()
    name = data.get('name')
    target = data.get('target')
    download_speed = data.get('download')
    upload_speed = data.get('upload')

    if not all([name, target, download_speed, upload_speed]):
        return jsonify({"success": False, "error": "Nombre, target y velocidades son requeridos."}), 400

    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if not mikrotik.api:
            return jsonify({"success": False, "error": "No se pudo conectar al router."}), 500
        
        result = mikrotik.create_simple_queue(name, target, download_speed, upload_speed)
        
        if result.get('success'):
            # The service method should return the newly created queue object
            new_queue = result.get('queue')
            return jsonify({"success": True, "queue": new_queue}), 201
        else:
            return jsonify({"success": False, "error": result.get('error', 'No se pudo crear la cola.')}), 500
    finally:
        if mikrotik:
            mikrotik.disconnect()

@main_bp.route('/api/mikrotik/routers/<router_id>/reboot', methods=['POST'])
@admin_required()
def reboot_specific_router(router_id):
    mikrotik = None
    try:
        mikrotik = MikroTikService(router_id)
        if mikrotik.reboot_router():
            return jsonify({"success": True, "message": f"Router {router_id} se está reiniciando."})
        return jsonify({"success": False, "error": "Fallo al reiniciar el router."})
    finally:
        if mikrotik:
            mikrotik.disconnect()

# ... (aquí irían el resto de endpoints para logs, backup, etc., de forma similar)