# tria_engine/tests/test_scope_assignment.py
#
# Admin scope-assignment API (RBAC spec 4.1/4.2 + Section 5 G7/G8):
#
#   * GET  /api/accounts/users/                  -> results now carry id,
#     role_name and scope_data (additive to the brief)
#   * PUT/PATCH /api/accounts/users/{id}/scope/  -> superuser-only; persists
#     {"studies": [...], "sites": [...]} on accounts_user.scope_data
#   * because every request reloads the session user, the target's very
#     next request is filtered at the SQL level (G8 — no re-login needed
#     for the assignment to take effect)
#
# 403 for non-superusers, 404 for unknown user ids, empty list = clear.

from __future__ import annotations

import uuid

from tria_engine.apps.accounts.models import User
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password

PASSWORD = "RolePass123!"
STUDY_A = "STUDY-ASSIGN-A"
SITE_1 = "SITE-ASSIGN-1"
SITE_2 = "SITE-ASSIGN-2"


def _user_id(email: str) -> int:
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).one().id
    finally:
        db.close()


def _seed_user(role_name: str, tag: str, scope_data: dict | None = None) -> str:
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


def _admin_login(client):
    res = client.post(
        "/api/accounts/login/",
        json={"email": "admin@test.local", "password": "AdminPass123!"},
    )
    assert res.status_code == 200, res.text
    return client


def _irb_payload(study: str, site: str, tag: str) -> dict:
    return {
        "studyCode": study,
        "siteCode": site,
        "type": "Initial",
        "title": f"Assign scope test {tag} {uuid.uuid4().hex[:6]}",
    }


def _sponsor_irb(client, study: str, site: str, tag: str) -> str:
    email = _seed_user("Sponsor", tag=tag)
    _login(client, email)
    res = client.post("/api/site/irb/", json=_irb_payload(study, site, tag))
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _assign_scope(client, user_id: int, studies=None, sites=None):
    res = client.put(
        f"/api/accounts/users/{user_id}/scope/",
        json={"studies": studies or [], "sites": sites or []},
    )
    assert res.status_code == 200, res.text
    return res.json()


# ==========================================================================
# Guard rails
# ==========================================================================


def test_non_admin_cannot_assign_scope(client):
    email = _seed_user("Sponsor", tag="na")
    target = _seed_user("Site Staff", tag="na-t")
    _login(client, email)
    res = client.put(
        f"/api/accounts/users/{_user_id(target)}/scope/",
        json={"studies": [], "sites": ["SITE-1"]},
    )
    assert res.status_code == 403, res.text
    assert "Forbidden" in res.json()["detail"]


def test_admin_assign_scope_unknown_user_404(client):
    _admin_login(client)
    res = client.put(
        "/api/accounts/users/999999999/scope/",
        json={"studies": [], "sites": ["SITE-1"]},
    )
    assert res.status_code == 404, res.text


# ==========================================================================
# G8 — assignment narrows the target's very next request (no re-login)
# ==========================================================================


def test_admin_assigned_scope_narrows_next_request(client):
    irb_site1 = _sponsor_irb(client, STUDY_A, SITE_1, "g8a")
    irb_site2 = _sponsor_irb(client, STUDY_A, SITE_2, "g8b")
    irb_nosite = _sponsor_irb(client, STUDY_A, "", "g8c")

    staff_email = _seed_user("Site Staff", tag="g8")
    staff_id = _user_id(staff_email)

    _admin_login(client)
    _assign_scope(client, staff_id, sites=[SITE_1])

    # Target's next login is already narrowed: no re-assignment needed.
    _login(client, staff_email)
    res = client.get("/api/site/irb/")
    assert res.status_code == 200, res.text
    ids = [r["id"] for r in res.json()]
    assert irb_site1 in ids
    assert irb_site2 not in ids  # filtered at the SQL level
    assert irb_nosite in ids  # org-level row still visible


def test_assign_study_scope_to_pi(client):
    irb_study_a = _sponsor_irb(client, STUDY_A, SITE_1, "pi-a")
    _sponsor_irb(client, "STUDY-ASSIGN-B", SITE_1, "pi-b")

    pi_email = _seed_user("PI", tag="g8pi")
    _admin_login(client)
    _assign_scope(client, _user_id(pi_email), studies=[STUDY_A])

    _login(client, pi_email)
    res = client.get("/api/site/irb/")
    ids = [r["id"] for r in res.json()]
    assert irb_study_a in ids
    assert all(r.get("studyCode") != "STUDY-ASSIGN-B" for r in res.json())


def test_clearing_scope_restores_org_visibility(client):
    irb_site2 = _sponsor_irb(client, STUDY_A, SITE_2, "clr")

    staff_email = _seed_user("Site Staff", tag="clr", scope_data={"sites": [SITE_1]})
    staff_id = _user_id(staff_email)

    _admin_login(client)
    payload = _assign_scope(client, staff_id)  # empty lists -> clear
    assert payload["scope_data"] == {"studies": [], "sites": []}

    _login(client, staff_email)
    res = client.get("/api/site/irb/")
    assert res.status_code == 200
    assert irb_site2 in [r["id"] for r in res.json()]


# ==========================================================================
# User list surfaces id / role_name / scope_data (additive brief)
# ==========================================================================


def test_user_list_includes_scope_fields(client):
    target = _seed_user("Site Staff", tag="lst", scope_data={"sites": [SITE_1]})
    _admin_login(client)
    res = client.get("/api/accounts/users/?page_size=100")
    assert res.status_code == 200, res.text
    row = next(r for r in res.json()["results"] if r["email"] == target)
    assert row["id"] == _user_id(target)
    assert row["role_name"] == "Site Staff"
    assert row["scope_data"] == {"sites": [SITE_1]}
