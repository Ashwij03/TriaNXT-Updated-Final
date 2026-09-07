# tria_engine/apps/reporting/models.py
#
# SQLAlchemy models for the Custom Report Builder, Standard Report Center,
# Financials and Milestones (Varsha's scope). Two groups:
#
# 1) Relational tables:
#      report_template      — saved Report-Builder configurations
#      finance_budget       — site budget lines (baseline amount)
#      finance_milestone    — contractual/study milestones (weighted)
#      finance_invoice      — invoices
#      finance_payout       — payout requests + approvals
#
# 2) Read-only mirrors that power report data sources which do not exist
#    anywhere else in the backend (the app keeps clinical data in
#    frontend localStorage stores and the ctms JSON mirrors):
#      report_deviation     — protocol-deviation records
#      report_studydocument — expected/uploaded study documents (the eISF
#                             Completeness Index reads this)
#
# Every table carries organization_id + study_id/site_id scope columns and
# created_at/updated_at, mirroring the ctms JSON-record tables so the same
# org / study / site scope filters apply at the SQL level.

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow

MONEY = Numeric(14, 2)


# ---------------------------------------------------------------------------
# Read-only reporting mirrors (JSON documents, like the ctms record layer)
# ---------------------------------------------------------------------------


class _MirrorMixin:
    """Shared columns for the reporting mirror tables (deviation/document)."""

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    organization_id: Mapped[int | None] = mapped_column(
        BIGINT,
        ForeignKey("organizations_organization.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    study_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


class ReportDeviation(_MirrorMixin, Base):
    """Protocol-deviation records (reporting mirror)."""

    __tablename__ = "report_deviation"


class ReportStudyDocument(_MirrorMixin, Base):
    """Expected study documents with upload state (eISF Completeness Index)."""

    __tablename__ = "report_studydocument"


# ---------------------------------------------------------------------------
# Report templates (Custom Report Builder)
# ---------------------------------------------------------------------------


class ReportTemplate(Base):
    __tablename__ = "report_template"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organization_id: Mapped[int | None] = mapped_column(
        BIGINT,
        ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    owner_id: Mapped[int | None] = mapped_column(
        BIGINT,
        ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    study_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    # Builder configuration: {"source", "columns", "filters", "aggregate",
    # "groupBy"} exactly as the /reports/run payload accepts it.
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


# ---------------------------------------------------------------------------
# Financials & milestones
# ---------------------------------------------------------------------------


class FinanceBudget(Base):
    __tablename__ = "finance_budget"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organization_id: Mapped[int | None] = mapped_column(
        BIGINT,
        ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    study_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    # Baseline (contracted) budget for the site/study.
    baseline_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    period_label: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="Active")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


class FinanceMilestone(Base):
    __tablename__ = "finance_milestone"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    organization_id: Mapped[int | None] = mapped_column(
        BIGINT,
        ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    study_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="Contractual")
    # Relative weight used for the completion percentage (0..100 per row).
    weight: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=1)
    target_date: Mapped[object] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="Not Started"
    )
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


class FinanceInvoice(Base):
    __tablename__ = "finance_invoice"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    number: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    organization_id: Mapped[int | None] = mapped_column(
        BIGINT,
        ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    study_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    budget_code: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="Draft")
    period_label: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    issue_date: Mapped[object] = mapped_column(Date, nullable=True)
    due_date: Mapped[object] = mapped_column(Date, nullable=True)
    created_by: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


class FinancePayout(Base):
    __tablename__ = "finance_payout"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    organization_id: Mapped[int | None] = mapped_column(
        BIGINT,
        ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    study_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    site_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    budget_code: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    invoice_code: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    reason: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    # Pending -> Approved -> Paid (or Rejected).
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="Pending")
    requested_by: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    requested_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    decided_by: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    decided_at: Mapped[object] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


# A tiny helper so callers can iterate the finance tables generically.
FINANCE_TABLES = (FinanceBudget, FinanceMilestone, FinanceInvoice, FinancePayout)
