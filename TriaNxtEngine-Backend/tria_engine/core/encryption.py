# tria_engine/core/encryption.py
#
# Replaces the CTMS_ENCRYPTION_KEY Fernet helper from
# tria_engine/apps/accounts/utils.py (same behaviour: encrypt_value /
# decrypt_value, InvalidToken -> None).

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from .config import settings


class EncryptionNotConfigured(RuntimeError):
    pass


def get_cipher_suite():
    key = settings.CTMS_ENCRYPTION_KEY
    if not key:
        raise EncryptionNotConfigured("CTMS_ENCRYPTION_KEY is not configured")

    if isinstance(key, str):
        key = key.encode("utf-8")

    try:
        return Fernet(key)
    except Exception as exc:  # pragma: no cover - invalid key format
        raise EncryptionNotConfigured("CTMS_ENCRYPTION_KEY must be a valid Fernet key") from exc


def encrypt_value(data):
    if data in (None, ""):
        return None

    cipher = get_cipher_suite()
    if isinstance(data, str):
        data = data.encode("utf-8")
    return cipher.encrypt(data).decode("utf-8")


def decrypt_value(encrypted_data):
    if encrypted_data in (None, ""):
        return None

    cipher = get_cipher_suite()
    if isinstance(encrypted_data, str):
        encrypted_data = encrypted_data.encode("utf-8")

    try:
        return cipher.decrypt(encrypted_data).decode("utf-8")
    except InvalidToken:
        return None
