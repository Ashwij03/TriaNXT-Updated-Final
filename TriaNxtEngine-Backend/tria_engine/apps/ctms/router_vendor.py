# tria_engine/apps/ctms/router_vendor.py
#
# M22 Vendor & Lab Management REST surface (mirrors vendorService.ts):
#   vendors:  GET /vendors  POST /vendors  GET /vendors/{code}
#             POST /vendors/{code}/activate  POST /vendors/{code}/offboard {reason}
#   kits:     GET /kits(?studyCode=)  POST /kits  GET /kits/{code}
#             POST /kits/{code}/advance  {nextStatus, location}

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
from .models import CtmsKit, CtmsVendor
from .vendor_logic import (
    add_vendor,
    advance_kit_status,
    offboard_vendor,
    register_kit,
    set_vendor_active,
)

router = APIRouter(prefix="/vendors", tags=["ctms-vendor"])


def _vendors(db, user) -> list[dict]:
    return list_records(db, CtmsVendor, user)


# ----------------------------------------------------------------------
# Vendors
# ----------------------------------------------------------------------


@router.get("")
@router.get("/")
def vendor_list(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: _vendors(db, user))


@router.post("")
@router.post("/")
def vendor_create(
    body: schemas.VendorBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = add_vendor(db, user, _vendors(db, user), body.model_dump(), actor_name(user))
        return create_record(db, CtmsVendor, user, record["id"], record), 201

    return guarded(_create)


@router.get("/{code}")
def vendor_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsVendor, user, code, "Vendor not found.")
        return record

    return guarded(_detail)


@router.post("/{code}/activate")
def vendor_activate(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _activate():
        row, record = load_row(db, CtmsVendor, user, code, "Vendor not found.")
        set_vendor_active(record, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_activate)


@router.post("/{code}/offboard")
def vendor_offboard(
    code: str,
    body: schemas.OffboardBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _offboard():
        row, record = load_row(db, CtmsVendor, user, code, "Vendor not found.")
        offboard_vendor(db, user, record, body.reason, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_offboard)


# ----------------------------------------------------------------------
# Lab kits / specimens
# ----------------------------------------------------------------------


@router.get("/kits")
@router.get("/kits/")
def kit_list(
    request: Request,
    studyCode: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: filter_study(list_records(db, CtmsKit, user), studyCode))


@router.post("/kits")
@router.post("/kits/")
def kit_create(
    body: schemas.KitBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = register_kit(db, user, _vendors(db, user), body.model_dump(), actor_name(user))
        return create_record(db, CtmsKit, user, record["id"], record), 201

    return guarded(_create)


@router.get("/kits/{code}")
def kit_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsKit, user, code, "Kit not found.")
        return record

    return guarded(_detail)


@router.post("/kits/{code}/advance")
def kit_advance(
    code: str,
    body: schemas.AdvanceKitBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _advance():
        row, record = load_row(db, CtmsKit, user, code, "Kit not found.")
        advance_kit_status(db, user, record, body.nextStatus, body.location, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_advance)
