"""Utilities for tenant-aware request handling."""

from __future__ import annotations

from functools import wraps
from typing import Any, Optional

from flask import g, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException, NoAuthorizationError
from jwt.exceptions import InvalidTokenError

from app.models import User


class TenantResolutionError(ValueError):
    """Raised when tenant information is malformed or inconsistent."""


def _coerce_tenant_id(value: Any) -> Optional[int]:
    if value in (None, ''):
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise TenantResolutionError('tenant_id must be an integer') from exc


def resolve_tenant_id() -> Optional[int]:
    """Resolve tenant id from header/query/JWT with consistency checks."""
    request_tenant = _coerce_tenant_id(
        request.headers.get('X-Tenant-ID') or request.args.get('tenant_id')
    )

    jwt_tenant: Optional[int] = None
    try:
        verify_jwt_in_request(optional=True)
    except NoAuthorizationError:
        jwt_tenant = None
    except (JWTExtendedException, InvalidTokenError) as exc:
        raise TenantResolutionError('Invalid JWT token') from exc
    else:
        claims = get_jwt() or {}
        jwt_tenant = _coerce_tenant_id(claims.get('tenant_id'))

    if request_tenant is not None and jwt_tenant is not None and request_tenant != jwt_tenant:
        raise TenantResolutionError(
            'tenant_id from request does not match authenticated tenant'
        )

    return request_tenant if request_tenant is not None else jwt_tenant


def _current_user_id() -> Optional[int]:
    identity = get_jwt_identity()
    if identity in (None, ''):
        return None
    try:
        return int(identity)
    except (TypeError, ValueError) as exc:
        raise TenantResolutionError('Invalid authenticated user id') from exc


def current_tenant_id() -> Optional[int]:
    """Return tenant id resolved in request lifecycle."""
    return getattr(g, 'tenant_id', None)


def tenant_access_allowed(resource_tenant_id: Optional[int]) -> bool:
    """Validate if current request can access a resource tenant."""
    tenant_id = current_tenant_id()
    if tenant_id is None:
        return True
    if resource_tenant_id is None:
        return False
    return tenant_id == int(resource_tenant_id)


def tenant_admin_required():
    """JWT + admin role + tenant scoped access."""

    def wrapper(fn):
        @jwt_required()
        @wraps(fn)
        def decorator(*args, **kwargs):
            try:
                user_id = _current_user_id()
            except TenantResolutionError:
                return jsonify({'error': 'Token de usuario invalido.'}), 401
            if user_id is None:
                return jsonify({'error': 'Token de usuario invalido.'}), 401
            user = User.query.get(user_id)
            if not user or user.role != 'admin':
                return jsonify({'error': 'Acceso denegado. Se requiere rol de administrador.'}), 403

            tenant_id = current_tenant_id()
            if tenant_id is not None and user.tenant_id not in (None, tenant_id):
                return jsonify({'error': 'Acceso denegado para este tenant.'}), 403

            return fn(*args, **kwargs)

        return decorator

    return wrapper
