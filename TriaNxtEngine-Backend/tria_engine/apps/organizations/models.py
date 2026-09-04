# tria_engine/apps/organizations/models.py
#
# SQLAlchemy port of the Django models — table/column layout identical to
# the Django migrations (organizations_organization, organizations_role).

from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tria_engine.core.database import BIGINT, Base


class Organization(Base):
    __tablename__ = "organizations_organization"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    roles: Mapped[list["Role"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return self.name


class Role(Base):
    __tablename__ = "organizations_role"

    id: Mapped[int] = mapped_column(BIGINT, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    organization_id: Mapped[int] = mapped_column(
        BIGINT, ForeignKey("organizations_organization.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(back_populates="roles")

    def __repr__(self) -> str:
        return f"{self.name} ({self.organization.name if self.organization else '-'})"
