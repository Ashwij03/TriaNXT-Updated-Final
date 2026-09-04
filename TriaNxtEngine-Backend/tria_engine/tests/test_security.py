# Password-hash compatibility: existing DB rows were created by Django
# (argon2$... with Django's params, or pbkdf2_sha256$... fallback). New
# hashes must stay in Django's format.

import base64
import hashlib

from tria_engine.core.security import hash_password, verify_password


def test_new_hashes_use_django_argon2_format():
    encoded = hash_password("S3cure!Pass")
    assert encoded.startswith("argon2$")
    assert verify_password("S3cure!Pass", encoded)
    assert not verify_password("wrong", encoded)


def test_verifies_django_argon2_hash_created_with_django_params():
    # Simulates a hash Django wrote with its own Argon2PasswordHasher params.
    import argon2

    ph = argon2.PasswordHasher(time_cost=2, memory_cost=102400, parallelism=8)
    inner = ph.hash("LegacyPass1!")
    django_encoded = "argon2$" + inner
    assert verify_password("LegacyPass1!", django_encoded)
    assert not verify_password("WrongPass1!", django_encoded)


def test_verifies_pbkdf2_fallback_hash():
    # Django PBKDF2PasswordHasher format:
    # pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>
    iterations = 260000
    salt = b"salty-salt"
    digest = hashlib.pbkdf2_hmac("sha256", b"Pbkdf2Pass1!", salt, iterations)
    encoded = "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )
    assert verify_password("Pbkdf2Pass1!", encoded)
    assert not verify_password("WrongPass1!", encoded)


def test_rejects_garbage():
    assert not verify_password("anything", "")
    assert not verify_password("anything", None)
    assert not verify_password("anything", "not-a-hash")
