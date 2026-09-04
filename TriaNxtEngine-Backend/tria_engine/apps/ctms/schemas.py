# tria_engine/apps/ctms/schemas.py
#
# Pydantic request bodies for the Site CTMS gap-module API. Field names are
# camelCase and deliberately mirror the payloads the frontend localStorage
# services produce, so the API adapter layer passes the exact same objects.
# extra fields are ignored (frontend payloads carry supersets in places).

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class _Body(BaseModel):
    model_config = ConfigDict(extra="ignore")


# --- M18 Amendments -----------------------------------------------------
# The required-field checks are enforced inside create_amendment (so the
# business-rule messages match the frontend localStorage service exactly);
# the request body therefore accepts optional strings and delegates
# validation to the logic layer.
class AmendmentCreateBody(_Body):
    studyCode: str = ""
    amendmentNumber: str = ""
    version: str = ""
    classification: str = ""
    effectiveDate: str = ""
    summary: str = ""
    impactedSiteCodes: list[str] = []
    reConsentRequired: bool = False
    binderUpdateRequired: bool = False
    trainingRequired: bool = False
    irbSubmissionRef: str = ""


class SyncBody(_Body):
    """Bulk-sync payload: a full collection of frontend records."""

    records: list[dict] = []


class CompleteTaskBody(_Body):
    siteCode: str
    taskId: str


class IrbRefBody(_Body):
    irbSubmissionRef: str = ""


# --- M19 IP / Supply ----------------------------------------------------
class ShipmentBody(_Body):
    studyCode: str
    siteCode: str
    lotNumber: str
    kitNumber: str = ""
    quantity: Any = None


class ReceiveBody(_Body):
    condition: str = "Acceptable"
    temperature: Any = None


class DispenseBody(_Body):
    subjectId: str
    quantity: Any = None
    visitCode: str = ""


class DispositionBody(_Body):
    disposition: str
    witness: str = ""


class ReturnBody(_Body):
    quantity: Any = None
    reason: str = ""


class DestroyBody(_Body):
    witness: str = ""


# --- M20 IRB / IEC ------------------------------------------------------
class IrbCreateBody(_Body):
    studyCode: str
    siteCode: str = ""
    type: str
    title: str = ""
    committee: str = ""
    linkedRef: str = ""
    reviewCycleMonths: Any = None


class DecisionBody(_Body):
    outcome: str
    note: str = ""


class CorrespondenceBody(_Body):
    message: str


# --- M21 ICF / eConsent -------------------------------------------------
class IcfVersionBody(_Body):
    studyCode: str
    siteCode: str
    language: str = "English"
    version: str
    amendmentId: str = ""
    witnessRequired: bool = False


class ConsentEventBody(_Body):
    studyCode: str
    subjectId: str
    icfVersionId: str
    witness: str = ""
    date: str = ""


class CampaignBody(_Body):
    studyCode: str
    amendmentId: str
    icfVersionId: str
    dueDate: str = ""
    subjectIds: list[str] = []


class CampaignSubjectBody(_Body):
    subjectId: str


# --- M22 Vendor & Lab ---------------------------------------------------
class VendorBody(_Body):
    name: str
    type: str
    scope: str = ""
    contractRef: str = ""
    contractExpiryDate: str = ""
    contactName: str = ""
    contactEmail: str = ""
    status: str = "Onboarding"
    notes: str = ""


class OffboardBody(_Body):
    reason: str = ""


class KitBody(_Body):
    vendorId: str
    studyCode: str = ""
    subjectId: str
    visitCode: str
    kitType: str
    specimenId: str = ""
    collectedLocation: str = "Site"


class AdvanceKitBody(_Body):
    nextStatus: str
    location: str = ""


# --- M23 Feasibility ----------------------------------------------------
class CandidateCreateBody(_Body):
    studyCode: str = ""
    institution: str
    contactName: str = ""
    email: str = ""
    phone: str = ""
    department: str = ""
    notes: str = ""


class CandidatePatchBody(_Body):
    studyCode: str | None = None
    institution: str | None = None
    contactName: str | None = None
    email: str | None = None
    phone: str | None = None
    department: str | None = None
    notes: str | None = None


class QuestionnaireResponseBody(_Body):
    patientPopulation: Any = None
    competingTrials: bool = False
    competingTrialDetails: str = ""
    infrastructure: str = ""
    staffAvailability: str = ""


class ScoresBody(_Body):
    scores: dict[str, Any] = {}


class DecideBody(_Body):
    decision: str
    rationale: str = ""


class ScoringConfigBody(_Body):
    studyCode: str = ""
    criteria: list[dict[str, Any]] = []
    minScore: Any = None


# --- Safety (AE / SAE cases) ----------------------------------------------
# SafetyCenter.tsx posts {study_id, subject_ref, description, is_serious};
# the response record is the full case document the page's table renders.
class AeCaseCreateBody(_Body):
    study_id: str = ""
    subject_ref: str = ""
    description: str = ""
    is_serious: bool = False
    causality: str = ""
    outcome: str = ""


class AeCasePatchBody(_Body):
    """Partial update — only supplied fields are merged into the case."""

    subject_ref: str | None = None
    description: str | None = None
    is_serious: bool | None = None
    causality: str | None = None
    outcome: str | None = None
    status: str | None = None
    pv_case_reference: str | None = None


class ReconcileBody(_Body):
    pv_case_reference: str = ""


# --- Monitoring access requests -------------------------------------------
class MonitoringRequestCreateBody(_Body):
    """MonitoringAccess.tsx posts {site (org id), start_date, end_date,
    reason?}. The requester + role are resolved server-side from the
    authenticated session (client-supplied identity is never trusted)."""

    site: str = ""
    start_date: str = ""
    end_date: str = ""
    reason: str = ""


class NoteBody(_Body):
    note: str = ""


# --- AI Review ------------------------------------------------------------
class AiDecisionBody(_Body):
    decision: str = ""
    rationale: str = ""
