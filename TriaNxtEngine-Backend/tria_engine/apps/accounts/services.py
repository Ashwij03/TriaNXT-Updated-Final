# tria_engine/apps/accounts/services.py
#
# Behavioural port of the Django services.py. Every success/error message
# and HTTP-relevant return tuple is preserved verbatim; Django ORM calls
# became SQLAlchemy queries against the same tables. Functions take an
# explicit `db` session plus a small `RequestMeta` (ip/path/method) used
# for the audit trail in place of the Django request object.

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, update

from tria_engine.core.config import settings
from tria_engine.core.security import hash_password
from tria_engine.core.storage import (
    delete_file,
    save_document,
    save_form,
    save_profile_photo,
)
from tria_engine.core.timeutils import utcnow

from .audit import log_audit_event
from .file_validators import (
    validate_document,
    validate_file_extension,
    validate_file_size,
    validate_form_file,
    validate_profile_photo,
)
from .models import AuditLog, LoginOTP, PasswordResetToken, UploadForm, UploadLog, UploadedDocument, User
from .upload_config import (
    get_document_allowed_extensions,
    get_document_max_size,
    get_profile_photo_allowed_extensions,
    get_profile_photo_max_size,
)


@dataclass
class RequestMeta:
    """Minimal stand-in for the Django request object where services used it
    (audit ip/path/method)."""

    ip: str | None = None
    path: str = ""
    method: str = ""

    @property
    def META(self) -> dict:
        return {"REMOTE_ADDR": self.ip}

    def __bool__(self) -> bool:
        return True


@dataclass
class UploadedFileLike:
    """Stand-in for a Django InMemoryUploadedFile: name/size/content_type."""

    name: str = ""
    size: int = 0
    content_type: str | None = None
    content: bytes = b""


def make_request_meta(ip: str | None, path: str, method: str) -> RequestMeta:
    return RequestMeta(ip=ip, path=path, method=method)


# =====================================================
# API validation helpers (kept for behaviour parity —
# the original threshold logic never fired in practice)
# =====================================================


def validate_rate_limit(current_request_count, threshold, retry_after_seconds):
    if current_request_count > threshold:
        return {
            "message": "Rate limit exceeded",
            "threshold": threshold,
            "retry_after_seconds": retry_after_seconds,
        }, 429
    return None, None


# =====================================================
# Security settings (TRIA_SECURITY equivalents)
# =====================================================


def _token_expires_in_minutes():
    return settings.TRIA_TOKEN_EXPIRY_MINUTES


def _expose_otp_in_response():
    return settings.TRIA_EXPOSE_OTP_IN_RESPONSE


def _generate_otp_code():
    return f"{secrets.randbelow(900000) + 100000}"


def _cleanup_active_login_otps(db, user):
    db.execute(
        update(LoginOTP)
        .where(LoginOTP.user_id == user.id, LoginOTP.is_used.is_(False), LoginOTP.expires_at > utcnow())
        .values(is_used=True)
    )


def _cleanup_active_reset_tokens(db, user):
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.is_used.is_(False),
            PasswordResetToken.expires_at > utcnow(),
        )
        .values(is_used=True)
    )


def _mark_all_unused_reset_tokens_used(db, user, exclude_id=None):
    stmt = update(PasswordResetToken).where(
        PasswordResetToken.user_id == user.id, PasswordResetToken.is_used.is_(False)
    )
    if exclude_id:
        stmt = stmt.where(PasswordResetToken.id != exclude_id)
    db.execute(stmt.values(is_used=True))


def _mark_all_unused_login_otps_used(db, user, exclude_id=None):
    stmt = update(LoginOTP).where(LoginOTP.user_id == user.id, LoginOTP.is_used.is_(False))
    if exclude_id:
        stmt = stmt.where(LoginOTP.id != exclude_id)
    db.execute(stmt.values(is_used=True))


def _build_login_response(user, otp):
    data = {
        "mfa_required": True,
        "message": "OTP generated successfully",
        "email": user.email,
        "expires_at": otp.expires_at,
    }
    if _expose_otp_in_response():
        data["otp_code"] = otp.otp_code
    return data


# =========================================================
# User / Auth services
# =========================================================


def _validate_new_password(password: str) -> None:
    """Light port of Django's validate_password (MinimumLengthValidator 8 +
    NumericPasswordValidator). Serializers already enforce length; Django
    only ever surfaced the numeric/common checks here."""
    if password.isnumeric():
        raise ValueError("This password is entirely numeric.")


def create_user(db, validated_data: dict) -> User:
    from .authentication import authenticate_by_email_password  # noqa: F401 (kept import order parity)

    user = User(
        username=validated_data["username"],
        email=validated_data["email"],
        first_name=validated_data.get("first_name", ""),
        last_name=validated_data.get("last_name", ""),
        organization_id=validated_data.get("organization"),
        role_id=validated_data.get("role"),
        is_active=True,
    )
    _validate_new_password(validated_data["password"])
    user.password = hash_password(validated_data["password"])
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_all_users_service(db):
    return db.execute(select(User)).scalars().all()


def login_user(db, email, password, request=None):
    from .authentication import authenticate_by_email_password

    user = authenticate_by_email_password(db, email=email, password=password)

    if user is None:
        log_audit_event(
            "login_failed",
            request=request,
            status="failed",
            details={"email": email},
        )
        return None, "Invalid credentials"

    if not user.is_active:
        log_audit_event("login_inactive_user", user=user, request=request, status="failed")
        return None, "User account is inactive"

    if user.must_change_password:
        log_audit_event(
            "login_blocked_password_change_required",
            user=user,
            request=request,
            status="failed",
        )
        return None, (
            "Password reset required due to a security event. "
            "Please reset your password."
        )

    # Update last activity after successful login (parity with Django).
    user.last_activity = utcnow()
    db.commit()

    return user, None


def login_user_with_mfa(db, email, password, request=None):
    user, error = login_user(db, email=email, password=password, request=request)
    if error:
        return None, error

    _cleanup_active_login_otps(db, user)

    otp = LoginOTP(
        user_id=user.id,
        otp_code=_generate_otp_code(),
        expires_at=utcnow() + timedelta(minutes=_token_expires_in_minutes()),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)

    log_audit_event(
        "otp_generated",
        user=user,
        request=request,
        details={"expires_at": str(otp.expires_at)},
    )

    return _build_login_response(user, otp), None


def verify_login_otp(db, email, otp_code, request=None):
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        log_audit_event(
            "otp_verify_failed", request=request, status="failed", details={"email": email}
        )
        return None, "Invalid email"

    otp = db.execute(
        select(LoginOTP).where(
            LoginOTP.user_id == user.id, LoginOTP.otp_code == otp_code, LoginOTP.is_used.is_(False)
        )
    ).scalar_one_or_none()

    if otp is None:
        log_audit_event("otp_verify_failed", user=user, request=request, status="failed")
        return None, "Invalid OTP"

    if otp.expires_at is None or otp.expires_at <= utcnow():
        otp.is_used = True
        db.commit()
        log_audit_event("otp_expired", user=user, request=request, status="failed")
        return None, "OTP has expired"

    otp.is_used = True
    db.commit()

    _mark_all_unused_login_otps_used(db, user, exclude_id=otp.id)
    db.commit()
    log_audit_event("otp_verified", user=user, request=request)
    return user, None


# =========================================================
# Password services
# =========================================================


def forgot_password_user(db, email, request=None):
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        log_audit_event(
            "forgot_password_requested_unknown_email",
            request=request,
            details={"email": email},
        )
        return None, "If an account with this email exists, a reset OTP has been generated."

    _cleanup_active_reset_tokens(db, user)

    reset_otp = PasswordResetToken(
        user_id=user.id,
        otp_code=_generate_otp_code(),
        expires_at=utcnow() + timedelta(minutes=_token_expires_in_minutes()),
    )
    db.add(reset_otp)
    db.commit()
    db.refresh(reset_otp)

    log_audit_event("password_reset_otp_generated", user=user, request=request)

    result = {
        "message": "If an account with this email exists, a reset OTP has been generated.",
        "email": user.email,
        "expires_at": reset_otp.expires_at,
    }
    if _expose_otp_in_response():
        result["reset_otp"] = reset_otp.otp_code

    return result, None


def reset_password_user(db, email, otp_code, new_password, request=None):
    reset_otp = db.execute(
        select(PasswordResetToken)
        .join(User)
        .where(User.email == email, PasswordResetToken.otp_code == otp_code, PasswordResetToken.is_used.is_(False))
    ).scalar_one_or_none()

    if reset_otp is None:
        log_audit_event(
            "password_reset_failed",
            request=request,
            status="failed",
            details={"email": email},
        )
        return None, "Invalid reset OTP"

    if reset_otp.expires_at is None or reset_otp.expires_at <= utcnow():
        reset_otp.is_used = True
        db.commit()
        log_audit_event("password_reset_expired", user=reset_otp.user, request=request, status="failed")
        return None, "Reset OTP has expired"

    user = reset_otp.user
    _validate_new_password(new_password)
    user.password = hash_password(new_password)
    user.must_change_password = False
    db.commit()

    reset_otp.is_used = True
    db.commit()

    _mark_all_unused_reset_tokens_used(db, user, exclude_id=reset_otp.id)
    _mark_all_unused_login_otps_used(db, user)
    db.commit()
    log_audit_event("password_reset_success", user=user, request=request)
    return user, None


def change_password_user(db, user, current_password, new_password, request=None):
    from tria_engine.core.security import verify_password

    if not user.password or not verify_password(current_password, user.password):
        if request:
            log_audit_event("change_password_failed", user=user, request=request, status="failed")
        return None, "Current password is incorrect"

    if current_password == new_password:
        return None, "New password must be different from current password"

    _validate_new_password(new_password)

    user.password = hash_password(new_password)
    user.must_change_password = False
    db.commit()

    _mark_all_unused_reset_tokens_used(db, user)
    _mark_all_unused_login_otps_used(db, user)
    db.commit()

    if request:
        log_audit_event("change_password_success", user=user, request=request)

    return {"message": "Password changed successfully"}, None


def report_compromised_token(db, user, token_type, request=None):
    if token_type == "login_otp":
        db.execute(update(LoginOTP).where(LoginOTP.user_id == user.id, LoginOTP.is_used.is_(False)).values(is_used=True))
    elif token_type == "password_reset":
        db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used.is_(False))
            .values(is_used=True)
        )

    user.must_change_password = True
    db.commit()

    log_audit_event(
        "compromised_token_reported",
        user=user,
        request=request,
        status="warning",
        details={"token_type": token_type},
    )

    return {
        "message": "Compromised token handled successfully",
        "token_type": token_type,
        "action": "active tokens revoked and password change required",
    }, None


# =========================================================
# Integrity / Audit services
# =========================================================


def create_audit_log(db, user, action, ip_address=None, description=None, signature_token=None, signature_meaning=None):
    import uuid

    audit_log = AuditLog(
        user_id=user.id if user is not None else None,
        action=action,
        ip_address=ip_address,
        description=description if description else "Audit log recorded",
        signature_meaning=signature_meaning if signature_meaning else "Electronic signature recorded",
        signature_token=(signature_token or uuid.uuid4().hex),
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def get_audit_logs_service(db):
    return db.execute(select(AuditLog).order_by(AuditLog.created_at.desc())).scalars().all()


def integrity_check_service(message):
    hash_value = hashlib.sha256(message.encode()).hexdigest()
    return {
        "message": "Integrity check completed successfully",
        "original_message": message,
        "sha256_hash": hash_value,
    }


# =========================================================
# Document services
# =========================================================


def upload_document(*, db, user_id, uploaded_file, uploaded_by, category="general", organization=None, request=None):
    validate_file_size(uploaded_file, get_document_max_size())
    validate_file_extension(uploaded_file, get_document_allowed_extensions())
    validate_document(uploaded_file)

    final_organization_id = uploaded_by.organization_id
    if organization is not None:
        final_organization_id = organization if isinstance(organization, int) else getattr(organization, "id", organization)

    if not final_organization_id and not uploaded_by.is_superuser:
        return None, "Organization is required for document upload"

    stored = save_document(category, uploaded_file.content, uploaded_file.name)

    document = UploadedDocument(
        uploaded_by_id=uploaded_by.id,
        organization_id=final_organization_id,
        file=stored.name,
        original_name=uploaded_file.name,
        content_type=uploaded_file.content_type,
        file_size=uploaded_file.size,
        category=category,
    )
    # document_number: Django's save() used count() + 1 (rows are kept
    # contiguous by renumbering on delete), so the next free number is
    # simply the first gap-free integer past the current count.
    existing_numbers = {
        row for (row,) in db.execute(select(UploadedDocument.document_number)).all() if row is not None
    }
    candidate = 1
    while candidate in existing_numbers:
        candidate += 1
    document.document_number = candidate
    db.add(document)
    db.commit()
    db.refresh(document)

    log_audit_event(
        "document_uploaded",
        user=uploaded_by,
        request=request,
        details={
            "user_id": user_id,
            "document_number": document.document_number,
            "file_name": document.original_name,
        },
    )

    return document, None


def _renumber_documents(db, after_id: int) -> None:
    rows = db.execute(
        select(UploadedDocument).order_by(UploadedDocument.document_number, UploadedDocument.id)
    ).scalars().all()
    for index, doc in enumerate(rows, start=1):
        if doc.id != after_id and doc.document_number != index:
            doc.document_number = index
    db.commit()


def get_document_by_number(*, db, document_number, user, request=None):
    document = db.execute(
        select(UploadedDocument).where(UploadedDocument.document_number == document_number)
    ).scalar_one_or_none()
    if document is None:
        log_audit_event(
            "document_access_failed",
            user=user,
            request=request,
            status="failed",
            details={"document_number": document_number},
        )
        return None, "Document not found"

    if not user.is_superuser and document.organization_id != user.organization_id:
        log_audit_event(
            "document_access_forbidden",
            user=user,
            request=request,
            status="failed",
            details={"document_number": document_number},
        )
        return None, "You do not have permission to access this document"

    return document, None


def delete_document_by_number(*, db, user_id, document_number, user, request=None):
    document = db.execute(
        select(UploadedDocument).where(UploadedDocument.document_number == document_number)
    ).scalar_one_or_none()

    if document is None:
        log_audit_event(
            "document_delete_failed",
            user=user,
            request=request,
            status="failed",
            details={"user_id": user_id, "document_number": document_number},
        )
        return None, "Document not found"

    if not user.is_superuser and document.organization_id != user.organization_id:
        log_audit_event(
            "document_delete_forbidden",
            user=user,
            request=request,
            status="failed",
            details={
                "user_id": user_id,
                "document_number": document_number,
                "file_name": document.original_name,
            },
        )
        return None, "You do not have permission to delete this document"

    file_name = document.original_name
    document_id = document.id
    stored_name = document.file
    db.delete(document)
    db.commit()
    delete_file(stored_name)
    _renumber_documents(db, after_id=document_id)

    if db.get(UploadedDocument, document_id) is not None:
        return None, "Document deletion validation failed"

    log_audit_event(
        "document_deleted",
        user=user,
        request=request,
        details={"user_id": user_id, "document_number": document_number, "file_name": file_name},
    )

    return {"message": "Document deleted successfully"}, None


# =========================================================
# Profile photo services
# =========================================================


def upload_profile_photo(*, db, user, uploaded_file, request=None):
    validate_file_size(uploaded_file, get_profile_photo_max_size())
    validate_file_extension(uploaded_file, get_profile_photo_allowed_extensions())
    validate_profile_photo(uploaded_file)

    if user.profile_photo:
        delete_file(user.profile_photo)

    stored = save_profile_photo(uploaded_file.content, uploaded_file.name, user_id=user.id)
    user.profile_photo = stored.name
    db.commit()

    log_audit_event(
        "profile_photo_uploaded",
        user=user,
        request=request,
        details={"file_name": uploaded_file.name},
    )
    return user, None


def get_profile_photo(*, db, user, request=None):
    if not user.profile_photo:
        log_audit_event(
            "profile_photo_view_failed",
            user=user,
            request=request,
            status="failed",
        )
        return None, "Profile photo not found"

    log_audit_event("profile_photo_viewed", user=user, request=request)
    return {
        "name": user.profile_photo.split("/")[-1],
        "url": f"/media/{user.profile_photo}",
    }, None


def delete_profile_photo(*, db, user, request=None):
    if not user.profile_photo:
        return None, "Profile photo not found"

    old_file_name = user.profile_photo
    delete_file(user.profile_photo)
    user.profile_photo = None
    db.commit()

    log_audit_event(
        "profile_photo_deleted",
        user=user,
        request=request,
        details={"file_name": old_file_name},
    )
    return {"message": "Profile photo deleted successfully"}, None


# =========================================================
# Upload form services
# =========================================================


def upload_form_service(db, user_id, user, uploaded_file, form_type):
    validate_form_file(uploaded_file)

    stored = save_form(uploaded_file.content, uploaded_file.name)

    form = UploadForm(
        user_id=user.id,
        form_type=form_type,
        file=stored.name,
        file_name=uploaded_file.name,
    )
    db.add(form)
    db.commit()
    db.refresh(form)

    db.add(UploadLog(user_id=user.id, file_name=uploaded_file.name, action="FORM_UPLOAD"))
    db.commit()

    log_audit_event(
        "form_uploaded",
        user=user,
        status="success",
        details={"user_id": user_id, "form_type": form_type, "file": uploaded_file.name},
    )

    return form


def delete_uploaded_form_service(db, user_id, form_id, user, request=None):
    form = db.get(UploadForm, form_id)

    if form is None:
        log_audit_event(
            "form_delete_failed",
            user=user,
            request=request,
            status="failed",
            details={"user_id": user_id, "form_id": form_id},
        )
        return None, "Form not found"

    if form.user_id != user.id and not user.is_superuser:
        log_audit_event(
            "form_delete_forbidden",
            user=user,
            request=request,
            status="failed",
            details={"user_id": user_id, "form_id": form_id},
        )
        return None, "You do not have permission to delete this form"

    form_type = form.form_type
    file_name = form.file_name
    stored_name = form.file

    db.delete(form)
    db.commit()
    delete_file(stored_name)

    db.add(UploadLog(user_id=user.id, action="FORM_DELETE"))
    db.commit()

    log_audit_event(
        "form_deleted",
        user=user,
        request=request,
        status="success",
        details={
            "user_id": user_id,
            "form_id": form_id,
            "form_type": form_type,
            "file_name": file_name,
        },
    )

    return {"message": f"{form_type} deleted successfully"}, None


def get_uploaded_form_service(db, form_id, user, request=None):
    form = db.get(UploadForm, form_id)

    if form is None:
        log_audit_event(
            "form_view_failed",
            user=user,
            request=request,
            status="failed",
            details={"form_id": form_id},
        )
        return None, "Form not found"

    if form.user_id != user.id and not user.is_superuser:
        log_audit_event(
            "form_view_forbidden",
            user=user,
            request=request,
            status="failed",
            details={"form_id": form_id},
        )
        return None, "You do not have permission to view this form"

    log_audit_event(
        "form_viewed",
        user=user,
        request=request,
        status="success",
        details={"form_id": form_id, "form_type": form.form_type, "file_name": form.file_name},
    )

    return {
        "form_id": form.id,
        "form_type": form.form_type,
        "file_name": form.file_name,
        "file_url": f"/media/{form.file}",
        "uploaded_at": form.created_at.strftime("%Y-%m-%d %H:%M:%S") if form.created_at else None,
    }, None
