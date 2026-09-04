# tria_engine/tests/test_gap_sync.py
#
# Bulk-sync endpoints used by the frontend integration (router_sync.py):
# upsert semantics (create then update in place, never duplicate),
# role enforcement (403 per matrix), per-record site/study scope skip for
# assigned users, cross-org isolation, and empty-payload safety. Records
# are the exact JSON shapes the frontend services store (id = row code).

from __future__ import annotations

import uuid

from tria_engine.apps.accounts.models import User
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password

PASSWORD = "RolePass123!"


def _seed_user(role_name: str, tag: str, scope_data: dict | None = None, org_index: int = 0) -> str:
    db = SessionLocal()
    try:
        org = db.query(Organization).order_by(Organization.id).all()[org_index]
        role = (
            db.query(Role)
            .filter(Role.name == role_name, Role.organization_id == org.id)
            .first()
        )
        if role is None:
            role = Role(name=role_name, organization_id=org.id)
            db.add(role)
            db.flush()
        email = f"{role_name.lower().replace(' ', '.')}.{tag}-{uuid.uuid4().hex[:6]}@test.local"
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


def _admin(client):
    res = client.post(
        "/api/accounts/login/",
        json={"email": "admin@test.local", "password": "AdminPass123!"},
    )
    assert res.status_code == 200, res.text
    return client


def _sync(client, path: str, records) -> dict:
    res = client.post(path, json={"records": records})
    assert res.status_code == 200, res.text
    return res.json()


def _amendment(study: str = "STUDY-SYNC", tag: str = "") -> dict:
    return {
        "id": f"AMD-SYNC-{uuid.uuid4().hex[:6]}",
        "studyCode": study,
        "amendmentNumber": f"AM-{tag or uuid.uuid4().hex[:4]}",
        "version": "1.0",
        "classification": "Non-substantial",
        "effectiveDate": "2026-09-01",
        "summary": "sync test amendment",
    }


def _lot(study: str, site: str, quantity: int = 5) -> dict:
    return {
        "id": f"IPL-SYNC-{uuid.uuid4().hex[:6]}",
        "studyCode": study,
        "siteCode": site,
        "lotNumber": f"LOT-SYNC-{uuid.uuid4().hex[:4]}",
        "quantity": quantity,
        "status": "Shipped",
    }


# ==========================================================================
# Amendments — create + idempotent update
# ==========================================================================


def test_sync_creates_then_updates_in_place(client):
    email = _seed_user("Sponsor", tag="syn1")
    _login(client, email)

    record = _amendment(tag="one")
    report = _sync(client, "/api/site/amendments/sync", [record])
    assert report["created"] == 1
    assert report["updated"] == 0
    assert report["skipped"] == []

    res = client.get("/api/site/amendments/")
    assert res.status_code == 200
    assert any(r["id"] == record["id"] for r in res.json())

    # Same id pushed again -> update, never a duplicate.
    changed = {**record, "summary": "updated via sync"}
    report2 = _sync(client, "/api/site/amendments/sync", [changed])
    assert report2["created"] == 0
    assert report2["updated"] == 1

    res = client.get("/api/site/amendments/")
    rows = [r for r in res.json() if r["id"] == record["id"]]
    assert len(rows) == 1
    assert rows[0]["summary"] == "updated via sync"


def test_sync_empty_payload_is_safe(client):
    email = _seed_user("Sponsor", tag="syn2")
    _login(client, email)
    report = _sync(client, "/api/site/amendments/sync", [])
    assert report == {"synced": 0, "created": 0, "updated": 0, "skipped": []}


# ==========================================================================
# IP — scoped Site Staff pushes in-scope lots and skips out-of-scope ones
# ==========================================================================


def test_scoped_site_staff_sync_skips_other_sites(client):
    _admin(client)
    # Seed via sync as admin: one lot on SITE-A, one on SITE-B.
    lot_a = _lot("STUDY-SYNC-IP", "SITE-A")
    lot_b = _lot("STUDY-SYNC-IP", "SITE-B")
    _sync(client, "/api/site/ip/sync", [lot_a, lot_b])

    # Site Staff scoped to SITE-A pushes the same two records back.
    _login(client, _seed_user("Site Staff", tag="syn3", scope_data={"sites": ["SITE-A"]}))
    report = _sync(client, "/api/site/ip/sync", [lot_a, lot_b])
    assert report["created"] == 0
    assert report["updated"] == 1
    assert len(report["skipped"]) == 1
    assert report["skipped"][0]["id"] == lot_b["id"]
    assert "outside your assigned site scope" in report["skipped"][0]["reason"]


# ==========================================================================
# IRB — role enforcement (CRO has no update right on IRB -> 403)
# ==========================================================================


def test_cro_cannot_sync_irb(client):
    _login(client, _seed_user("CRA", tag="syn4"))
    record = _amendment(tag="irb")
    record["id"] = f"IRB-SYNC-{uuid.uuid4().hex[:6]}"
    record["type"] = "Initial"
    record["title"] = "sync"
    res = client.post("/api/site/irb/sync", json={"records": [record]})
    assert res.status_code == 403, res.text


# ==========================================================================
# Every other collection endpoint accepts records and persists them
# ==========================================================================


def test_all_module_sync_endpoints_persist(client):
    email = _seed_user("Sponsor", tag="syn5")
    _login(client, email)

    cases = [
        ("/api/site/irb/sync", {**_amendment(tag="irb"), "id": f"IRB-SYNC-{uuid.uuid4().hex[:6]}", "type": "Initial", "title": "sync", "siteCode": "SITE-A"}),
        ("/api/site/icf/versions/sync", {"id": f"ICFV-SYNC-{uuid.uuid4().hex[:6]}", "studyCode": "STUDY-SYNC", "siteCode": "SITE-A", "version": "1.0", "language": "en"}),
        ("/api/site/icf/events/sync", {"id": f"ICEV-SYNC-{uuid.uuid4().hex[:6]}", "studyCode": "STUDY-SYNC", "siteCode": "SITE-A", "subjectId": "SUB-1"}),
        ("/api/site/icf/campaigns/sync", {"id": f"ICFC-SYNC-{uuid.uuid4().hex[:6]}", "studyCode": "STUDY-SYNC", "siteCode": "SITE-A", "title": "re-consent"}),
        ("/api/site/vendors/sync", {"id": f"VND-SYNC-{uuid.uuid4().hex[:6]}", "name": "Central Lab Sync", "type": "Central Lab"}),
        ("/api/site/vendors/kits/sync", {"id": f"KIT-SYNC-{uuid.uuid4().hex[:6]}", "studyCode": "STUDY-SYNC", "vendorId": "VND-1", "subjectId": "SUB-1"}),
        ("/api/site/feasibility/sync", {"id": f"FC-SYNC-{uuid.uuid4().hex[:6]}", "studyCode": "STUDY-SYNC", "institution": "Apollo Hospital"}),
        ("/api/site/feasibility-scoring/sync", {"id": "STUDY-SYNC", "studyCode": "STUDY-SYNC", "criteria": [], "minScore": 60}),
    ]
    for path, record in cases:
        report = _sync(client, path, [record])
        assert report["created"] == 1, (path, report)
        assert report["skipped"] == [], (path, report)

    # Confirm two representative reads reflect the pushed data.
    res = client.get("/api/site/vendors/")
    assert any(r["name"] == "Central Lab Sync" for r in res.json())
    res = client.get("/api/site/feasibility/")
    assert any(r["institution"] == "Apollo Hospital" for r in res.json())


# ==========================================================================
# Cross-org isolation: same id in another org never touches this org's row
# ==========================================================================


def test_sync_is_org_isolated(client):
    email_a = _seed_user("Sponsor", tag="syn6a")
    _login(client, email_a)
    record = _amendment(tag="iso")
    _sync(client, "/api/site/amendments/sync", [record])

    # Second org pushes the SAME id -> must not overwrite org A's record.
    db = SessionLocal()
    try:
        db.add(Organization(name="Sync Org B"))
        db.commit()
    finally:
        db.close()
    email_b = _seed_user("Sponsor", tag="syn6b", org_index=1)
    _login(client, email_b)
    report = _sync(client, "/api/site/amendments/sync", [{**record, "summary": "tampered"}])
    assert report["created"] == 1  # separate org row

    _login(client, email_a)
    res = client.get("/api/site/amendments/")
    rows = [r for r in res.json() if r["id"] == record["id"]]
    assert len(rows) == 1
    assert rows[0]["summary"] == "sync test amendment"
