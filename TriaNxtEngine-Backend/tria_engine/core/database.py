# tria_engine/core/database.py
#
# Replaces settings.py DATABASES + tria_engine/db_backends/iam_postgres.
#
# Behaviour parity with the Django setup:
#   * dev without DATABASE_URL  -> SQLite at <project-root>/db.sqlite3
#   * DATABASE_URL provided     -> that URL (typically PostgreSQL)
#   * DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT override individual parts
#     of the URL (settings.py used these when DATABASE_URL was absent but a
#     non-development env demanded one; kept for compatibility).
#   * connect_timeout + statement_timeout are applied per-connection.
#   * DB_TRANSACTION_ISOLATION_LEVEL mirrors the psycopg2 isolation_level.
#   * IAM_DB_AUTH_ENABLED uses boto3 rds.generate_db_auth_token as the
#     engine "creator" — the SQLAlchemy equivalent of the old custom
#     iam_postgres Django backend. boto3 is imported lazily so dev/SQLite
#     never needs it.

from __future__ import annotations

import time

from sqlalchemy import BigInteger, Integer as _Integer, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# SQLite needs a literal INTEGER PRIMARY KEY for the rowid autoincrement
# alias (BigInteger PKs break inserts there); PostgreSQL gets BIGINT to
# match Django's BigAutoField. The variant type gives both.
BIGINT = BigInteger().with_variant(_Integer, "sqlite")

from .config import BASE_DIR, settings


class Base(DeclarativeBase):
    """Declarative base shared by every SQLAlchemy model in the project."""


def _build_database_url() -> str:
    url = settings.DATABASE_URL
    if not url and settings.env == "development":
        # Local development fallback — same file settings.py used.
        return f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
    if not url:
        # Non-dev without DATABASE_URL: replicate settings.py, which built a
        # postgres DSN from the individual DB_* variables.
        db_user = os_environ_get("DB_USER", settings.DB_USER)
        db_password = os_environ_get("DB_PASSWORD", settings.DB_PASSWORD)
        db_host = os_environ_get("DB_HOST", settings.DB_HOST)
        db_port = os_environ_get("DB_PORT", settings.DB_PORT)
        db_name = os_environ_get("DB_NAME", settings.DB_NAME)
        auth = f"{db_user}:{db_password}@" if db_password else f"{db_user}@"
        return f"postgresql+psycopg2://{auth}{db_host}:{db_port}/{db_name}"
    return url


def os_environ_get(key: str, default: str) -> str:
    import os

    return os.environ.get(key, default)


def _iam_creator(*, db_host: str, db_port: str, db_user: str, region: str):
    """Return a SQLAlchemy connection creator that obtains an AWS RDS IAM
    auth token for every new connection (replicates the old
    db_backends/iam_postgres Django backend behaviour)."""
    import boto3

    def connect():
        client = boto3.client("rds", region_name=region)
        token = client.generate_db_auth_token(
            DBHostname=db_host,
            Port=int(db_port),
            DBUsername=db_user,
            Region=region,
        )
        import psycopg2

        return psycopg2.connect(
            host=db_host,
            port=int(db_port),
            user=db_user,
            password=token,
            dbname=os_environ_get("DB_NAME", settings.DB_NAME),
            connect_timeout=settings.DB_CONNECT_TIMEOUT_SECONDS,
        )

    return connect


def create_db_engine() -> Engine:
    url = _build_database_url()
    connect_args: dict = {}
    creator = None

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return create_engine(url, connect_args=connect_args, future=True)

    # PostgreSQL.
    if _env_flag("IAM_DB_AUTH_ENABLED"):
        creator = _iam_creator(
            db_host=os_environ_get("DB_HOST", settings.DB_HOST),
            db_port=os_environ_get("DB_PORT", settings.DB_PORT),
            db_user=os_environ_get("DB_USER", settings.DB_USER),
            region=os_environ_get("AWS_REGION", settings.AWS_REGION),
        )

    engine = create_engine(
        url,
        creator=creator,
        connect_args={
            "connect_timeout": settings.DB_CONNECT_TIMEOUT_SECONDS,
            "options": f"-c statement_timeout={settings.DB_STATEMENT_TIMEOUT_MS}",
        },
        future=True,
    )

    isolation = os_environ_get("DB_TRANSACTION_ISOLATION_LEVEL", settings.DB_TRANSACTION_ISOLATION_LEVEL).upper()

    @event.listens_for(engine, "connect")
    def _set_isolation(dbapi_connection, _connection_record):  # pragma: no cover
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute(f"SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL {isolation}")
            cursor.close()
        except Exception:
            # Non-PostgreSQL drivers (e.g. SQLite) don't understand SET — ignore.
            pass

    return engine


def _env_flag(name: str) -> bool:
    import os

    return os.environ.get(name, "false").strip().lower() in ("1", "true", "yes", "on")


engine = create_db_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


def get_db():
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
