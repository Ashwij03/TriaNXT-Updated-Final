# tria_engine/apps/ctms/router_visits.py
#
# Visit mirror REST surface (frontend visitScheduleService.ts adminSchedules
# store — per-subject visit schedule rows pushed via POST /visits/sync):
#
#   GET /visits/summary     aggregate counts/status envelope (dashboard KPIs)
#   GET /visits             list (optional ?studyId= filter)
#   GET /visits/{code}      one schedule row by its schedule id
#
# Reads are authenticated + org-scoped with SQL-level study/site scope
# filters from the row scope columns. Bodies are the exact schedule JSON the
# calendar/visit UI renders (study, subjectId, visit, date, status, ...).
#
# /summary is registered BEFORE /{code} so the literal path "summary" always
# resolves to the aggregate, never to a visit detail lookup.

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from .common import guarded, list_records, load_row
from .models import CtmsVisit

router = APIRouter(prefix="/visits", tags=["ctms-visits"])

# Statuses that close a visit operationally (visitScheduleService's
# INACTIVE_VISIT_STATUSES) — excluded from the "upcoming" bucket.
_INACTIVE_STATUSES = {"completed", "cancelled", "missed"}


def _filter_study(records: list[dict], study_id: str | None) -> list[dict]:
    if not study_id:
        return records
    want = str(study_id).strip()
    return [
        r
        for r in records
        if str(r.get("study") or r.get("studyKey") or "").strip() == want
    ]


def _date_key(value) -> str:
    """Normalize a schedule date to YYYY-MM-DD for window comparisons."""
    return str(value or "").strip()[:10]


def _visit_summary(records: list[dict], *, today: str | None = None, window: int = 30) -> dict:
    today = today or date.today().isoformat()
    by_status: dict[str, int] = {}
    scheduled = completed = upcoming = 0
    window_end = (date.fromisoformat(today) + timedelta(days=window)).isoformat()
    for record in records:
        status = str(record.get("status") or "Unknown").strip() or "Unknown"
        by_status[status] = by_status.get(status, 0) + 1
        if status.lower() == "scheduled":
            scheduled += 1
        elif status.lower() == "completed":
            completed += 1
        if (
            _date_key(record.get("date"))
            and status.lower() not in _INACTIVE_STATUSES
            and today <= _date_key(record.get("date")) <= window_end
        ):
            upcoming += 1
    return {
        "total": len(records),
        "byStatus": by_status,
        "scheduled": scheduled,
        "completed": completed,
        "upcoming": upcoming,
        "window": window,
    }


@router.get("/summary")
@router.get("/summary/")
def visit_summary(
    request: Request,
    studyId: str | None = None,
    window: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aggregate mirror totals under a {\"data\": ...} envelope. `upcoming` is
    the count of dated, still-active visit rows within the window (default
    next 30 days — the same horizon the dashboards' Upcoming Visits list
    uses); completed/cancelled/missed rows never count as upcoming.
    """
    records = _filter_study(list_records(db, CtmsVisit, user), studyId)
    return {"data": _visit_summary(records, window=max(1, min(window, 365)))}


@router.get("")
@router.get("/")
def visit_list(
    request: Request,
    studyId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = _filter_study(list_records(db, CtmsVisit, user), studyId)
    return records


@router.get("/{code}")
def visit_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsVisit, user, code, "Visit not found.")
        return record

    return guarded(_detail)
