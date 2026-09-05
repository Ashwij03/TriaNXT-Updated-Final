# tria_engine/apps/ctms/router_subjects.py
#
# Subject mirror REST surface (frontend subjectService.ts subjectsByStudy
# store — enrollment/screening records pushed via POST /subjects/sync):
#
#   GET /subjects/summary             aggregate counts/status envelope (dashboard KPIs)
#   GET /subjects/enrollment-counts   per-study enrollment counts (Studies
#                                     list / Studies dashboards). Counts are
#                                     DISTINCT subjects whose canonical status
#                                     is Screened or Enrolled, grouped by
#                                     study — the study_id/site_id JOIN the
#                                     Studies list relies on. Results are
#                                     cached (Redis when REDIS_URL is set,
#                                     in-process otherwise) and invalidated
#                                     on every POST /subjects/sync.
#   GET /subjects                     list (optional ?studyId= filter)
#   GET /subjects/{code}              one record by its study-qualified sync code
#   GET /subjects/{code}/history      merged chronological feed for the Subject
#                                     Profile timeline: status transitions
#                                     (ctms_subject_status_history) + completed
#                                     visits (ctms_visit) + consent events
#                                     (ctms_consentevent). Document-upload
#                                     events are deferred with the eISF
#                                     documents work (no documents table yet).
#   GET /subjects/{code}/consent     consent state for one subject, derived
#                                     server-side from ctms_consentevent +
#                                     ctms_icfversion (+ open re-consent
#                                     campaigns) — same semantics as the
#                                     frontend badge, no documents join.
#
# Reads are authenticated + org-scoped, with SQL-level study/site scope
# filters applied from the row scope columns (same record layer as the gap
# modules). Record bodies are the exact subject JSON the UI renders.
#
# /summary is registered BEFORE /{code} so the literal path "summary" always
# resolves to the aggregate, never to a subject detail lookup.

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.cache import cache_delete_prefix, cache_get, cache_set
from ...core.database import get_db
from ...core.timeutils import utcnow
from .common import guarded, list_records, load_row
from .models import (
    CtmsConsentEvent,
    CtmsIcfVersion,
    CtmsReConsentCampaign,
    CtmsSubject,
    CtmsSubjectStatusHistory,
    CtmsVisit,
)

router = APIRouter(prefix="/subjects", tags=["ctms-subjects"])

# Enrollment-count cache: one key per requested study scope ("*" = all
# studies). The key prefix is shared with router_sync's invalidation hook,
# so a subject registration/sync always busts the hot cache immediately.
ENROLLMENT_COUNTS_CACHE_PREFIX = "ctms:enrollment-counts:"
ENROLLMENT_COUNTS_CACHE_TTL = 15

# Statuses counted as "subjects on the roster" for the Studies list:
# registered (Screened) plus enrolled (Enrolled and onward). Kept in sync
# with the canonical buckets below; Ongoing/Completed/Withdrawn/Dropout are
# intentionally NOT part of this number (they are still in "total").
_ENROLLMENT_COUNT_STATUSES = {"Screened", "Enrolled"}


def invalidate_subject_enrollment_counts() -> None:
    """Bust every cached enrollment-count payload (called after subjects sync)."""
    cache_delete_prefix(ENROLLMENT_COUNTS_CACHE_PREFIX)

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


def _build_enrollment_counts(records: list[dict], study_id: str | None = None) -> dict:
    """Per-study DISTINCT-subject enrollment counts.

    Subjects are stored as mirrored JSON rows (one row per subject, code =
    `study::subjectId`), so this is the JSON-mirror equivalent of

        SELECT study_id,
               COUNT(DISTINCT subjects.id) FILTER (
                 WHERE canonical_status(status) IN ('Screened', 'Enrolled'))
        FROM subjects JOIN study ON ...
        GROUP BY study_id;

    The DISTINCT is on the study-qualified row code, mirroring the relational
    COUNT(DISTINCT subjects.id) semantics the Studies list specifies.
    """
    per_study: dict[str, dict] = {}
    want = str(study_id).strip() if study_id else None
    seen_codes: set[tuple[str, str]] = set()

    for record in records:
        study = str(record.get("studyId") or "").strip()
        if not study:
            continue
        if want and study != want:
            continue
        subject_id = str(record.get("subjectId") or record.get("id") or "").strip()
        code_key = (study, subject_id)
        if code_key in seen_codes:
            continue
        seen_codes.add(code_key)

        bucket = per_study.setdefault(study, {"studyId": study, "total": 0, "screened": 0, "enrolled": 0})
        bucket["total"] += 1
        status = _canonical_status(record.get("status"))
        if status == "Screened":
            bucket["screened"] += 1
            bucket["enrolled"] += 1
        elif status == "Enrolled":
            bucket["enrolled"] += 1

    return {"byStudy": per_study}


@router.get("/enrollment-counts")
@router.get("/enrollment-counts/")
def subject_enrollment_counts(
    request: Request,
    studyId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Per-study enrollment counts backing the Studies list / dashboards.

    Enrolled = DISTINCT subjects whose canonical status is Screened or
    Enrolled (the roster the Studies list reports), optionally scoped to one
    study. Responses are cached for a few seconds and the cache is busted
    by every subjects sync, so newly registered subjects appear immediately.
    """
    cache_key = ENROLLMENT_COUNTS_CACHE_PREFIX + (str(studyId).strip() or "*")
    cached = cache_get(cache_key)
    if cached is not None:
        return {"data": cached}

    payload = _build_enrollment_counts(
        list_records(db, CtmsSubject, user), study_id=studyId
    )
    payload["generatedAt"] = utcnow().isoformat()
    cache_set(cache_key, payload, ENROLLMENT_COUNTS_CACHE_TTL)
    return {"data": payload}


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


# ---------------------------------------------------------------------------
# Subject Profile — history feed + consent state (Subject Profile & Visit
# Worklist). `/subjects/{code}/history` and `/subjects/{code}/consent` are
# registered before the bare `/{code}` detail route below so the literal
# segments always win.
# ---------------------------------------------------------------------------


def _split_subject_code(code: str) -> tuple[str, str]:
    """Split a study-qualified sync code (`study::subjectId`) into parts."""
    idx = str(code).rfind("::")
    if idx <= 0:
        return "", ""
    return str(code)[:idx], str(code)[idx + 2 :]


def _status_events_for(db, user, study: str, subject_id: str) -> list[dict]:
    rows = list_records(db, CtmsSubjectStatusHistory, user)
    events = []
    for row in rows:
        if str(row.get("studyId") or "") != study:
            continue
        if str(row.get("subjectId") or row.get("id") or "") != subject_id:
            continue
        at = str(row.get("changedAt") or "") or None
        events.append(
            {
                "kind": "status",
                "title": str(row.get("status") or "Status change"),
                "detail": str(row.get("reason") or "").strip() or None,
                "at": at,
                "by": str(row.get("changedBy") or "").strip() or None,
            }
        )
    return events


def _visit_events_for(db, user, study: str, subject_id: str) -> list[dict]:
    rows = list_records(db, CtmsVisit, user)
    events = []
    for row in rows:
        if str(row.get("subjectId") or "") != subject_id:
            continue
        if str(row.get("study") or row.get("studyKey") or "") != study:
            continue
        if str(row.get("status") or "").lower() != "completed":
            continue
        at = str(row.get("actualDate") or row.get("date") or "") or None
        events.append(
            {
                "kind": "visit",
                "title": "Visit completed",
                "detail": str(row.get("visit") or "").strip() or None,
                "at": at,
                "by": None,
            }
        )
    return events


def _consent_events_for(db, user, study: str, subject_id: str) -> list[dict]:
    rows = list_records(db, CtmsConsentEvent, user)
    events = []
    for row in rows:
        if str(row.get("studyCode") or "") != study:
            continue
        if str(row.get("subjectId") or "") != subject_id:
            continue
        version = str(row.get("icfVersion") or "")
        at = str(row.get("date") or row.get("createdAt") or "") or None
        events.append(
            {
                "kind": "consent",
                "title": f"Consent signed (ICF v{version})" if version else "Consent signed",
                "detail": None,
                "at": at,
                "by": str(row.get("createdBy") or "").strip() or None,
            }
        )
    return events


@router.get("/{code}/history")
def subject_history(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Chronological subject timeline (newest first) for the Profile tab:

      status  — every recorded status transition
                 (ctms_subject_status_history rows pushed by the frontend),
      visit   — completed visits (ctms_visit rows whose status is Completed),
      consent — signed consent events (ctms_consentevent rows).

    Document-upload events are intentionally absent until the eISF
    `documents`/`document_approvals` tables land (deferred — see the gap
    report), so nothing here invents a documents join.
    """
    study, subject_id = _split_subject_code(code)
    if not study or not subject_id:
        raise HTTPException(
            status_code=400, detail="Invalid subject code. Expected study::subjectId."
        )

    events = (
        _status_events_for(db, user, study, subject_id)
        + _visit_events_for(db, user, study, subject_id)
        + _consent_events_for(db, user, study, subject_id)
    )
    events.sort(key=lambda event: str(event["at"] or ""), reverse=True)
    return {
        "data": {
            "code": code,
            "events": events[:200],
            "generatedAt": utcnow().isoformat(),
        }
    }


@router.get("/{code}/consent")
def subject_consent_status(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Consent state for one subject, derived server-side.

    Mirrors the frontend badge semantics (subjectConsentStatus.ts) against
    the mirrored consent store: an ACTIVE ICF version for the subject's
    site, the subject's consent events on it, and any open re-consent
    campaign. There is deliberately NO `documents`/`document_approvals`
    join — those tables belong to the deferred eISF & signature work.
    """
    study, subject_id = _split_subject_code(code)
    if not study or not subject_id:
        raise HTTPException(
            status_code=400, detail="Invalid subject code. Expected study::subjectId."
        )

    def _norm(value) -> str:
        return str(value or "").strip().lower()

    versions = [
        v
        for v in list_records(db, CtmsIcfVersion, user)
        if _norm(v.get("studyCode")) == _norm(study)
        and str(v.get("status") or "").lower() == "active"
    ]
    events = sorted(
        [
            e
            for e in list_records(db, CtmsConsentEvent, user)
            if _norm(e.get("studyCode")) == _norm(study)
            and str(e.get("subjectId") or "") == str(subject_id)
        ],
        key=lambda e: str(e.get("createdAt") or e.get("date") or ""),
        reverse=True,
    )
    campaigns = [
        c
        for c in list_records(db, CtmsReConsentCampaign, user)
        if _norm(c.get("studyCode")) == _norm(study)
        and str(c.get("status") or "").lower() == "open"
        and any(
            _norm(e.get("subjectId")) == _norm(subject_id) and not e.get("completedAt")
            for e in (c.get("subjects") or [])
        )
    ]

    latest = events[0] if events else None
    if campaigns:
        return {
            "data": {
                "key": "re-consent",
                "label": "Re-consent",
                "tone": "danger",
                "detail": "Consent refresh required on the active ICF version.",
                "lastEventAt": latest.get("createdAt") or latest.get("date") if latest else None,
            }
        }

    active = None
    if len(versions) == 1:
        active = versions[0]
    elif latest:
        active = next(
            (v for v in versions if str(v.get("id")) == str(latest.get("icfVersionId"))),
            None,
        )

    if not active:
        if latest:
            return {
                "data": {
                    "key": "re-consent",
                    "label": "Re-consent",
                    "tone": "danger",
                    "detail": f"Signed on an inactive ICF version (v{latest.get('icfVersion') or '?'}).",
                    "lastEventAt": latest.get("createdAt") or latest.get("date"),
                }
            }
        return {
            "data": {
                "key": "not-started",
                "label": "Not started",
                "tone": "muted",
                "detail": "No active ICF version for this site yet.",
                "lastEventAt": None,
            }
        }

    signed = next(
        (e for e in events if str(e.get("icfVersionId")) == str(active.get("id"))),
        None,
    )
    if signed:
        detail_date = str(signed.get("date") or "").strip()
        return {
            "data": {
                "key": "signed",
                "label": "Signed",
                "tone": "ok",
                "detail": f"Consent on ICF v{active.get('version')}"
                + (f" · {detail_date}" if detail_date else ""),
                "lastEventAt": signed.get("createdAt") or signed.get("date"),
            }
        }
    if events:
        return {
            "data": {
                "key": "re-consent",
                "label": "Re-consent",
                "tone": "danger",
                "detail": f"Active ICF v{active.get('version')} requires fresh consent.",
                "lastEventAt": latest.get("createdAt") or latest.get("date"),
            }
        }
    return {
        "data": {
            "key": "pending",
            "label": "Pending",
            "tone": "warn",
            "detail": f"Awaiting consent on active ICF v{active.get('version')}.",
            "lastEventAt": None,
        }
    }


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
