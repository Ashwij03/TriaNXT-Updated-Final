# tria_engine/tests/conftest.py
#
# Every test runs against a throwaway SQLite database (never db.sqlite3):
# the schema is created from the SQLAlchemy models and a seed org/role/admin
# are inserted. DATABASE_URL must be set before any tria_engine module is
# imported (the settings object is created at import time), so it is set at
# module scope here — conftest always loads first.

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMPDIR = Path(tempfile.mkdtemp(prefix="trianxt_tests_"))
_TMP_DB = _TMPDIR / "test.sqlite3"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB.as_posix()}"
os.environ.setdefault("APP_ENV", "development")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from tria_engine.core.database import Base, SessionLocal, engine  # noqa: E402
from tria_engine.core.security import hash_password  # noqa: E402

# Import every model module before create_all.
from tria_engine.apps.accounts.models import User  # noqa: E402
from tria_engine.apps.organizations.models import Organization, Role  # noqa: E402
# Site CTMS gap-module tables (registered before create_all).
import tria_engine.apps.ctms.models  # noqa: E402,F401
# eISF Regulatory Document Repository tables (documents + Part 11
# signatures).
import tria_engine.apps.eisf.models  # noqa: E402,F401
import tria_engine.apps.billing.models  # noqa: E402,F401
import tria_engine.apps.monitoring.models  # noqa: E402,F401
import tria_engine.apps.licensing.models  # noqa: E402,F401
import tria_engine.apps.subscriptions.models  # noqa: E402,F401
# Reporting & financials tables (Varsha's scope) registered before create_all.
import tria_engine.apps.reporting.models  # noqa: E402,F401
from tria_engine.core.session_store import DjangoSession  # noqa: E402,F401

Base.metadata.create_all(engine)


def _seed() -> None:
    db = SessionLocal()
    try:
        org = Organization(name="Test Org")
        db.add(org)
        db.flush()
        role = Role(name="Admin", organization_id=org.id)
        db.add(role)
        db.flush()
        db.add(
            User(
                username="admin",
                email="admin@test.local",
                password=hash_password("AdminPass123!"),
                first_name="Admin",
                last_name="User",
                is_active=True,
                is_staff=True,
                is_superuser=True,
                organization_id=org.id,
                role_id=role.id,
            )
        )
        db.commit()
    finally:
        db.close()


_seed()

from tria_engine.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
