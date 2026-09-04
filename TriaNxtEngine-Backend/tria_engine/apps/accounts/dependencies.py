# tria_engine/apps/accounts/dependencies.py
#
# FastAPI dependency layer replacing DRF's SessionAuthentication +
# IsAuthenticated + the accounts permissions module.
#
# Auth behaviour parity: DRF SessionAuthentication read the "sessionid"
# cookie and returned HTTP 401 {"detail": "Authentication credentials were
# not provided."} when the session was missing/expired. get_current_user
# reproduces that exactly (same cookie name, same table, same envelope).
# The dedicated accounts/permissions.py classes were never attached to any
# mounted view — they are represented here by the role helpers the router
# actually needs, and the file keeps the old module name for parity.

from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from tria_engine.core.database import get_db
from tria_engine.core.security import SESSION_COOKIE_NAME
from tria_engine.core.session_store import load_session

from .models import User

UNAUTHENTICATED_DETAIL = "Authentication credentials were not provided."


def _load_session_user(db: Session, request: Request) -> User | None:
    session_key = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_key:
        return None
    payload = load_session(db, session_key)
    if not payload:
        return None
    user_id = payload.get("_auth_user_id")
    if user_id is None:
        return None
    return db.get(User, user_id)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Replicates DRF IsAuthenticated: 401 when there is no valid session."""
    user = _load_session_user(db, request)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail=UNAUTHENTICATED_DETAIL)
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    return _load_session_user(db, request)
