# tria_engine/core/timeutils.py
#
# Datetime helpers. The old Django + SQLite development database stored
# naive UTC datetimes (Django strips tz info for SQLite). To keep wire
# responses byte-identical to what DRF produced, the migrated code writes
# and compares naive UTC datetimes. On PostgreSQL the same naive values are
# interpreted as server-local time; see MIGRATION_NOTES.md for the trade-off.

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone


def utcnow() -> datetime:
    """Naive UTC now (Django/SQLite storage semantics)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def localdate() -> date:
    return date.today()


def now_plus_minutes(minutes: int) -> datetime:
    return utcnow() + timedelta(minutes=minutes)
