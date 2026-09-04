# tria_engine/apps/ctms/router_ip.py
#
# M19 IP / Supply Accountability REST surface (mirrors
# ipAccountabilityService.ts):
#   GET  /ip/lots/?studyCode=               GET /ip/lots/{code}
#   POST /ip/shipments/                     {studyCode, siteCode, lotNumber, kitNumber, quantity}
#   POST /ip/lots/{code}/receive            {condition, temperature}
#   POST /ip/lots/{code}/dispense           {subjectId, quantity, visitCode}
#   POST /ip/lots/{code}/excursions/{excursionId}/disposition  {disposition, witness}
#   POST /ip/lots/{code}/return             {quantity, reason}
#   POST /ip/lots/{code}/destroy            {witness}
#   POST /ip/lots/{code}/reconcile

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from . import schemas
from .common import (
    actor_name,
    audit,
    create_record,
    filter_study,
    guarded,
    list_records,
    load_row,
    save_record,
)
from .ip_logic import (
    destroy_lot,
    dispense_to_subject,
    receive_shipment,
    record_shipment,
    resolve_excursion,
    return_lot,
    run_reconciliation,
)
from .models import CtmsIpLot

router = APIRouter(prefix="/ip", tags=["ctms-ip"])


@router.get("/lots")
@router.get("/lots/")
def ip_lot_list(
    request: Request,
    studyCode: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: filter_study(list_records(db, CtmsIpLot, user), studyCode))


@router.get("/lots/{code}")
def ip_lot_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsIpLot, user, code, "Lot not found.")
        return record

    return guarded(_detail)


@router.post("/shipments")
@router.post("/shipments/")
def ip_shipment_create(
    body: schemas.ShipmentBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = record_shipment(db, user, body.model_dump(), actor_name(user))
        audit(
            db,
            user,
            "IP_SHIPMENT_DISPATCHED",
            details={"lotNumber": record["lotNumber"], "siteCode": record["siteCode"]},
        )
        return create_record(db, CtmsIpLot, user, record["id"], record), 201

    return guarded(_create)


@router.post("/lots/{code}/receive")
def ip_lot_receive(
    code: str,
    body: schemas.ReceiveBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _receive():
        row, record = load_row(db, CtmsIpLot, user, code, "Lot not found.")
        receive_shipment(record, body.model_dump(), actor_name(user))
        audit(
            db,
            user,
            "IP_SHIPMENT_RECEIVED",
            details={"lotNumber": record.get("lotNumber"), "condition": record.get("condition")},
        )
        return save_record(db, user, row, record)

    return guarded(_receive)


@router.post("/lots/{code}/dispense")
def ip_lot_dispense(
    code: str,
    body: schemas.DispenseBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _dispense():
        row, record = load_row(db, CtmsIpLot, user, code, "Lot not found.")
        dispense_to_subject(record, body.subjectId, body.quantity, body.visitCode, actor_name(user))
        audit(
            db,
            user,
            "IP_DISPENSED_TO_SUBJECT",
            details={"lotNumber": record.get("lotNumber"), "subjectId": body.subjectId, "quantity": body.quantity},
        )
        return save_record(db, user, row, record)

    return guarded(_dispense)


@router.post("/lots/{code}/excursions/{excursion_id}/disposition")
def ip_excursion_disposition(
    code: str,
    excursion_id: str,
    body: schemas.DispositionBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _resolve():
        row, record = load_row(db, CtmsIpLot, user, code, "Lot not found.")
        resolve_excursion(record, excursion_id, body.disposition, body.witness, actor_name(user))
        audit(
            db,
            user,
            "IP_EXCURSION_DISPOSITION",
            details={"lotNumber": record.get("lotNumber"), "disposition": body.disposition},
        )
        return save_record(db, user, row, record)

    return guarded(_resolve)


@router.post("/lots/{code}/return")
def ip_lot_return(
    code: str,
    body: schemas.ReturnBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _return():
        row, record = load_row(db, CtmsIpLot, user, code, "Lot not found.")
        return_lot(record, body.quantity, body.reason, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_return)


@router.post("/lots/{code}/destroy")
def ip_lot_destroy(
    code: str,
    body: schemas.DestroyBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _destroy():
        row, record = load_row(db, CtmsIpLot, user, code, "Lot not found.")
        destroy_lot(db, user, record, body.witness, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_destroy)


@router.post("/lots/{code}/reconcile")
def ip_lot_reconcile(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _reconcile():
        row, record = load_row(db, CtmsIpLot, user, code, "Lot not found.")
        run_reconciliation(db, user, record, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_reconcile)
