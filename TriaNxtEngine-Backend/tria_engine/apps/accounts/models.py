# tria_engine/apps/accounts/models.py
#
# SQLAlchemy port of the accounts Django models. Table/column layout is
# identical to the applied Django migrations (0001_initial + 0002_user_pincode):
# same tables (accounts_user, accounts_uploadeddocument, accounts_auditlog,
# accounts_loginotp, accounts_passwordresettoken, accounts_uploadform,
# accounts_uploadlog), same nullability/unique constraints/indexes.
#
# Django-framework plumbing that has no FastAPI equivalent (auth_group /
# auth_permission / django_content_type / django_admin_log /
# django_migrations / django_session content encoding) is not recreated as
# models — see MIGRATION_NOTES.md.

from __future__ import annotations

import uuid

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow

from ..organizations.models import Organization, Role


class User(Base):
    __tablename__ = "accounts_user"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)

    # --- django.contrib.auth.models.AbstractUser columns ------------------
    password: Mapped[str] = mapped_column(String(128), nullable=False)
    last_login: Mapped[object] = mapped_column(DateTime, nullable=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    username: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    first_name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    is_staff: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    date_joined: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)

    # --- custom TriaNXT columns ------------------------------------------
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    profile_photo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    session_token: Mapped[str] = mapped_column(
        String(32), nullable=False, default=lambda: uuid.uuid4().hex
    )
    last_activity: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )
    pincode: Mapped[str] = mapped_column(String(10), nullable=False, default="")

    organization_id: Mapped[int | None] = mapped_column(
            ForeignKey("organizations_organization.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role_id: Mapped[int | None] = mapped_column(
            ForeignKey("organizations_role.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Per-user site/study scope (RBAC): JSON like
    #   {"studies": ["TNX-001"], "sites": ["SITE-01"]}
    # holding the study/site CODES the user is assigned to. NULL/empty means
    # "no site/study restriction — organization scope only" (superusers are
    # wildcard regardless). Admin assigns this via the accounts API.
    scope_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    organization: Mapped["Organization | None"] = relationship(
        "Organization", foreign_keys=[organization_id]
    )
    role: Mapped["Role | None"] = relationship("Role", foreign_keys=[role_id])

    def __repr__(self) -> str:
        return self.email or self.username


class UploadedDocument(Base):
    __tablename__ = "accounts_uploadeddocument"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    document_number: Mapped[int | None] = mapped_column(
        Integer, nullable=True, unique=True
    )
    file: Mapped[str] = mapped_column(String(100), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int] = mapped_column(BIGINT, nullable=False, default=0)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )

    organization_id: Mapped[int | None] = mapped_column(
            ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    uploaded_by_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    uploaded_by: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by_id])
    organization: Mapped["Organization | None"] = relationship(
        "Organization", foreign_keys=[organization_id]
    )


class PasswordResetToken(Base):
    __tablename__ = "accounts_passwordresettoken"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    token: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    otp_code: Mapped[str | None] = mapped_column(String(6), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    expires_at: Mapped[object] = mapped_column(DateTime, nullable=True)
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    user_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class LoginOTP(Base):
    __tablename__ = "accounts_loginotp"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    otp_code: Mapped[str] = mapped_column(String(6), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    expires_at: Mapped[object] = mapped_column(DateTime, nullable=True)
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    user_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class AuditLog(Base):
    __tablename__ = "accounts_auditlog"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(39), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    signature_token: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, default=lambda: uuid.uuid4().hex
    )
    signature_meaning: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    user_id: Mapped[int | None] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])


class UploadForm(Base):
    __tablename__ = "accounts_uploadform"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    form_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    user_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class UploadLog(Base):
    __tablename__ = "accounts_uploadlog"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    user_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
