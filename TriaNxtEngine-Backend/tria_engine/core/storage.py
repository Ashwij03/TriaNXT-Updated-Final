# tria_engine/core/storage.py
#
# Local media storage for the migrated stack. Replaces Django's
# FileField/ImageField + MEDIA_ROOT handling for development: files land
# under <project-root>/media/ and are served by the FastAPI app at /media/
# in DEBUG mode, exactly like Django's `static(settings.MEDIA_URL, ...)`.
#
# The old production setup used django-storages + boto3 for S3-style
# document storage; that configuration was environment-driven and is not
# exercised by the local dev database. If S3 storage is re-enabled for a
# deployment, swap FileStorage below for an S3-backed implementation at the
# same call sites — nothing else in the code depends on how a file is
# physically stored.

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from pathlib import Path

from .config import BASE_DIR, settings
from .timeutils import utcnow

MEDIA_URL = "/media/"


@dataclass
class StoredFile:
    """Minimal stand-in for a Django FieldFile: name is the storage-relative
    path (e.g. documents/general/2026/09/04/<uuid>.pdf)."""

    name: str
    size: int = 0

    @property
    def url(self) -> str:
        return f"{MEDIA_URL}{self.name}"

    @property
    def basename(self) -> str:
        return os.path.basename(self.name)


def _media_root() -> Path:
    return Path(settings.media_root) if settings.media_root else BASE_DIR / "media"


def save_bytes(rel_dir: str, filename: str, content: bytes) -> StoredFile:
    """Save raw bytes under media/<rel_dir> with a uuid4 filename (keeps the
    upload_to-style randomisation Django's FileField produced)."""
    ext = os.path.splitext(filename)[1].lower()
    directory = _media_root() / rel_dir
    directory.mkdir(parents=True, exist_ok=True)
    storage_name = f"{rel_dir}/{uuid.uuid4().hex}{ext}".replace("\\", "/")
    full_path = _media_root() / storage_name
    full_path.write_bytes(content)
    return StoredFile(name=storage_name, size=len(content))


def save_profile_photo(content: bytes, filename: str, user_id=None) -> StoredFile:
    # Mirror Django's user_profile_photo_path: profile_photos/user_<id>/<uuid><ext>
    ext = os.path.splitext(filename)[1].lower()
    rel_dir = f"profile_photos/user_{user_id if user_id is not None else 'new'}"
    return save_bytes(rel_dir, f"{uuid.uuid4().hex}{ext}", content)


def save_document(category: str, content: bytes, filename: str) -> StoredFile:
    rel_dir = f"documents/{category}/{utcnow().strftime('%Y/%m/%d')}"
    return save_bytes(rel_dir, filename, content)


def save_form(content: bytes, filename: str) -> StoredFile:
    return save_bytes("forms", filename, content)


def absolute_path(storage_name: str) -> Path:
    return _media_root() / storage_name


def delete_file(storage_name: str | None) -> None:
    if not storage_name:
        return
    try:
        path = _media_root() / storage_name
        if path.is_file():
            path.unlink()
    except OSError:
        pass
