"""
ISPMAX Backend Application
Main application factory
"""
import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from prometheus_flask_exporter import PrometheusMetrics

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(key_func=get_remote_address)
metrics = PrometheusMetrics.for_app_factory()

def create_app(config_class='config.Config'):
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)
    metrics.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})
    
    # Configure logging
    if not app.debug:
        gunicorn_logger = logging.getLogger('gunicorn.error')
        app.logger.handlers = gunicorn_logger.handlers
        app.logger.setLevel(gunicorn_logger.level)
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.clients import clients_bp
    from app.routes.mikrotik import mikrotik_bp
    from app.routes.billing import billing_bp
    from app.routes.admin import admin_bp
    from app.routes.provisioning import provisioning_bp
    from app.routes.monitoring import monitoring_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(clients_bp, url_prefix='/api/clients')
    app.register_blueprint(mikrotik_bp, url_prefix='/api/mikrotik')
    app.register_blueprint(billing_bp, url_prefix='/api/billing')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(provisioning_bp, url_prefix='/api/provisioning')
    app.register_blueprint(monitoring_bp, url_prefix='/api/monitoring')
    
    # Health check endpoint
    @app.route('/health')
    def health():
        return jsonify({'status': 'healthy', 'service': 'ispmax-backend'})
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f'Server Error: {error}')
        return jsonify({'error': 'Internal server error'}), 500
    
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    return app
