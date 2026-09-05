# _cro_live_check.py - LIVE RBAC check for the CRO role against the running
# backend (uvicorn on http://127.0.0.1:8000, dev db.sqlite3).
#
# Proves, over real HTTP with a real session, the two RBAC-matrix claims for
# the CRO role (rbac.py PERMISSION_MATRIX):
#   * Safety Center  -> read-only oversight (GETs 200, POST/PATCH/reconcile
#                       403, no state change)
#   * Monitoring     -> REQUEST rights kept (POST /monitoring/requests/ 201,
#                       list + access-check 200) but decision rights denied
#                       (approve/reject/revoke 403)
#
# Run from the backend root with the project venv:
#   .venv/Scripts/python _cro_live_check.py
#
# Idempotent: creates (or reuses) the demo CRO in "Safety Demo Org" and
# removes the monitoring-request row it creates through the API afterwards.

from __future__ import annotations

import http.cookiejar
import json
import sys
import urllib.request
import uuid
from datetime import date, timedelta

from sqlalchemy import select

from tria_engine.apps.accounts.models import User
from tria_engine.apps.organizations.models import Role
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password

BASE = "http://127.0.0.1:8000"
ORG_ID = 5  # "Safety Demo Org" (holds the AE/SAE + monitoring demo data)
CRO_EMAIL = "cro.live@demo.com"
CRO_PASSWORD = "CRO@1234"
# Picker site for the request: org 2 ("Probe Org") has no approved coverage
# in the demo data, so the pending-only access-check result is deterministic.
SITE_ID = "2"

_checks = []


def check(label: str, ok: bool, detail: str = "") -> None:
    _checks.append((label, ok))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {label}" + (f"  -> {detail}" if detail else ""))
    if not ok:
        sys.stdout.flush()


_opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
)


def request(method: str, path: str, body: dict | None = None):
    """HTTP helper bound to a session-cookie opener (login persists across
    calls exactly like the SPA's fetch with credentials)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with _opener.open(req) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        return exc.code, json.loads(raw) if raw else {}


def ensure_cro_user() -> None:
    db = SessionLocal()
    try:
        role = db.execute(
            select(Role).where(Role.name == "CRO", Role.organization_id == ORG_ID)
        ).scalar_one_or_none()
        if role is None:
            role = Role(name="CRO", organization_id=ORG_ID)
            db.add(role)
            db.flush()
        user = db.execute(
            select(User).where(User.email == CRO_EMAIL)
        ).scalar_one_or_none()
        if user is None:
            user = User(
                username="cro.live",
                email=CRO_EMAIL,
                password=hash_password(CRO_PASSWORD),
                first_name="CRO",
                last_name="Live Check",
                is_active=True,
                organization_id=ORG_ID,
                role_id=role.id,
            )
            db.add(user)
            db.flush()
            print(f"[SEED] created demo CRO user {CRO_EMAIL} (org {ORG_ID})")
        else:
            user.password = hash_password(CRO_PASSWORD)
            user.is_active = True
            user.role_id = role.id
            user.organization_id = ORG_ID
            print(f"[SEED] reusing demo CRO user {CRO_EMAIL}")
        db.commit()
    finally:
        db.close()


def cleanup_request(code: str) -> None:
    from tria_engine.apps.ctms.models import CtmsMonitoringRequest

    db = SessionLocal()
    try:
        row = db.execute(
            select(CtmsMonitoringRequest).where(CtmsMonitoringRequest.code == code)
        ).scalar_one_or_none()
        if row is not None:
            db.delete(row)
            db.commit()
            print(f"[CLEAN] removed live-check monitoring request {code}")
    finally:
        db.close()


def main() -> None:
    ensure_cro_user()

    # Login as the CRO over real HTTP; the session cookie is kept for the run.
    status, body = request("POST", "/api/accounts/login/",
                           {"email": CRO_EMAIL, "password": CRO_PASSWORD})
    check("login as CRO establishes a session", status == 200, f"POST /api/accounts/login/ -> {status}")

    # ---- Safety Center: every read 200, every write 403 -------------------
    status, rows = request("GET", "/safety/ae-cases/")
    check("CRO lists Safety AE cases", status == 200 and isinstance(rows, list) and len(rows) == 3,
          f"GET /safety/ae-cases/ -> {status}, {len(rows) if isinstance(rows, list) else '?'} rows")
    case_id = rows[0]["id"] if isinstance(rows, list) and rows else None

    status, summary = request("GET", "/safety/ae-cases/summary/")
    ok_summary = status == 200 and summary.get("data", {}).get("total") == 3
    check("CRO reads Safety summary KPIs", ok_summary, f"GET /safety/ae-cases/summary/ -> {status} {summary.get('data')}")

    status, detail = request("GET", f"/safety/ae-cases/{case_id}/")
    check("CRO reads an AE case detail", status == 200 and detail.get("id") == case_id,
          f"GET /safety/ae-cases/{case_id}/ -> {status}")

    status, body = request("POST", "/safety/ae-cases/", {
        "study_id": "TNX-LIVE-CRO", "subject_ref": "S-LIVE1",
        "description": "live RBAC check", "is_serious": False,
    })
    check("CRO cannot CREATE an AE case", status == 403 and "role=CRO" in str(body.get("detail")),
          f"POST /safety/ae-cases/ -> {status} {body.get('detail')}")

    status, body = request("PATCH", f"/safety/ae-cases/{case_id}/", {"outcome": "Resolved"})
    check("CRO cannot UPDATE an AE case", status == 403 and "role=CRO" in str(body.get("detail")),
          f"PATCH /safety/ae-cases/{case_id}/ -> {status} {body.get('detail')}")

    status, body = request("POST", f"/safety/ae-cases/{case_id}/reconcile/",
                           {"pv_case_reference": "PV-LIVE-1"})
    check("CRO cannot RECONCILE an AE case", status == 403 and "role=CRO" in str(body.get("detail")),
          f"POST /safety/ae-cases/{case_id}/reconcile/ -> {status} {body.get('detail')}")

    status, rows_after = request("GET", "/safety/ae-cases/")
    check("denied Safety writes left no side effect",
          status == 200 and len(rows_after) == len(rows),
          f"GET /safety/ae-cases/ -> {status}, {len(rows_after)} rows (was {len(rows)})")

    # ---- Monitoring Access: request rights kept, decisions denied ---------
    start = date.today().isoformat()
    end = (date.today() + timedelta(days=3)).isoformat()
    code = f"MA-live-cro-{uuid.uuid4().hex[:8]}"
    status, req = request("POST", "/monitoring/requests/", {
        "site": SITE_ID, "start_date": start, "end_date": end,
        "reason": "Live RBAC check - CRO request rights",
    })
    check("CRO can CREATE a monitoring-access request",
          status == 201 and req.get("status") == "pending" and req.get("requester_role") == "CRO",
          f"POST /monitoring/requests/ -> {status}, id={req.get('id')} role={req.get('requester_role')}")
    req_id = req.get("id") or code

    status, mine = request("GET", "/monitoring/requests/")
    check("CRO lists own monitoring requests", status == 200 and any(r.get("id") == req_id for r in mine),
          f"GET /monitoring/requests/ -> {status}, {len(mine) if isinstance(mine, list) else '?'} rows")

    status, acc = request("GET", f"/monitoring/access-check/?site={SITE_ID}")
    check("CRO access-check returns a decision",
          status == 200 and acc.get("data", {}).get("allowed") is False,
          f"GET /monitoring/access-check/?site={SITE_ID} -> {status} {acc.get('data')}")

    for action in ("approve", "reject", "revoke"):
        status, body = request("PUT", f"/monitoring/requests/{req_id}/{action}/", {"note": "x"})
        check(f"CRO cannot {action.upper()} a monitoring request",
              status == 403 and "role=CRO" in str(body.get("detail")),
              f"PUT /monitoring/requests/{req_id}/{action}/ -> {status} {body.get('detail')}")

    # ---- Cleanup ------------------------------------------------------------
    cleanup_request(req_id)

    failed = [label for label, ok in _checks if not ok]
    print(f"\n{len(_checks) - len(failed)}/{len(_checks)} live checks passed")
    if failed:
        print("FAILED:", failed)
        sys.exit(1)
    print("CRO live RBAC matrix: Safety read-only / Monitoring request rights CONFIRMED")


if __name__ == "__main__":
    main()
