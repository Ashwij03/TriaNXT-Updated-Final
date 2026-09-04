# tria_engine/apps/ctms/models.py
#
# Backend persistence for the Site CTMS gap modules implemented in the
# frontend (M18 Protocol Amendments, M19 IP/Supply Accountability, M20
# IRB/IEC Submissions, M21 ICF/eConsent, M22 Vendor & Lab Management, M23
# Site Feasibility & Selection).
#
# Design note: each frontend localStorage service keeps flat JSON records
# (one list per entity). To keep the API contract byte-faithful to the
# frontend records — including nested structures such as per-site task
# packs (amendment.sites), transaction trails and excursion lists — each
# record is stored as a JSON document on a thin relational row. The
# relational columns (code, organization_id, created_at/updated_at)
# provide org scoping, ordering and auditability; the document holds the
# full record exactly as the UI renders it.
#
# Schema creation: `Base.metadata.create_all(engine)` creates these tables
# alongside the migrated accounts tables (additive only — nothing existing
# is touched). See docs/gap-assessment/ for the migration note.

from __future__ import annotations

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from tria_engine.core.database import BIGINT, Base
from tria_engine.core.timeutils import utcnow


class _CtmsRecord:
    """Shared columns for every CTMS JSON-record table (SQLAlchemy mixin).

    study_id / site_id hold the record's studyCode / siteCode (the codes the
    frontend uses) as first-class indexed columns so role scope filters for
    Site Staff / PI / CRO / Sponsor run at the SQL level instead of having
    to parse each record's JSON. Records that are not study/site-scoped
    (e.g. org-level vendor records) leave both NULL, which the scope filter
    treats as "visible to every org member".
    """

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


# --- M18 Protocol Amendments -------------------------------------------
class CtmsAmendment(_CtmsRecord, Base):
    __tablename__ = "ctms_amendment"


# --- M19 IP / Supply accountability -------------------------------------
class CtmsIpLot(_CtmsRecord, Base):
    __tablename__ = "ctms_iplot"


# --- M20 IRB / IEC submissions ------------------------------------------
class CtmsIrbSubmission(_CtmsRecord, Base):
    __tablename__ = "ctms_irbsubmission"


# --- M21 ICF / eConsent -------------------------------------------------
class CtmsIcfVersion(_CtmsRecord, Base):
    __tablename__ = "ctms_icfversion"


class CtmsConsentEvent(_CtmsRecord, Base):
    __tablename__ = "ctms_consentevent"


class CtmsReConsentCampaign(_CtmsRecord, Base):
    __tablename__ = "ctms_reconsentcampaign"


# --- M22 Vendor & Lab management ---------------------------------------
class CtmsVendor(_CtmsRecord, Base):
    __tablename__ = "ctms_vendor"


class CtmsKit(_CtmsRecord, Base):
    __tablename__ = "ctms_kit"


# --- M23 Site feasibility & selection -----------------------------------
class CtmsFeasibilityCandidate(_CtmsRecord, Base):
    __tablename__ = "ctms_feasibilitycandidate"


class CtmsFeasibilityScoring(_CtmsRecord, Base):
    """Per-study scoring criteria configuration (code == normalized study code)."""

    __tablename__ = "ctms_feasibilityscoring"


# --- Safety (AE / SAE cases) ----------------------------------------------
class CtmsAeCase(_CtmsRecord, Base):
    """Adverse-event / SAE case (Safety Center). Row scope columns hold the
    case's study code (data['study_id']) so Site Staff / PI study-scope
    filters run at the SQL level; the JSON document carries the full case
    exactly as SafetyCenter.tsx renders it.
    """

    __tablename__ = "ctms_safetyaecase"


# --- Monitoring access requests -------------------------------------------
class CtmsMonitoringRequest(_CtmsRecord, Base):
    """Date-scoped, view-only monitoring access request (MonitoringAccess.tsx).
    Records are org-level (no study/site scope columns) because the workflow
    is between requester and approver inside one organization; the requested
    site id lives in the JSON document (data['site']).
    """

    __tablename__ = "ctms_monitoringrequest"


# --- Subjects & visits (enrollment / screening mirror) ----------------------
class CtmsSubject(_CtmsRecord, Base):
    """Subject records mirrored from the frontend subjectsByStudy store
    (subjectService.ts). Row scope columns hold the subject's study code
    (data['studyId']) so SQL-level study filters apply; the JSON document is
    the exact subject row the UI renders.
    """

    __tablename__ = "ctms_subject"


class CtmsVisit(_CtmsRecord, Base):
    """Per-subject visit schedule rows mirrored from the frontend adminSchedules
    store (visitScheduleService.ts). Each row's code is the schedule id
    (`study::subjectId::visit`) and data['study']/data['studyKey'] carry the
    study code used for the row-level scope column.
    """

    __tablename__ = "ctms_visit"
