# tria_engine/core/security.py
#
# Password hashing + session handling for the migrated stack.
#
# Password parity: existing rows in the database were created by Django with
# its Argon2PasswordHasher (format "argon2$<argon2-cffi-encoded>") or, as a
# fallback, PBKDF2PasswordHasher ("pbkdf2_sha256$<iterations>$<salt>$<hash>").
# verify_password() understands both formats so no password reset is forced.
# New hashes are written in Django's argon2 format ("argon2$" + argon2-cffi
# encoded) so the data stays portable.
#
# Session parity: the old stack authenticated via Django session cookies
# (SESSION_COOKIE_NAME "sessionid" pointing at the django_session table).
# SessionAuth here keeps the exact same table/columns and cookie name, and
# stores a JSON payload in session_data instead of Django's pickle+HMAC
# encoding. Old Django session rows can no longer be decoded and are simply
# treated as absent (deleted lazily) — users simply log in again.

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets

import argon2
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from .config import settings

_ph = PasswordHasher()

# Django's Argon2PasswordHasher writes "argon2$" + an argon2-cffi encoded
# string. New hashes use the same prefix so both stacks interoperate.
_ARGON2_PREFIX = "argon2$"
_PBKDF2_PREFIX = "pbkdf2_sha256$"
_SALT_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def hash_password(password: str) -> str:
    """Hash a plaintext password in Django's argon2 format."""
    return _ARGON2_PREFIX + _ph.hash(password)


def verify_password(password: str, encoded: str | None) -> bool:
    """Verify a password against a stored Django/argon2/pbkdf2 hash."""
    if not encoded:
        return False
    if encoded.startswith(_ARGON2_PREFIX):
        try:
            return _ph.verify(encoded[len(_ARGON2_PREFIX):], password)
        except (VerificationError, VerifyMismatchError, InvalidHashError):
            return False
    if encoded.startswith(_PBKDF2_PREFIX):
        return _verify_pbkdf2(password, encoded)
    return False


def _verify_pbkdf2(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_b64, hash_b64 = encoded.split("$", 3)
        iterations = int(iterations)
        if algorithm != "pbkdf2_sha256" or iterations <= 0:
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def get_random_string(length: int = 32) -> str:
    """Random alphanumeric string (same charset as Django's get_random_string)."""
    return "".join(secrets.choice(_SALT_CHARS) for _ in range(length))


# ---------------------------------------------------------------------------
# Session data codec (JSON instead of Django's signed/pickled blob)
# ---------------------------------------------------------------------------


def dumps_session(payload: dict) -> str:
    return json.dumps(payload)


def loads_session(session_data: str) -> dict | None:
    """Decode session_data. Returns None when the row is not readable (e.g.
    an old Django-encoded row), so the caller treats it as logged out."""
    try:
        decoded = json.loads(session_data)
        return decoded if isinstance(decoded, dict) else None
    except (ValueError, TypeError):
        return None


SESSION_COOKIE_NAME = settings.SESSION_COOKIE_NAME
SESSION_COOKIE_AGE = settings.SESSION_COOKIE_AGE
