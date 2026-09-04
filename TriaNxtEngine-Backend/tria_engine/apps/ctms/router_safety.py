# tria_engine/apps/ctms/router_safety.py
#
# Safety Center REST surface (mirrors src/shared/services/api/safetyApi.ts):
#
#   GET  /safety/ae-cases/              -> raw JSON array (list)
#   POST /safety/ae-cases/              -> 201 record   {study_id, subject_ref,
#                                          description, is_serious, ...}
#   GET  /safety/ae-cases/{code}/       -> record (404 when unknown/out of scope)
#   PATCH /safety/ae-cases/{code}/      -> merged record
#   POST /safety/ae-cases/{code}/reconcile/  {pv_case_reference} -> record
#   GET  /safety/ae-cases/summary/      -> {"data": {total, serious, open,
#                                          reconciled}}
#
# Wire contract notes (driven by SafetyCenter.tsx):
#   * the list endpoint returns a bare JSON array (the page does
#     Array.isArray on the response body);
#   * the summary endpoint returns the counts under a {"data": ...} envelope
#     (the page reads summaryData.data.total/serious/open/reconciled);
#   * errors are {"message": ...} with the business-rule wording the page's
#     error banner already renders.
#
# Persistence follows the ctms JSON-record convention: one thin relational
# row (code, organization_id, study_id/site_id scope columns) holding the
# full case document. The row's study_id mirrors data['study_id'] so the
# existing SQL-level site/study scope filters apply to AE cases too.

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...apps.accounts.rbac import assert_write_scope, enforce
from ...core.database import get_db
from . import schemas
from .common import (
    actor_name,
    audit,
    guarded,
    iso_now,
    list_records,
    load_row,
    new_id,
    stamp,
)
from .models import CtmsAeCase

router = APIRouter(prefix="/safety", tags=["safety"])

_DEFAULT_STATUS = "Open"
_RECONCILED_STATUS = "Reconciled"


def _new_case(user, body: schemas.AeCaseCreateBody, actor: str) -> dict:
    now = iso_now()
    return {
        "id": new_id("AE-"),
        "study_id": (body.study_id or "").strip(),
        "subject_ref": (body.subject_ref or "").strip(),
        "description": (body.description or "").strip(),
        "is_serious": bool(body.is_serious),
        "causality": (body.causality or "").strip() or None,
        "outcome": (body.outcome or "").strip() or None,
        "status": _DEFAULT_STATUS,
        "pv_case_reference": None,
        "created_by": user.username,
        "created_at": now,
        "updated_at": now,
        "history": stamp({}, "CREATED", actor),
    }


def _save(db: Session, row, record: dict) -> dict:
    """Persist a case document; mirror the study code into the SQL scope
    column (site stays NULL — cases are study-scoped, not site-scoped)."""
    record["updated_at"] = iso_now()
    row.data = record
    row.study_id = (record.get("study_id") or "").strip() or None
    row.site_id = None
    db.add(row)
    db.commit()
    return dict(record)


def _insert(db: Session, user, record: dict, actor: str) -> dict:
    study_code = (record.get("study_id") or "").strip() or None
    assert_write_scope(user, study_code, None)
    row = CtmsAeCase(
        code=record["id"],
        organization_id=user.organization_id,
        study_id=study_code,
        site_id=None,
        data=record,
    )
    db.add(row)
    db.commit()
    audit(db, user, "AE_CASE_CREATED", details={"case": record["id"]})
    return dict(record)


def _filtered(records: list[dict], study_id=None, serious_only=None, status=None) -> list[dict]:
    out = list(records)
    if study_id:
        want = str(study_id).strip()
        out = [r for r in out if str(r.get("study_id") or "").strip() == want]
    if serious_only:
        out = [r for r in out if bool(r.get("is_serious"))]
    if status:
        want = str(status).strip()
        out = [r for r in out if str(r.get("status") or "").strip() == want]
    return out


# ---------------------------------------------------------------------------
# List + summary
# ---------------------------------------------------------------------------


@router.get("/ae-cases")
@router.get("/ae-cases/")
def ae_case_list(
    request: Request,
    studyId: str | None = None,
    seriousOnly: bool | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Bare JSON array — SafetyCenter expects Array.isArray on the body."""
    records = list_records(db, CtmsAeCase, user)
    return _filtered(records, studyId, seriousOnly, status)


@router.get("/ae-cases/summary")
@router.get("/ae-cases/summary/")
def ae_case_summary(
    request: Request,
    studyId: str | None = None,
    seriousOnly: bool | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Counts under a {"data": ...} envelope (page reads .data.total etc.)."""
    rows = _filtered(list_records(db, CtmsAeCase, user), studyId, seriousOnly, status)
    return {
        "data": {
            "total": len(rows),
            "serious": sum(1 for r in rows if bool(r.get("is_serious"))),
            "open": sum(1 for r in rows if str(r.get("status") or "") == _DEFAULT_STATUS),
            "reconciled": sum(1 for r in rows if str(r.get("status") or "") == _RECONCILED_STATUS),
        }
    }


# ---------------------------------------------------------------------------
# Create / detail / update / reconcile
# ---------------------------------------------------------------------------


@router.post("/ae-cases")
@router.post("/ae-cases/")
def ae_case_create(
    body: schemas.AeCaseCreateBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        enforce(user, "safety", "create")
        if not (body.study_id or "").strip() or not (body.subject_ref or "").strip() or not (
            body.description or ""
        ).strip():
            from .common import CtmsError

            raise CtmsError("Study ID, subject reference, and description are required.")
        actor = actor_name(user)
        record = _new_case(user, body, actor)
        return _insert(db, user, record, actor), 201

    return guarded(_create)


@router.get("/ae-cases/{code}")
@router.get("/ae-cases/{code}/")
def ae_case_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsAeCase, user, code, "Case not found.")
        return record

    return guarded(_detail)


@router.patch("/ae-cases/{code}")
@router.patch("/ae-cases/{code}/")
def ae_case_update(
    code: str,
    body: schemas.AeCasePatchBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _update():
        row, record = load_row(db, CtmsAeCase, user, code, "Case not found.")
        enforce(user, "safety", "update")
        patch = body.model_dump(exclude_unset=True)
        for key in ("subject_ref", "description", "causality", "outcome", "pv_case_reference"):
            if key in patch and patch[key] is not None:
                record[key] = str(patch[key]).strip() or None
        if patch.get("is_serious") is not None:
            record["is_serious"] = bool(patch["is_serious"])
        if patch.get("status") not in (None, ""):
            record["status"] = patch["status"]
        record["history"] = stamp(record, "UPDATED", actor_name(user))
        audit(db, user, "AE_CASE_UPDATED", details={"case": code})
        return _save(db, row, record)

    return guarded(_update)


@router.post("/ae-cases/{code}/reconcile")
@router.post("/ae-cases/{code}/reconcile/")
def ae_case_reconcile(
    code: str,
    body: schemas.ReconcileBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _reconcile():
        from .common import CtmsError

        reference = (body.pv_case_reference or "").strip()
        if not reference:
            raise CtmsError("A PV system case reference is required to reconcile.")
        row, record = load_row(db, CtmsAeCase, user, code, "Case not found.")
        enforce(user, "safety", "update")
        record["pv_case_reference"] = reference
        record["status"] = _RECONCILED_STATUS
        record["history"] = stamp(
            record, f"RECONCILED ({reference})", actor_name(user)
        )
        audit(db, user, "AE_CASE_RECONCILED", details={"case": code, "pv": reference})
        return _save(db, row, record)

    return guarded(_reconcile)
