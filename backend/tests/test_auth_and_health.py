from flask_jwt_extended import create_access_token, decode_token

from app import db
from app.models import Tenant, User


def test_health_endpoint(client):
    response = client.get('/health')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload == {'status': 'healthy', 'service': 'ispmax-backend'}


def test_versioned_api_health_endpoint(client):
    response = client.get('/api/v1/health')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload == {'status': 'healthy', 'service': 'ispmax-backend-api'}


def test_login_success_returns_token_and_user(client, app):
    with app.app_context():
        tenant = Tenant(slug='isp-a', name='ISP A')
        db.session.add(tenant)
        db.session.flush()

        user = User(email='admin@test.local', role='admin', name='Admin Test', tenant_id=tenant.id)
        user.set_password('supersecret')
        db.session.add(user)
        db.session.commit()

    response = client.post(
        '/api/auth/login',
        json={'email': 'admin@test.local', 'password': 'supersecret'},
        headers={'X-Tenant-ID': '1'},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert 'token' in payload
    assert payload['user']['email'] == 'admin@test.local'
    assert payload['user']['role'] == 'admin'
    with app.app_context():
        claims = decode_token(payload['token'])
    assert claims.get('tenant_id') == 1


def test_v1_login_alias_works(client, app):
    with app.app_context():
        user = User(email='v1@test.local', role='admin', name='V1 Admin')
        user.set_password('supersecret')
        db.session.add(user)
        db.session.commit()

    response = client.post(
        '/api/v1/auth/login',
        json={'email': 'v1@test.local', 'password': 'supersecret'},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert 'token' in payload


def test_login_rejects_invalid_credentials(client):
    response = client.post(
        '/api/auth/login',
        json={'email': 'missing@test.local', 'password': 'bad-password'},
    )

    assert response.status_code == 401
    payload = response.get_json()
    assert payload['error'] == 'Credenciales incorrectas.'


def test_login_requires_email_and_password(client):
    response = client.post('/api/auth/login', json={'email': ''})

    assert response.status_code == 400
    payload = response.get_json()
    assert payload['error'] == 'Email y contrasena son requeridos.'


def test_login_rejects_tenant_mismatch(client, app):
    with app.app_context():
        tenant = Tenant(slug='isp-b', name='ISP B')
        db.session.add(tenant)
        db.session.flush()
        user = User(email='tenant@test.local', role='admin', name='Tenant Admin', tenant_id=tenant.id)
        user.set_password('supersecret')
        db.session.add(user)
        db.session.commit()

    response = client.post(
        '/api/auth/login',
        json={'email': 'tenant@test.local', 'password': 'supersecret'},
        headers={'X-Tenant-ID': '999'},
    )

    assert response.status_code == 401


def test_update_password_success(client, app):
    with app.app_context():
        user = User(email='password@test.local', role='admin', name='Password Admin')
        user.set_password('oldpassword123')
        db.session.add(user)
        db.session.commit()
        user_id = user.id

    with app.app_context():
        auth_token = create_access_token(identity=str(user_id))

    response = client.post(
        '/api/auth/password',
        json={'current_password': 'oldpassword123', 'new_password': 'newpassword123'},
        headers={'Authorization': f'Bearer {auth_token}'},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True

    with app.app_context():
        updated = User.query.get(user_id)
        assert updated is not None
        assert updated.check_password('newpassword123')


def test_update_password_rejects_wrong_current_password(client, app):
    with app.app_context():
        user = User(email='password-fail@test.local', role='admin', name='Password Fail')
        user.set_password('correctpassword')
        db.session.add(user)
        db.session.commit()
        user_id = user.id
        auth_token = create_access_token(identity=str(user_id))

    response = client.post(
        '/api/auth/password',
        json={'current_password': 'wrongpassword', 'new_password': 'anothernewpassword'},
        headers={'Authorization': f'Bearer {auth_token}'},
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert 'incorrecta' in payload['error']

