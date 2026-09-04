# tria_engine/apps/accounts/authentication.py
#
# Parity module for the old authentication.py EmailBackend. Django's
# ModelBackend + custom EmailBackend are replaced by direct helpers built
# on core.security (Django-compatible password hashes), so existing rows
# verify without a password reset.

from __future__ import annotations

from sqlalchemy import select

from tria_engine.core.security import verify_password

from .models import User


def authenticate_by_email_password(db, email, password):
    """Return the User when email + password match and the account is
    active, else None (mirrors EmailBackend.authenticate + user_can_authenticate)."""
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        return None
    if not user.is_active:
        return None
    if user.password and verify_password(password, user.password):
        return user
    return None
