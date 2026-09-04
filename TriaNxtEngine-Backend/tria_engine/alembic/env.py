# tria_engine/alembic/env.py

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make the backend root importable (mirrors prepend_sys_path).
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Import every model module so all tables register on Base.metadata.
# Import every model module so all tables register on Base.metadata.
from tria_engine.core.database import Base, engine  # noqa: E402
from tria_engine.apps import accounts, organizations  # noqa: E402,F401
from tria_engine.apps.accounts import models as accounts_models  # noqa: E402,F401
from tria_engine.apps.organizations import models as organizations_models  # noqa: E402,F401
from tria_engine.apps.billing import models as billing_models  # noqa: E402,F401
from tria_engine.apps.licensing import models as licensing_models  # noqa: E402,F401
from tria_engine.apps.monitoring import models as monitoring_models  # noqa: E402,F401
from tria_engine.apps.subscriptions import models as subscriptions_models  # noqa: E402,F401
from tria_engine.core.session_store import DjangoSession  # noqa: E402,F401

# Alembic Config object — provides access to alembic.ini values.
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without a DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using the application engine."""
    connectable = engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
