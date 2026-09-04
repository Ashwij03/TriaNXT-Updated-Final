# tria_engine/apps/licensing/models.py
#
# SQLAlchemy schema models for the dormant licensing app tables
# (licensing_referralcode, licensing_referralusage,
# licensing_licenseentitlement, licensing_referralprogramsettings).
# See MIGRATION_NOTES.md — no FastAPI router is migrated for this dormant
# app; models exist so Alembic reproduces the existing tables.

from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow

from ..accounts.models import User


class ReferralCode(Base):
    __tablename__ = "licensing_referralcode"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    redemption_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)

    user_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    user: Mapped["User"] = relationship("User")


class ReferralUsage(Base):
    __tablename__ = "licensing_referralusage"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    redeemed_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    referee_days_granted: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    referrer_days_granted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    referee_license_start_date: Mapped[object] = mapped_column(DateTime, nullable=False)
    referee_license_end_date: Mapped[object] = mapped_column(DateTime, nullable=False)

    referee_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    referrer_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_id: Mapped[int] = mapped_column(
            ForeignKey("licensing_referralcode.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    referee: Mapped["User"] = relationship("User", foreign_keys=[referee_id])
    referrer: Mapped["User"] = relationship("User", foreign_keys=[referrer_id])
    code: Mapped["ReferralCode"] = relationship("ReferralCode")


class LicenseEntitlement(Base):
    __tablename__ = "licensing_licenseentitlement"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    subscription_end_date: Mapped[object] = mapped_column(DateTime, nullable=True)
    referral_extension_end_date: Mapped[object] = mapped_column(DateTime, nullable=True)
    referral_extension_days_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_checked_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    user_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    referral_extension_source_id: Mapped[int | None] = mapped_column(
            ForeignKey("licensing_referralusage.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user: Mapped["User"] = relationship("User")


class ReferralProgramSettings(Base):
    __tablename__ = "licensing_referralprogramsettings"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    referrer_bonus_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)
