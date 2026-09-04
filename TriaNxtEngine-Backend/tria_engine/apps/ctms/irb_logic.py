# tria_engine/apps/ctms/irb_logic.py
#
# M20 IRB / IEC Submission & Continuing Review (spec 6.27) — Python port of
# src/shared/services/irbSubmissionService.ts.

from __future__ import annotations

from datetime import datetime, timezone

from .common import CtmsError, audit, iso_now, new_id, stamp

IRB_TYPES = ["Initial", "Amendment", "Continuing Review", "Reportable event"]

IRB_STATUSES = [
    "Preparing",
    "Submitted",
    "Under Review",
    "Approved",
    "Contingent",
    "Rejected",
]

DEFAULT_REVIEW_CYCLE_MONTHS = 12

DECISION_OUTCOMES = ["Approved", "Contingent", "Rejected"]


def _add_months_iso(value: str, months: int) -> str:
    """JS addMonths: new Date(date).setUTCMonth(+months) -> ISO string."""
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    year = date.year + (date.month - 1 + months) // 12
    month = (date.month - 1 + months) % 12 + 1
    day = date.day
    # clamp day to the target month length (JS Date does the same)
    import calendar

    max_day = calendar.monthrange(year, month)[1]
    if day > max_day:
        day = max_day
    shifted = datetime(year, month, day, date.hour, date.minute, date.second, date.microsecond, tzinfo=timezone.utc)
    return shifted.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def create_submission(db, user, payload: dict, actor: str) -> dict:
    if not payload.get("studyCode") or not payload.get("type"):
        raise CtmsError("studyCode and submission type are required.")
    submission_type = payload.get("type")
    if submission_type not in IRB_TYPES:
        raise CtmsError("A valid submission type is required.")
    if submission_type == "Reportable event" and not payload.get("linkedRef"):
        raise CtmsError(
            "Reportable-event submissions must link the originating Finding / SAE reference."
        )

    now = iso_now()
    try:
        cycle = int(payload.get("reviewCycleMonths") or 0)
    except (TypeError, ValueError):
        cycle = 0
    submission = {
        "id": new_id("IRB-", upper=True),
        "studyCode": payload.get("studyCode"),
        "siteCode": payload.get("siteCode") or "",
        "type": submission_type,
        "title": payload.get("title") or "",
        "committee": payload.get("committee") or "",
        "linkedRef": payload.get("linkedRef") or "",
        "status": "Preparing",
        "submittedAt": None,
        "approvedAt": None,
        "nextDueDate": None,
        "reviewCycleMonths": cycle or DEFAULT_REVIEW_CYCLE_MONTHS,
        "conditions": [],
        "correspondence": [],
        "outcomeNote": "",
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": actor,
        "history": [{"action": "IRB_SUBMISSION_CREATED", "at": now, "by": actor or "Unknown"}],
    }
    audit(
        db,
        user,
        "IRB_SUBMISSION_CREATED",
        details={"submissionId": submission["id"], "studyCode": submission["studyCode"], "type": submission_type},
    )
    return submission


def submit_submission(submission: dict, actor: str) -> dict:
    if submission["status"] != "Preparing":
        raise CtmsError("Only Preparing submissions can be submitted.")
    submission["status"] = "Submitted"
    submission["submittedAt"] = iso_now()
    submission["updatedAt"] = submission["submittedAt"]
    submission["updatedBy"] = actor
    submission["history"] = stamp(submission, "IRB_SUBMITTED", actor)
    return submission


def start_review(submission: dict, actor: str) -> dict:
    if submission["status"] != "Submitted":
        raise CtmsError("Only Submitted submissions can move to Under Review.")
    submission["status"] = "Under Review"
    submission["updatedAt"] = iso_now()
    submission["updatedBy"] = actor
    submission["history"] = stamp(submission, "IRB_UNDER_REVIEW", actor)
    return submission


def record_decision(db, user, submission: dict, outcome: str, note: str, actor: str) -> dict:
    if outcome not in DECISION_OUTCOMES:
        raise CtmsError("Outcome must be Approved, Contingent or Rejected.")
    if submission["status"] != "Under Review":
        raise CtmsError("Only Under Review submissions can receive a decision.")

    submission["status"] = outcome
    submission["outcomeNote"] = note or ""
    submission["updatedAt"] = iso_now()
    submission["updatedBy"] = actor

    if outcome == "Approved":
        submission["approvedAt"] = submission["updatedAt"]
        submission["nextDueDate"] = _add_months_iso(submission["updatedAt"], int(submission.get("reviewCycleMonths") or 12))
        submission["conditions"] = []
    elif outcome == "Contingent":
        submission["conditions"] = [
            {"text": line.strip(), "resolved": False, "resolvedAt": None}
            for line in (note or "").split("\n")
            if line.strip()
        ]
    submission["history"] = stamp(submission, "IRB_DECISION:" + outcome, actor)
    audit(
        db,
        user,
        "IRB_SUBMISSION_DECISION",
        details={"submissionId": submission.get("id"), "outcome": outcome},
    )
    return submission


def resolve_condition(submission: dict, condition_index, actor: str) -> dict:
    if submission["status"] != "Contingent":
        raise CtmsError("Only contingent approvals carry resolvable conditions.")
    try:
        condition = submission["conditions"][int(condition_index)]
    except (TypeError, ValueError, IndexError):
        raise CtmsError("Condition not found.")
    condition["resolved"] = True
    condition["resolvedAt"] = iso_now()
    submission["updatedAt"] = condition["resolvedAt"]
    submission["updatedBy"] = actor
    submission["history"] = stamp(submission, "IRB_CONDITION_RESOLVED", actor)
    return submission


def add_correspondence(submission: dict, message: str, actor: str) -> dict:
    if not str(message or "").strip():
        raise CtmsError("Correspondence message is required.")
    if submission["status"] == "Rejected":
        raise CtmsError("Rejected submissions are closed to new correspondence.")
    submission.setdefault("correspondence", []).append(
        {"date": iso_now(), "from": actor or "Unknown", "message": message}
    )
    submission["updatedAt"] = iso_now()
    submission["updatedBy"] = actor
    submission["history"] = stamp(submission, "CORRESPONDENCE_ADDED", actor)
    return submission


def has_open_conditions(submission: dict) -> bool:
    return any(not c.get("resolved") for c in (submission.get("conditions") or []))


def is_continuing_review_due(submission: dict) -> bool:
    if submission.get("status") != "Approved" or not submission.get("nextDueDate"):
        return False
    try:
        due = datetime.fromisoformat(str(submission["nextDueDate"]).replace("Z", "+00:00"))
    except ValueError:
        return False
    return due.timestamp() * 1000 <= __import__("time").time() * 1000
