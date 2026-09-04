# tria_engine/tests/test_subject_visit_sync.py
#
# Subjects & visits write-through mirror (frontend subjectService.ts
# subjectsByStudy + visitScheduleService.ts adminSchedules): the same
# bulk-sync contract as the six gap modules, plus the enrollment/screening
# specifics — study-qualified subject sync codes (identical subject numbers
# in different studies must never collide), row-level study scope columns
# for SQL filters, per-record scope skips, RBAC role gates and cross-org
# isolation.

from __future__ import annotations

import uuid

from tria_engine.apps.accounts.models import User
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password

PASSWORD = "RolePass123!"
SUBJECTS_SYNC = "/api/site/subjects/sync"
VISITS_SYNC = "/api/site/visits/sync"


def _org(name: str) -> int:
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.name == name).first()
        if org is None:
            org = Organization(name=name)
            db.add(org)
            db.flush()
        org_id = org.id
        db.commit()
        return org_id
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


def _login(client, email: str, password: str = PASSWORD):
    res = client.post("/api/accounts/login/", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return client


def _as_admin(client):
    return _login(client, "admin@test.local", "AdminPass123!")


def _subject(study: str, subj: str, status: str = "Screened", **over) -> dict:
    return {
        "id": subj,
        "subjectId": subj,
        "studyId": study,
        "initials": "SJ",
        "site": "Site A",
        "siteNo": "SITE-A",
        "status": status,
        "screeningDate": "2026-09-01",
        "enrollmentDate": "—",
        "currentVisit": "Screening",
        "createdAt": "2026-09-01T08:00:00.000Z",
        "updatedAt": "2026-09-01T08:00:00.000Z",
        **over,
    }


def _visit(study: str, subj: str, name: str = "Screening", **over) -> dict:
    return {
        "id": f"{study}::{subj}::{name}",
        "date": "2026-09-02",
        "subjectId": subj,
        "subjectName": subj,
        "visit": name,
        "status": "Scheduled",
        "study": study,
        "site": "—",
        "time": "09:00 AM",
        "studyKey": study,
        "source": "subject",
        **over,
    }


def _sync(client, path: str, records) -> dict:
    res = client.post(path, json={"records": records})
    assert res.status_code == 200, res.text
    return res.json()


# ===========================================================================
# Auth
# ===========================================================================


def test_subject_visit_surfaces_require_auth(client):
    assert client.get("/api/site/subjects/").status_code == 401
    assert client.get("/api/site/visits/").status_code == 401
    assert client.post(SUBJECTS_SYNC, json={"records": []}).status_code == 401
    assert client.post(VISITS_SYNC, json={"records": []}).status_code == 401


# ===========================================================================
# Subjects mirror
# ===========================================================================


def test_subjects_upsert_and_no_cross_study_collision(client):
    _as_admin(client)
    # Same subject number in two different studies must survive as two rows.
    report = _sync(client, SUBJECTS_SYNC, [_subject("TNX-A", "S-1001"), _subject("TNX-B", "S-1001")])
    assert report["created"] == 2 and report["skipped"] == []

    rows = client.get("/api/site/subjects/").json()
    assert len(rows) == 2
    assert {(r["studyId"], r["subjectId"]) for r in rows} == {("TNX-A", "S-1001"), ("TNX-B", "S-1001")}

    # studyId filter narrows.
    assert [r["studyId"] for r in client.get("/api/site/subjects/", params={"studyId": "TNX-A"}).json()] == ["TNX-A"]

    # Idempotent re-push updates in place (never duplicates).
    report = _sync(client, SUBJECTS_SYNC, [_subject("TNX-A", "S-1001", status="Enrolled")])
    assert report["created"] == 0 and report["updated"] == 1
    rows = client.get("/api/site/subjects/").json()
    assert len(rows) == 2
    tnx_a = next(r for r in rows if r["studyId"] == "TNX-A")
    assert tnx_a["status"] == "Enrolled"

    # Detail by the study-qualified sync code.
    detail = client.get(f"/api/site/subjects/TNX-A%3A%3AS-1001").json()
    assert detail["subjectId"] == "S-1001" and detail["studyId"] == "TNX-A"


def test_subjects_rbac_roles(client):
    cro = _seed_user("CRO", "Test Org")
    staff = _seed_user("Site Staff", "Test Org")
    sponsor = _seed_user("Sponsor", "Test Org")

    _login(client, cro)
    res = client.post(SUBJECTS_SYNC, json={"records": [_subject("TNX-C", "S-1")]})
    assert res.status_code == 403  # CRO stays read-only (G3)

    _login(client, staff)
    assert _sync(client, SUBJECTS_SYNC, [_subject("TNX-C", "S-1")])["created"] == 1
    _login(client, sponsor)
    report = _sync(client, SUBJECTS_SYNC, [_subject("TNX-C", "S-2")])
    assert report["created"] == 1 and report["skipped"] == []


def test_subjects_site_staff_study_scope(client):
    staff = _seed_user("Site Staff", "Test Org", scope_data={"studies": ["ST-A"]})
    _login(client, staff)
    # In-scope + out-of-scope records in one push: only ST-A is written.
    report = _sync(client, SUBJECTS_SYNC, [_subject("ST-A", "S-11"), _subject("ST-B", "S-22")])
    assert report["created"] == 1
    assert report["skipped"] and "ST-B" in str(report["skipped"])

    rows = client.get("/api/site/subjects/").json()
    assert [r["studyId"] for r in rows] == ["ST-A"]

    # The out-of-scope write was never persisted: the ST-B row is absent
    # from the store even for a wildcard admin.
    _as_admin(client)
    assert client.get("/api/site/subjects/", params={"studyId": "ST-B"}).json() == []


# ===========================================================================
# Visits mirror
# ===========================================================================


def test_visits_upsert_and_filter(client):
    _as_admin(client)
    report = _sync(
        client,
        VISITS_SYNC,
        [_visit("TNX-A", "S-1001", "Screening"), _visit("TNX-A", "S-1001", "Enrollment", status="Completed")],
    )
    assert report["created"] == 2
    rows = client.get("/api/site/visits/").json()
    assert len(rows) == 2

    # Rescheduling a visit updates the same schedule id in place.
    report = _sync(client, VISITS_SYNC, [_visit("TNX-A", "S-1001", "Screening", date="2026-09-09", status="Completed")])
    assert report["updated"] == 1 and report["created"] == 0
    rows = client.get("/api/site/visits/").json()
    assert len(rows) == 2
    screening = next(r for r in rows if r["visit"] == "Screening")
    assert screening["date"] == "2026-09-09" and screening["status"] == "Completed"

    assert [r["study"] for r in client.get("/api/site/visits/", params={"studyId": "TNX-A"}).json()] == ["TNX-A", "TNX-A"]


def test_visits_role_and_scope(client):
    staff = _seed_user("Site Staff", "Test Org", scope_data={"studies": ["ST-A"]})
    _login(client, staff)
    report = _sync(client, VISITS_SYNC, [_visit("ST-A", "S-1", "Screening"), _visit("ST-B", "S-2", "Screening")])
    assert report["created"] == 1 and len(report["skipped"]) == 1
    assert [r["study"] for r in client.get("/api/site/visits/").json()] == ["ST-A"]

    _as_admin(client)
    cro = _seed_user("CRO", "Test Org")
    _login(client, cro)
    assert client.post(VISITS_SYNC, json={"records": [_visit("ST-C", "S-3", "Screening")]}).status_code == 403


# ===========================================================================
# Cross-org isolation
# ===========================================================================


def test_subject_visit_org_isolation(client):
    _as_admin(client)
    _sync(client, SUBJECTS_SYNC, [_subject("ORG-A-ST", "S-1001")])
    _sync(client, VISITS_SYNC, [_visit("ORG-A-ST", "S-1001", "Screening")])

    org_b = _org("SubjectOrgB")
    staff_b = _seed_user("Site Staff", "SubjectOrgB")
    _login(client, staff_b)
    report = _sync(client, SUBJECTS_SYNC, [_subject("ORG-B-ST", "S-1001")])
    assert report["created"] == 1
    _sync(client, VISITS_SYNC, [_visit("ORG-B-ST", "S-1001", "Screening")])

    # Org B sees only its own rows — even when codes are identical.
    subjects = client.get("/api/site/subjects/").json()
    assert [r["studyId"] for r in subjects] == ["ORG-B-ST"]
    assert len(client.get("/api/site/visits/").json()) == 1
    assert org_b is not None  # org was created (sanity for the fixture)
