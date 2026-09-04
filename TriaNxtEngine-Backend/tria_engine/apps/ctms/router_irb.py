# tria_engine/apps/ctms/router_irb.py
#
# M20 IRB / IEC Submission REST surface (mirrors irbSubmissionService.ts):
#   GET  /irb/?studyCode=                      GET /irb/{code}
#   POST /irb/                                 {studyCode, siteCode, type, title, ...}
#   POST /irb/{code}/submit
#   POST /irb/{code}/start-review
#   POST /irb/{code}/decision                  {outcome, note}
#   POST /irb/{code}/conditions/{index}/resolve
#   POST /irb/{code}/correspondence            {message}

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from . import schemas
from .common import (
    actor_name,
    create_record,
    filter_study,
    guarded,
    list_records,
    load_row,
    save_record,
)
from .irb_logic import (
    add_correspondence,
    create_submission,
    record_decision,
    resolve_condition,
    start_review,
    submit_submission,
)
from .models import CtmsIrbSubmission

router = APIRouter(prefix="/irb", tags=["ctms-irb"])


@router.get("")
@router.get("/")
def irb_list(
    request: Request,
    studyCode: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: filter_study(list_records(db, CtmsIrbSubmission, user), studyCode))


@router.post("")
@router.post("/")
def irb_create(
    body: schemas.IrbCreateBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = create_submission(db, user, body.model_dump(), actor_name(user))
        return create_record(db, CtmsIrbSubmission, user, record["id"], record), 201

    return guarded(_create)


@router.get("/{code}")
def irb_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsIrbSubmission, user, code, "Submission not found.")
        return record

    return guarded(_detail)


@router.post("/{code}/submit")
def irb_submit(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _submit():
        row, record = load_row(db, CtmsIrbSubmission, user, code, "Submission not found.")
        submit_submission(record, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_submit)


@router.post("/{code}/start-review")
def irb_start_review(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _start():
        row, record = load_row(db, CtmsIrbSubmission, user, code, "Submission not found.")
        start_review(record, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_start)


@router.post("/{code}/decision")
def irb_decision(
    code: str,
    body: schemas.DecisionBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _decide():
        row, record = load_row(db, CtmsIrbSubmission, user, code, "Submission not found.")
        record_decision(db, user, record, body.outcome, body.note, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_decide)


@router.post("/{code}/conditions/{index}/resolve")
def irb_resolve_condition(
    code: str,
    index: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _resolve():
        row, record = load_row(db, CtmsIrbSubmission, user, code, "Submission not found.")
        resolve_condition(record, index, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_resolve)


@router.post("/{code}/correspondence")
def irb_correspondence(
    code: str,
    body: schemas.CorrespondenceBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _correspond():
        row, record = load_row(db, CtmsIrbSubmission, user, code, "Submission not found.")
        add_correspondence(record, body.message, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_correspond)
