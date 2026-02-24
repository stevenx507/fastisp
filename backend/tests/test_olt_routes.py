import app.routes.olt as olt_routes

from app import db
from app.models import User


def _admin_headers(client, app):
    with app.app_context():
        user = User(email="olt-admin@test.local", role="admin", name="OLT Admin")
        user.set_password("supersecret")
        db.session.add(user)
        db.session.commit()

    response = client.post(
        "/api/auth/login",
        json={"email": "olt-admin@test.local", "password": "supersecret"},
    )
    assert response.status_code == 200
    token = response.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


class _DummyOLTService:
    calls = []

    def __init__(self):
        pass

    def generate_script(self, device_id, action, payload=None):
        self.__class__.calls.append(
            {
                "method": "generate_script",
                "device_id": device_id,
                "action": action,
                "payload": payload or {},
            }
        )
        return {
            "success": True,
            "device": {"id": device_id, "name": "Test OLT", "vendor": "zte"},
            "action": action,
            "commands": ["enable", "show version"],
        }

    def execute_script(self, device_id, commands, run_mode="simulate", actor=None, source_ip=None):
        self.__class__.calls.append(
            {
                "method": "execute_script",
                "device_id": device_id,
                "run_mode": run_mode,
                "commands": commands,
                "actor": actor,
                "source_ip": source_ip,
            }
        )
        return {
            "success": True,
            "run_mode": run_mode,
            "executed_commands": len(commands),
            "message": "Simulated execution completed.",
            "error": None,
        }


def test_authorize_onu_runs_vendor_action_in_simulate_mode(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    _DummyOLTService.calls = []
    monkeypatch.setattr(olt_routes, "OLTScriptService", _DummyOLTService)

    response = client.post(
        "/api/olt/devices/OLT-ZTE-001/authorize-onu",
        json={"serial": "ZTEG00000001", "vlan": 120, "run_mode": "simulate"},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["action"] == "authorize_onu"
    assert payload["run_mode"] == "simulate"
    assert any(call["method"] == "generate_script" for call in _DummyOLTService.calls)
    assert any(call["method"] == "execute_script" for call in _DummyOLTService.calls)


def test_authorize_onu_live_requires_confirmation(client, app):
    headers = _admin_headers(client, app)

    response = client.post(
        "/api/olt/devices/OLT-ZTE-001/authorize-onu",
        json={"serial": "ZTEG00000001", "run_mode": "live"},
        headers=headers,
    )

    assert response.status_code == 400
    payload = response.get_json()
    assert payload["success"] is False
    assert "live_confirm" in payload["error"]


def test_suspend_onu_maps_to_deauthorize_action(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    _DummyOLTService.calls = []
    monkeypatch.setattr(olt_routes, "OLTScriptService", _DummyOLTService)

    response = client.post(
        "/api/olt/devices/OLT-ZTE-001/onu/suspend",
        json={"serial": "ZTEG00000001", "run_mode": "simulate"},
        headers=headers,
    )

    assert response.status_code == 200
    generate_calls = [c for c in _DummyOLTService.calls if c["method"] == "generate_script"]
    assert generate_calls
    assert generate_calls[0]["action"] == "deauthorize_onu"


def test_pon_power_uses_show_optical_power_action(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    _DummyOLTService.calls = []
    monkeypatch.setattr(olt_routes, "OLTScriptService", _DummyOLTService)

    response = client.get(
        "/api/olt/devices/OLT-ZTE-001/pon-power?run_mode=simulate&frame=1&slot=1&pon=1&onu=1",
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["action"] == "show_optical_power"


class _SocketContext:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_tr064_test_reports_tcp_reachability(client, app, monkeypatch):
    headers = _admin_headers(client, app)
    monkeypatch.setattr(olt_routes.socket, "create_connection", lambda *args, **kwargs: _SocketContext())

    response = client.post(
        "/api/olt/tr064/test",
        json={"host": "127.0.0.1", "port": 7547, "timeout": 1.0},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["success"] is True
    assert payload["host"] == "127.0.0.1"
