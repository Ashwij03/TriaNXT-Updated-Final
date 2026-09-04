# tria_engine/apps/ctms/router_monitoring.py
#
# Monitoring Access REST surface (mirrors
# src/shared/services/api/monitoringApi.ts):
#
#   GET  /monitoring/requests/            -> raw JSON array (?status=)
#   POST /monitoring/requests/            -> 201 record {site, start_date,
#                                          end_date, reason}
#   PUT  /monitoring/requests/{id}/approve/  {note} -> record (Admin/Site Staff)
#   PUT  /monitoring/requests/{id}/reject/   {note} -> record
#   PUT  /monitoring/requests/{id}/revoke/   {note} -> record
#   GET  /monitoring/access-check/?site=  -> {"data": {allowed, ...}}
#
# Plus the sites picker the request form needs:
#   GET  /organizations/                  -> bare JSON array [{id, name}]
#
# Wire contract notes (driven by MonitoringAccess.tsx):
#   * list returns a bare JSON array (Array.isArray on the body); a brand-new
#     install returns [] — the page already maps a 404 to [] defensively;
#   * row fields are snake_case: requested_by_name, requester_role_label,
#     site_name, start_date, end_date, reason, status;
#   * statuses are lowercase: pending | approved | rejected | revoked;
#   * requester identity/role is resolved SERVER-SIDE from the session —
#     client-supplied identity is never trusted (RBAC validation G9).
#
# The requested "site" is an organizations_organization id (the org-level
# site directory); the request record itself is org-level JSON (row
# study_id/site_id scope columns stay NULL), so the workflow stays inside
# the requester's organization and the standard org scope filter applies.

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...apps.accounts.rbac import enforce, resolve_role
from ...core.database import get_db
from ..organizations.models import Organization
from . import schemas
from .common import (
    CtmsError,
    actor_name,
    audit,
    guarded,
    iso_now,
    list_records,
    load_row,
    new_id,
    stamp,
)
from .models import CtmsMonitoringRequest

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

# Sites picker — mounted separately at /organizations in main.py.
sites_router = APIRouter(prefix="/organizations", tags=["monitoring-sites"])


def _display_name(user: User) -> str:
    full = " ".join(
        part for part in (getattr(user, "first_name", ""), getattr(user, "last_name", "")) if part
    )
    return full or user.username


def _new_request(user: User, body: schemas.MonitoringRequestCreateBody, org) -> dict:
    now = iso_now()
    role = resolve_role(user)
    role_row = getattr(user, "role", None)
    return {
        "id": new_id("MA-"),
        "site": str(org.id),
        "site_name": org.name,
        "requested_by": user.username,
        "requested_by_name": _display_name(user),
        "requester_role": role or "UNKNOWN",
        "requester_role_label": (getattr(role_row, "name", "") or role or "Unknown"),
        "start_date": (body.start_date or "").strip(),
        "end_date": (body.end_date or "").strip(),
        "reason": (body.reason or "").strip() or None,
        "note": None,
        "status": "pending",
        "decided_by": None,
        "decided_by_name": None,
        "decided_at": None,
        "created_at": now,
        "updated_at": now,
        "history": stamp({}, "CREATED", actor_name(user)),
    }


def _save(db: Session, row, record: dict, user: User, action: str, code: str) -> dict:
    record["updated_at"] = iso_now()
    row.data = record
    db.add(row)
    db.commit()
    audit(db, user, action, details={"request": code})
    return dict(record)


# ---------------------------------------------------------------------------
# List / create
# ---------------------------------------------------------------------------


@router.get("/requests")
@router.get("/requests/")
def monitoring_request_list(
    request: Request,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = list_records(db, CtmsMonitoringRequest, user)
    if status:
        want = str(status).strip().lower()
        records = [r for r in records if str(r.get("status") or "").lower() == want]
    return records


@router.post("/requests")
@router.post("/requests/")
def monitoring_request_create(
    body: schemas.MonitoringRequestCreateBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        enforce(user, "monitoring", "create")
        site_id = (body.site or "").strip()
        start = (body.start_date or "").strip()
        end = (body.end_date or "").strip()
        if not site_id or not start or not end:
            raise CtmsError("Site, start date, and end date are required.")
        if end < start:
            raise CtmsError("End date cannot be before start date.")
        try:
            org = db.get(Organization, int(site_id))
        except (TypeError, ValueError):
            org = None
        if org is None:
            raise CtmsError("Selected site was not found.")
        record = _new_request(user, body, org)
        row = CtmsMonitoringRequest(
            code=record["id"],
            organization_id=user.organization_id,
            study_id=None,
            site_id=None,
            data=record,
        )
        db.add(row)
        db.commit()
        audit(db, user, "MONITORING_REQUEST_CREATED", details={"request": record["id"]})
        return record, 201

    return guarded(_create)


# ---------------------------------------------------------------------------
# Decisions (approve / reject / revoke) — Admin / Site Staff only
# ---------------------------------------------------------------------------


def _decide(
    db: Session,
    user: User,
    code: str,
    note: str,
    target_status: str,
    action_label: str,
):
    row, record = load_row(db, CtmsMonitoringRequest, user, code, "Request not found.")
    enforce(user, "monitoring", "update")
    current = str(record.get("status") or "").lower()
    allowed_from = {"approved": ("pending",), "rejected": ("pending",), "revoked": ("approved",)}[
        target_status
    ]
    if current not in allowed_from:
        raise CtmsError(
            f"A {target_status} decision is only valid on "
            f"{'/'.join(allowed_from)} requests (current status: {current})."
        )
    record["status"] = target_status
    record["note"] = (note or "").strip() or None
    record["decided_by"] = user.username
    record["decided_by_name"] = _display_name(user)
    record["decided_at"] = iso_now()
    record["history"] = stamp(
        record,
        f"{action_label} by {record['decided_by_name']}",
        actor_name(user),
    )
    return _save(db, row, record, user, f"MONITORING_REQUEST_{action_label.upper()}", code)


@router.put("/requests/{code}/approve")
@router.put("/requests/{code}/approve/")
def monitoring_request_approve(
    code: str,
    body: schemas.NoteBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: _decide(db, user, code, body.note, "approved", "APPROVED"))


@router.put("/requests/{code}/reject")
@router.put("/requests/{code}/reject/")
def monitoring_request_reject(
    code: str,
    body: schemas.NoteBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: _decide(db, user, code, body.note, "rejected", "REJECTED"))


@router.put("/requests/{code}/revoke")
@router.put("/requests/{code}/revoke/")
def monitoring_request_revoke(
    code: str,
    body: schemas.NoteBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: _decide(db, user, code, body.note, "revoked", "REVOKED"))


# ---------------------------------------------------------------------------
# Access check (a monitor asking "am I currently allowed into site X?")
# ---------------------------------------------------------------------------


@router.get("/access-check")
@router.get("/access-check/")
def monitoring_access_check(
    request: Request,
    site: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today().isoformat()
    allowed = False
    until = None
    for record in list_records(db, CtmsMonitoringRequest, user):
        if str(record.get("site") or "") != str(site).strip():
            continue
        if str(record.get("status") or "").lower() != "approved":
            continue
        start = str(record.get("start_date") or "")
        end = str(record.get("end_date") or "")
        if start <= today <= end:
            allowed = True
            until = end
            break
    return {
        "data": {
            "allowed": allowed,
            "site": site,
            "valid_until": until,
            "checked_at": iso_now(),
        }
    }


# ---------------------------------------------------------------------------
# Sites picker — GET /organizations/
# ---------------------------------------------------------------------------


@sites_router.get("")
@sites_router.get("/")
def site_directory(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.query(Organization).order_by(Organization.name).all()
    return [{"id": str(org.id), "name": org.name} for org in rows]
