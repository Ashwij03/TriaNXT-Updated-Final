# tria_engine/apps/ctms/ip_logic.py
#
# M19 IP / Supply Accountability (spec 6.26) — Python port of
# src/shared/services/ipAccountabilityService.ts. Same lot record shape,
# chain-of-custody rules (IP-01/02/03) and error messages.

from __future__ import annotations

from .common import CtmsError, audit, iso_now, new_id, stamp

IP_LOT_STATUSES = [
    "Shipped",
    "Received",
    "In Use",
    "Reconciled",
    "Returned",
    "Destroyed",
]

IP_RECONCILIATION_STATUSES = ["Balanced", "Discrepancy", "Under investigation"]

IP_EXCURSION_DISPOSITIONS = ["Use", "Quarantine", "Discard"]

RECEIPT_CONDITIONS = ["Acceptable", "Excursion", "Rejected"]


def _tx_total(lot: dict, tx_type: str) -> int:
    return sum(
        int(tx.get("quantity") or 0)
        for tx in (lot.get("transactions") or [])
        if tx.get("type") == tx_type
    )


def get_expected_on_hand(lot: dict) -> int:
    received = _tx_total(lot, "Receipt")
    dispensed = _tx_total(lot, "Dispense")
    returned = _tx_total(lot, "Return")
    destroyed = _tx_total(lot, "Destroy")
    return received - dispensed - returned - destroyed


def _has_open_excursion(lot: dict) -> bool:
    return any(
        not e.get("disposition") or e.get("disposition") == "Quarantine"
        for e in (lot.get("excursions") or [])
    )


def _actor_of(user) -> str:
    return (user.role.name if user and user.role else "") or ""


def record_shipment(db, user, payload: dict, actor: str) -> dict:
    if not payload.get("studyCode") or not payload.get("siteCode") or not payload.get("lotNumber"):
        raise CtmsError("studyCode, siteCode and lotNumber are required.")
    try:
        quantity = float(payload.get("quantity"))
    except (TypeError, ValueError):
        quantity = float("nan")
    if quantity != quantity or quantity <= 0:  # NaN-safe positive check
        raise CtmsError("Quantity received must be a positive number.")

    now = iso_now()
    lot = {
        "id": new_id("IPL-", upper=True),
        "studyCode": payload.get("studyCode"),
        "siteCode": payload.get("siteCode"),
        "lotNumber": payload.get("lotNumber"),
        "kitNumber": payload.get("kitNumber") or "",
        "quantityReceived": int(quantity),
        "quantityOnHand": 0,
        "status": "Shipped",
        "condition": "",
        "receivedAt": None,
        "receivedBy": "",
        "transactions": [
            {
                "id": new_id("TX-"),
                "type": "Receipt",
                "quantity": int(quantity),
                "date": now,
                "by": actor or "Unknown",
                "note": "Shipment dispatched",
            }
        ],
        "excursions": [],
        "reconciliationStatus": "Under investigation",
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": actor,
        "history": [
            {"action": "SHIPMENT_DISPATCHED:" + str(payload.get("lotNumber")), "at": now, "by": actor or "Unknown"}
        ],
    }
    audit(
        db,
        user,
        "IP_SHIPMENT_DISPATCHED",
        details={"lotNumber": lot["lotNumber"], "siteCode": lot["siteCode"]},
    )
    return lot


def receive_shipment(lot: dict, payload: dict, actor: str) -> dict:
    if lot["status"] != "Shipped":
        raise CtmsError("Only Shipped lots can be received.")
    condition = payload.get("condition") or "Acceptable"
    if condition not in RECEIPT_CONDITIONS:
        raise CtmsError("Receipt condition must be Acceptable, Excursion or Rejected.")

    lot["status"] = "Received"
    lot["condition"] = condition
    lot["quantityOnHand"] = lot["quantityReceived"]
    lot["receivedAt"] = iso_now()
    lot["receivedBy"] = actor
    lot["updatedAt"] = lot["receivedAt"]
    lot["updatedBy"] = actor

    if condition in ("Excursion", "Rejected"):
        # IP-02: an excursion at receipt needs a disposition decision before use.
        lot.setdefault("excursions", []).append(
            {
                "id": new_id("EXC-"),
                "temperature": payload.get("temperature"),
                "reportedAt": lot["receivedAt"],
                "reportedBy": actor,
                "disposition": None,
                "witness": "",
                "resolved": False,
            }
        )
    lot["history"].append(
        {"action": "SHIPMENT_RECEIVED:" + condition, "at": lot["receivedAt"], "by": actor}
    )
    return lot


def dispense_to_subject(lot: dict, subject_id: str, quantity, visit_code: str, actor: str) -> dict:
    if not subject_id:
        raise CtmsError("A subject is required for dispensation.")
    if lot["status"] not in ("Received", "In Use"):
        raise CtmsError("Lot must be Received/In Use before dispensation.")
    # IP-02
    if _has_open_excursion(lot):
        raise CtmsError(
            "A temperature excursion requires a disposition decision before further dispensation from this lot."
        )
    try:
        requested = float(quantity)
    except (TypeError, ValueError):
        requested = float("nan")
    if requested != requested or requested <= 0:
        raise CtmsError("Quantity must be a positive number.")
    # IP-01
    if requested > int(lot.get("quantityOnHand") or 0):
        raise CtmsError(
            "Dispensation cannot exceed on-hand quantity (on hand: "
            + str(lot.get("quantityOnHand"))
            + ", requested: "
            + str(int(requested))
            + ")."
        )

    lot["quantityOnHand"] = int(lot.get("quantityOnHand") or 0) - int(requested)
    lot["status"] = "In Use"
    lot["updatedAt"] = iso_now()
    lot["updatedBy"] = actor
    lot.setdefault("transactions", []).append(
        {
            "id": new_id("TX-"),
            "type": "Dispense",
            "quantity": int(requested),
            "subjectId": subject_id,
            "visitCode": visit_code or "",
            "date": lot["updatedAt"],
            "by": actor,
            "note": "",
        }
    )
    lot["history"].append(
        {"action": "DISPENSED:" + str(int(requested)) + ":" + subject_id, "at": lot["updatedAt"], "by": actor}
    )
    return lot


def resolve_excursion(lot: dict, excursion_id: str, disposition: str, witness: str, actor: str) -> dict:
    if disposition not in IP_EXCURSION_DISPOSITIONS:
        raise CtmsError("Disposition must be Use, Quarantine or Discard.")
    excursion = next(
        (e for e in (lot.get("excursions") or []) if str(e.get("id")) == str(excursion_id)),
        None,
    )
    if excursion is None:
        raise CtmsError("Excursion record not found.")

    if disposition == "Discard":
        # IP-03: destruction/discard needs two-person evidence.
        if not str(witness or "").strip():
            raise CtmsError("Discard requires a two-person (witness) approval signature.")
        excursion["witness"] = witness
        lot["quantityOnHand"] = 0
        lot["status"] = "Destroyed"
    excursion["disposition"] = disposition
    excursion["resolved"] = disposition == "Use"
    excursion["witness"] = excursion.get("witness") if disposition == "Use" else witness
    lot["updatedAt"] = iso_now()
    lot["updatedBy"] = actor
    lot["history"].append(
        {"action": "EXCURSION_DISPOSITION:" + disposition, "at": lot["updatedAt"], "by": actor}
    )
    return lot


def return_lot(lot: dict, quantity, reason: str, actor: str) -> dict:
    try:
        requested = float(quantity)
    except (TypeError, ValueError):
        requested = float("nan")
    if (
        requested != requested
        or requested <= 0
        or requested > int(lot.get("quantityOnHand") or 0)
    ):
        raise CtmsError("Return quantity must be positive and no more than on-hand.")
    lot["quantityOnHand"] = int(lot.get("quantityOnHand") or 0) - int(requested)
    lot["updatedAt"] = iso_now()
    lot["updatedBy"] = actor
    lot.setdefault("transactions", []).append(
        {
            "id": new_id("TX-"),
            "type": "Return",
            "quantity": int(requested),
            "date": lot["updatedAt"],
            "by": actor,
            "note": reason or "",
        }
    )
    if lot["quantityOnHand"] == 0:
        lot["status"] = "Returned"
    lot["history"].append(
        {"action": "RETURNED:" + str(int(requested)), "at": lot["updatedAt"], "by": actor}
    )
    return lot


def destroy_lot(db, user, lot: dict, witness: str, actor: str) -> dict:
    # IP-03
    if not str(witness or "").strip():
        raise CtmsError("Destruction requires two-person (witness) approval evidence.")
    if lot["status"] in ("Destroyed", "Returned"):
        raise CtmsError("Lot already has a final disposition.")
    remaining = int(lot.get("quantityOnHand") or 0)
    lot["quantityOnHand"] = 0
    lot["status"] = "Destroyed"
    lot["updatedAt"] = iso_now()
    lot["updatedBy"] = actor
    lot.setdefault("transactions", []).append(
        {
            "id": new_id("TX-"),
            "type": "Destroy",
            "quantity": remaining,
            "date": lot["updatedAt"],
            "by": actor,
            "note": "Witness: " + witness,
        }
    )
    lot["history"].append(
        {"action": "DESTROYED:" + str(remaining), "at": lot["updatedAt"], "by": actor}
    )
    audit(db, user, "IP_LOT_DESTROYED", details={"lotNumber": lot.get("lotNumber"), "witness": witness})
    return lot


def run_reconciliation(db, user, lot: dict, actor: str) -> dict:
    expected = get_expected_on_hand(lot)
    recorded = int(lot.get("quantityOnHand") or 0)
    lot["reconciliationStatus"] = "Balanced" if expected == recorded else "Discrepancy"
    lot["expectedOnHand"] = expected
    if lot["reconciliationStatus"] == "Balanced" and recorded == 0:
        lot["status"] = "Reconciled"
    lot["updatedAt"] = iso_now()
    lot["updatedBy"] = actor
    lot["history"].append(
        {
            "action": "RECONCILIATION:" + lot["reconciliationStatus"],
            "at": lot["updatedAt"],
            "by": actor,
        }
    )
    audit(
        db,
        user,
        "IP_RECONCILIATION",
        details={
            "lotNumber": lot.get("lotNumber"),
            "expected": expected,
            "recorded": recorded,
            "status": lot["reconciliationStatus"],
        },
    )
    return lot
