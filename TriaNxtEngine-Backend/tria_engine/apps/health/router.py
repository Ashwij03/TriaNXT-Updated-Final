# tria_engine/apps/health/router.py
#
# Port of tria_engine/apps/health/views.py — identical JSON bodies and
# status codes:
#   GET /api/health/       -> liveness  {"status": "healthy", ...} 200
#   GET /api/health/ready/ -> readiness {"status": "ready", ...} 200 / 503

from __future__ import annotations

import logging
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from tria_engine.core.config import settings
from tria_engine.core.database import engine
from tria_engine.core.timeutils import utcnow

logger = logging.getLogger("tria_engine")

router = APIRouter(prefix="/api/health", tags=["health"])

# Django APPEND_SLASH made /api/health and /api/health/ready redirect (301)
# to the slash form; both variants are registered below for parity.
_ROUTES = [""]


@router.get("", response_class=JSONResponse)
@router.get("/", response_class=JSONResponse)
def health_check():
    """Liveness probe — returns 200 if the process is running."""
    return JSONResponse(
        {
            "status": "healthy",
            "service": "trianxt-ctms-engine",
            "timestamp": int(time.time()),
        }
    )


@router.get("/ready", response_class=JSONResponse)
@router.get("/ready/", response_class=JSONResponse)
def readiness_check():
    """Readiness probe — verifies database connectivity and cache
    availability before routing traffic to this instance."""
    checks: dict = {}
    overall = True

    # --- Database check ---
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logger.error("Readiness check: database unreachable — %s", exc)
        checks["database"] = f"error: {type(exc).__name__}"
        overall = False

    # --- Cache check ---
    # Django used locmem by default (always available); Redis only when
    # REDIS_URL was set. The same conditional is reproduced here.
    try:
        if settings.REDIS_URL:
            import redis

            r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
            value = r.set("_health_check_probe", "ok", ex=10)
            checks["cache"] = "ok" if value else "degraded"
        else:
            _IN_MEMORY_PROBE = {"_health_check_probe": "ok"}
            # localmem semantics: write then read back from the same store
            checks["cache"] = "ok" if _IN_MEMORY_PROBE.get("_health_check_probe") == "ok" else "degraded"
    except Exception as exc:
        logger.warning("Readiness check: cache unavailable — %s", exc)
        checks["cache"] = f"unavailable: {type(exc).__name__}"
        # Cache is optional — not fatal

    status_code = 200 if overall else 503
    return JSONResponse(
        {
            "status": "ready" if overall else "not_ready",
            "service": "trianxt-ctms-engine",
            "checks": checks,
            "timestamp": int(time.time()),
        },
        status_code=status_code,
    )
