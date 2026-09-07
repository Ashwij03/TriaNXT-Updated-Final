# tria_engine/core/cache.py
#
# Tiny optional cache used by hot read endpoints (e.g. the subjects
# enrollment-count summary). Mirrors the app's long-standing convention
# (see health/router.py): Redis is used ONLY when REDIS_URL is configured;
# otherwise an in-process TTL store stands in, with Django-locmem semantics
# (always available, process-local). Values are JSON-encoded strings so a
# single code path serves both backends.

from __future__ import annotations

import json
import logging
import threading
import time

from tria_engine.core.config import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
# key -> (expires_at, value)
_LOCMEM: dict[str, tuple[float, str]] = {}

DEFAULT_TTL_SECONDS = 15


def _redis_client():
    if not settings.REDIS_URL:
        return None
    try:
        import redis  # type: ignore

        return redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
    except Exception:  # pragma: no cover - optional dependency
        logger.warning("REDIS_URL set but redis client unavailable; using in-process cache.")
        return None


def cache_get(key: str) -> object | None:
    """Return the cached JSON value (decoded) or None on miss/expiry."""
    client = _redis_client()
    if client is not None:
        try:
            raw = client.get(key)
        except Exception as exc:  # pragma: no cover - network failures are non-fatal
            logger.warning("cache_get(redis) failed: %s", exc)
            return None
        if not raw:
            return None
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return None

    with _lock:
        entry = _LOCMEM.get(key)
        if entry is None:
            return None
        expires_at, raw = entry
        if expires_at < time.monotonic():
            _LOCMEM.pop(key, None)
            return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def cache_set(key: str, value: object, ttl: int = DEFAULT_TTL_SECONDS) -> None:
    raw = json.dumps(value)
    client = _redis_client()
    if client is not None:
        try:
            client.set(key, raw, ex=ttl)
            return
        except Exception as exc:  # pragma: no cover
            logger.warning("cache_set(redis) failed: %s", exc)
            return
    with _lock:
        _LOCMEM[key] = (time.monotonic() + ttl, raw)


def cache_delete(key: str) -> None:
    client = _redis_client()
    if client is not None:
        try:
            client.delete(key)
        except Exception as exc:  # pragma: no cover
            logger.warning("cache_delete(redis) failed: %s", exc)
            return
    with _lock:
        _LOCMEM.pop(key, None)


def cache_delete_prefix(prefix: str) -> None:
    """Delete every cached key starting with ``prefix`` (both backends)."""
    client = _redis_client()
    if client is not None:
        try:
            for key in client.scan_iter(match=f"{prefix}*"):
                client.delete(key)
        except Exception as exc:  # pragma: no cover
            logger.warning("cache_delete_prefix(redis) failed: %s", exc)
            return
    with _lock:
        for key in [k for k in _LOCMEM if k.startswith(prefix)]:
            _LOCMEM.pop(key, None)
