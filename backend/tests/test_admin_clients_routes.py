from flask_jwt_extended import create_access_token

from app import db
from app.models import Client, Plan, User


def _token_for_user(app, user_id: int) -> str:
    with app.app_context():
        return create_access_token(identity=str(user_id))


def _admin_and_plan(app, email_prefix: str = 'admin-clients'):
    with app.app_context():
        admin = User(email=f'{email_prefix}@test.local', role='admin', name='Admin Clients')
        admin.set_password('adminpass123')
        plan = Plan(name=f'Plan {email_prefix}', download_speed=80, upload_speed=20, price=29.9)
        db.session.add_all([admin, plan])
        db.session.commit()
        return admin.id, plan.id


def test_admin_create_client_with_portal_access(client, app):
    admin_id, plan_id = _admin_and_plan(app, email_prefix='admin-clients-portal')
    token = _token_for_user(app, admin_id)

    response = client.post(
        '/api/admin/clients',
        json={
            'name': 'Cliente Portal',
            'plan_id': plan_id,
            'connection_type': 'pppoe',
            'email': 'cliente.portal@test.local',
            'create_portal_access': True,
        },
        headers={'Authorization': f'Bearer {token}'},
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload['client']['name'] == 'Cliente Portal'
    assert payload['user']['email'] == 'cliente.portal@test.local'
    assert payload.get('password')

    with app.app_context():
        created_user = User.query.filter_by(email='cliente.portal@test.local').first()
        assert created_user is not None
        assert created_user.role == 'client'

        created_client = db.session.get(Client, payload['client']['id'])
        assert created_client is not None
        assert created_client.user_id == created_user.id
        assert created_client.connection_type == 'pppoe'
        assert created_client.pppoe_username
        assert created_client.pppoe_password


def test_admin_create_client_without_portal_access(client, app):
    admin_id, plan_id = _admin_and_plan(app, email_prefix='admin-clients-no-portal')
    token = _token_for_user(app, admin_id)

    response = client.post(
        '/api/admin/clients',
        json={
            'name': 'Cliente Solo Red',
            'plan_id': plan_id,
            'connection_type': 'dhcp',
            'create_portal_access': False,
        },
        headers={'Authorization': f'Bearer {token}'},
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload['client']['name'] == 'Cliente Solo Red'
    assert 'user' not in payload
    assert 'password' not in payload

    with app.app_context():
        created_client = db.session.get(Client, payload['client']['id'])
        assert created_client is not None
        assert created_client.user_id is None


def test_admin_create_client_requires_email_when_portal_access_enabled(client, app):
    admin_id, plan_id = _admin_and_plan(app, email_prefix='admin-clients-email-required')
    token = _token_for_user(app, admin_id)

    response = client.post(
        '/api/admin/clients',
        json={
            'name': 'Cliente Sin Email',
            'plan_id': plan_id,
            'connection_type': 'dhcp',
            'create_portal_access': True,
        },
        headers={'Authorization': f'Bearer {token}'},
    )

    assert response.status_code == 400
    assert 'email' in response.get_json()['error']
