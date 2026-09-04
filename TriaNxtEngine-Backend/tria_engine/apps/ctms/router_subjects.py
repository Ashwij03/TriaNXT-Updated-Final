# tria_engine/apps/ctms/router_subjects.py
#
# Subject mirror REST surface (frontend subjectService.ts subjectsByStudy
# store — enrollment/screening records pushed via POST /subjects/sync):
#
#   GET /subjects            list (optional ?studyId= filter)
#   GET /subjects/{code}     one record by its study-qualified sync code
#
# Reads are authenticated + org-scoped, with SQL-level study/site scope
# filters applied from the row scope columns (same record layer as the gap
# modules). Record bodies are the exact subject JSON the UI renders.

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from .common import guarded, list_records, load_row
from .models import CtmsSubject

router = APIRouter(prefix="/subjects", tags=["ctms-subjects"])


@router.get("")
@router.get("/")
def subject_list(
    request: Request,
    studyId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = list_records(db, CtmsSubject, user)
    if studyId:
        want = str(studyId).strip()
        records = [r for r in records if str(r.get("studyId") or "").strip() == want]
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
