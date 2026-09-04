# tria_engine/apps/accounts/file_validators.py
#
# Ported unchanged from the Django module. DRF's serializers.ValidationError
# is replaced by FileValidationError, which the accounts router converts to
# the same {"message": ...} 400 responses DRF produced.

import os

ALLOWED_FILE_TYPES = ["pdf", "docx", "txt"]
MAX_FILE_SIZE_MB = 10

ALLOWED_IMAGE_TYPES = ["jpg", "jpeg", "png"]
MAX_IMAGE_SIZE_MB = 2

ALLOWED_FORM_TYPES = ["jpg", "jpeg", "png", "pdf"]
MAX_FORM_SIZE_MB = 5


class FileValidationError(ValueError):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def validate_file_size(uploaded_file, max_size):
    if uploaded_file.size > max_size:
        raise FileValidationError(
            f"File size must be less than or equal to {max_size} bytes"
        )


def validate_file_extension(uploaded_file, allowed_extensions):
    ext = os.path.splitext(uploaded_file.name)[1].lower().lstrip(".")
    if ext not in [item.lower() for item in allowed_extensions]:
        raise FileValidationError(
            f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"
        )


def validate_document(file):
    extension = file.name.split(".")[-1].lower()

    if extension not in ALLOWED_FILE_TYPES:
        raise FileValidationError(f"Only {ALLOWED_FILE_TYPES} files are allowed")

    if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise FileValidationError(f"File size should not exceed {MAX_FILE_SIZE_MB} MB")


def validate_profile_photo(file):
    extension = file.name.split(".")[-1].lower()

    if extension not in ALLOWED_IMAGE_TYPES:
        raise FileValidationError(
            f"Only {ALLOWED_IMAGE_TYPES} image types are allowed"
        )

    if file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise FileValidationError(
            f"Image size should not exceed {MAX_IMAGE_SIZE_MB} MB"
        )


def validate_form_file(file):
    extension = file.name.split(".")[-1].lower()

    if extension not in ALLOWED_FORM_TYPES:
        raise FileValidationError(f"Only {ALLOWED_FORM_TYPES} files allowed")

    if file.size > MAX_FORM_SIZE_MB * 1024 * 1024:
        raise FileValidationError(f"File size should not exceed {MAX_FORM_SIZE_MB} MB")
