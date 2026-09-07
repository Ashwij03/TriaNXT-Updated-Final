# tria_engine/main.py
#
# FastAPI application entry point — replaces manage.py + tria_engine/urls.py
# + wsgi.py/asgi.py.
#
#   Dev:    uvicorn tria_engine.main:app --reload
#   Prod:   gunicorn tria_engine.main:app -k uvicorn.workers.UvicornWorker \
#               --config gunicorn_config.py
#
# Mounted surface mirrors the old urls.py exactly:
#   /api/health/        (health + readiness)
#   /api/accounts/      (all account/auth/document endpoints)
# OpenAPI docs at /docs, /redoc (FastAPI built-ins); /swagger/ and
# /swagger.json are kept as aliases for any tooling that used drf_yasg.
# The Django /admin/ site is NOT migrated (see MIGRATION_NOTES.md).
# Dormant apps (organizations, billing, licensing, monitoring,
# subscriptions) are not mounted — matching their unmounted state in the
# old urls.py.

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .apps.accounts.router import router as accounts_router
from .apps.ctms.router import router as ctms_router
from .apps.ctms.router_ai import router as ai_review_router
from .apps.ctms.router_monitoring import router as monitoring_router
from .apps.ctms.router_monitoring import sites_router as organizations_router
from .apps.ctms.router_safety import router as safety_router
from .apps.health.router import router as health_router
# Varsha's scope: Custom Report Builder / Standard Report Center + Financials
# & Milestones (additive reporting app; tables come from the `reporting`
# alembic migration or Base.metadata.create_all).
from .apps.reporting.router_finance import (
    finance_router,
    milestones_router,
)
from .apps.reporting.router_reports import router as reports_router
from .core.config import BASE_DIR, settings
from .core.database import engine
from .core.logging_config import configure_logging
from .core.schema_ensure import ensure_schema_columns
from .core.middleware import DatabaseRetryMiddleware
from .schemas_validation import validation_error_response

configure_logging()
logger = logging.getLogger("tria_engine")

app = FastAPI(
    title="Tria Engine API",
    description="API documentation for Tria Engine",
    version="v1",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS — environment-driven, no wildcard in production (parity with the
# old CORS_ALLOWED_ORIGINS / CORS_ALLOW_CREDENTIALS settings)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
    allow_headers=[
        "accept",
        "accept-encoding",
        "authorization",
        "content-type",
        "dnt",
        "origin",
        "user-agent",
        "x-csrftoken",
        "x-requested-with",
        "x-api-key",
    ],
)

# Database-retry middleware (port of tria_engine/middleware.py).
app.add_middleware(DatabaseRetryMiddleware)


# ---------------------------------------------------------------------------
# DRF-style validation envelope: {"message", "request_schema", "errors"}
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def _request_validation_handler(request: Request, exc: RequestValidationError):
    return validation_error_response(exc)


# ---------------------------------------------------------------------------
# drf_yasg URL aliases -> FastAPI built-in docs
# ---------------------------------------------------------------------------
@app.get("/swagger/", include_in_schema=False)
async def swagger_ui_alias():
    return RedirectResponse("/docs")


@app.get("/swagger.json", include_in_schema=False)
async def swagger_json_alias():
    return RedirectResponse("/openapi.json")


@app.get("/swagger.yaml", include_in_schema=False)
async def swagger_yaml_alias():
    return RedirectResponse("/openapi.json")


# ---------------------------------------------------------------------------
# Routers — same prefixes as the Django urlpatterns
# ---------------------------------------------------------------------------
app.include_router(health_router)
app.include_router(accounts_router)
# Site CTMS gap modules (M18-M23) — additive; mounted under /api/site.
app.include_router(ctms_router)
# Safety / Monitoring-Access / AI-Review surfaces (root-level prefixes, the
# paths src/shared/services/api/*.ts call in API mode).
app.include_router(safety_router)
app.include_router(monitoring_router)
app.include_router(organizations_router)
app.include_router(ai_review_router)
# Reports / Financials & Milestones (Varsha's scope).
app.include_router(reports_router)
app.include_router(finance_router)
app.include_router(milestones_router)


# ---------------------------------------------------------------------------
# Static / media (Django DEBUG static() equivalents)
# ---------------------------------------------------------------------------
def _mount_if_dir(app_: FastAPI, path: str, directory: Path) -> None:
    if directory.is_dir():
        try:
            app_.mount(path, StaticFiles(directory=str(directory)), name=path.strip("/"))
        except Exception as exc:  # pragma: no cover
            logger.warning("Could not mount %s from %s: %s", path, directory, exc)


# Media must be served wherever uploaded files land (same surface Django's
# DEBUG static() helper exposed). The staticfiles dir is mounted for parity
# when present; prod deployments typically serve both via a reverse proxy.
_mount_if_dir(app, "/media", Path(settings.media_root) if settings.media_root else BASE_DIR / "media")
_mount_if_dir(app, "/static", Path(settings.static_root) if settings.static_root else BASE_DIR / "staticfiles")


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Tria Engine (FastAPI) starting — env=%s", settings.env)
    # Additive schema repair for databases created before a model gained
    # columns (ctms study_id/site_id, accounts_user.scope_data). No-op for
    # fresh databases and non-SQLite dialects.
    try:
        ensure_schema_columns(engine)
    except Exception:  # pragma: no cover - never blocks startup
        logger.exception("schema ensure failed")
    try:
        with engine.connect():
            logger.info("Database connection OK")
    except Exception as exc:  # pragma: no cover - surfaced by /api/health/ready/
        logger.warning("Database connection check failed at startup: %s", exc)
