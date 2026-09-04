# tria_engine/apps/subscriptions/models.py
#
# SQLAlchemy schema models for the dormant subscriptions app tables
# (subscriptions_plan, subscriptions_subscription). See MIGRATION_NOTES.md
# — no FastAPI router is migrated; models exist so Alembic reproduces the
# existing tables.

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow

from ..organizations.models import Organization


class Plan(Base):
    __tablename__ = "subscriptions_plan"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    max_studies: Mapped[int] = mapped_column(Integer, nullable=False)
    max_users: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_limit_gb: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions_subscription"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Active")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    auto_renewal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    organization_id: Mapped[int] = mapped_column(
            ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    plan_id: Mapped[int] = mapped_column(
            ForeignKey("subscriptions_plan.id"),
        nullable=False,
        index=True,
    )

    organization: Mapped["Organization"] = relationship("Organization")
    plan: Mapped["Plan"] = relationship("Plan")
