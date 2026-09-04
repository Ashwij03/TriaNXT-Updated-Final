# tria_engine/apps/ctms/router_subjects.py
#
# Subject mirror REST surface (frontend subjectService.ts subjectsByStudy
# store — enrollment/screening records pushed via POST /subjects/sync):
#
#   GET /subjects/summary    aggregate counts/status envelope (dashboard KPIs)
#   GET /subjects            list (optional ?studyId= filter)
#   GET /subjects/{code}     one record by its study-qualified sync code
#
# Reads are authenticated + org-scoped, with SQL-level study/site scope
# filters applied from the row scope columns (same record layer as the gap
# modules). Record bodies are the exact subject JSON the UI renders.
#
# /summary is registered BEFORE /{code} so the literal path "summary" always
# resolves to the aggregate, never to a subject detail lookup.

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from .common import guarded, list_records, load_row
from .models import CtmsSubject

router = APIRouter(prefix="/subjects", tags=["ctms-subjects"])

# Canonical subject-lifecycle buckets the Sponsor/CRO/Site Staff dashboards
# render (subjectLifecycle.ts / normalizeStatus.ts): zero-padded so the UI
# can read a stable shape without defaulting on its side.
_CANONICAL_STATUSES = [
    "Screened",
    "Enrolled",
    "Ongoing",
    "Completed",
    "Withdrawn",
    "Dropout",
]

# Legacy/alternate tokens stored by older builds are normalized into the
# same buckets the frontend normalizer uses (screen* -> Screened,
# randomiz* / enroll* -> Enrolled, discontin*/terminat* -> Dropout).
_STATUS_ALIASES = {
    "screening": "Screened",
    "enrolling": "Enrolled",
    "enrolled": "Enrolled",
    "randomized": "Enrolled",
    "randomised": "Enrolled",
    "randomization": "Enrolled",
    "randomisation": "Enrolled",
    "on-study": "Enrolled",
    "ongoing": "Ongoing",
    "completed": "Completed",
    "withdrawn": "Withdrawn",
    "withdrew": "Withdrawn",
    "dropout": "Dropout",
    "drop out": "Dropout",
    "discontinued": "Dropout",
    "terminated": "Dropout",
}


def _canonical_status(raw) -> str:
    """Map a stored subject status token onto the six canonical buckets.

    Mirrors the frontend normalizeStatus semantics so legacy tokens such as
    \"Screening\" or \"Randomized\" land in the same bucket the UI would show.
    Unknown tokens are returned verbatim (never dropped from the totals).
    """
    token = str(raw or "").strip()
    if not token:
        return "Unknown"
    lower = token.lower()
    if lower in _STATUS_ALIASES:
        return _STATUS_ALIASES[lower]
    if "screen" in lower:
        return "Screened"
    if "randomi" in lower or "enroll" in lower:
        return "Enrolled"
    if "withdraw" in lower:
        return "Withdrawn"
    if "drop" in lower or "discontin" in lower or "terminat" in lower:
        return "Dropout"
    if lower == "ongoing" or lower == "completed":
        return token[:1].upper() + token[1:]
    return token


def _filter_study(records: list[dict], study_id: str | None) -> list[dict]:
    if not study_id:
        return records
    want = str(study_id).strip()
    return [r for r in records if str(r.get("studyId") or "").strip() == want]


def _subject_summary(records: list[dict]) -> dict:
    by_status = {status: 0 for status in _CANONICAL_STATUSES}
    enrolled = 0
    for record in records:
        status = _canonical_status(record.get("status"))
        if status in by_status:
            by_status[status] += 1
            # Enrolled-stage subjects (Enrolled/Ongoing/Completed) drive the
            # enrollment-progress KPIs (normalizeStatus.isEnrolledSubjectStatus).
            if status in ("Enrolled", "Ongoing", "Completed"):
                enrolled += 1
        else:
            by_status[status] = by_status.get(status, 0) + 1
    # byStatus ordering: canonical buckets first, then any extra tokens.
    extra = {k: v for k, v in by_status.items() if k not in _CANONICAL_STATUSES}
    ordered = {k: by_status[k] for k in _CANONICAL_STATUSES}
    ordered.update(extra)
    return {
        "total": len(records),
        "byStatus": ordered,
        "enrolled": enrolled,
    }


@router.get("/summary")
@router.get("/summary/")
def subject_summary(
    request: Request,
    studyId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aggregate mirror totals under a {\"data\": ...} envelope — the same
    contract Safety Center's summary endpoint uses, so dashboard cards can
    read totals in API mode instead of counting local stores alone.
    """
    records = _filter_study(list_records(db, CtmsSubject, user), studyId)
    return {"data": _subject_summary(records)}


@router.get("")
@router.get("/")
def subject_list(
    request: Request,
    studyId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = _filter_study(list_records(db, CtmsSubject, user), studyId)
    return records


@router.get("/{code}")
def subject_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsSubject, user, code, "Subject not found.")
        return record

    return guarded(_detail)
