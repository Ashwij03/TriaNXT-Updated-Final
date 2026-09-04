# tria_engine/apps/ctms/vendor_logic.py
#
# M22 Vendor & Lab Management (spec 6.29) — Python port of
# src/shared/services/vendorService.ts.

from __future__ import annotations

from .common import CtmsError, audit, iso_now, new_id, stamp

VENDOR_TYPES = ["Central Lab", "Imaging", "ECG Core Lab", "Translation", "Other"]

VENDOR_STATUSES = ["Onboarding", "Active", "Offboarding", "Offboarded"]

KIT_STATUSES = ["Collected", "Shipped", "Received", "Resulted", "Archived"]

KIT_FLOW = ["Collected", "Shipped", "Received", "Resulted", "Archived"]


def _norm(value) -> str:
    return str(value or "").strip().lower()


# ----------------------------------------------------------------------
# Vendors
# ----------------------------------------------------------------------


def add_vendor(db, user, vendors: list[dict], payload: dict, actor: str) -> dict:
    if not payload.get("name") or not payload.get("type"):
        raise CtmsError("Vendor name and type are required.")
    vendor_type = payload.get("type")
    if vendor_type not in VENDOR_TYPES:
        raise CtmsError("A valid vendor type is required.")
    if any(_norm(v.get("name")) == _norm(payload.get("name")) for v in vendors):
        raise CtmsError("A vendor with this name already exists.")

    now = iso_now()
    vendor = {
        "id": new_id("VND-", upper=True),
        "name": payload.get("name"),
        "type": vendor_type,
        "scope": payload.get("scope") or "",
        "contractRef": payload.get("contractRef") or "",
        "contractExpiryDate": payload.get("contractExpiryDate") or "",
        "contactName": payload.get("contactName") or "",
        "contactEmail": payload.get("contactEmail") or "",
        "status": payload.get("status") or "Onboarding",
        "notes": payload.get("notes") or "",
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": actor,
        "history": [],
    }
    vendor["history"] = stamp(vendor, "VENDOR_ADDED", actor)
    audit(
        db,
        user,
        "VENDOR_ADDED",
        details={"vendorId": vendor["id"], "vendorName": vendor["name"], "type": vendor_type},
    )
    return vendor


def set_vendor_active(vendor: dict, actor: str) -> dict:
    if vendor["status"] == "Offboarded":
        raise CtmsError("Offboarded vendors cannot be reactivated directly.")
    vendor["status"] = "Active"
    vendor["updatedAt"] = iso_now()
    vendor["updatedBy"] = actor
    vendor["history"] = stamp(vendor, "VENDOR_ACTIVATED", actor)
    return vendor


def offboard_vendor(db, user, vendor: dict, reason: str, actor: str) -> dict:
    if not str(reason or "").strip():
        raise CtmsError("An offboarding reason is required.")
    if vendor["status"] == "Offboarded":
        raise CtmsError("Vendor is already offboarded.")
    vendor["status"] = "Offboarded"
    vendor["offboardReason"] = reason
    vendor["offboardedAt"] = iso_now()
    vendor["updatedAt"] = vendor["offboardedAt"]
    vendor["updatedBy"] = actor
    vendor["history"] = stamp(vendor, "VENDOR_OFFBOARDED", actor)
    audit(
        db,
        user,
        "VENDOR_OFFBOARDED",
        details={"vendorId": vendor.get("id"), "vendorName": vendor.get("name"), "reason": reason},
    )
    return vendor


def is_vendor_contract_expiring(vendor: dict, within_days: int = 90) -> bool:
    if not vendor.get("contractExpiryDate"):
        return False
    from datetime import datetime

    try:
        expiry = datetime.fromisoformat(str(vendor["contractExpiryDate"]).replace("Z", "+00:00"))
    except ValueError:
        return False
    horizon = datetime.now(expiry.tzinfo).timestamp() + within_days * 86400
    return expiry.timestamp() <= horizon


# ----------------------------------------------------------------------
# Lab kits / specimens
# ----------------------------------------------------------------------


def register_kit(db, user, vendors: list[dict], payload: dict, actor: str) -> dict:
    if not payload.get("vendorId") or not payload.get("subjectId") or not payload.get("visitCode"):
        raise CtmsError("A kit must link to a vendor, subject and visit context.")
    if not payload.get("kitType"):
        raise CtmsError("Kit type is required.")
    vendor = next((v for v in vendors if str(v.get("id")) == str(payload["vendorId"])), None)
    if vendor is None or vendor["status"] == "Offboarded":
        raise CtmsError("Kit vendor must exist and not be offboarded.")

    now = iso_now()
    kit = {
        "id": new_id("KT-", upper=True),
        "vendorId": vendor["id"],
        "vendorName": vendor["name"],
        "studyCode": payload.get("studyCode") or "",
        "subjectId": payload["subjectId"],
        "visitCode": payload["visitCode"],
        "kitType": payload["kitType"],
        "specimenId": payload.get("specimenId") or "",
        "status": "Collected",
        "chainOfCustody": [
            {
                "at": now,
                "action": "Collected at site",
                "handler": actor or "Unknown",
                "location": payload.get("collectedLocation") or "Site",
            }
        ],
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": actor,
        "history": [],
    }
    kit["history"] = stamp(kit, "KIT_REGISTERED", actor)
    audit(
        db,
        user,
        "LAB_KIT_REGISTERED",
        details={"kitId": kit["id"], "subjectId": kit["subjectId"], "visitCode": kit["visitCode"]},
    )
    return kit


def advance_kit_status(db, user, kit: dict, next_status: str, location: str, actor: str) -> dict:
    if next_status not in KIT_STATUSES:
        raise CtmsError("Invalid kit status.")
    # No-op advance to the current status: allowed, but must not fabricate a
    # duplicate chain-of-custody entry (parity with the frontend service).
    if kit["status"] == next_status:
        return kit
    current_pos = KIT_FLOW.index(kit["status"]) if kit["status"] in KIT_FLOW else -1
    next_pos = KIT_FLOW.index(next_status)
    if next_pos <= current_pos:
        raise CtmsError("Kit status can only move forward through the flow.")

    kit["status"] = next_status
    kit["updatedAt"] = iso_now()
    kit["updatedBy"] = actor
    kit.setdefault("chainOfCustody", []).append(
        {"at": kit["updatedAt"], "action": next_status, "handler": actor or "Unknown", "location": location or ""}
    )
    kit["history"] = stamp(kit, "KIT_STATUS:" + next_status, actor)
    audit(db, user, "LAB_KIT_STATUS", details={"kitId": kit.get("id"), "status": next_status})
    return kit
