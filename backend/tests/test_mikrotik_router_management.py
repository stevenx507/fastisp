import app.routes.mikrotik as mikrotik_routes

from app import db
from app.models import AdminSystemSetting, User


def _admin_headers(client, app):
    with app.app_context():
        user = User(email='mk-admin@test.local', role='admin', name='MK Admin')
        user.set_password('supersecret')
        db.session.add(user)
        db.session.commit()

    response = client.post(
        '/api/auth/login',
        json={'email': 'mk-admin@test.local', 'password': 'supersecret'},
    )
    assert response.status_code == 200
    token = response.get_json()['token']
    return {'Authorization': f'Bearer {token}'}


def test_router_crud_and_quick_connect(client, app):
    headers = _admin_headers(client, app)

    create_response = client.post(
        '/api/mikrotik/routers',
        json={
            'name': 'Nodo-Centro',
            'ip_address': '10.10.10.1',
            'username': 'api-admin',
            'password': 'router-pass',
            'api_port': 8728,
            'test_connection': False,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    created_payload = create_response.get_json()
    assert created_payload['success'] is True
    router_id = str(created_payload['router']['id'])

    patch_response = client.patch(
        f'/api/mikrotik/routers/{router_id}',
        json={'name': 'Nodo-Centro-Actualizado', 'api_port': 8729},
        headers=headers,
    )
    assert patch_response.status_code == 200
    patch_payload = patch_response.get_json()
    assert patch_payload['success'] is True
    assert patch_payload['router']['name'] == 'Nodo-Centro-Actualizado'

    quick_response = client.get(f'/api/mikrotik/routers/{router_id}/quick-connect', headers=headers)
    assert quick_response.status_code == 200
    quick_payload = quick_response.get_json()
    assert quick_payload['success'] is True
    assert 'direct_api_script' in quick_payload['scripts']
    assert 'wireguard_site_to_vps_script' in quick_payload['scripts']
    assert isinstance(quick_payload['guidance']['back_to_home'], list)
    assert 'back_to_home' in quick_payload
    assert 'scripts' in quick_payload['back_to_home']
    assert 'enable_script' in quick_payload['back_to_home']['scripts']
    assert 'add_vps_user_script' in quick_payload['back_to_home']['scripts']

    delete_response = client.delete(f'/api/mikrotik/routers/{router_id}', headers=headers)
    assert delete_response.status_code == 200
    delete_payload = delete_response.get_json()
    assert delete_payload['success'] is True


class _DummyMikrotikService:
    scripts = []

    def __init__(self, router_id):
        self.router_id = router_id
        self.api = object()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute_script(self, script_content):
        self.__class__.scripts.append(str(script_content))
        return {'success': True, 'result': 'ok'}


def test_back_to_home_actions_execute_scripts(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    _DummyMikrotikService.scripts = []
    monkeypatch.setattr(mikrotik_routes, 'MikroTikService', _DummyMikrotikService)

    create_response = client.post(
        '/api/mikrotik/routers',
        json={
            'name': 'Nodo-BTH',
            'ip_address': '10.10.20.1',
            'username': 'api-admin',
            'password': 'router-pass',
            'api_port': 8728,
            'test_connection': False,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    router_id = str(create_response.get_json()['router']['id'])

    enable_response = client.post(
        f'/api/mikrotik/routers/{router_id}/back-to-home/enable',
        json={'confirm': True, 'change_ticket': 'CHG-BTH-001', 'preflight_ack': True},
        headers=headers,
    )
    assert enable_response.status_code == 200
    assert enable_response.get_json()['success'] is True

    add_user_response = client.post(
        f'/api/mikrotik/routers/{router_id}/back-to-home/users/add',
        json={
            'confirm': True,
            'user_name': 'noc-vps',
            'private_key': 'base64-private-key',
            'allow_lan': True,
            'change_ticket': 'CHG-BTH-001',
            'preflight_ack': True,
        },
        headers=headers,
    )
    assert add_user_response.status_code == 200
    assert add_user_response.get_json()['success'] is True

    remove_user_response = client.post(
        f'/api/mikrotik/routers/{router_id}/back-to-home/users/remove',
        json={'confirm': True, 'user_name': 'noc-vps', 'change_ticket': 'CHG-BTH-001', 'preflight_ack': True},
        headers=headers,
    )
    assert remove_user_response.status_code == 200
    assert remove_user_response.get_json()['success'] is True

    assert any('/ip/cloud/set back-to-home-vpn=enabled' in script for script in _DummyMikrotikService.scripts)
    assert any('/ip/cloud/back-to-home-users/add' in script for script in _DummyMikrotikService.scripts)
    assert any('/ip/cloud/back-to-home-users/remove' in script for script in _DummyMikrotikService.scripts)


def test_back_to_home_actions_require_confirmation(client, app):
    headers = _admin_headers(client, app)

    create_response = client.post(
        '/api/mikrotik/routers',
        json={
            'name': 'Nodo-BTH-Confirm',
            'ip_address': '10.10.30.1',
            'username': 'api-admin',
            'password': 'router-pass',
            'api_port': 8728,
            'test_connection': False,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    router_id = str(create_response.get_json()['router']['id'])

    enable_response = client.post(
        f'/api/mikrotik/routers/{router_id}/back-to-home/enable',
        json={'change_ticket': 'CHG-BTH-002', 'preflight_ack': True},
        headers=headers,
    )
    assert enable_response.status_code == 400

    add_user_response = client.post(
        f'/api/mikrotik/routers/{router_id}/back-to-home/users/add',
        json={'confirm': True, 'user_name': 'noc-vps', 'change_ticket': 'CHG-BTH-002', 'preflight_ack': True},
        headers=headers,
    )
    assert add_user_response.status_code == 400


def test_back_to_home_bootstrap_runs_single_flow(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    _DummyMikrotikService.scripts = []
    monkeypatch.setattr(mikrotik_routes, 'MikroTikService', _DummyMikrotikService)

    create_response = client.post(
        '/api/mikrotik/routers',
        json={
            'name': 'Nodo-BTH-Bootstrap',
            'ip_address': '10.10.40.1',
            'username': 'api-admin',
            'password': 'router-pass',
            'api_port': 8728,
            'test_connection': False,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    router_id = str(create_response.get_json()['router']['id'])

    bootstrap_response = client.post(
        f'/api/mikrotik/routers/{router_id}/back-to-home/bootstrap',
        json={
            'confirm': True,
            'user_name': 'noc-vps',
            'private_key': 'base64-private-key',
            'allow_lan': True,
            'change_ticket': 'CHG-BTH-003',
            'preflight_ack': True,
        },
        headers=headers,
    )
    assert bootstrap_response.status_code == 200
    payload = bootstrap_response.get_json()
    assert payload['success'] is True
    assert payload['bootstrap']['user_name'] == 'noc-vps'
    assert any('/ip/cloud/set back-to-home-vpn=enabled' in script for script in _DummyMikrotikService.scripts)
    assert any('/ip/cloud/back-to-home-users/add' in script for script in _DummyMikrotikService.scripts)


class _DummyMikrotikRiskService:
    def __init__(self, router_id):
        self.router_id = router_id
        self.api = object()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def reboot_router(self):
        return True

    def execute_script(self, _script_content):
        return {'success': True, 'result': 'ok'}


def test_change_ticket_guard_required_for_high_risk_mikrotik_actions(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    monkeypatch.setattr(mikrotik_routes, 'MikroTikService', _DummyMikrotikRiskService)

    create_response = client.post(
        '/api/mikrotik/routers',
        json={
            'name': 'Nodo-Risk-Guard',
            'ip_address': '10.10.50.1',
            'username': 'api-admin',
            'password': 'router-pass',
            'api_port': 8728,
            'test_connection': False,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    router_id = str(create_response.get_json()['router']['id'])

    reboot_response = client.post(
        f'/api/mikrotik/routers/{router_id}/reboot',
        json={},
        headers=headers,
    )
    assert reboot_response.status_code == 400
    assert 'change_ticket' in str(reboot_response.get_json().get('error', ''))

    reboot_preflight_response = client.post(
        f'/api/mikrotik/routers/{router_id}/reboot',
        json={'change_ticket': 'CHG-RISK-001'},
        headers=headers,
    )
    assert reboot_preflight_response.status_code == 400
    assert 'preflight_ack' in str(reboot_preflight_response.get_json().get('error', ''))

    execute_response = client.post(
        f'/api/mikrotik/routers/{router_id}/execute-script',
        json={'script': '/system identity print'},
        headers=headers,
    )
    assert execute_response.status_code == 400
    assert 'change_ticket' in str(execute_response.get_json().get('error', ''))

    hardening_live_response = client.post(
        f'/api/mikrotik/routers/{router_id}/enterprise/hardening',
        json={'dry_run': False, 'profile': 'baseline', 'site_profile': 'access'},
        headers=headers,
    )
    assert hardening_live_response.status_code == 400
    assert 'change_ticket' in str(hardening_live_response.get_json().get('error', ''))

    failover_response = client.post(
        f'/api/mikrotik/routers/{router_id}/enterprise/failover-test',
        json={'targets': ['1.1.1.1']},
        headers=headers,
    )
    assert failover_response.status_code == 400
    assert 'change_ticket' in str(failover_response.get_json().get('error', ''))


def test_change_ticket_guard_allows_dry_run_without_ticket(client, app):
    headers = _admin_headers(client, app)

    create_response = client.post(
        '/api/mikrotik/routers',
        json={
            'name': 'Nodo-Hardening-DryRun',
            'ip_address': '10.10.60.1',
            'username': 'api-admin',
            'password': 'router-pass',
            'api_port': 8728,
            'test_connection': False,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    router_id = str(create_response.get_json()['router']['id'])

    hardening_dry_response = client.post(
        f'/api/mikrotik/routers/{router_id}/enterprise/hardening',
        json={'dry_run': True, 'profile': 'baseline', 'site_profile': 'access'},
        headers=headers,
    )
    assert hardening_dry_response.status_code == 200
    payload = hardening_dry_response.get_json()
    assert payload['success'] is True
    assert payload['dry_run'] is True


def test_change_ticket_guard_can_be_disabled_by_setting(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    monkeypatch.setattr(mikrotik_routes, 'MikroTikService', _DummyMikrotikRiskService)

    with app.app_context():
        db.session.add(
            AdminSystemSetting(
                tenant_id=None,
                key='change_control_required_for_live',
                value=False,
            )
        )
        db.session.commit()

    create_response = client.post(
        '/api/mikrotik/routers',
        json={
            'name': 'Nodo-No-Guard',
            'ip_address': '10.10.70.1',
            'username': 'api-admin',
            'password': 'router-pass',
            'api_port': 8728,
            'test_connection': False,
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    router_id = str(create_response.get_json()['router']['id'])

    reboot_response = client.post(
        f'/api/mikrotik/routers/{router_id}/reboot',
        json={'preflight_ack': True},
        headers=headers,
    )
    assert reboot_response.status_code == 200
    assert reboot_response.get_json()['success'] is True
