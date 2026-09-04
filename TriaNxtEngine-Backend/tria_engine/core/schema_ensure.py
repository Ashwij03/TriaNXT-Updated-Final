# tria_engine/core/schema_ensure.py
#
# Idempotent, additive schema repair for databases created before a model
# gained columns. SQLAlchemy's create_all() only creates missing TABLES — it
# never ALTERs existing ones — so when a column is added to a model (e.g.
# ctms record study_id/site_id, accounts_user.scope_data) databases that
# were created earlier keep working by gaining the column here at startup.
#
# PostgreSQL deployments apply the canonical migration in the repository's
# SQL schema instead; this helper is a no-op for non-SQLite dialects.
#
# It runs once at application import (tria_engine/main.py) and is fully
# idempotent: columns that already exist are never touched, and the
# backfill only updates rows whose new column is NULL.

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger("tria_engine")

# (table, new_column, column_type)
_CTMS_TABLES = [
    "ctms_amendment",
    "ctms_iplot",
    "ctms_irbsubmission",
    "ctms_icfversion",
    "ctms_consentevent",
    "ctms_reconsentcampaign",
    "ctms_vendor",
    "ctms_kit",
    "ctms_feasibilitycandidate",
    "ctms_feasibilityscoring",
]


def _dialect_name(engine) -> str:
    return str(getattr(engine, "dialect", None) and engine.dialect.name or "")


def _columns(engine, table: str) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(text(f'PRAGMA table_info("{table}")')).fetchall()
    return {str(r[1]) for r in rows}


def _backfill_codes(engine, table: str, column: str, json_key: str) -> int:
    """Fill study_id/site_id from the record JSON for legacy rows (SQLite)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text(f'SELECT id, data FROM "{table}" WHERE "{column}" IS NULL')
        ).fetchall()
        if not rows:
            return 0
        updated = 0
        for row_id, raw in rows:
            code = None
            if isinstance(raw, str):
                import json as _json

                try:
                    payload = _json.loads(raw)
                except Exception:
                    payload = None
            else:
                payload = raw
            if isinstance(payload, dict):
                value = payload.get(json_key)
                if isinstance(value, str):
                    code = value
            if code is not None:
                conn.execute(
                    text(f'UPDATE "{table}" SET "{column}" = :code WHERE id = :id'),
                    {"code": code, "id": row_id},
                )
                updated += 1
        conn.commit()
        return updated


def ensure_ctms_scope_columns(engine) -> dict:
    """ALTER (if needed) + backfill study_id / site_id on every ctms table."""
    if _dialect_name(engine) != "sqlite":
        return {"skipped": True}
    report: dict = {}
    try:
        for table in _CTMS_TABLES:
            cols = _columns(engine, table)
            if not cols:  # table does not exist yet (fresh DB)
                continue
            for column, json_key in (("study_id", "studyCode"), ("site_id", "siteCode")):
                if column not in cols:
                    with engine.connect() as conn:
                        conn.execute(
                            text(
                                f'ALTER TABLE "{table}" ADD COLUMN "{column}" VARCHAR(100)'
                            )
                        )
                        conn.commit()
                    report[f"{table}.{column}"] = "added"
                backfilled = _backfill_codes(engine, table, column, json_key)
                if backfilled:
                    report[f"{table}.{column}"] = f"backfilled {backfilled}"
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("ctms scope-column ensure failed: %s", exc)
        report["error"] = str(exc)
    return report


def ensure_accounts_scope_column(engine) -> dict:
    """Add accounts_user.scope_data when missing (SQLite)."""
    if _dialect_name(engine) != "sqlite":
        return {"skipped": True}
    report: dict = {}
    try:
        cols = _columns(engine, "accounts_user")
        if cols and "scope_data" not in cols:
            with engine.connect() as conn:
                conn.execute(
                    text('ALTER TABLE "accounts_user" ADD COLUMN "scope_data" JSON')
                )
                conn.commit()
            report["accounts_user.scope_data"] = "added"
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("accounts scope-column ensure failed: %s", exc)
        report["error"] = str(exc)
    return report


def ensure_schema_columns(engine) -> dict:
    """Run every additive schema repair (idempotent, SQLite only)."""
    if engine is None:
        return {"skipped": True}
    out: dict = {}
    out.update(ensure_ctms_scope_columns(engine))
    out.update(ensure_accounts_scope_column(engine))
    return out