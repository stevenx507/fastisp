from datetime import date

import app.routes.main_routes as main_routes
from flask_jwt_extended import create_access_token

from app import db
from app.models import Client, MikroTikRouter, Plan, Subscription, User


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


def test_admin_create_portal_access_for_existing_client(client, app):
    admin_id, plan_id = _admin_and_plan(app, email_prefix='admin-portal-existing-client')
    token = _token_for_user(app, admin_id)

    with app.app_context():
        existing = Client(
            full_name='Cliente Sin Portal',
            connection_type='dhcp',
            plan_id=plan_id,
        )
        db.session.add(existing)
        db.session.commit()
        client_id = existing.id

    response = client.post(
        f'/api/admin/clients/{client_id}/portal-access',
        json={'email': 'sin.portal@test.local'},
        headers={'Authorization': f'Bearer {token}'},
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload['success'] is True
    assert payload['created'] is True
    assert payload['user']['email'] == 'sin.portal@test.local'
    assert payload.get('password')

    with app.app_context():
        created_client = db.session.get(Client, client_id)
        assert created_client is not None
        assert created_client.user_id is not None
        created_user = db.session.get(User, created_client.user_id)
        assert created_user is not None
        assert created_user.email == 'sin.portal@test.local'
        assert created_user.role == 'client'


def test_admin_reset_portal_access_for_existing_user(client, app):
    admin_id, plan_id = _admin_and_plan(app, email_prefix='admin-portal-reset')
    token = _token_for_user(app, admin_id)

    with app.app_context():
        linked_user = User(email='cliente.existente@test.local', role='client', name='Cliente Existente')
        linked_user.set_password('old-password')
        db.session.add(linked_user)
        db.session.flush()

        existing = Client(
            full_name='Cliente Existente',
            connection_type='dhcp',
            plan_id=plan_id,
            user_id=linked_user.id,
        )
        db.session.add(existing)
        db.session.commit()
        client_id = existing.id
        user_id = linked_user.id

    response = client.post(
        f'/api/admin/clients/{client_id}/portal-access',
        json={'password': 'new-password-123'},
        headers={'Authorization': f'Bearer {token}'},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert payload['created'] is False
    assert payload['user']['email'] == 'cliente.existente@test.local'
    assert payload['password'] == 'new-password-123'

    with app.app_context():
        updated_user = db.session.get(User, user_id)
        assert updated_user is not None
        assert updated_user.check_password('new-password-123') is True


def test_admin_clients_export_csv_supports_filters(client, app):
    admin_id, plan_id = _admin_and_plan(app, email_prefix='admin-clients-export')
    token = _token_for_user(app, admin_id)

    with app.app_context():
        db.session.add_all(
            [
                Client(full_name='Cliente Export Uno', connection_type='dhcp', plan_id=plan_id, ip_address='10.0.0.11'),
                Client(full_name='Cliente Export Dos', connection_type='dhcp', plan_id=plan_id, ip_address='10.0.0.12'),
            ]
        )
        db.session.commit()

    response = client.get(
        '/api/admin/clients/export?format=csv&q=Uno',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert response.status_code == 200
    assert 'text/csv' in response.headers.get('Content-Type', '').lower()
    body = response.get_data(as_text=True)
    assert 'Cliente Export Uno' in body
    assert 'Cliente Export Dos' not in body
    assert 'router_name' in body


def test_admin_clients_bulk_action_suspend_and_activate(client, app, monkeypatch):
    admin_id, plan_id = _admin_and_plan(app, email_prefix='admin-clients-bulk')
    token = _token_for_user(app, admin_id)

    with app.app_context():
        router = MikroTikRouter(
            name='Router Bulk',
            ip_address='10.200.1.1',
            username='admin',
            tenant_id=None,
        )
        router.password = 'Secret#Router01'
        db.session.add(router)
        db.session.flush()

        ok_client = Client(
            full_name='Cliente Lote OK',
            connection_type='pppoe',
            plan_id=plan_id,
            router_id=router.id,
            pppoe_username='loteok',
            pppoe_password='lotepass',
        )
        no_router_client = Client(
            full_name='Cliente Lote Sin Router',
            connection_type='dhcp',
            plan_id=plan_id,
        )
        db.session.add_all([ok_client, no_router_client])
        db.session.flush()

        subscription = Subscription(
            customer=ok_client.full_name,
            email='cliente.lote.ok@test.local',
            plan='Plan bulk',
            cycle_months=1,
            amount=25,
            status='active',
            currency='USD',
            tax_percent=0,
            next_charge=date.today(),
            method='manual',
            client_id=ok_client.id,
        )
        db.session.add(subscription)
        db.session.commit()

        ok_client_id = ok_client.id
        no_router_client_id = no_router_client.id

    class FakeMikroTikService:
        def __init__(self, router_id):
            self.router_id = router_id

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def suspend_client(self, _client):
            return True

        def activate_client(self, _client, _plan):
            return True

    monkeypatch.setattr(main_routes, 'MikroTikService', FakeMikroTikService)
    monkeypatch.setattr(main_routes, '_notify_incident', lambda *args, **kwargs: None)
    monkeypatch.setattr(main_routes, '_notify_client', lambda *args, **kwargs: None)

    suspend_response = client.post(
        '/api/admin/clients/bulk-action',
        json={'action': 'suspend', 'client_ids': [ok_client_id, no_router_client_id, 999999]},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert suspend_response.status_code == 200
    suspend_payload = suspend_response.get_json()
    assert suspend_payload['success_count'] == 1
    assert suspend_payload['failed_count'] == 2

    with app.app_context():
        updated = Subscription.query.filter_by(client_id=ok_client_id).first()
        assert updated is not None
        assert updated.status == 'suspended'

    activate_response = client.post(
        '/api/admin/clients/bulk-action',
        json={'action': 'activate', 'client_ids': [ok_client_id]},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert activate_response.status_code == 200
    activate_payload = activate_response.get_json()
    assert activate_payload['success_count'] == 1

    with app.app_context():
        updated = Subscription.query.filter_by(client_id=ok_client_id).first()
        assert updated is not None
        assert updated.status == 'active'
