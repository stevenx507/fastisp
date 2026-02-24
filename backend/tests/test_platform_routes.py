from flask_jwt_extended import create_access_token

from app import db
from app.models import Tenant, User


def _platform_headers(app, user_id: int):
    with app.app_context():
        token = create_access_token(identity=str(user_id), additional_claims={'tenant_id': None})
    return {'Authorization': f'Bearer {token}'}


def test_platform_tenants_crud_and_admin_creation(client, app):
    with app.app_context():
        root_user = User(email='root@test.local', role='platform_admin', name='Root Admin', tenant_id=None)
        root_user.set_password('supersecret')
        db.session.add(root_user)
        db.session.commit()
        root_id = root_user.id

    headers = _platform_headers(app, root_id)

    create_res = client.post(
        '/api/platform/tenants',
        json={
            'name': 'ISP Norte',
            'slug': 'isp-norte',
            'admin_email': 'admin@ispnorte.local',
            'admin_name': 'Admin Norte',
            'admin_password': 'supersecret123',
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    create_payload = create_res.get_json()
    assert create_payload['success'] is True
    assert create_payload['tenant']['slug'] == 'isp-norte'
    assert create_payload['admin']['email'] == 'admin@ispnorte.local'
    tenant_id = int(create_payload['tenant']['id'])

    list_res = client.get('/api/platform/tenants', headers=headers)
    assert list_res.status_code == 200
    list_payload = list_res.get_json()
    assert list_payload['count'] >= 1
    assert any(item['slug'] == 'isp-norte' for item in list_payload['items'])

    patch_res = client.patch(
        f'/api/platform/tenants/{tenant_id}',
        json={'name': 'ISP Norte Premium', 'is_active': False},
        headers=headers,
    )
    assert patch_res.status_code == 200
    patch_payload = patch_res.get_json()
    assert patch_payload['tenant']['name'] == 'ISP Norte Premium'
    assert patch_payload['tenant']['is_active'] is False

    create_admin_res = client.post(
        f'/api/platform/tenants/{tenant_id}/admins',
        json={'email': 'ops@ispnorte.local', 'name': 'Ops Norte', 'password': 'ops-secret-123'},
        headers=headers,
    )
    assert create_admin_res.status_code == 201
    admin_payload = create_admin_res.get_json()
    assert admin_payload['success'] is True
    assert admin_payload['admin']['role'] == 'admin'
    assert admin_payload['tenant_id'] == tenant_id

    overview_res = client.get('/api/platform/overview', headers=headers)
    assert overview_res.status_code == 200
    overview_payload = overview_res.get_json()
    assert overview_payload['tenants_total'] >= 1


def test_platform_routes_require_platform_admin_role(client, app):
    with app.app_context():
        tenant = Tenant(slug='isp-demo', name='ISP Demo')
        db.session.add(tenant)
        db.session.flush()
        user = User(email='admin-demo@test.local', role='admin', name='Admin Demo', tenant_id=tenant.id)
        user.set_password('supersecret')
        db.session.add(user)
        db.session.commit()
        user_id = user.id

        token = create_access_token(identity=str(user_id), additional_claims={'tenant_id': tenant.id})
    headers = {'Authorization': f'Bearer {token}'}

    response = client.get('/api/platform/tenants', headers=headers)
    assert response.status_code == 403


def test_platform_routes_reject_tenant_scoped_context(client, app):
    with app.app_context():
        tenant = Tenant(slug='isp-scope', name='ISP Scope')
        db.session.add(tenant)
        db.session.flush()
        root_user = User(email='scope-root@test.local', role='platform_admin', name='Scope Root')
        root_user.set_password('supersecret')
        db.session.add(root_user)
        db.session.commit()
        root_id = root_user.id
        tenant_id = tenant.id

    headers = _platform_headers(app, root_id)
    headers['X-Tenant-ID'] = str(tenant_id)

    response = client.get('/api/platform/overview', headers=headers)
    assert response.status_code == 403
