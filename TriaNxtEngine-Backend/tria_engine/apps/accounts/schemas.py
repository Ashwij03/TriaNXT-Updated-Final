# tria_engine/apps/accounts/schemas.py
#
# Pydantic v2 port of the DRF serializers. The DRF validation layer was a
# hand-rolled "request schema" system with its own response envelope:
#
#   {"message": "Request schema validation failed",
#    "request_schema": {...}, "errors": {field: [messages]}}   (HTTP 400)
#
# and single-message bodies like {"message": "Invalid Credentials"} (401)
# elsewhere. That envelope is what the (optional) frontend API integration
# parses, so the migrated endpoints reproduce it via the manual validation
# helpers below rather than FastAPI's default 422 detail format.

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Request bodies (used by FastAPI for JSON parsing + OpenAPI docs)
# ---------------------------------------------------------------------------


class LoginBody(BaseModel):
    # Fields are deliberately unconstrained here: the original DRF layer ran
    # serializer.is_valid() and reported every field error at once, so a
    # Pydantic min_length would shadow the blank-email error. Semantic
    # validation (required / format / length) happens in the router with
    # DRF-identical messages.
    email: str
    password: str


class LoginMFABody(BaseModel):
    # See LoginBody: constraints enforced in the router for DRF parity.
    email: str
    password: str


class VerifyLoginOTPBody(BaseModel):
    email: str
    otp_code: str = Field(..., max_length=6)


class ForgotPasswordBody(BaseModel):
    email: str


class ResetPasswordBody(BaseModel):
    email: str
    otp_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=50)


class ChangePasswordBody(BaseModel):
    email: str
    current_password: str = Field(..., min_length=8, max_length=50)
    new_password: str = Field(..., min_length=8, max_length=50)
    confirm_password: str = Field(..., min_length=8, max_length=50)


class RegisterBody(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: str
    password: str = Field(..., min_length=8, max_length=50)
    confirm_password: str = Field(..., min_length=8, max_length=50)
    first_name: str = Field(..., min_length=2, max_length=50)
    last_name: str = Field(..., min_length=2, max_length=50)
    organization: int | None = None
    organization_name: str | None = None
    role: int | str | None = None


class ScopeUpdateBody(BaseModel):
    """Admin-assigned site/study scope for a user (RBAC 4.1).

    `studies` / `sites` hold the study/site CODES the user may access;
    empty lists clear the restriction back to plain organization scope.
    Persisted on accounts_user.scope_data.
    """

    studies: list[str] = []
    sites: list[str] = []


class IntegrityBody(BaseModel):
    message: str


class DeleteUploadFormBody(BaseModel):
    user_id: int = Field(..., ge=1, le=99999999)
    form_id: int = Field(..., ge=1, le=99999999)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserOut(BaseModel):
    """Login/check-session user payload (only the fields DRF returned)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    first_name: str = ""
    last_name: str = ""
    is_active: bool = True


class UploadedDocumentOut(BaseModel):
    """Mirror of DRF UploadedDocumentSerializer (read-only fields)."""

    model_config = ConfigDict(from_attributes=True)

    document_number: int | None
    original_name: str
    content_type: str | None
    file_size: int
    category: str
    organization: Any = None
    uploaded_by: str = ""
    created_at: Any = None
    updated_at: Any = None


class AuditLogOut(BaseModel):
    """Mirror of DRF AuditLogSerializer."""

    id: int
    user: Any = "Unknown User"
    action: str
    ip_address: Any = None
    description: str
    timestamp: Any = None
    signature_token: str
    signature_meaning: str


# ---------------------------------------------------------------------------
# DRF-style schema-error envelope helpers
# ---------------------------------------------------------------------------


def request_schema_error(field_errors: dict[str, list[str]]) -> dict:
    """Build the DRF `validate_api_request_schema` envelope for field errors.

    field_errors keys mirror serializer.errors (non-field errors use the
    "non_field_errors" key)."""
    return {
        "message": "Request schema validation failed",
        "request_schema": {},
        "errors": field_errors,
    }


def require_fields(data: dict, fields: list[str]) -> dict[str, list[str]]:
    """Replicates RequestSchemaValidationMixin.validate_request_schema:
    a field whose value is None or "" fails with '<field> is required'."""
    errors: dict[str, list[str]] = {}
    for field_name in fields:
        value = data.get(field_name)
        if value in (None, ""):
            errors[field_name] = [f"{field_name} is required"]
    return errors


def validate_email_format(value: str) -> bool:
    return bool(EMAIL_RE.match(value or ""))
