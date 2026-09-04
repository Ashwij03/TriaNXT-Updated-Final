# Liveness/readiness endpoint parity tests.

import time


def test_health_liveness(client):
    r = client.get("/api/health/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["service"] == "trianxt-ctms-engine"
    assert isinstance(body["timestamp"], int)
    assert abs(body["timestamp"] - int(time.time())) < 60


def test_health_no_slash(client):
    # Django APPEND_SLASH used to redirect; the route is reachable either way.
    assert client.get("/api/health").status_code == 200


def test_readiness(client):
    r = client.get("/api/health/ready/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["checks"]["database"] == "ok"
    assert body["checks"]["cache"] == "ok"
