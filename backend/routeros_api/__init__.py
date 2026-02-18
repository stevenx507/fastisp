from .exceptions import RouterOsApiConnectionError, RouterOsApiError


class _DummyResource:
    def get(self, *args, **kwargs):
        return []
    def add(self, *args, **kwargs):
        return {}
    def set(self, *args, **kwargs):
        return None
    def remove(self, *args, **kwargs):
        return None


class DummyAPI:
    def get_resource(self, name):
        return _DummyResource()


class RouterOsApiPool:
    """Simple stub of RouterOsApiPool for local development/testing.

    This stub does not perform real RouterOS operations. It provides a
    minimal API so the backend can run in development without actual
    RouterOS devices or the external `routeros-api` package.
    """
    def __init__(self, *args, **kwargs):
        pass

    def get_api(self):
        return DummyAPI()

    def disconnect(self):
        return None


__all__ = [
    "RouterOsApiPool",
    "RouterOsApiConnectionError",
    "RouterOsApiError",
]
