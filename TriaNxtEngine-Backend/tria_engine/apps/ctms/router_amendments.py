# tria_engine/apps/ctms/router_amendments.py
#
# M18 Protocol Amendments REST surface (mirrors amendmentService.ts):
#   GET    /amendments/?studyCode=
#   POST   /amendments/
#   GET    /amendments/{code}
#   POST   /amendments/{code}/assess
#   POST   /amendments/{code}/publish
#   POST   /amendments/{code}/complete-task      {siteCode, taskId}
#   POST   /amendments/{code}/sites/{siteCode}/compliant
#   POST   /amendments/{code}/close
#   PATCH  /amendments/{code}/irb-ref            {irbSubmissionRef}
#   DELETE /amendments/{code}

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from . import schemas
from .amendments_logic import (
    close_amendment,
    complete_site_task,
    create_amendment,
    delete_amendment,
    mark_site_compliant,
    publish_amendment,
    run_impact_assessment,
    set_irb_submission_ref,
)
from .common import (
    CtmsError,
    actor_name,
    audit,
    create_record,
    enforce_for_model,
    filter_study,
    guarded,
    list_records,
    load_row,
    save_record,
)
from .models import CtmsAmendment

router = APIRouter(prefix="/amendments", tags=["ctms-amendments"])


@router.get("")
@router.get("/")
def amendment_list(
    request: Request,
    studyCode: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: filter_study(list_records(db, CtmsAmendment, user), studyCode))


@router.post("")
@router.post("/")
def amendment_create(
    body: schemas.AmendmentCreateBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = create_amendment(db, user, body.model_dump(), actor_name(user))
        return create_record(db, CtmsAmendment, user, record["id"], record), 201

    return guarded(_create)


@router.get("/{code}")
def amendment_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        return record

    return guarded(_detail)


@router.post("/{code}/assess")
def amendment_assess(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _assess():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        run_impact_assessment(record, actor_name(user))
        audit(
            db,
            user,
            "AMENDMENT_IMPACT_ASSESSMENT",
            details={"amendmentId": record.get("id"), "impactedSites": len(record.get("impactedSiteCodes") or [])},
        )
        return save_record(db, user, row, record)

    return guarded(_assess)


@router.post("/{code}/publish")
def amendment_publish(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _publish():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        publish_amendment(record, actor_name(user))
        audit(
            db,
            user,
            "AMENDMENT_PUBLISHED",
            details={"amendmentId": record.get("id"), "amendmentNumber": record.get("amendmentNumber")},
        )
        return save_record(db, user, row, record)

    return guarded(_publish)


@router.post("/{code}/complete-task")
def amendment_complete_task(
    code: str,
    body: schemas.CompleteTaskBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _complete():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        complete_site_task(record, body.siteCode, body.taskId, actor_name(user))
        audit(
            db,
            user,
            "AMENDMENT_SITE_TASK_COMPLETED",
            details={"amendmentId": record.get("id"), "siteCode": body.siteCode, "taskId": body.taskId},
        )
        return save_record(db, user, row, record)

    return guarded(_complete)


@router.post("/{code}/sites/{site_code}/compliant")
def amendment_site_compliant(
    code: str,
    site_code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _compliant():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        mark_site_compliant(record, site_code, actor_name(user))
        audit(
            db,
            user,
            "AMENDMENT_SITE_COMPLIANT",
            details={"amendmentId": record.get("id"), "siteCode": site_code},
        )
        return save_record(db, user, row, record)

    return guarded(_compliant)


@router.post("/{code}/close")
def amendment_close(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _close():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        close_amendment(record, actor_name(user))
        audit(
            db,
            user,
            "AMENDMENT_CLOSED",
            details={"amendmentId": record.get("id"), "amendmentNumber": record.get("amendmentNumber")},
        )
        return save_record(db, user, row, record)

    return guarded(_close)


@router.patch("/{code}/irb-ref")
def amendment_irb_ref(
    code: str,
    body: schemas.IrbRefBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _ref():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        set_irb_submission_ref(record, body.irbSubmissionRef, actor_name(user))
        audit(
            db,
            user,
            "AMENDMENT_IRB_REF_UPDATED",
            details={"amendmentId": record.get("id"), "irbSubmissionRef": record.get("irbSubmissionRef")},
        )
        return save_record(db, user, row, record)

    return guarded(_ref)


@router.delete("/{code}")
def amendment_delete(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _delete():
        row, record = load_row(db, CtmsAmendment, user, code, "Amendment not found.")
        enforce_for_model(user, CtmsAmendment, "delete")
        delete_amendment(
            record,
            db,
            user,
            delete=lambda: db.delete(row),
        )
        db.commit()
        return {"deleted": True, "id": code}

    return guarded(_delete)
