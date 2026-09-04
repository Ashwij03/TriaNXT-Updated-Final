# tria_engine/apps/billing/models.py
#
# SQLAlchemy schema models for the billing tables (billing_plantier,
# billing_subscription, billing_subscriptionevent, billing_paymenttransaction).
#
# The billing Django app is NOT wired into urls.py/INSTALLED_APPS today
# (dormant), and its FastAPI router is intentionally NOT migrated (see
# MIGRATION_NOTES.md). These models exist so Alembic can reproduce the
# tables the existing database already contains and the schema stays
# loadable — no runtime code uses them yet.

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow

from ..organizations.models import Organization


class PlanTier(Base):
    __tablename__ = "billing_plantier"
    __table_args__ = (
        Index("single_default_plan_tier", "is_default", unique=True, sqlite_where=text("is_default")),
    )

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    max_studies: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_users: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_limit_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    features: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class BillingSubscription(Base):
    # Class is named BillingSubscription (not Subscription) because the
    # dormant subscriptions app maps a separate class of the same name into
    # the same SQLAlchemy registry; the table name is unchanged.
    __tablename__ = "billing_subscription"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING_PAYMENT")
    start_date: Mapped[object] = mapped_column(Date, nullable=True)
    end_date: Mapped[object] = mapped_column(Date, nullable=True)
    auto_renewal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    max_studies_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_users_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_limit_gb_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    organization_id: Mapped[int] = mapped_column(
            ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    plan_id: Mapped[int] = mapped_column(
            ForeignKey("billing_plantier.id"),
        nullable=False,
        index=True,
    )

    organization: Mapped["Organization"] = relationship("Organization")
    plan: Mapped["PlanTier"] = relationship("PlanTier")


class SubscriptionEvent(Base):
    __tablename__ = "billing_subscriptionevent"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # DB column name is "metadata" (JSONField); "metadata_" avoids SQLAlchemy's
    # reserved Declarative attribute name while keeping the table column.
    metadata_: Mapped[str] = mapped_column("metadata", Text, nullable=False, default="{}")
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)

    subscription_id: Mapped[int] = mapped_column(
            ForeignKey("billing_subscription.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    subscription: Mapped["BillingSubscription"] = relationship("BillingSubscription")


class PaymentTransaction(Base):
    __tablename__ = "billing_paymenttransaction"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    gateway: Mapped[str] = mapped_column(String(20), nullable=False, default="razorpay")
    gateway_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    gateway_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    gateway_signature: Mapped[str | None] = mapped_column(String(512), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="CREATED")
    raw_webhook_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    subscription_id: Mapped[int] = mapped_column(
            ForeignKey("billing_subscription.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[int] = mapped_column(
            ForeignKey("billing_plantier.id"),
        nullable=False,
        index=True,
    )

    subscription: Mapped["BillingSubscription"] = relationship("BillingSubscription")
    plan: Mapped["PlanTier"] = relationship("PlanTier")
