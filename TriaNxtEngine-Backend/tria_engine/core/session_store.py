# tria_engine/core/session_store.py
#
# Session persistence with byte-level schema parity to Django's sessions
# table (django_session: session_key / session_data / expire_date) so the
# existing database layout is preserved. Cookies keep Django's name
# (sessionid). session_data holds a JSON payload instead of Django's
# signed pickle blob.

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .config import settings
from .database import Base
from .security import SESSION_COOKIE_AGE, SESSION_COOKIE_NAME, dumps_session, get_random_string, loads_session
from .timeutils import utcnow


class DjangoSession(Base):
    """Mirror of Django's django_session table."""

    __tablename__ = "django_session"

    session_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    session_data: Mapped[str] = mapped_column(Text, nullable=False)
    expire_date: Mapped[object] = mapped_column(DateTime, nullable=False)


def create_session(db, user_id: int) -> str:
    """Insert a session row and return its key (32-char alphanumeric)."""
    key = get_random_string(32)
    now = utcnow()
    db_session = DjangoSession(
        session_key=key,
        session_data=dumps_session({"_auth_user_id": user_id}),
        expire_date=now + timedelta(seconds=SESSION_COOKIE_AGE),
    )
    db.merge(db_session)
    db.commit()
    return key


def load_session(db, session_key: str | None) -> dict | None:
    """Return the decoded session payload for a key, or None if absent,
    expired or unreadable (old Django-encoded rows)."""
    if not session_key:
        return None
    row = db.get(DjangoSession, session_key)
    if row is None:
        return None
    if row.expire_date is None or row.expire_date <= utcnow():
        db.delete(row)
        db.commit()
        return None
    payload = loads_session(row.session_data)
    if payload is None:
        # Old Django-encoded row we can't decode — drop it so the user just
        # logs in again rather than looping on a dead session.
        db.delete(row)
        db.commit()
        return None
    return payload


def delete_session(db, session_key: str | None) -> None:
    if not session_key:
        return
    row = db.get(DjangoSession, session_key)
    if row is not None:
        db.delete(row)
        db.commit()


def clear_cookie_header(cookie: str | None) -> str:
    """Serialized Set-Cookie header value clearing the session cookie."""
    return (
        f"{SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
        + ("; Secure" if settings.env == "production" else "")
    )
