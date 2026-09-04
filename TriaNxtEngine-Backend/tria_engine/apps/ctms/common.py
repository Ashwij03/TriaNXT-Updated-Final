# tria_engine/apps/ctms/common.py
#
# Shared helpers for the CTMS gap-module routers: domain error type,
# ISO-timestamp / id generators (mirroring the frontend generators),
# record persistence and audit logging.

from __future__ import annotations

import time
from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..accounts.services import create_audit_log
from ..accounts.rbac import (
    assert_write_scope,
    enforce_for_model,
    resolve_role,
    resolve_user_scope,
)

# ---------------------------------------------------------------------------
# ISO timestamps + ids identical to the frontend generators
# (new Date().toISOString() / Date.now().toString(36))
# ---------------------------------------------------------------------------


def iso_now() -> str:
    """JS new Date().toISOString() equivalent (UTC, milliseconds, 'Z')."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


_B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def _b36(num: int) -> str:
    if num <= 0:
        return "0"
    out = ""
    while num:
        num, rem = divmod(num, 36)
        out = _B36[rem] + out
    return out


def new_id(prefix: str, upper: bool = False) -> str:
    """e.g. new_id('AMD-', upper=True) -> 'AMD-M1X2Y3...'."""
    value = _b36(int(time.time() * 1000))
    return prefix + (value.upper() if upper else value)


# ---------------------------------------------------------------------------
# Domain errors -> {"message": ...} responses (the frontend api client parses
# body.message, and the messages mirror the localStorage services exactly).
# ---------------------------------------------------------------------------


class CtmsError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ---------------------------------------------------------------------------
# Record persistence on the JSON-record tables
# ---------------------------------------------------------------------------


def record_codes(data: dict) -> tuple[str | None, str | None]:
    """Extract the study/site codes a record belongs to (its studyCode /
    siteCode). Records without them (org-level rows, e.g. vendors) return
    (None, None) and are visible to every member of the organization."""
    study = data.get("studyCode")
    site = data.get("siteCode")
    return (
        (str(study).strip() if study else None),
        (str(site).strip() if site else None),
    )


def create_record(db: Session, model, user, code: str, data: dict) -> dict:
    enforce_for_model(user, model, "create")
    study_id, site_id = record_codes(data)
    assert_write_scope(user, study_id, site_id)
    row = model(
        code=code,
        organization_id=user.organization_id,
        study_id=study_id,
        site_id=site_id,
        data=data,
    )
    db.add(row)
    db.commit()
    return dict(data)


def save_record(db: Session, user, row, data: dict) -> dict:
    enforce_for_model(user, type(row), "update")
    study_id, site_id = record_codes(data)
    assert_write_scope(user, study_id, site_id)
    row.data = data
    row.study_id = study_id
    row.site_id = site_id
    db.add(row)
    db.commit()
    return dict(data)


def bulk_sync_records(
    db: Session,
    model,
    user,
    records,
    *,
    codes_fn=None,
    code_fn=None,
) -> dict:
    """Upsert a full collection of frontend records (integration sync).

    Each record is the exact JSON the frontend service stores; its `id` is
    the row `code` by default. Rows already present in the caller's
    organization are updated in place (data + study/site scope columns
    refreshed); unknown ids are inserted. Cross-organization rows are never
    touched. Role enforcement runs once for the collection; per-record
    site/study scope assertion means out-of-scope records are skipped
    (reported), never written.

    `codes_fn(record) -> (study_code, site_code)` overrides where the scope
    columns come from (e.g. subject rows carry their study under
    `studyId`, not `studyCode`); `code_fn(record) -> str` overrides the row
    code (e.g. subjects need a study-qualified key so identical subject
    numbers in different studies never collide). Both default to the
    gap-module behavior and existing callers are unaffected.
    """
    enforce_for_model(user, model, "update")
    _scope_codes = codes_fn or record_codes
    created = 0
    updated = 0
    skipped: list[dict] = []
    for record in records or []:
        if not isinstance(record, dict):
            skipped.append({"id": None, "reason": "not-an-object"})
            continue
        raw_code = code_fn(record) if code_fn is not None else record.get("id")
        code = str(raw_code or "").strip()
        if not code:
            skipped.append({"id": None, "reason": "missing-id"})
            continue
        study_id, site_id = _scope_codes(record)
        try:
            assert_write_scope(user, study_id, site_id)
        except Exception as exc:  # HTTPException 403
            skipped.append({"id": code, "reason": str(getattr(exc, "detail", exc))})
            continue
        row = (
            db.execute(
                select(model).where(
                    model.code == code,
                    model.organization_id == user.organization_id,
                )
            )
            .scalars()
            .first()
        )
        if row is None:
            db.add(
                model(
                    code=code,
                    organization_id=user.organization_id,
                    study_id=study_id,
                    site_id=site_id,
                    data=record,
                )
            )
            created += 1
        else:
            row.data = record
            row.study_id = study_id
            row.site_id = site_id
            db.add(row)
            updated += 1
    db.commit()
    return {
        "synced": created + updated,
        "created": created,
        "updated": updated,
        "skipped": skipped,
    }


def _scope_condition(model, user):
    """SQL-level visibility condition for the session user (RBAC 4.2).

    * superuser/Admin  -> no condition (wildcard)
    * everyone else    -> organization equality, PLUS, when the user has
      site/study assignments, the record's site/study must be in scope.
      Records with a NULL site/study (org-level rows) stay visible to all
      members of the organization.
    """
    if user is None or getattr(user, "is_superuser", False):
        return None
    conds = [model.organization_id == user.organization_id]
    scope = resolve_user_scope(user)
    if scope["studies"]:
        conds.append(
            or_(model.study_id.is_(None), model.study_id.in_(scope["studies"]))
        )
    if scope["sites"]:
        conds.append(or_(model.site_id.is_(None), model.site_id.in_(scope["sites"])))
    return and_(*conds)


def list_records(db: Session, model, user) -> list[dict]:
    stmt = select(model)
    cond = _scope_condition(model, user)
    if cond is not None:
        stmt = stmt.where(cond)
    stmt = stmt.order_by(model.created_at.desc(), model.id.desc())
    return [dict(r.data) for r in db.execute(stmt).scalars().all()]


def load_row(db: Session, model, user, code: str, not_found: str = "Record not found."):
    stmt = select(model).where(model.code == code)
    cond = _scope_condition(model, user)
    if cond is not None:
        stmt = stmt.where(cond)
    row = db.execute(stmt).scalars().first()
    if row is None:
        raise CtmsError(not_found, status=404)
    return row, dict(row.data)


def find_code(records: list[dict], code: str) -> int:
    """Index of a record by its frontend code/id within a fetched list."""
    for i, record in enumerate(records):
        if str(record.get("id")) == str(code):
            return i
    return -1


def actor_name(user) -> str:
    """Actor label used in record history (frontend uses the effective role)."""
    role = getattr(user, "role", None)
    if role is not None and getattr(role, "name", None):
        return role.name
    return getattr(user, "username", None) or "Unknown"


def filter_study(records: list[dict], study_code: str | None) -> list[dict]:
    """Records already scoped to the user's org; optionally narrow by study."""
    if not study_code:
        return records
    key = str(study_code).strip().lower()
    return [r for r in records if str(r.get("studyCode") or "").strip().lower() == key]


# ---------------------------------------------------------------------------
# History stamping + audit logging (mirrors the frontend stampHistory /
# addAuditLog calls — same action names, now persisted in accounts_auditlog)
# ---------------------------------------------------------------------------


def stamp(record: dict, action: str, actor: str) -> list[dict]:
    history = list(record.get("history") or [])
    history.append({"action": action, "at": iso_now(), "by": actor or "Unknown"})
    return history


def audit(db: Session, user, action: str, *, details: dict | None = None, ip=None) -> None:
    """Persist an audit-log row for a gap-module mutation (additive to the
    existing accounts_auditlog table; same helper accounts uses)."""
    bits = [details[k] for k in (details or {}) if details.get(k) not in (None, "")]
    description = f"{user.username} {action}"
    if bits:
        description += " (" + ", ".join(str(b) for b in bits) + ")"
    # Audit context: resolved role + org scope for every state-changing
    # action (RBAC validation G10 — actor, role and scope on each record).
    description += f" [role={resolve_role(user) or 'UNKNOWN'}, scope=org:{getattr(user, 'organization_id', None) or 'ALL'}]"
    create_audit_log(
        db,
        user=user,
        action=action,
        ip_address=ip,
        description=description,
        signature_meaning=f"{action} — electronic signature recorded",
    )


# ---------------------------------------------------------------------------
# Response helpers shared by every ctms router (plain JSON records, exactly
# like the localStorage services return; errors as {"message": ...})
# ---------------------------------------------------------------------------


def ok_response(data, status: int | None = None) -> "JSONResponse":
    from fastapi.responses import JSONResponse

    if isinstance(data, tuple) and len(data) == 2 and isinstance(data[1], int):
        data, status = data
    return JSONResponse(data, status_code=status or 200)


def guarded(fn):
    """Run a router action; map CtmsError -> JSON {"message": ...} response."""
    from fastapi.responses import JSONResponse

    try:
        return ok_response(fn())
    except CtmsError as exc:
        return JSONResponse({"message": exc.message}, status_code=exc.status)
