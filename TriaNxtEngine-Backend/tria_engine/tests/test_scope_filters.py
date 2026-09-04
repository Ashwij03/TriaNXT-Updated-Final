# tria_engine/tests/test_scope_filters.py
#
# SQL-level site/study scope tests for the ctms gap-record tables
# (RBAC_Implementation_Prompt.md Section 4.2 + validation S1/S2, P1/P8,
# C1/C7):
#
#   * ctms records now persist first-class study_id / site_id columns
#     extracted from the record's studyCode / siteCode at write time.
#   * list_records / load_row apply the scope filter at the SQL level:
#       - superuser Admin            -> wildcard (validation A1)
#       - Site Staff / PI / CRO with scope_data assignments -> record's
#         study/site must be in the assigned set (NULL site/study on the
#         record = org-level row, visible to every org member)
#       - users with no assignment   -> plain organization scope (unchanged)
#   * assert_write_scope rejects out-of-scope writes with 403 before any
#     row is persisted.
#   * schema_ensure backfills study_id / site_id from the record JSON for
#     databases created before the columns existed.
#
# Existing conftest users are superuser Admins; non-admin actors are seeded
# per-test with org-scoped roles, mirroring test_rbac.py.

from __future__ import annotations

import uuid

import pytest

from tria_engine.apps.accounts.models import User
from tria_engine.apps.ctms.models import CtmsIrbSubmission
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.core.database import SessionLocal, engine
from tria_engine.core.schema_ensure import (
    ensure_accounts_scope_column,
    ensure_ctms_scope_columns,
    ensure_schema_columns,
)
from tria_engine.core.security import hash_password

PASSWORD = "RolePass123!"

STUDY_A = "STUDY-SCOPED-A"
STUDY_B = "STUDY-SCOPED-B"
SITE_1 = "SITE-SCOPED-1"
SITE_2 = "SITE-SCOPED-2"


def _seed_user(role_name: str, tag: str, scope_data: dict | None = None) -> str:
    """Create an org-scoped user (optionally with site/study scope_data) in
    the seed organization and return its email."""
    db = SessionLocal()
    try:
        org = db.query(Organization).order_by(Organization.id).first()
        role = (
            db.query(Role)
            .filter(Role.name == role_name, Role.organization_id == org.id)
            .first()
        )
        if role is None:
            role = Role(name=role_name, organization_id=org.id)
            db.add(role)
            db.flush()
        unique = f"{tag}-{uuid.uuid4().hex[:6]}"
        email = f"{role_name.lower().replace(' ', '.')}.{unique}@test.local"
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


def _irb_payload(study: str, site: str, tag: str) -> dict:
    return {
        "studyCode": study,
        "siteCode": site,
        "type": "Initial",
        "title": f"IRB scope test {tag} {uuid.uuid4().hex[:6]}",
    }


def _ship_payload(study: str, site: str) -> dict:
    return {
        "studyCode": study,
        "siteCode": site,
        "lotNumber": f"LOT-SC-{uuid.uuid4().hex[:6]}",
        "quantity": 5,
    }


def _sponsor_irb(client, study: str, site: str, tag: str) -> str:
    """Org-A Sponsor creates an IRB submission; returns its id."""
    _login(client, _seed_user("Sponsor", tag=tag))
    res = client.post("/api/site/irb/", json=_irb_payload(study, site, tag))
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _irb_ids(client) -> list[str]:
    res = client.get("/api/site/irb/")
    assert res.status_code == 200, res.text
    return [r["id"] for r in res.json()]


# ==========================================================================
# Columns are persisted at write time (the SQL filter reads them)
# ==========================================================================


def test_record_study_site_columns_persisted(client):
    irb_a = _sponsor_irb(client, STUDY_A, SITE_1, "cola")
    irb_nosite = _sponsor_irb(client, STUDY_A, "", "colb")

    db = SessionLocal()
    try:
        row_a = db.query(CtmsIrbSubmission).filter(CtmsIrbSubmission.code == irb_a).one()
        assert row_a.study_id == STUDY_A
        assert row_a.site_id == SITE_1

        row_nosite = (
            db.query(CtmsIrbSubmission)
            .filter(CtmsIrbSubmission.code == irb_nosite)
            .one()
        )
        assert row_nosite.study_id == STUDY_A
        assert row_nosite.site_id is None  # org-level row stays visible to all
    finally:
        db.close()


# ==========================================================================
# S1/S2 — Site Staff sees only the assigned site (SQL level)
# ==========================================================================


def test_site_staff_list_filtered_by_assigned_site(client):
    irb_site1 = _sponsor_irb(client, STUDY_A, SITE_1, "ss1a")
    irb_site2 = _sponsor_irb(client, STUDY_A, SITE_2, "ss1b")
    irb_nosite = _sponsor_irb(client, STUDY_A, "", "ss1c")

    _login(client, _seed_user("Site Staff", tag="ss1", scope_data={"sites": [SITE_1]}))

    visible = _irb_ids(client)
    assert irb_site1 in visible
    assert irb_site2 not in visible  # other site filtered at SQL level
    assert irb_nosite in visible  # org-level row visible to all org members

    # Direct ID access to the out-of-scope record -> 404, not the data (S2)
    res = client.get(f"/api/site/irb/{irb_site2}")
    assert res.status_code == 404, res.text

    res = client.get(f"/api/site/irb/{irb_site1}")
    assert res.status_code == 200, res.text


# ==========================================================================
# P1/P8 — PI sees only the assigned study(ies)
# ==========================================================================


def test_pi_list_filtered_by_assigned_study(client):
    irb_study_a = _sponsor_irb(client, STUDY_A, SITE_1, "pi1a")
    irb_study_b = _sponsor_irb(client, STUDY_B, SITE_1, "pi1b")

    _login(
        client,
        _seed_user("PI", tag="pi1", scope_data={"studies": [STUDY_A]}),
    )

    visible = _irb_ids(client)
    assert irb_study_a in visible
    assert irb_study_b not in visible

    res = client.get(f"/api/site/irb/{irb_study_b}")
    assert res.status_code == 404, res.text  # different study -> 404


# ==========================================================================
# C1/C7 — CRO sees only the assigned sites (multi-site)
# ==========================================================================


def test_cro_list_filtered_by_assigned_sites(client):
    irb_site1 = _sponsor_irb(client, STUDY_A, SITE_1, "cro1a")
    irb_site2 = _sponsor_irb(client, STUDY_A, SITE_2, "cro1b")

    _login(
        client,
        _seed_user("CRA", tag="cro1", scope_data={"sites": [SITE_1]}),
    )

    visible = _irb_ids(client)
    assert irb_site1 in visible
    assert irb_site2 not in visible  # CRO cannot reach an unassigned site

    res = client.get(f"/api/site/irb/{irb_site2}")
    assert res.status_code == 404, res.text


# ==========================================================================
# Out-of-scope writes -> 403 before any row is persisted
# ==========================================================================


def test_site_staff_write_out_of_scope_site_403(client):
    _login(client, _seed_user("Site Staff", tag="w1", scope_data={"sites": [SITE_1]}))

    # IRB create targeting an unassigned site -> 403
    res = client.post("/api/site/irb/", json=_irb_payload(STUDY_A, SITE_2, "w1"))
    assert res.status_code == 403, res.text
    assert "outside your assigned site scope" in res.json()["detail"]

    # IP shipment targeting an unassigned site -> 403
    res = client.post(
        "/api/site/ip/shipments/",
        json=_ship_payload(STUDY_A, SITE_2),
    )
    assert res.status_code == 403, res.text

    # In-scope writes still succeed (same role, assigned site)
    res = client.post(
        "/api/site/ip/shipments/",
        json=_ship_payload(STUDY_A, SITE_1),
    )
    assert res.status_code == 201, res.text


def test_pi_write_out_of_scope_study_404(client):
    # PI may not create IRB (403 from the matrix first), so scope-on-read is
    # exercised through an update path: decision on another study's
    # submission resolves at the SQL scope layer -> 404, never reaches the
    # record (P8).
    irb_study_b = _sponsor_irb(client, STUDY_B, SITE_1, "piw")

    _login(client, _seed_user("PI", tag="piw", scope_data={"studies": [STUDY_A]}))
    res = client.post(f"/api/site/irb/{irb_study_b}/decision", json={"outcome": "Approved"})
    assert res.status_code == 404, res.text


# ==========================================================================
# Unassigned users keep plain org scope; Admin stays wildcard
# ==========================================================================


def test_unassigned_site_staff_keeps_org_scope(client):
    irb_site1 = _sponsor_irb(client, STUDY_A, SITE_1, "un1a")
    irb_site2 = _sponsor_irb(client, STUDY_A, SITE_2, "un1b")

    # No scope_data -> no site/study restriction (backwards compatible)
    _login(client, _seed_user("Site Staff", tag="un1"))
    visible = _irb_ids(client)
    assert irb_site1 in visible
    assert irb_site2 in visible


def test_admin_wildcard_site_scope(client):
    irb_site1 = _sponsor_irb(client, STUDY_A, SITE_1, "aw1a")
    irb_site2 = _sponsor_irb(client, STUDY_A, SITE_2, "aw1b")

    res = client.post(
        "/api/accounts/login/",
        json={"email": "admin@test.local", "password": "AdminPass123!"},
    )
    assert res.status_code == 200, res.text

    visible = _irb_ids(client)
    assert irb_site1 in visible
    assert irb_site2 in visible

    res = client.get(f"/api/site/irb/{irb_site2}")
    assert res.status_code == 200, res.text  # Admin wildcard (A1)


# ==========================================================================
# schema_ensure backfills legacy rows from the record JSON (idempotent)
# ==========================================================================


def test_schema_ensure_backfills_legacy_rows(client):
    db = SessionLocal()
    try:
        org = db.query(Organization).order_by(Organization.id).first()
        legacy = CtmsIrbSubmission(
            code=f"IRB-LEGACY-{uuid.uuid4().hex[:6]}",
            organization_id=org.id,
            study_id=None,
            site_id=None,
            data={
                "id": "irb-legacy-1",
                "studyCode": STUDY_A,
                "siteCode": SITE_2,
                "type": "Initial",
            },
        )
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id
    finally:
        db.close()

    report = ensure_ctms_scope_columns(engine)
    joined = {k: v for k, v in report.items() if "ctms_irbsubmission" in k}
    assert joined, report
    assert "backfilled" in str(joined), report

    # Columns are now populated from the JSON payload.
    db = SessionLocal()
    try:
        row = db.query(CtmsIrbSubmission).filter(CtmsIrbSubmission.id == legacy_id).one()
        assert row.study_id == STUDY_A
        assert row.site_id == SITE_2
    finally:
        db.close()

    # Second run is a no-op (idempotent) and reports no backfill.
    again = ensure_ctms_scope_columns(engine)
    assert all("backfilled" not in str(v) for v in again.values()), again

    # accounts_user.scope_data exists -> no-op.
    assert ensure_accounts_scope_column(engine) == {}
    assert isinstance(ensure_schema_columns(engine), dict)
