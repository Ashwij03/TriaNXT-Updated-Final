# tria_engine/apps/accounts/router.py
#
# Port of tria_engine/apps/accounts/views.py (all 23 endpoints) onto a
# single FastAPI APIRouter with the same URL paths under /api/accounts/.
# Response bodies, status codes and error messages are reproduced from the
# DRF views; datetimes are serialized with the same naive-ISO8601 encoding
# Django's JSONRenderer produced for the SQLite-backed datetimes.
#
# Not carried over (dev-time DRF machinery, no API-contract impact):
#   * the "API validation" response-schema checker headers
#     (X-Response-Schema-Validated / X-Response-Schema-Type),
#   * the per-request endpoint-availability pre-check (FastAPI's own 405 /
#     422 semantics apply),
#   * the always-false request-count rate-limit probe (it never fired).

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from tria_engine.core.config import settings
from tria_engine.core.database import get_db
from tria_engine.core.security import SESSION_COOKIE_NAME
from tria_engine.core.session_store import create_session, delete_session
from tria_engine.core.timeutils import utcnow

from . import schemas
from .audit import log_audit_event
from .dependencies import get_current_user
from .models import AuditLog, UploadedDocument, User
from .schemas import request_schema_error, validate_email_format
from .services import (
    RequestMeta,
    UploadedFileLike,
    change_password_user,
    create_audit_log,
    create_user,
    delete_document_by_number,
    delete_profile_photo,
    delete_uploaded_form_service,
    forgot_password_user,
    get_all_users_service,
    get_audit_logs_service,
    get_document_by_number,
    get_profile_photo,
    get_uploaded_form_service,
    integrity_check_service,
    login_user,
    login_user_with_mfa,
    make_request_meta,
    report_compromised_token,
    reset_password_user,
    upload_document,
    upload_form_service,
    upload_profile_photo,
    verify_login_otp,
)
from ..organizations.models import Organization, Role

logger = logging.getLogger("tria_engine")

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


# ---------------------------------------------------------------------------
# response helpers
# ---------------------------------------------------------------------------


def _json_default(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def json_response(data: dict | list, status: int = 200) -> JSONResponse:
    import json

    return JSONResponse(content=json.loads(json.dumps(data, default=_json_default)), status_code=status)


def _request_meta(request: Request) -> RequestMeta:
    client = request.client
    ip = client.host if client else None
    return make_request_meta(ip=ip, path=request.url.path, method=request.method)


def _schema_failure(field_errors: dict[str, list[str]]) -> JSONResponse:
    return json_response(request_schema_error(field_errors), status=400)


def _int_field_errors(value, *, min_value=None, max_value=None, field="page_number"):
    """Replicates DRF IntegerField validation messages."""
    if value is None or value == "":
        return {field: ["This field is required."]}
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return {field: ["A valid integer is required."]}
    if min_value is not None and parsed < min_value:
        return {field: [f"Ensure this value is greater than or equal to {min_value}."]}
    if max_value is not None and parsed > max_value:
        return {field: [f"Ensure this value is less than or equal to {max_value}."]}
    return None


def _pagination(request: Request):
    params = request.query_params
    page_number = params.get("page_number", "1")
    page_size = params.get("page_size", "10")

    errors = {}
    err = _int_field_errors(page_number, min_value=1, field="page_number")
    if err:
        errors.update(err)
    err = _int_field_errors(page_size, min_value=1, max_value=100, field="page_size")
    if err:
        errors.update(err)
    if errors:
        return None, None, _schema_failure(errors)
    return int(page_number), int(page_size), None


def _paginate(db: Session, rows: list, page_number: int, page_size: int) -> dict:
    total_count = len(rows)
    total_pages = max(1, -(-total_count // page_size)) if total_count else 1
    # Django Paginator.get_page clamps out-of-range page numbers to the last page.
    if page_number > total_pages:
        page_number = total_pages
    start = (page_number - 1) * page_size
    page_items = rows[start : start + page_size]
    return {
        "page_number": page_number,
        "page_size": page_size,
        "total_count": total_count,
        "total_pages": total_pages,
        "results": page_items,
    }


def _client_ip(request: Request) -> str | None:
    client = request.client
    return client.host if client else None


def _user_brief(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "organization": user.organization_id,
        "role": user.role_id,
        "role_name": user.role.name if user.role else None,
        "scope_data": user.scope_data,
    }


def _login_user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "is_active": user.is_active,
        "role": user.role.name if user.role else None,
        "organization_name": user.organization.name if user.organization else None,
        "organization": user.organization.id if user.organization else None,
    }


def _document_payload(doc: UploadedDocument) -> dict:
    return {
        "document_number": doc.document_number,
        "original_name": doc.original_name,
        "content_type": doc.content_type,
        "file_size": doc.file_size,
        "category": doc.category,
        "organization": doc.organization.name if doc.organization else None,
        "uploaded_by": doc.uploaded_by.email if doc.uploaded_by else None,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }


def _audit_payload(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "user": log.user.username if log.user else "Unknown User",
        "action": log.action,
        "ip_address": log.ip_address,
        "description": log.description,
        "timestamp": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else None,
        "signature_token": str(log.signature_token),
        "signature_meaning": log.signature_meaning,
    }


def _file_like(upload: UploadFile | None) -> UploadedFileLike | None:
    if upload is None:
        return None
    content = upload.file.read() if hasattr(upload.file, "read") else None
    if content is None:
        content = b""
    return UploadedFileLike(
        name=upload.filename or "",
        size=len(content),
        content_type=upload.content_type,
        content=content,
    )


# ---------------------------------------------------------------------------
# helpers for org/role resolution used by RegisterAPI
# ---------------------------------------------------------------------------

ROLE_NAME_MAP = {
    "SiteStaff": "SiteStaff",
    "Site Staff": "SiteStaff",
    "Site PI": "PI",
    "PI": "PI",
    "Principal Investigator": "PI",
    "CRO": "CRO",
    "Sponsor": "Sponsor",
    "Admin": "Admin",
}


def _default_roles_for_org(db: Session, org: Organization) -> Role:
    for rn in ["SiteStaff", "PI", "CRO", "Sponsor", "Admin"]:
        existing = db.execute(
            select(Role).where(Role.name == rn, Role.organization_id == org.id)
        ).scalar_one_or_none()
        if existing is None:
            db.add(Role(name=rn, organization_id=org.id))
    db.commit()
    role = db.execute(
        select(Role).where(Role.name == "SiteStaff", Role.organization_id == org.id)
    ).scalar_one_or_none()
    return role


# ===========================================================================
# Endpoints
# ===========================================================================


@router.get("/users/")
@router.get("/users")
def user_list(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """GET /api/accounts/users/ — paginated user list (superuser sees all)."""
    page_number, page_size, err_response = _pagination(request)
    if err_response:
        return err_response

    if user.is_superuser:
        users = get_all_users_service(db)
    else:
        users = db.execute(select(User).where(User.organization_id == user.organization_id)).scalars().all()

    payload = _paginate(db, users, page_number, page_size)
    payload["results"] = [_user_brief(u) for u in payload["results"]]

    create_audit_log(
        db,
        user=user,
        action="VIEW_USERS",
        ip_address=_client_ip(request),
        description=f"{user.username} viewed users list",
        signature_meaning="User electronically signed for viewing users",
    )
    return json_response(payload, status=200)


@router.put("/users/{user_id}/scope/")
@router.put("/users/{user_id}/scope")
@router.patch("/users/{user_id}/scope/")
@router.patch("/users/{user_id}/scope")
def user_scope_update(
    user_id: int,
    body: schemas.ScopeUpdateBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """PUT/PATCH /api/accounts/users/{user_id}/scope/ — Admin assigns a
    user's site/study scope (RBAC spec 4.1/4.2 + Section 5 G7/G8).

    Superuser only: 403 for any other role. The scope is persisted on the
    target User row's scope_data, and because every request reloads the
    user from the session, the very next request from that user is filtered
    at the SQL level — no re-login required (G8). Empty lists clear the
    restriction back to plain organization scope.
    """
    if not getattr(user, "is_superuser", False):
        return json_response(
            {"detail": "Forbidden: only Administrators may assign user scope."},
            status=403,
        )
    target = (
        db.execute(select(User).where(User.id == user_id)).scalars().first()
    )
    if target is None:
        return json_response({"detail": "User not found."}, status=404)

    studies = sorted({str(s).strip() for s in (body.studies or []) if str(s).strip()})
    sites = sorted({str(s).strip() for s in (body.sites or []) if str(s).strip()})
    target.scope_data = {"studies": studies, "sites": sites}
    db.add(target)
    db.commit()

    create_audit_log(
        db,
        user=user,
        action="USER_SCOPE_UPDATED",
        ip_address=_client_ip(request),
        description=(
            f"{user.username} assigned scope to {target.username}: "
            f"studies={studies}, sites={sites}"
        ),
        signature_meaning="User electronically signed for scope assignment",
    )
    return json_response(
        {
            "id": target.id,
            "email": target.email,
            "username": target.username,
            "role_name": target.role.name if target.role else None,
            "scope_data": target.scope_data,
        },
        status=200,
    )


@router.post("/register/")
@router.post("/register")
def register(body: schemas.RegisterBody, request: Request, db: Session = Depends(get_db)):
    try:
        data = body.model_dump()

        # -- Resolve organization ----------------------------------------
        org_value = data.get("organization")
        org_name = data.get("organization_name")

        if isinstance(org_value, int):
            org = db.get(Organization, org_value)
            if org is None:
                org = None
        else:
            org = None

        if org is None and org_name and isinstance(org_name, str) and org_name.strip():
            org = db.execute(
                select(Organization).where(Organization.name == org_name.strip())
            ).scalar_one_or_none()
            if org is None:
                org = Organization(name=org_name.strip())
                db.add(org)
                db.commit()
                db.refresh(org)
            data["organization"] = org.id
        elif org is None and not db.execute(select(Organization.id)).first():
            org = Organization(name="Default Organization")
            db.add(org)
            db.commit()
            db.refresh(org)
            data["organization"] = org.id
        else:
            if org_value is None:
                first_org = db.execute(select(Organization).order_by(Organization.id)).scalars().first()
                if first_org is not None:
                    data["organization"] = first_org.id

        # -- Resolve role -------------------------------------------------
        role_value = data.get("role")
        org_id = data.get("organization")
        org_obj = db.get(Organization, org_id) if isinstance(org_id, int) else None

        if isinstance(role_value, int):
            role_obj = db.get(Role, role_value)
            if role_obj is None:
                role_obj = None
        elif isinstance(role_value, str) and role_value.strip():
            mapped_name = ROLE_NAME_MAP.get(role_value.strip(), role_value.strip())
            if org_obj is not None:
                role_obj = db.execute(
                    select(Role).where(Role.name == mapped_name, Role.organization_id == org_obj.id)
                ).scalar_one_or_none()
                if role_obj is None:
                    role_obj = Role(name=mapped_name, organization_id=org_obj.id)
                    db.add(role_obj)
                    db.commit()
                    db.refresh(role_obj)
                data["role"] = role_obj.id
        elif not db.execute(select(Role.id)).first() and org_obj is not None:
            role_obj = _default_roles_for_org(db, org_obj)
            if role_obj is not None:
                data["role"] = role_obj.id

        # -- Field-level validation (mirrors RegisterSerializer) ----------
        errors: dict[str, list[str]] = {}

        for field in ["username", "email", "password", "confirm_password", "first_name", "last_name"]:
            value = data.get(field)
            if value in (None, ""):
                errors[field] = [f"{field} is required"]

        # username constraints (CharField min/max_length)
        username = data.get("username")
        if username and not errors.get("username"):
            if len(username) < 3:
                errors.setdefault("username", []).append("Ensure this field has at least 3 characters.")
            elif len(username) > 30:
                errors.setdefault("username", []).append("Ensure this field has no more than 30 characters.")
        email = data.get("email")
        if email and not validate_email_format(email):
            errors.setdefault("email", []).append("Enter a valid email address.")
        for f, lo, hi in [("password", 8, 50), ("confirm_password", 8, 50), ("first_name", 2, 50), ("last_name", 2, 50)]:
            v = data.get(f)
            if v and not errors.get(f):
                if len(v) < lo:
                    errors.setdefault(f, []).append(f"Ensure this field has at least {lo} characters.")
                elif len(v) > hi:
                    errors.setdefault(f, []).append(f"Ensure this field has no more than {hi} characters.")

        if isinstance(data.get("organization"), int):
            org_row = db.get(Organization, data["organization"])
            if org_row is None:
                errors.setdefault("organization", []).append('Invalid pk "{}" - object does not exist.'.format(data["organization"]))
            else:
                data["_org_obj"] = org_row
        else:
            if data.get("organization") is None:
                errors.setdefault("organization", []).append("This field is required.")

        if isinstance(data.get("role"), int):
            role_row = db.get(Role, data["role"])
            if role_row is None:
                errors.setdefault("role", []).append('Invalid pk "{}" - object does not exist.'.format(data["role"]))
            else:
                data["_role_obj"] = role_row
                if org_row is not None and role_row.organization_id != org_row.id:
                    errors.setdefault("non_field_errors", []).append("Role does not belong to selected organization")
        else:
            if data.get("role") is None:
                errors.setdefault("role", []).append("This field is required.")

        # duplicates
        if email and db.execute(select(User.id).where(User.email == email)).first():
            errors.setdefault("email", []).append("A user with this email already exists.")
        if username and db.execute(select(User.id).where(User.username == username)).first():
            errors.setdefault("username", []).append("This username is already taken.")

        if data.get("password") != data.get("confirm_password"):
            errors.setdefault("non_field_errors", []).append("Passwords do not match")

        if errors:
            schema_error = request_schema_error(errors)
            # RegisterAPI returns 409 Conflict when the error touches email/username.
            if "email" in errors or "username" in errors:
                return json_response(schema_error, status=409)
            return json_response(schema_error, status=400)

        # -- Create the user ----------------------------------------------
        user = create_user(
            db,
            {
                "username": data["username"],
                "email": data["email"],
                "password": data["password"],
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "organization": data["organization"],
                "role": data["role"],
            },
        )

        create_audit_log(
            db,
            user=user,
            action="REGISTER",
            ip_address=_client_ip(request),
            description=f"{user.username} registered into system",
            signature_meaning="User electronically signed registration",
        )
        log_audit_event("user_registered", user=user, request=_request_meta(request))

        return json_response({"message": "User registered", "user_id": user.id}, status=201)

    except Exception as exc:
        return json_response({"message": str(exc)}, status=500)


@router.post("/login/")
@router.post("/login")
def login(body: schemas.LoginBody, request: Request, db: Session = Depends(get_db)):
    data = body.model_dump()

    # field-level validation mirroring LoginSerializer
    errors: dict[str, list[str]] = {}
    if data.get("email") in (None, ""):
        errors["email"] = ["This field is required."]
    elif not validate_email_format(data["email"]):
        errors["email"] = ["Enter a valid email address."]
    if data.get("password") in (None, ""):
        errors["password"] = ["This field is required."]
    elif len(data["password"]) < 8:
        errors["password"] = ["Ensure this field has at least 8 characters."]
    elif len(data["password"]) > 50:
        errors["password"] = ["Ensure this field has no more than 50 characters."]
    if errors:
        return _schema_failure(errors)

    user, error = login_user(db, email=data["email"], password=data["password"], request=_request_meta(request))

    if user is not None:
        session_key = create_session(db, user.id)
        create_audit_log(
            db,
            user=user,
            action="LOGIN",
            ip_address=_client_ip(request),
            description=f"{user.username} logged into system",
            signature_meaning="User electronically signed for login",
        )
        response = json_response(
            {"message": "Login successful", "user": _login_user_payload(user)}, status=200
        )
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_key,
            max_age=settings.SESSION_COOKIE_AGE,
            path="/",
            httponly=True,
            samesite="lax",
            secure=(settings.env == "production"),
        )
        return response
    else:
        create_audit_log(
            db,
            user=None,
            action="FAILED_LOGIN",
            ip_address=_client_ip(request),
            description=f"Failed login attempt for {data['email']}",
            signature_meaning="Failed electronic signature attempt",
        )
        return json_response({"message": "Invalid Credentials"}, status=401)


@router.post("/logout/")
@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    create_audit_log(
        db,
        user=user,
        action="LOGOUT",
        ip_address=_client_ip(request),
        description=f"{user.username} logged out",
        signature_meaning="User electronically signed logout",
    )
    session_key = request.cookies.get(SESSION_COOKIE_NAME)
    delete_session(db, session_key)
    response = json_response({"message": "Logged out successfully"}, status=200)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return response


@router.post("/login-mfa/")
@router.post("/login-mfa")
def login_mfa(body: schemas.LoginMFABody, request: Request, db: Session = Depends(get_db)):
    data = body.model_dump()

    errors: dict[str, list[str]] = {}
    if data.get("email") in (None, ""):
        errors["email"] = ["This field is required."]
    elif not validate_email_format(data["email"]):
        errors["email"] = ["Enter a valid email address."]
    if data.get("password") in (None, ""):
        errors["password"] = ["This field is required."]
    elif len(data["password"]) < 8:
        errors["password"] = ["Ensure this field has at least 8 characters."]
    elif len(data["password"]) > 50:
        errors["password"] = ["Ensure this field has no more than 50 characters."]
    if errors:
        return _schema_failure(errors)

    result, error = login_user_with_mfa(db, **data, request=_request_meta(request))
    if error:
        create_audit_log(
            db,
            user=None,
            action="FAILED_MFA_LOGIN",
            ip_address=_client_ip(request),
            description="Failed MFA login attempt",
            signature_meaning="Failed MFA electronic signature",
        )
        return json_response({"message": error}, status=401)

    create_audit_log(
        db,
        user=None,
        action="MFA_LOGIN_INITIATED",
        ip_address=_client_ip(request),
        description="MFA login initiated",
        signature_meaning="MFA authentication initiated",
    )
    # Parity: Django's login() inside login_user() established a session
    # cookie on this response even before OTP verification.
    if isinstance(result, dict) and result.get("email"):
        from sqlalchemy import select as _select

        mfa_user = db.execute(_select(User).where(User.email == result["email"])).scalar_one_or_none()
        if mfa_user is not None:
            session_key = create_session(db, mfa_user.id)
            response = json_response(result, status=200)
            response.set_cookie(
                key=SESSION_COOKIE_NAME,
                value=session_key,
                max_age=settings.SESSION_COOKIE_AGE,
                path="/",
                httponly=True,
                samesite="lax",
                secure=(settings.env == "production"),
            )
            return response
    return json_response(result, status=200)


@router.post("/verify-otp/")
@router.post("/verify-otp")
def verify_otp(body: schemas.VerifyLoginOTPBody, request: Request, db: Session = Depends(get_db)):
    data = body.model_dump()

    errors: dict[str, list[str]] = {}
    if data.get("email") in (None, ""):
        errors["email"] = ["This field is required."]
    if data.get("otp_code") in (None, ""):
        errors["otp_code"] = ["This field is required."]
    elif not str(data["otp_code"]).isdigit():
        errors["otp_code"] = ["OTP must contain only numbers"]
    elif not (100000 <= int(data["otp_code"]) <= 999999):
        errors["otp_code"] = ["OTP must be between 100000 and 999999"]
    if errors:
        return _schema_failure(errors)

    user, error = verify_login_otp(
        db, email=data["email"], otp_code=str(data["otp_code"]), request=_request_meta(request)
    )
    if error:
        create_audit_log(
            db,
            user=None,
            action="FAILED_OTP_VERIFICATION",
            ip_address=_client_ip(request),
            description="Invalid OTP verification attempt",
            signature_meaning="Failed OTP verification signature",
        )
        return json_response({"message": error}, status=400)

    if user is None:
        return json_response({"message": "Invalid user"}, status=400)

    user.last_activity = utcnow()
    db.commit()

    create_audit_log(
        db,
        user=user,
        action="MFA_VERIFIED",
        ip_address=_client_ip(request),
        description=f"{user.username} verified MFA OTP successfully",
        signature_meaning="User electronically signed MFA verification",
    )
    # Parity: Django's login(request, user) in the original view created a
    # session cookie on this response.
    session_key = create_session(db, user.id)
    response = json_response({"message": "MFA login successful", "user_id": user.id}, status=200)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_key,
        max_age=settings.SESSION_COOKIE_AGE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=(settings.env == "production"),
    )
    return response


@router.post("/forgot-password/")
@router.post("/forgot-password")
def forgot_password(body: schemas.ForgotPasswordBody, request: Request, db: Session = Depends(get_db)):
    try:
        data = body.model_dump()
        errors: dict[str, list[str]] = {}
        if data.get("email") in (None, ""):
            errors["email"] = ["This field is required."]
        if errors:
            return _schema_failure(errors)

        result, error = forgot_password_user(db, email=data["email"], request=_request_meta(request))
        if error:
            return json_response({"message": error}, status=404)

        user = db.execute(select(User).where(User.email == data["email"])).scalar_one_or_none()
        if user is not None:
            create_audit_log(
                db,
                user=user,
                action="FORGOT_PASSWORD",
                ip_address=_client_ip(request),
                description=f"{user.username} requested forgot password",
                signature_meaning="User electronically signed forgot password request",
            )

        return json_response(
            {"message": "Password reset instructions sent successfully", "data": result}, status=200
        )
    except Exception:
        return json_response({"message": "Internal Server Error"}, status=500)


@router.post("/reset-password/")
@router.post("/reset-password")
def reset_password(body: schemas.ResetPasswordBody, request: Request, db: Session = Depends(get_db)):
    try:
        data = body.model_dump()
        errors: dict[str, list[str]] = {}
        if data.get("email") in (None, ""):
            errors["email"] = ["This field is required."]
        if data.get("otp_code") in (None, ""):
            errors["otp_code"] = ["This field is required."]
        if data.get("new_password") in (None, ""):
            errors["new_password"] = ["This field is required."]
        if errors:
            return _schema_failure(errors)

        user, error = reset_password_user(
            db,
            email=data["email"],
            otp_code=str(data["otp_code"]),
            new_password=data["new_password"],
            request=_request_meta(request),
        )
        if error:
            return json_response({"message": error}, status=400)

        if user is not None:
            create_audit_log(
                db,
                user=user,
                action="RESET_PASSWORD",
                ip_address=_client_ip(request),
                description="User password reset successfully",
                signature_meaning="User electronically signed for password reset",
            )

        return json_response({"message": "Password reset successful"}, status=200)
    except Exception:
        return json_response({"message": "Internal Server Error"}, status=500)


@router.post("/change-password/")
@router.post("/change-password")
def change_password(
    body: schemas.ChangePasswordBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = body.model_dump()

    errors: dict[str, list[str]] = {}
    if data.get("email") in (None, ""):
        errors["email"] = ["This field is required."]
    if data.get("current_password") in (None, ""):
        errors["current_password"] = ["This field is required."]
    if data.get("new_password") in (None, ""):
        errors["new_password"] = ["This field is required."]
    if data.get("confirm_password") in (None, ""):
        errors["confirm_password"] = ["This field is required."]
    if data.get("new_password") != data.get("confirm_password"):
        errors.setdefault("non_field_errors", []).append("New passwords do not match")
    if data.get("current_password") == data.get("new_password"):
        errors.setdefault("non_field_errors", []).append("New password must be different from current password")
    if errors:
        return _schema_failure(errors)

    try:
        target = db.execute(select(User).where(User.email == data["email"])).scalar_one_or_none()
        if target is None:
            return json_response({"message": "User not found with this email"}, status=400)

        if target.id != user.id and not user.is_superuser:
            return json_response({"message": "You don't have permission"}, status=403)

        result, error = change_password_user(
            db,
            user=target,
            current_password=data["current_password"],
            new_password=data["new_password"],
            request=_request_meta(request),
        )
        if error:
            create_audit_log(
                db,
                user=target,
                action="FAILED_PASSWORD_CHANGE",
                ip_address=_client_ip(request),
                description=f"Failed password change attempt for {target.username}",
                signature_meaning="Failed electronic signature for password change",
            )
            return json_response({"message": error}, status=400)

        create_audit_log(
            db,
            user=target,
            action="PASSWORD_CHANGE",
            ip_address=_client_ip(request),
            description=f"{target.username} changed password",
            signature_meaning="User electronically signed for password change",
        )
        return json_response({"message": "Password changed successfully", "data": result}, status=200)
    except Exception as exc:
        return json_response({"message": f"Error: {str(exc)}"}, status=500)


@router.post("/report-compromised-token/")
@router.post("/report-compromised-token")
def report_compromised_token(
    request: Request,
    token_type: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not token_type:
        return json_response({"message": "token_type is required"}, status=400)
    if token_type not in ("login_otp", "password_reset"):
        return json_response(
            request_schema_error({"token_type": ['"{}" is not a valid choice.'.format(token_type)]}),
            status=400,
        )

    result, error = report_compromised_token(db, user=user, token_type=token_type, request=_request_meta(request))
    if error:
        return json_response({"message": error}, status=400)

    create_audit_log(
        db,
        user=user,
        action="COMPROMISED_TOKEN_REPORTED",
        ip_address=_client_ip(request),
        description=f"{user.username} reported compromised token",
        signature_meaning="User electronically signed compromised token report",
    )
    return json_response(result, status=200)


@router.get("/check-session/")
@router.get("/check-session")
def check_session(
    request: Request,
    username: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not username:
        return json_response({"message": "username is required"}, status=400)

    target = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if target is None:
        return json_response({"message": "User not found"}, status=404)

    if target.last_activity is None:
        return json_response({"message": "No active session found"}, status=401)

    inactive_time = utcnow() - target.last_activity
    if inactive_time > timedelta(minutes=5):
        create_audit_log(
            db,
            user=target,
            action="SESSION_EXPIRED",
            ip_address=_client_ip(request),
            description=f"{target.username} session expired due to inactivity",
            signature_meaning="Automatic session timeout recorded",
        )
        return json_response({"message": "Session expired. Auto logoff successful."}, status=401)

    target.last_activity = utcnow()
    db.commit()

    create_audit_log(
        db,
        user=target,
        action="SESSION_ACTIVE",
        ip_address=_client_ip(request),
        description=f"{target.username} session checked and active",
        signature_meaning="Session activity verified",
    )
    return json_response({"message": "Session active", "last_activity": target.last_activity}, status=200)


@router.post("/integrity-check/")
@router.post("/integrity-check")
def integrity_check(
    body: schemas.IntegrityBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        data = body.model_dump()
        errors: dict[str, list[str]] = {}
        if data.get("message") in (None, ""):
            errors["message"] = ["This field is required."]
        if errors:
            return _schema_failure(errors)

        response = integrity_check_service(data["message"])
        log_audit_event("integrity_check_completed", user=user, request=_request_meta(request), status="success")
        create_audit_log(
            db,
            user=user,
            action="INTEGRITY_CHECK",
            ip_address=_client_ip(request),
            description=f"{user.username} performed integrity check",
            signature_meaning="Integrity verification electronically signed",
        )
        return json_response(response, status=200)
    except Exception:
        return json_response({"message": "Internal Server Error"}, status=500)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

ALLOWED_FILTERS = ["document_number", "original_name", "content_type", "category"]
ALLOWED_SORT_FIELDS = [
    "document_number",
    "original_name",
    "file_size",
    "created_at",
    "updated_at",
    "category",
    "content_type",
    "organization",
    "uploaded_by",
]


@router.get("/documents/")
@router.get("/documents")
def document_list(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    params = request.query_params
    page_number, page_size, err_response = _pagination(request)
    if err_response:
        return err_response

    # -- filtering (FilterSerializer) -------------------------------------
    filter_by = params.get("filter_by") or ""
    filter_value = params.get("filter_value") or ""
    errors: dict[str, list[str]] = {}
    if filter_by and filter_by not in ALLOWED_FILTERS:
        errors["filter_by"] = [f"Invalid filter field. Allowed values: {', '.join(ALLOWED_FILTERS)}"]
    if filter_by and not filter_value:
        errors["filter_value"] = ["Filter value is required when filter_by is provided."]
    if errors:
        return _schema_failure(errors)

    # -- sorting (SortingSerializer) --------------------------------------
    sort_by = params.get("sort_by") or ""
    sort_order = params.get("sort_order") or "asc"
    if sort_by and sort_by not in ALLOWED_SORT_FIELDS:
        errors["sort_by"] = [f"Invalid sort field. Allowed values: {', '.join(ALLOWED_SORT_FIELDS)}"]
    if sort_order and sort_order.lower() not in ("asc", "desc"):
        errors["sort_order"] = ["Sort order must be either 'asc' or 'desc'"]
    if errors:
        return _schema_failure(errors)

    stmt = select(UploadedDocument)
    if not user.is_superuser:
        stmt = stmt.where(UploadedDocument.organization_id == user.organization_id)

    if filter_by and filter_value:
        column = getattr(UploadedDocument, filter_by)
        stmt = stmt.where(column == filter_value)

    desc = sort_order.lower() == "desc"
    if sort_by:
        if sort_by == "organization":
            from ..organizations.models import Organization

            stmt = stmt.join(Organization, UploadedDocument.organization_id == Organization.id)
            col = Organization.name
        elif sort_by == "uploaded_by":
            from .models import User as U

            stmt = stmt.join(U, UploadedDocument.uploaded_by_id == U.id)
            col = U.email
        else:
            col = getattr(UploadedDocument, sort_by)
        stmt = stmt.order_by(col.desc() if desc else col.asc())
    else:
        stmt = stmt.order_by(UploadedDocument.document_number)

    rows = db.execute(stmt).scalars().all()
    payload = _paginate(db, rows, page_number, page_size)
    payload["results"] = [_document_payload(doc) for doc in payload["results"]]

    create_audit_log(
        db,
        user=user,
        action="VIEW_DOCUMENTS",
        ip_address=_client_ip(request),
        description=f"{user.username} viewed document list",
        signature_meaning="Document viewing electronically signed",
    )
    return json_response(payload, status=200)


@router.post("/documents/upload/")
@router.post("/documents/upload")
async def document_upload(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Form(...),
    uploaded_by: str = Form(...),
    category: str = Form("general"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    errors: dict[str, list[str]] = {}
    # DocumentUploadSerializer field-level checks
    if user_id is None:
        errors["user_id"] = ["This field is required."]
    if uploaded_by in (None, ""):
        errors["uploaded_by"] = ["This field is required."]
    elif not validate_email_format(uploaded_by):
        errors["uploaded_by"] = ["Enter a valid email address."]
    if file is None:
        errors["file"] = ["This field is required."]
    if errors:
        return _schema_failure(errors)

    if uploaded_by != user.email:
        return json_response({"message": "uploaded_by must match the authenticated user's email"}, status=400)

    try:
        fl = _file_like(file)
        document, error = upload_document(
            db=db,
            user_id=user_id,
            uploaded_file=fl,
            uploaded_by=user,
            category=category,
            organization=user.organization_id,
            request=_request_meta(request),
        )
        if error:
            return json_response({"message": error}, status=400)

        create_audit_log(
            db,
            user=user,
            action="UPLOAD_DOCUMENT",
            ip_address=_client_ip(request),
            description=f"{user.username} uploaded document {document.document_number}",
            signature_meaning="Document upload electronically signed",
        )
        return json_response(
            {"message": "Document uploaded successfully", "data": _document_payload(document)},
            status=201,
        )
    except Exception as exc:
        from .file_validators import FileValidationError

        if isinstance(exc, FileValidationError):
            return json_response({"message": "Validation failed", "errors": exc.message}, status=400)
        logger.exception("document upload failed")
        return json_response({"message": "Internal Server Error"}, status=500)


@router.get("/documents/download/")
@router.get("/documents/download")
def document_download(
    request: Request,
    document_number: int = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if document_number is None:
        return json_response({"message": "document_number is required"}, status=400)
    document, error = get_document_by_number(
        db=db, document_number=document_number, user=user, request=_request_meta(request)
    )
    if error:
        return json_response({"message": error}, status=404)

    from fastapi.responses import Response
    from tria_engine.core.storage import absolute_path

    path = absolute_path(document.file)
    if not path.is_file():
        return json_response({"message": "Document not found"}, status=404)

    content = path.read_bytes()
    from urllib.parse import quote

    safe_name = quote(document.original_name)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.delete("/documents/delete/")
@router.delete("/documents/delete")
def document_delete(
    request: Request,
    user_id: int = Query(None),
    document_number: int = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user_id is None:
        return json_response({"message": "user_id is required"}, status=400)
    if document_number is None:
        return json_response({"message": "document_number is required"}, status=400)

    result, error = delete_document_by_number(
        db=db, user_id=user_id, document_number=document_number, user=user, request=_request_meta(request)
    )
    if error:
        return json_response({"message": error}, status=404)

    create_audit_log(
        db,
        user=user,
        action="DELETE_DOCUMENT",
        ip_address=_client_ip(request),
        description=f"{user.username} deleted document {document_number}",
        signature_meaning="Document deletion electronically signed",
    )
    return json_response(result, status=200)


# ---------------------------------------------------------------------------
# Profile photo
# ---------------------------------------------------------------------------


@router.post("/profile-photo/upload/")
@router.post("/profile-photo/upload")
async def profile_photo_upload(
    request: Request,
    photo: UploadFile = File(...),
    email: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        errors: dict[str, list[str]] = {}
        if photo is None:
            errors["photo"] = ["This field is required."]
        if email in (None, ""):
            errors["email"] = ["This field is required."]
        if errors:
            return _schema_failure(errors)

        # ProfilePhotoUploadSerializer.validate_photo (extensions only)
        import os

        ext = os.path.splitext(photo.filename or "")[1].lower()
        if ext not in [".png", ".jpg", ".jpeg"]:
            return json_response(
                request_schema_error(
                    {
                        "photo": [
                            "Only PNG, JPG, and JPEG image files are allowed. PDF, DOC and TXT files are not supported."
                        ]
                    }
                ),
                status=400,
            )

        if email != user.email:
            return json_response({"message": "email must match the authenticated user's email"}, status=400)

        fl = _file_like(photo)
        updated_user, error = upload_profile_photo(
            db=db, user=user, uploaded_file=fl, request=_request_meta(request)
        )
        if error:
            return json_response({"message": error}, status=400)

        create_audit_log(
            db,
            user=user,
            action="PROFILE_PHOTO_UPLOAD",
            ip_address=_client_ip(request),
            description=f"{user.username} uploaded profile photo",
            signature_meaning="Profile photo upload electronically signed",
        )
        return json_response(
            {
                "message": "Profile photo uploaded successfully",
                "profile_photo": f"/media/{updated_user.profile_photo}" if updated_user.profile_photo else None,
            },
            status=200,
        )
    except Exception:
        return json_response({"message": "Internal Server Error"}, status=500)


@router.get("/profile-photo/view/")
@router.get("/profile-photo/view")
def profile_photo_view(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    file, error = get_profile_photo(db=db, user=user, request=_request_meta(request))
    if error:
        return json_response({"message": error}, status=404)

    create_audit_log(
        db,
        user=user,
        action="VIEW_PROFILE_PHOTO",
        ip_address=_client_ip(request),
        description=f"{user.username} viewed profile photo",
        signature_meaning="Profile photo viewed electronically",
    )
    return json_response({"name": file["name"], "url": file["url"]}, status=200)


@router.delete("/profile-photo/delete/")
@router.delete("/profile-photo/delete")
def profile_photo_delete(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result, error = delete_profile_photo(db=db, user=user, request=_request_meta(request))
    if error:
        return json_response({"message": error}, status=404)

    create_audit_log(
        db,
        user=user,
        action="DELETE_PROFILE_PHOTO",
        ip_address=_client_ip(request),
        description=f"{user.username} deleted profile photo",
        signature_meaning="Profile photo deletion electronically signed",
    )
    return json_response(result, status=200)


# ---------------------------------------------------------------------------
# Upload forms
# ---------------------------------------------------------------------------


@router.post("/upload-form/")
@router.post("/upload-form")
async def upload_form(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Form(...),
    form_type: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        errors: dict[str, list[str]] = {}
        if user_id is None:
            errors["user_id"] = ["This field is required."]
        if form_type in (None, ""):
            errors["form_type"] = ["This field is required."]
        if file is None:
            errors["file"] = ["This field is required."]
        if errors:
            return _schema_failure(errors)
        if form_type not in ("IMAGE", "LAB_REPORT"):
            return json_response(
                request_schema_error({"form_type": [f'"{form_type}" is not a valid choice.']}), status=400
            )

        fl = _file_like(file)
        form = upload_form_service(db, user_id, user, fl, form_type)

        create_audit_log(
            db,
            user=user,
            action="UPLOAD_FORM",
            ip_address=_client_ip(request),
            description=f"{user.username} uploaded {form_type} form",
            signature_meaning="Form upload electronically signed",
        )
        return json_response(
            {"message": f"{form_type} uploaded successfully", "form_id": form.id, "file": f"/media/{form.file}"},
            status=201,
        )
    except Exception as exc:
        from .file_validators import FileValidationError

        if isinstance(exc, FileValidationError):
            return json_response({"message": "Validation failed", "errors": exc.message}, status=400)
        return json_response({"message": "Internal Server Error"}, status=500)


@router.delete("/upload-form/delete/")
@router.delete("/upload-form/delete")
def delete_upload_form(
    body: schemas.DeleteUploadFormBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = body.model_dump()
    errors: dict[str, list[str]] = {}
    if data.get("user_id") in (None, ""):
        errors["user_id"] = ["This field is required."]
    if data.get("form_id") in (None, ""):
        errors["form_id"] = ["This field is required."]
    if errors:
        return _schema_failure(errors)

    result, error = delete_uploaded_form_service(
        db, data["user_id"], data["form_id"], user, request=_request_meta(request)
    )
    if error:
        return json_response({"message": error}, status=400)

    create_audit_log(
        db,
        user=user,
        action="FORM_DELETE",
        ip_address=_client_ip(request),
        description=f"{user.username} deleted uploaded form",
        signature_meaning="Form deletion electronically signed",
    )
    return json_response(result, status=200)


@router.get("/upload-form/view/")
@router.get("/upload-form/view")
def view_upload_form(
    request: Request,
    form_id: int = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    errors: dict[str, list[str]] = {}
    if form_id is None:
        errors["form_id"] = ["This field is required."]
    if errors:
        return _schema_failure(errors)

    result, error = get_uploaded_form_service(db, form_id, user, request=_request_meta(request))
    if error:
        return json_response({"message": error}, status=404)

    create_audit_log(
        db,
        user=user,
        action="FORM_VIEW",
        ip_address=_client_ip(request),
        description=f"{user.username} viewed uploaded form",
        signature_meaning="Form viewing electronically signed",
    )
    return json_response(result, status=200)


@router.get("/audit-logs/")
@router.get("/audit-logs")
def audit_logs(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    page_number, page_size, err_response = _pagination(request)
    if err_response:
        return err_response

    logs = get_audit_logs_service(db)
    payload = _paginate(db, logs, page_number, page_size)
    payload["results"] = [_audit_payload(log) for log in payload["results"]]

    create_audit_log(
        db,
        user=user,
        action="VIEW_AUDIT_LOGS",
        ip_address=_client_ip(request),
        description=f"{user.username} viewed audit logs",
        signature_meaning="Audit logs viewed electronically",
    )
    return json_response(payload, status=200)
