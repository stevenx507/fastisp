"""
OLT enterprise API endpoints (ZTE, Huawei, VSOL).
"""
from __future__ import annotations

import socket
import time

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.models import AuditLog, User
from app.routes.main_routes import admin_required
from app.services.olt_script_service import OLTScriptService
from app.tenancy import current_tenant_id

olt_bp = Blueprint("olt", __name__)

# Service profile templates used by authorize-onu flows.
SERVICE_TEMPLATES = {
    "zte": [
        {
            "id": "zte-line-100m",
            "label": "ZTE 100M",
            "line_profile": "LINE-100M",
            "srv_profile": "SRV-INTERNET",
        },
        {
            "id": "zte-line-200m",
            "label": "ZTE 200M",
            "line_profile": "LINE-200M",
            "srv_profile": "SRV-INTERNET",
        },
    ],
    "huawei": [
        {
            "id": "hw-100m",
            "label": "Huawei 100M",
            "line_profile": "line-profile_100M",
            "srv_profile": "srv-profile_internet",
        },
        {
            "id": "hw-300m",
            "label": "Huawei 300M",
            "line_profile": "line-profile_300M",
            "srv_profile": "srv-profile_internet",
        },
    ],
    "vsol": [
        {
            "id": "vsol-50m",
            "label": "VSOL 50M",
            "line_profile": "VSOL50M",
            "srv_profile": "Internet",
        },
        {
            "id": "vsol-100m",
            "label": "VSOL 100M",
            "line_profile": "VSOL100M",
            "srv_profile": "Internet",
        },
    ],
}


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "y", "on")


def _resolve_actor_identity() -> str:
    current_identity = get_jwt_identity()
    if current_identity is None:
        return "system"
    try:
        user = User.query.get(current_identity)
    except Exception:
        user = None
    if user:
        return user.email or f"user:{user.id}"
    return f"user:{current_identity}"


def _audit(action: str, entity_type: str | None = None, entity_id: str | None = None, metadata=None):
    try:
        tenant_id = current_tenant_id()
        user_id = get_jwt_identity()
        log = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=metadata,
            ip_address=getattr(request, "remote_addr", None),
        )
        from app import db

        db.session.add(log)
        db.session.commit()
    except Exception:
        # Auditing should not break user flows.
        pass


def _demo_mode_response(feature: str):
    if current_app.config.get("ALLOW_OLT_DEMO", False):
        return None
    return (
        jsonify(
            {
                "success": False,
                "error": f"{feature} requires real OLT integration (demo mode disabled).",
            }
        ),
        501,
    )


def _parse_run_mode(data, default: str = "simulate") -> str:
    run_mode = str((data or {}).get("run_mode", default)).strip().lower()
    if run_mode not in {"simulate", "dry-run", "live"}:
        return "simulate"
    return run_mode


def _validate_live_confirm(run_mode: str, data):
    if run_mode != "live":
        return None
    if _as_bool((data or {}).get("live_confirm")):
        return None
    return jsonify({"success": False, "error": "live_confirm is required for live mode"}), 400


def _build_onu_payload(data) -> dict:
    data = data or {}
    payload: dict = {}

    for field in ("frame", "slot", "pon", "onu", "vlan"):
        value = data.get(field)
        if value in (None, ""):
            continue
        try:
            payload[field] = int(value)
        except (TypeError, ValueError):
            raise ValueError(f"{field} must be integer")

    for field in ("serial", "line_profile", "srv_profile"):
        value = data.get(field)
        if value in (None, ""):
            continue
        payload[field] = str(value).strip()

    profile = data.get("profile")
    if profile and "line_profile" not in payload:
        payload["line_profile"] = str(profile).strip()

    return payload


def _run_vendor_action(device_id: str, action: str, payload: dict, run_mode: str):
    service = OLTScriptService()
    generated = service.generate_script(device_id=device_id, action=action, payload=payload)
    if not generated.get("success"):
        return generated, 400

    commands = generated.get("commands", [])
    result = service.execute_script(
        device_id=device_id,
        commands=commands,
        run_mode=run_mode,
        actor=_resolve_actor_identity(),
        source_ip=request.remote_addr,
    )

    response = {
        "success": bool(result.get("success")),
        "device_id": device_id,
        "device": generated.get("device"),
        "action": action,
        "run_mode": run_mode,
        "payload": payload,
        "commands": commands,
        "execution": result,
        "message": result.get("message"),
    }
    if not result.get("success"):
        response["error"] = result.get("error") or "execution_failed"

    status = 200 if result.get("success") else (502 if run_mode == "live" else 400)
    return response, status


@olt_bp.route("/vendors", methods=["GET"])
@admin_required()
def list_vendors():
    service = OLTScriptService()
    return jsonify({"success": True, "vendors": service.list_vendors()}), 200


@olt_bp.route("/service-templates", methods=["GET"])
@admin_required()
def service_templates():
    vendor = (request.args.get("vendor") or "").strip().lower()
    if vendor and vendor in SERVICE_TEMPLATES:
        return jsonify({"success": True, "vendor": vendor, "templates": SERVICE_TEMPLATES[vendor]}), 200
    return jsonify({"success": True, "templates": SERVICE_TEMPLATES}), 200


@olt_bp.route("/devices", methods=["GET"])
@admin_required()
def list_devices():
    vendor = request.args.get("vendor")
    service = OLTScriptService()
    return jsonify({"success": True, "devices": service.list_devices(vendor=vendor)}), 200


@olt_bp.route("/devices/<device_id>/snapshot", methods=["GET"])
@admin_required()
def get_snapshot(device_id):
    service = OLTScriptService()
    result = service.get_snapshot(device_id)
    _audit("olt_snapshot", entity_type="olt", entity_id=device_id, metadata={"success": result.get("success")})
    return jsonify(result), (200 if result.get("success") else 404)


@olt_bp.route("/devices/test-connection", methods=["POST"])
@admin_required()
def test_connection():
    data = request.get_json() or {}
    device_id = str(data.get("device_id", "")).strip()
    if not device_id:
        return jsonify({"success": False, "error": "device_id is required"}), 400

    try:
        timeout = float(data.get("timeout", 2.5) or 2.5)
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "timeout must be numeric"}), 400
    timeout = max(0.5, min(timeout, 10.0))

    service = OLTScriptService()
    result = service.test_connection(device_id=device_id, timeout_seconds=timeout)
    _audit(
        "olt_test_connection",
        entity_type="olt",
        entity_id=device_id,
        metadata={"success": result.get("success"), "latency_ms": result.get("latency_ms")},
    )
    return jsonify(result), (200 if result.get("success") else 502)


@olt_bp.route("/devices/<device_id>/script/generate", methods=["POST"])
@admin_required()
def generate_script(device_id):
    data = request.get_json() or {}
    action = str(data.get("action", "")).strip().lower()
    if not action:
        return jsonify({"success": False, "error": "action is required"}), 400
    payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}

    service = OLTScriptService()
    result = service.generate_script(device_id=device_id, action=action, payload=payload)
    _audit(
        "olt_generate_script",
        entity_type="olt",
        entity_id=device_id,
        metadata={"action": action, "success": result.get("success")},
    )
    return jsonify(result), (200 if result.get("success") else 400)


@olt_bp.route("/devices/<device_id>/script/execute", methods=["POST"])
@admin_required()
def execute_script(device_id):
    data = request.get_json() or {}
    commands = data.get("commands")
    if not isinstance(commands, list):
        return jsonify({"success": False, "error": "commands must be an array"}), 400

    run_mode = _parse_run_mode(data)
    live_guard = _validate_live_confirm(run_mode, data)
    if live_guard:
        return live_guard

    service = OLTScriptService()
    result = service.execute_script(
        device_id=device_id,
        commands=commands,
        run_mode=run_mode,
        actor=_resolve_actor_identity(),
        source_ip=request.remote_addr,
    )
    _audit(
        "olt_execute_script",
        entity_type="olt",
        entity_id=device_id,
        metadata={"run_mode": run_mode, "success": result.get("success"), "commands": len(commands)},
    )
    if result.get("success"):
        return jsonify(result), 200
    return jsonify(result), (502 if run_mode == "live" else 400)


@olt_bp.route("/audit-log", methods=["GET"])
@admin_required()
def get_audit_log():
    try:
        limit = int(request.args.get("limit", 50) or 50)
    except Exception:
        limit = 50
    limit = max(1, min(200, limit))
    service = OLTScriptService()
    return jsonify({"success": True, "entries": service.list_audit_log(limit=limit)}), 200


@olt_bp.route("/devices/<device_id>/quick-connect-script", methods=["POST"])
@admin_required()
def quick_connect_script(device_id):
    data = request.get_json() or {}
    action = str(data.get("action", "show_pon_summary")).strip().lower()
    payload = data.get("payload") if isinstance(data.get("payload"), dict) else {}
    platform = str(data.get("platform", "windows")).strip().lower()
    if platform not in ("windows", "linux"):
        platform = "windows"

    service = OLTScriptService()
    generated = service.generate_script(device_id=device_id, action=action, payload=payload)
    if not generated.get("success"):
        return jsonify(generated), 400

    quick = generated.get("quick_connect", {})
    script = quick.get(platform) or quick.get("windows") or ""
    return jsonify(
        {
            "success": True,
            "device": generated.get("device"),
            "action": action,
            "platform": platform,
            "script": script,
            "commands": generated.get("commands", []),
        }
    ), 200


@olt_bp.route("/devices/<device_id>/autofind-onu", methods=["GET"])
@admin_required()
def autofind_onu(device_id):
    params = request.args.to_dict()
    run_mode = _parse_run_mode(params)
    live_guard = _validate_live_confirm(run_mode, params)
    if live_guard:
        return live_guard

    serial = str(params.get("serial") or "").strip()
    action = "find_onu" if serial else "show_onu_list"
    try:
        payload = _build_onu_payload(params)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    response, status = _run_vendor_action(device_id=device_id, action=action, payload=payload, run_mode=run_mode)
    if run_mode in {"simulate", "dry-run"} and current_app.config.get("ALLOW_OLT_DEMO", False):
        response["pending_onu"] = [
            {"serial": "ZTEG00000001", "vendor": "zte", "signal": -18.2, "rx_power": -19.5},
            {"serial": "48575443ABCDEF01", "vendor": "huawei", "signal": -20.0, "rx_power": -21.3},
            {"serial": "VSOL00000001", "vendor": "vsol", "signal": -17.5, "rx_power": -18.7},
        ]

    _audit(
        "olt_autofind_onu",
        entity_type="olt",
        entity_id=device_id,
        metadata={"success": response.get("success"), "action": action, "run_mode": run_mode},
    )
    return jsonify(response), status


@olt_bp.route("/devices/<device_id>/authorize-onu", methods=["POST"])
@admin_required()
def authorize_onu(device_id):
    data = request.get_json() or {}
    run_mode = _parse_run_mode(data)
    live_guard = _validate_live_confirm(run_mode, data)
    if live_guard:
        return live_guard

    serial = str(data.get("serial") or "").strip()
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400

    try:
        payload = _build_onu_payload(data)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    response, status = _run_vendor_action(
        device_id=device_id, action="authorize_onu", payload=payload, run_mode=run_mode
    )
    _audit(
        "olt_authorize_onu",
        entity_type="onu",
        entity_id=serial,
        metadata={"device_id": device_id, "run_mode": run_mode, "success": response.get("success")},
    )
    return jsonify(response), status


@olt_bp.route("/devices/<device_id>/pon-power", methods=["GET"])
@admin_required()
def pon_power(device_id):
    params = request.args.to_dict()
    run_mode = _parse_run_mode(params)
    live_guard = _validate_live_confirm(run_mode, params)
    if live_guard:
        return live_guard

    try:
        payload = _build_onu_payload(params)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    response, status = _run_vendor_action(
        device_id=device_id, action="show_optical_power", payload=payload, run_mode=run_mode
    )
    _audit(
        "olt_pon_power",
        entity_type="olt",
        entity_id=device_id,
        metadata={"run_mode": run_mode, "success": response.get("success")},
    )
    return jsonify(response), status


@olt_bp.route("/devices/<device_id>/onu/suspend", methods=["POST"])
@admin_required()
def suspend_onu(device_id):
    data = request.get_json() or {}
    run_mode = _parse_run_mode(data)
    live_guard = _validate_live_confirm(run_mode, data)
    if live_guard:
        return live_guard

    serial = str(data.get("serial") or "").strip()
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400

    try:
        payload = _build_onu_payload(data)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    response, status = _run_vendor_action(
        device_id=device_id, action="deauthorize_onu", payload=payload, run_mode=run_mode
    )
    _audit(
        "olt_suspend_onu",
        entity_type="onu",
        entity_id=serial,
        metadata={"device_id": device_id, "run_mode": run_mode, "success": response.get("success")},
    )
    return jsonify(response), status


@olt_bp.route("/devices/<device_id>/onu/activate", methods=["POST"])
@admin_required()
def activate_onu(device_id):
    data = request.get_json() or {}
    run_mode = _parse_run_mode(data)
    live_guard = _validate_live_confirm(run_mode, data)
    if live_guard:
        return live_guard

    serial = str(data.get("serial") or "").strip()
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400

    try:
        payload = _build_onu_payload(data)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    response, status = _run_vendor_action(
        device_id=device_id, action="authorize_onu", payload=payload, run_mode=run_mode
    )
    _audit(
        "olt_activate_onu",
        entity_type="onu",
        entity_id=serial,
        metadata={"device_id": device_id, "run_mode": run_mode, "success": response.get("success")},
    )
    return jsonify(response), status


@olt_bp.route("/devices/<device_id>/onu/reboot", methods=["POST"])
@admin_required()
def reboot_onu(device_id):
    data = request.get_json() or {}
    run_mode = _parse_run_mode(data)
    live_guard = _validate_live_confirm(run_mode, data)
    if live_guard:
        return live_guard

    serial = str(data.get("serial") or "").strip()
    if not serial:
        return jsonify({"success": False, "error": "serial requerido"}), 400

    try:
        payload = _build_onu_payload(data)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    response, status = _run_vendor_action(
        device_id=device_id, action="reboot_onu", payload=payload, run_mode=run_mode
    )
    _audit(
        "olt_reboot_onu",
        entity_type="onu",
        entity_id=serial,
        metadata={"device_id": device_id, "run_mode": run_mode, "success": response.get("success")},
    )
    return jsonify(response), status


@olt_bp.route("/devices/<device_id>/tr069/reprovision", methods=["POST"])
@admin_required()
def tr069_reprovision(device_id):
    guard = _demo_mode_response("tr069_reprovision")
    if guard:
        return guard

    data = request.get_json() or {}
    host = data.get("host") or "acs.demo.local"
    ssid = data.get("ssid") or "ISPFAST_WIFI"
    key = data.get("key") or "ClaveFuerte2026"
    _audit("olt_tr069_reprovision", entity_type="olt", entity_id=device_id, metadata={"acs": host})
    return (
        jsonify(
            {
                "success": True,
                "device_id": device_id,
                "acs": host,
                "ssid": ssid,
                "key": key,
                "message": "TR-069 reprovision enviado (demo)",
            }
        ),
        200,
    )


@olt_bp.route("/devices/<device_id>/quick-login", methods=["GET"])
@admin_required()
def quick_login(device_id):
    platform = str(request.args.get("platform", "windows")).strip().lower()
    if platform not in ("windows", "linux"):
        platform = "windows"

    service = OLTScriptService()
    try:
        connect = service.quick_login_command(device_id=device_id, platform=platform)
        return jsonify({"success": True, "platform": platform, "command": connect}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 404


@olt_bp.route("/tr064/test", methods=["POST"])
@admin_required()
def tr064_test():
    data = request.get_json() or {}
    host = str(data.get("host", "")).strip()
    if not host:
        return jsonify({"success": False, "message": "Host requerido"}), 400

    try:
        port = int(data.get("port") or 7547)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Port invalido"}), 400
    if port < 1 or port > 65535:
        return jsonify({"success": False, "message": "Port invalido"}), 400

    try:
        timeout = float(data.get("timeout") or 2.5)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Timeout invalido"}), 400
    timeout = max(0.5, min(timeout, 10.0))

    started = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            return (
                jsonify(
                    {
                        "success": True,
                        "message": "TR-064 reachable",
                        "host": host,
                        "port": port,
                        "latency_ms": latency_ms,
                    }
                ),
                200,
            )
    except Exception as exc:
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        return (
            jsonify(
                {
                    "success": False,
                    "message": "TR-064 unreachable",
                    "host": host,
                    "port": port,
                    "latency_ms": latency_ms,
                    "error": str(exc),
                }
            ),
            502,
        )
