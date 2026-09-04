# tria_engine/apps/monitoring/models.py
#
# SQLAlchemy schema model for the dormant monitoring app table
# (monitoring_monitoringaccessrequest). See MIGRATION_NOTES.md — the
# Django app was never wired into INSTALLED_APPS/urls.py and no FastAPI
# router is migrated; the model exists so Alembic reproduces the table the
# existing database contains.

from __future__ import annotations

from datetime import date

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow

from ..accounts.models import User
from ..organizations.models import Organization


class MonitoringAccessRequest(Base):
    __tablename__ = "monitoring_monitoringaccessrequest"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    requester_role_label: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    decision_note: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    decided_at: Mapped[object] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[object] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    requested_by_id: Mapped[int] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approved_by_id: Mapped[int | None] = mapped_column(
            ForeignKey("accounts_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    site_id: Mapped[int] = mapped_column(
            ForeignKey("organizations_organization.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    requested_by: Mapped["User"] = relationship("User", foreign_keys=[requested_by_id])
    approved_by: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by_id])
    site: Mapped["Organization"] = relationship("Organization")
