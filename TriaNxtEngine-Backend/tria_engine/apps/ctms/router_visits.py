# tria_engine/apps/ctms/router_visits.py
#
# Visit mirror REST surface (frontend visitScheduleService.ts adminSchedules
# store — per-subject visit schedule rows pushed via POST /visits/sync):
#
#   GET /visits              list (optional ?studyId= filter)
#   GET /visits/{code}       one schedule row by its schedule id
#
# Reads are authenticated + org-scoped with SQL-level study/site scope
# filters from the row scope columns. Bodies are the exact schedule JSON the
# calendar/visit UI renders (study, subjectId, visit, date, status, ...).

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from .common import guarded, list_records, load_row
from .models import CtmsVisit

router = APIRouter(prefix="/visits", tags=["ctms-visits"])


@router.get("")
@router.get("/")
def visit_list(
    request: Request,
    studyId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = list_records(db, CtmsVisit, user)
    if studyId:
        want = str(studyId).strip()
        records = [
            r
            for r in records
            if str(r.get("study") or r.get("studyKey") or "").strip() == want
        ]
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
