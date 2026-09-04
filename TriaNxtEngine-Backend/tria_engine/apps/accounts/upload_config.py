# tria_engine/apps/accounts/upload_config.py
#
# Same accessors as the Django module, now reading from core.config.Settings
# (TRIA_UPLOADS equivalents). Defaults unchanged.

from tria_engine.core.config import settings


def get_document_max_size():
    return settings.TRIA_DOCUMENT_MAX_SIZE


def get_document_allowed_extensions():
    return list(settings.document_allowed_extensions)


def get_profile_photo_max_size():
    return settings.TRIA_PROFILE_PHOTO_MAX_SIZE


def get_profile_photo_allowed_extensions():
    return list(settings.profile_photo_allowed_extensions)
