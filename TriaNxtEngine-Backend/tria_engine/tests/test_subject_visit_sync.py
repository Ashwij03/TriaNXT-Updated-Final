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
from datetime import date, timedelta

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


# ===========================================================================
# Aggregate summary endpoints (dashboard KPIs in API mode)
#
# GET /api/site/subjects/summary/ and GET /api/site/visits/summary/ return
# {"data": {...}} envelopes (Safety-Center convention) so Sponsor/CRO/Site
# Staff dashboards can read mirror totals instead of counting local stores.
# ===========================================================================

SUBJECTS_SUMMARY = "/api/site/subjects/summary/"
VISITS_SUMMARY = "/api/site/visits/summary/"


def test_summary_endpoints_require_auth(client):
    assert client.get(SUBJECTS_SUMMARY).status_code == 401
    assert client.get(VISITS_SUMMARY).status_code == 401


def test_subject_summary_canonical_counts_and_study_filter(client):
    """Totals bucket into the six canonical statuses (legacy "Screening" /
    "Randomized" tokens normalized like the frontend) and narrow by studyId."""
    _as_admin(client)
    _sync(
        client,
        SUBJECTS_SYNC,
        [
            _subject("TNX-SUM-A", "S-01", status="Screened"),
            _subject("TNX-SUM-A", "S-02", status="Enrolled"),
            _subject("TNX-SUM-A", "S-03", status="Ongoing"),
            _subject("TNX-SUM-A", "S-04", status="Withdrawn"),
            _subject("TNX-SUM-A", "S-05", status="Screening"),  # legacy -> Screened
            _subject("TNX-SUM-A", "S-06", status="Randomized"),  # legacy -> Enrolled
            _subject("TNX-SUM-B", "S-01", status="Completed"),
        ],
    )

    # Unique study codes keep the totals hermetic even though this module's
    # earlier admin tests share the "Test Org" database.
    data = client.get(SUBJECTS_SUMMARY, params={"studyId": "TNX-SUM-A"}).json()["data"]
    assert data["total"] == 6
    assert data["byStatus"] == {
        "Screened": 2,
        "Enrolled": 2,
        "Ongoing": 1,
        "Completed": 0,
        "Withdrawn": 1,
        "Dropout": 0,
    }
    # Enrolled-stage KPIs = Enrolled + Ongoing + Completed (isEnrolledSubjectStatus).
    assert data["enrolled"] == 3

    # studyId filter narrows to the other study; the shape stays zero-padded.
    only_b = client.get(SUBJECTS_SUMMARY, params={"studyId": "TNX-SUM-B"}).json()["data"]
    assert only_b["total"] == 1
    assert only_b["byStatus"]["Completed"] == 1 and only_b["enrolled"] == 1

    empty = client.get(SUBJECTS_SUMMARY, params={"studyId": "TNX-NOPE"}).json()["data"]
    assert empty["total"] == 0
    assert empty["byStatus"] == {s: 0 for s in ("Screened", "Enrolled", "Ongoing", "Completed", "Withdrawn", "Dropout")}


def test_visit_summary_counts_and_window(client):
    """Visits total by status; `upcoming` counts dated, still-active rows in
    the next-`window` days (completed/cancelled/missed and undated never)."""
    _as_admin(client)
    today = date.today().isoformat()
    d = lambda offset: (date.today() + timedelta(days=offset)).isoformat()
    _sync(
        client,
        VISITS_SYNC,
        [
            _visit("TNX-VSUM", "S-01", "Screening", date=today, status="Scheduled"),
            _visit("TNX-VSUM", "S-01", "Visit 1", date=d(3), status="Scheduled"),
            _visit("TNX-VSUM", "S-02", "Screening", date=today, status="Completed"),
            _visit("TNX-VSUM", "S-02", "Visit 1", date=d(40), status="Scheduled"),
            _visit("TNX-VSUM", "S-02", "Visit 2", date="", status="Scheduled"),
            _visit("TNX-VSUM", "S-03", "Screening", date=today, status="Cancelled"),
            _visit("TNX-VSUM", "S-03", "Visit 1", date=d(-1), status="Completed"),
        ],
    )

    # Unique study code keeps the counts hermetic (see subject summary test).
    data = client.get(VISITS_SUMMARY, params={"studyId": "TNX-VSUM"}).json()["data"]
    assert data["total"] == 7
    assert data["byStatus"] == {"Scheduled": 4, "Completed": 2, "Cancelled": 1}
    assert data["scheduled"] == 4
    assert data["completed"] == 2
    # Upcoming: today Scheduled + d(3) Scheduled (+40 and undated are outside;
    # Completed/Cancelled are inactive regardless of date).
    assert data["upcoming"] == 2

    # Narrow window excludes the d(3) row; an unknown study is an empty envelope.
    one_day = client.get(VISITS_SUMMARY, params={"studyId": "TNX-VSUM", "window": 1}).json()["data"]
    assert one_day["upcoming"] == 1
    other = client.get(VISITS_SUMMARY, params={"studyId": "TNX-VSUM-OTHER"}).json()["data"]
    assert other["total"] == 0 and other["upcoming"] == 0


def test_summary_reads_are_org_scoped_and_readonly_roles_can_read(client):
    """A read-only role (CRO/Sponsor) can read the aggregate envelopes but
    only ever sees its own organization's mirror rows (same scope as lists)."""
    _org("SumOrgA")
    _org("SumOrgB")
    sponsor_a = _seed_user("Sponsor", "SumOrgA")
    sponsor_b = _seed_user("Sponsor", "SumOrgB")
    cro_a = _seed_user("CRO", "SumOrgA")

    today = date.today().isoformat()
    _login(client, sponsor_a)
    _sync(
        client,
        SUBJECTS_SYNC,
        [
            _subject("SUM-ST", "S-1", status="Enrolled"),
            _subject("SUM-ST", "S-2", status="Screened"),
        ],
    )
    _sync(client, VISITS_SYNC, [_visit("SUM-ST", "S-1", "Visit 1", date=today, status="Scheduled")])

    _login(client, sponsor_b)
    _sync(client, SUBJECTS_SYNC, [_subject("OTHER-ST", "S-1", status="Completed")])
    _sync(client, VISITS_SYNC, [_visit("OTHER-ST", "S-1", "Visit 1", date=today, status="Scheduled")])

    # CRO (read-only on subjects/visits writes per the matrix) reads Org A only.
    _login(client, cro_a)
    subjects = client.get(SUBJECTS_SUMMARY).json()["data"]
    assert subjects["total"] == 2
    assert subjects["byStatus"]["Enrolled"] == 1 and subjects["byStatus"]["Screened"] == 1
    assert subjects["byStatus"]["Completed"] == 0  # Org B's row never leaks
    visits = client.get(VISITS_SUMMARY).json()["data"]
    assert visits["total"] == 1 and visits["byStatus"].get("Scheduled") == 1

    # studyId filter never leaks across orgs either.
    other = client.get(SUBJECTS_SUMMARY, params={"studyId": "OTHER-ST"}).json()["data"]
    assert other["total"] == 0
