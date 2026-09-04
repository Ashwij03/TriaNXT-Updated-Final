# tria_engine/core/config.py
#
# Replaces tria_engine/settings.py. Environment handling is intentionally
# source-compatible with the old Django settings:
#   - DJANGO_ENV / DJANGO_SECRET_KEY / DJANGO_ALLOWED_HOSTS still work
#     (the new APP_ENV / SECRET_KEY / ALLOWED_HOSTS names are preferred).
#   - DATABASE_URL remains the single source of truth for the DB URL, with
#     the DJANGO_DB_* family (DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT)
#     kept as individual overrides exactly like settings.py did.
#   - CTMS_ENCRYPTION_KEY, TRIA_SECURITY / TRIA_UPLOADS settings,
#     CORS_ALLOWED_ORIGINS, RAZORPAY_*, BILLING_DEFAULT_PERIOD_DAYS are
#     unchanged.

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load a project-root .env file (if present) before any settings are read,
# so secrets live in .env (git-ignored) rather than in this file.
load_dotenv(BASE_DIR / ".env")


def _env_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    # --- Environment -------------------------------------------------------
    APP_ENV: str = "development"
    # Backwards-compatible alias for DJANGO_ENV (handled in __init__).

    DEBUG: bool = False

    SECRET_KEY: str = ""
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"

    # --- CORS --------------------------------------------------------------
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    CORS_ALLOW_CREDENTIALS: bool = True

    # --- Database ----------------------------------------------------------
    DATABASE_URL: str = ""
    DB_NAME: str = "trianxt_ctms"
    DB_USER: str = "trianxt"
    DB_PASSWORD: str = ""
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_CONNECT_TIMEOUT_SECONDS: int = 5
    DB_STATEMENT_TIMEOUT_MS: int = 30000
    DB_TRANSACTION_ISOLATION_LEVEL: str = "READ_COMMITTED"
    # AWS RDS IAM auth (replicates tria_engine/db_backends/iam_postgres).
    IAM_DB_AUTH_ENABLED: bool = False
    AWS_REGION: str = "us-east-1"

    # --- Cache (Redis optional; in-process fallback mirrors locmem) --------
    REDIS_URL: str = ""
    CACHE_DEFAULT_TIMEOUT: int = 300

    # --- Security / TRIA settings ------------------------------------------
    CTMS_ENCRYPTION_KEY: str = ""
    TRIA_PASSWORD_MAX_AGE_DAYS: int = 90
    TRIA_TOKEN_EXPIRY_MINUTES: int = 10
    TRIA_EXPOSE_OTP_IN_RESPONSE: bool = True

    # --- File uploads ------------------------------------------------------
    TRIA_DOCUMENT_MAX_SIZE: int = 10 * 1024 * 1024
    TRIA_DOCUMENT_ALLOWED_EXTENSIONS: str = "pdf,doc,docx,xls,xlsx,txt"
    TRIA_PROFILE_PHOTO_MAX_SIZE: int = 5 * 1024 * 1024
    TRIA_PROFILE_PHOTO_ALLOWED_EXTENSIONS: str = "jpg,jpeg,png"

    # --- Sessions ----------------------------------------------------------
    SESSION_COOKIE_NAME: str = "sessionid"
    SESSION_COOKIE_AGE: int = 3600

    # --- Billing / Razorpay (kept for config parity; dormant apps) ---------
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    BILLING_DEFAULT_PERIOD_DAYS: int = 30

    # --- Logging -----------------------------------------------------------
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = str(BASE_DIR / "logs")

    # --- Gunicorn (read by gunicorn_config.py, kept here for parity) -------
    GUNICORN_WORKERS: int = 3
    GUNICORN_TIMEOUT: int = 120
    GUNICORN_BIND: str = "0.0.0.0:8000"

    # Internal resolved state ------------------------------------------------
    env: str = "development"
    secret_key: str = ""
    allowed_hosts_list: list[str] = []
    cors_allowed_origins_list: list[str] = []
    document_allowed_extensions: list[str] = []
    profile_photo_allowed_extensions: list[str] = []
    media_root: Path = BASE_DIR / "media"
    static_root: Path = BASE_DIR / "staticfiles"

    def model_post_init(self, _ctx) -> None:
        # DJANGO_ENV wins for the old name; APP_ENV for the new one.
        env = os.environ.get("APP_ENV") or os.environ.get("DJANGO_ENV") or self.APP_ENV or "development"
        self.env = env
        self.DEBUG = env == "development"

        secret = os.environ.get("SECRET_KEY") or os.environ.get("DJANGO_SECRET_KEY") or self.SECRET_KEY
        if not secret:
            if env == "development":
                secret = "dev-only-not-for-production-change-me-immediately"
            else:
                raise RuntimeError("SECRET_KEY (or DJANGO_SECRET_KEY) is required in production")
        self.secret_key = secret

        hosts = os.environ.get("ALLOWED_HOSTS") or os.environ.get("DJANGO_ALLOWED_HOSTS") or self.ALLOWED_HOSTS
        self.allowed_hosts_list = [h.strip() for h in hosts.split(",") if h.strip()]

        origins = os.environ.get("CORS_ALLOWED_ORIGINS") or self.CORS_ALLOWED_ORIGINS
        self.cors_allowed_origins_list = [o.strip() for o in origins.split(",") if o.strip()]

        self.document_allowed_extensions = [
            e.strip()
            for e in os.environ.get("TRIA_DOCUMENT_ALLOWED_EXTENSIONS", self.TRIA_DOCUMENT_ALLOWED_EXTENSIONS).split(",")
            if e.strip()
        ]
        self.profile_photo_allowed_extensions = [
            e.strip()
            for e in os.environ.get(
                "TRIA_PROFILE_PHOTO_ALLOWED_EXTENSIONS", self.TRIA_PROFILE_PHOTO_ALLOWED_EXTENSIONS
            ).split(",")
            if e.strip()
        ]

        # LOG_LEVEL default: INFO for production, DEBUG otherwise.
        log_level = os.environ.get("LOG_LEVEL") or os.environ.get("DJANGO_LOG_LEVEL")
        if not log_level:
            log_level = "INFO" if env == "production" else "DEBUG"
        self.LOG_LEVEL = log_level.upper()

        # Encryption key parity: CTMS_ENCRYPTION_KEY required outside dev.
        encryption_key = os.environ.get("CTMS_ENCRYPTION_KEY") or self.CTMS_ENCRYPTION_KEY
        if not encryption_key and env != "development":
            raise RuntimeError("CTMS_ENCRYPTION_KEY is required")
        self.CTMS_ENCRYPTION_KEY = encryption_key


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
