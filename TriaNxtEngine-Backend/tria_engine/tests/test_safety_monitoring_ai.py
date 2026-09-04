# tria_engine/tests/test_safety_monitoring_ai.py
#
# Backend suites for the three API-gated page surfaces that used to 404 in
# API mode: Safety Center (AE/SAE), Monitoring Access, and AI Review.
# Each test exercises the EXACT wire contract the frontend api modules
# expect (bare-array lists where the page does Array.isArray on the body,
# {"data": ...} envelopes where the page reads res.data, and
# {"message": ...} error bodies the client parses) plus auth, RBAC role
# enforcement, org isolation and SQL-level study scope for Site Staff.

from __future__ import annotations

import uuid
from datetime import date, timedelta

from tria_engine.apps.accounts.models import User
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password

PASSWORD = "RolePass123!"


def _org(name: str) -> tuple[int, str]:
    """Create/get an org; return (id, name) as plain values so callers never
    touch a detached ORM instance after the session closes."""
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.name == name).first()
        if org is None:
            org = Organization(name=name)
            db.add(org)
            db.flush()
        org_id, org_name = org.id, org.name
        db.commit()
        return org_id, org_name
    finally:
        db.close()


def _seed_user(role_name: str, org_name: str, scope_data: dict | None = None) -> str:
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.name == org_name).one()
        role = (
            db.query(Role)
            .filter(Role.name == role_name, Role.organization_id == org.id)
            .first()
        )
        if role is None:
            role = Role(name=role_name, organization_id=org.id)
            db.add(role)
            db.flush()
        email = f"{role_name.lower().replace(' ', '.')}.{uuid.uuid4().hex[:6]}@test.local"
        db.add(
            User(
                username=email.split("@")[0],
                email=email,
                password=hash_password(PASSWORD),
                first_name=role_name,
                last_name="User",
                is_active=True,
                organization_id=org.id,
                role_id=role.id,
                scope_data=scope_data,
            )
        )
        db.commit()
        return email
    finally:
        db.close()


def _login(client, email: str):
    res = client.post(
        "/api/accounts/login/",
        json={"email": email, "password": PASSWORD},
    )
    assert res.status_code == 200, res.text
    return client


def _as_admin(client):
    res = client.post(
        "/api/accounts/login/",
        json={"email": "admin@test.local", "password": "AdminPass123!"},
    )
    assert res.status_code == 200, res.text
    return client


def _logout(client):
    client.cookies.clear()
    return client


def _ae_payload(study: str = "STUDY-AE", subject: str = "S-1001") -> dict:
    return {
        "study_id": study,
        "subject_ref": subject,
        "description": "Mild headache after first dose",
        "is_serious": False,
    }


def _mk_case(client, study: str = "STUDY-AE", subject: str = "S-1001", **over):
    """Create an AE case. `study` maps to the payload's study_id key."""
    payload = _ae_payload(study=study, subject=subject)
    payload.update(over)
    return client.post("/safety/ae-cases/", json=payload)


# ===========================================================================
# Auth
# ===========================================================================


def test_new_surfaces_require_auth(client):
    assert client.get("/safety/ae-cases/").status_code == 401
    assert client.get("/monitoring/requests/").status_code == 401
    assert client.get("/organizations/").status_code == 401
    assert client.get("/ai-review/copilot?q=oncology").status_code == 401
    assert client.get("/ai-review/sites/1/risk").status_code == 401


# ===========================================================================
# Safety — Safety Center (safetyApi.ts wire contract)
# ===========================================================================


def test_safety_create_list_detail_envelope(client):
    _as_admin(client)
    res = _mk_case(client)
    assert res.status_code == 201, res.text
    case = res.json()
    assert case["id"].startswith("AE-")
    assert case["study_id"] == "STUDY-AE"
    assert case["subject_ref"] == "S-1001"
    assert case["status"] == "Open"
    assert case["pv_case_reference"] is None
    assert case["is_serious"] is False

    # List is a bare array (page does Array.isArray on the body).
    rows = client.get("/safety/ae-cases/").json()
    assert isinstance(rows, list) and len(rows) == 1

    # Summary is under {"data": ...} with the KPI keys the page reads.
    summary = client.get("/safety/ae-cases/summary/").json()["data"]
    assert summary == {"total": 1, "serious": 0, "open": 1, "reconciled": 0}

    # Detail by id; unknown -> 404 {"message": ...}.
    detail = client.get(f"/safety/ae-cases/{case['id']}/")
    assert detail.status_code == 200 and detail.json()["id"] == case["id"]
    assert client.get("/safety/ae-cases/UNKNOWN/").status_code == 404

    # studyId filter narrows list and summary.
    assert client.get("/safety/ae-cases/", params={"studyId": "OTHER"}).json() == []
    assert client.get("/safety/ae-cases/summary/", params={"studyId": "OTHER"}).json()["data"][
        "total"
    ] == 0


def test_safety_validation_and_serious_summary(client):
    _as_admin(client)
    assert _mk_case(client, description="").status_code == 400
    r1 = _mk_case(client, study="STUDY-VAL", is_serious=True)
    assert r1.status_code == 201, r1.text
    r2 = _mk_case(client, study="STUDY-VAL", subject_ref="S-1002")
    assert r2.status_code == 201, r2.text
    summary = client.get("/safety/ae-cases/summary/", params={"studyId": "STUDY-VAL"}).json()["data"]
    assert summary["total"] == 2 and summary["serious"] == 1 and summary["open"] == 2


def test_safety_patch_and_reconcile(client):
    _as_admin(client)
    case_id = _mk_case(client, study="STUDY-PAT").json()["id"]
    patched = client.patch(f"/safety/ae-cases/{case_id}/", json={"outcome": "Resolved"}).json()
    assert patched["outcome"] == "Resolved"

    res = client.post(
        f"/safety/ae-cases/{case_id}/reconcile/", json={"pv_case_reference": "PV-8821"}
    )
    assert res.status_code == 200, res.text
    case = res.json()
    assert case["status"] == "Reconciled"
    assert case["pv_case_reference"] == "PV-8821"
    assert client.post(f"/safety/ae-cases/{case_id}/reconcile/", json={"pv_case_reference": ""}).status_code == 400


def test_safety_rbac_roles(client):
    sponsor = _seed_user("Sponsor", "Test Org")
    cro = _seed_user("CRO", "Test Org")

    # Sponsor may report + reconcile (SAE oversight); CRO is read-only.
    _login(client, sponsor)
    assert client.get("/safety/ae-cases/", params={"studyId": "STUDY-SP"}).json() == []
    res = _mk_case(client, study="STUDY-SP")
    assert res.status_code == 201, res.text

    case_id = res.json()["id"]
    assert client.get("/safety/ae-cases/summary/", params={"studyId": "STUDY-SP"}).json()["data"]["total"] == 1

    _login(client, cro)
    assert client.get("/safety/ae-cases/").status_code == 200
    assert _mk_case(client, study="STUDY-SP").status_code == 403
    assert client.post(
        f"/safety/ae-cases/{case_id}/reconcile/", json={"pv_case_reference": "PV-1"}
    ).status_code == 403


def test_safety_site_staff_study_scope_sql(client):
    """Site Staff assigned study ST-A sees only its cases — the filter runs
    at the SQL level through the row.study_id column."""
    staff = _seed_user("Site Staff", "Test Org", scope_data={"studies": ["ST-A"]})
    _as_admin(client)
    _mk_case(client, study="ST-A", subject="S-A1")
    _mk_case(client, study="ST-B", subject="S-B1")

    _login(client, staff)
    rows = client.get("/safety/ae-cases/").json()
    assert [r["study_id"] for r in rows] == ["ST-A"]
    assert client.get("/safety/ae-cases/summary/").json()["data"]["total"] == 1

    # Write out of study scope -> 403 and no row persisted.
    res = _mk_case(client, study="ST-B")
    assert res.status_code == 403
    assert len(client.get("/safety/ae-cases/").json()) == 1

    # In-scope write succeeds.
    res = _mk_case(client, study="ST-A", subject="S-A2")
    assert res.status_code == 201
    assert client.get("/safety/ae-cases/summary/").json()["data"]["total"] == 2


# ===========================================================================
# Monitoring Access (monitoringApi.ts wire contract)
# ===========================================================================


def _mon_payload(site_id: str, start: str = "2026-09-10", end: str = "2026-09-14") -> dict:
    return {"site": site_id, "start_date": start, "end_date": end, "reason": "Routine monitoring visit"}


def test_monitoring_request_flow(client):
    _as_admin(client)
    org_id, _ = _org("SafetyOrg")
    # Baseline: empty list (no 404), picker lists the org.
    assert client.get("/monitoring/requests/").json() == []
    orgs = client.get("/organizations/").json()
    assert {"id": str(org_id), "name": "SafetyOrg"} in orgs

    cro = _seed_user("CRO", "SafetyOrg")
    staff = _seed_user("Site Staff", "SafetyOrg")
    _login(client, cro)
    # Request window must cover TODAY for the access-check to be allowed.
    window_end = date.today() + timedelta(days=5)
    res = client.post(
        "/monitoring/requests/",
        json=_mon_payload(str(org_id), start=date.today().isoformat(), end=window_end.isoformat()),
    )
    assert res.status_code == 201, res.text
    req = res.json()
    assert req["status"] == "pending"
    assert req["site_name"] == "SafetyOrg"
    assert req["requester_role"] == "CRO"
    assert req["requested_by_name"]  # server-resolved, never client-supplied

    # Requester sees own list; row shape matches the UI columns.
    rows = client.get("/monitoring/requests/").json()
    assert len(rows) == 1
    for key in ("requested_by_name", "requester_role_label", "site_name", "start_date", "end_date", "reason", "status"):
        assert key in rows[0]

    # Validation parity with the page.
    assert client.post("/monitoring/requests/", json={"site": "", "start_date": "x", "end_date": "y"}).status_code == 400
    assert client.post(
        "/monitoring/requests/", json=_mon_payload(str(org_id), start="2026-09-20", end="2026-09-10")
    ).status_code == 400
    assert client.post("/monitoring/requests/", json=_mon_payload("999999")).status_code == 400

    # Staff approves; CRO list + access-check reflect it.
    _login(client, staff)
    res = client.put(f"/monitoring/requests/{req['id']}/approve/", json={"note": "OK"})
    assert res.status_code == 200 and res.json()["status"] == "approved"
    assert client.put(f"/monitoring/requests/{req['id']}/approve/", json={"note": "again"}).status_code == 400

    _login(client, cro)
    assert client.get("/monitoring/requests/").json()[0]["status"] == "approved"
    check = client.get("/monitoring/access-check/", params={"site": str(org_id)}).json()["data"]
    assert check["allowed"] is True and check["valid_until"] == window_end.isoformat()


def test_monitoring_reject_and_revoke(client):
    org_id, _ = _org("SafetyOrg2")
    cro = _seed_user("CRO", "SafetyOrg2")
    staff = _seed_user("Site Staff", "SafetyOrg2")
    _login(client, cro)
    res = client.post("/monitoring/requests/", json=_mon_payload(str(org_id)))
    assert res.status_code == 201, res.text
    req_id = res.json()["id"]
    _login(client, staff)
    # Reject only valid from pending.
    res = client.put(f"/monitoring/requests/{req_id}/reject/", json={"note": "busy week"})
    assert res.status_code == 200 and res.json()["status"] == "rejected"
    assert client.put(f"/monitoring/requests/{req_id}/reject/", json={}).status_code == 400

    # Revoke needs an approved request.
    _login(client, cro)
    res = client.post("/monitoring/requests/", json=_mon_payload(str(org_id)))
    assert res.status_code == 201, res.text
    req2 = res.json()["id"]
    _login(client, staff)
    assert client.put(f"/monitoring/requests/{req_id}/revoke/", json={}).status_code == 400
    assert client.put(f"/monitoring/requests/{req2}/approve/", json={}).status_code == 200
    res = client.put(f"/monitoring/requests/{req2}/revoke/", json={"note": "monitor left"})
    assert res.status_code == 200 and res.json()["status"] == "revoked"
    # Revoked access no longer allows entry.
    check = client.get("/monitoring/access-check/", params={"site": str(org_id)}).json()["data"]
    assert check["allowed"] is False


def test_monitoring_rbac_and_org_isolation(client):
    org_a_id, _ = _org("SafetyOrgA")
    _org("SafetyOrgB")
    sponsor_a = _seed_user("Sponsor", "SafetyOrgA")
    staff_b = _seed_user("Site Staff", "SafetyOrgB")
    _login(client, sponsor_a)
    res = client.post("/monitoring/requests/", json=_mon_payload(str(org_a_id)))
    assert res.status_code == 201, res.text
    req_id = res.json()["id"]

    # Cross-org: staff B cannot see or decide on org A's request.
    _login(client, staff_b)
    assert client.get("/monitoring/requests/").json() == []
    assert client.put(f"/monitoring/requests/{req_id}/approve/", json={}).status_code == 404

    # CRO is a requester, not an approver -> 403 on decisions.
    cro = _seed_user("CRO", "SafetyOrgA")
    _login(client, cro)
    assert client.put(f"/monitoring/requests/{req_id}/approve/", json={}).status_code == 403

    # Site Staff of the SAME org approves fine.
    staff_a = _seed_user("Site Staff", "SafetyOrgA")
    _login(client, staff_a)
    assert client.put(f"/monitoring/requests/{req_id}/approve/", json={}).status_code == 200


# ===========================================================================
# AI Review (aiReviewApi.ts wire contract)
# ===========================================================================


def test_ai_site_risk_envelope(client):
    _as_admin(client)
    org_id, _ = _org("AIRiskOrg")
    # No data yet -> {"data": {...}} with score 0 + reasons.
    res = client.get(f"/ai-review/sites/{org_id}/risk").json()["data"]
    assert "score" in res and "reasons" in res and "model" in res
    assert res["score"] == 0
    # Pending monitoring request raises the score with a reason.
    cro = _seed_user("CRO", "AIRiskOrg")
    _login(client, cro)
    r = client.post("/monitoring/requests/", json=_mon_payload(str(org_id)))
    assert r.status_code == 201, r.text
    _as_admin(client)
    res = client.get(f"/ai-review/sites/{org_id}/risk").json()["data"]
    assert res["score"] >= 20 and any("monitoring" in r for r in res["reasons"])


def test_ai_copilot_keyword_fallback(client):
    _as_admin(client)
    _org("Oncology Center")
    _org("Cardiology Institute")
    res = client.get("/ai-review/copilot", params={"q": "oncology phase 2"}).json()["data"]
    assert res["answer_mode"] == "keyword-fallback"
    codes = [m["code"] for m in res["matches"]]
    assert "Oncology Center" in codes
    assert "Cardiology Institute" not in codes
    assert all({"id", "code", "name", "status"} <= set(m) for m in res["matches"])

    # Copilot corpus also surfaces study codes referenced by in-scope AE cases.
    _mk_case(client, study="STUDY-ONCO-01")
    res = client.get("/ai-review/copilot", params={"q": "ONCO"}).json()["data"]
    assert any(m["code"] == "STUDY-ONCO-01" for m in res["matches"])


def test_ai_advisory_writes_and_rbac(client):
    _as_admin(client)
    qc = client.post("/ai-review/documents/DOC-1/qc").json()["data"]
    assert qc["document_id"] == "DOC-1" and qc["qc_status"] == "no-source-store"
    triage = client.post("/ai-review/comments/C-1/triage").json()["data"]
    assert triage["comment_id"] == "C-1"
    assert client.post("/ai-review/findings/F-1/decision", json={"decision": "Bogus"}).status_code == 400
    decided = client.post(
        "/ai-review/findings/F-1/decision", json={"decision": "Accepted", "rationale": "looks right"}
    ).json()["data"]
    assert decided["decision"] == "Accepted"

    # Site Staff (no AI write role) -> 403; Sponsor allowed.
    staff = _seed_user("Site Staff", "Test Org")
    sponsor = _seed_user("Sponsor", "Test Org")
    _login(client, staff)
    assert client.post("/ai-review/documents/DOC-2/qc").status_code == 403
    _login(client, sponsor)
    assert client.post("/ai-review/documents/DOC-2/qc").status_code == 200
