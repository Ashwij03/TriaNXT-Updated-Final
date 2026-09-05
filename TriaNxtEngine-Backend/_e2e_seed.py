# _e2e_seed.py - idempotent demo setup/seed for the live CTMS environment.
#
# Provisions the whole "Safety Demo Org" (organization 5) demo world used by
# the browser E2E sessions, the RBAC live checks and the API-mode dashboards:
#
#   * Demo users per role (org 5) with known passwords, so the SPA login
#     directory and the backend-session bootstrap (POST /api/accounts/login/)
#     both succeed: Sponsor / Site Staff / CRO.
#   * Three AE/SAE cases so the Safety Center KPIs render real data
#     (1 open SAE + 1 open mild + 1 reconciled -> total 3, open 2).
#   * Two monitoring-access requests (one pending, one approved covering
#     today) so Monitoring Access shows statuses and the access-check works.
#   * Subject mirror rows spanning the six canonical lifecycle statuses
#     (Screened / Enrolled / Ongoing / Completed / Withdrawn / Dropout) for
#     study TNX-E2E-02, so /api/site/subjects/summary returns non-empty
#     per-status buckets.
#   * Matching visit schedule rows (Completed / Scheduled / Missed /
#     Cancelled) for those subjects, so /api/site/visits/summary reports
#     scheduled/completed/upcoming counts.
#
# Convergence, not duplication: when org 5 already holds a functionally
# equivalent demo row from earlier ad-hoc provisioning (e.g. a Reconciled
# AE case or an approved monitoring request), the seed leaves it in place
# instead of stacking a canonical twin - so the Safety envelope stays at
# total 3 / open 2 across re-runs and pre-seeded databases.
#
# Run from the backend root with the project venv (idempotent - safe to re-run):
#   .venv/Scripts/python _e2e_seed.py
#
# Requires the mirror tables to exist (ctms_subject / ctms_visit are created
# by the app's startup schema_ensure; run the app once or apply the latest
# migration first).

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from tria_engine.apps.accounts.models import User
from tria_engine.apps.ctms.models import CtmsAeCase, CtmsMonitoringRequest, CtmsSubject, CtmsVisit
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password

ORG_ID = 5            # "Safety Demo Org"
ORG_NAME = "Safety Demo Org"
STUDY_ID = "TNX-E2E-02"
SITE_NO = "001"
SITE_NAME = "Safety Demo Site"
PI_NAME = "Dr. A. Demo"

# --- Demo users (org 5) -----------------------------------------------------
DEMO_USERS = [
    {
        "email": "sponsor.c787e7@demo.com",
        "username": "sponsor.c787e7",
        "password": "Sponsor@123",
        "role": "Sponsor",
        "first": "Sponsor",
        "last": "Demo",
    },
    {
        "email": "staff.9fb588@demo.com",
        "username": "staff.9fb588",
        "password": "SiteStaff@123",
        "role": "Site Staff",
        "first": "Site",
        "last": "Staff Demo",
    },
    {
        "email": "cro.live@demo.com",
        "username": "cro.live",
        "password": "CRO@1234",
        "role": "CRO",
        "first": "CRO",
        "last": "Demo",
    },
]


def iso_now() -> str:
    return date.today().isoformat() + "T00:00:00"


def day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


def ensure_org(db) -> None:
    """Guarantee the demo organization row exists (fresh-DB friendly)."""
    if db.get(Organization, ORG_ID) is None:
        db.add(Organization(id=ORG_ID, name=ORG_NAME))
        db.flush()


def ensure_user(db, spec: dict) -> User:
    role = db.execute(
        select(Role).where(Role.name == spec["role"], Role.organization_id == ORG_ID)
    ).scalar_one_or_none()
    if role is None:
        role = Role(name=spec["role"], organization_id=ORG_ID)
        db.add(role)
        db.flush()
    user = db.execute(
        select(User).where(User.email == spec["email"])
    ).scalar_one_or_none()
    if user is None:
        user = User(
            username=spec["username"],
            email=spec["email"],
            password=hash_password(spec["password"]),
            first_name=spec["first"],
            last_name=spec["last"],
            is_active=True,
            must_change_password=False,
            organization_id=ORG_ID,
            role_id=role.id,
        )
        db.add(user)
        db.flush()
    else:
        # Re-running the seed re-asserts the known password + role binding.
        user.password = hash_password(spec["password"])
        user.is_active = True
        user.must_change_password = False
        user.organization_id = ORG_ID
        user.role_id = role.id
        db.flush()
    return user


def ensure_row(db, model, code: str, **fields) -> bool:
    """Insert one mirror row by its stable code; return True when created."""
    exists = db.execute(select(model).where(model.code == code)).scalar_one_or_none()
    if exists is not None:
        return False
    db.add(model(code=code, **fields))
    db.flush()
    return True


def seed_ae_cases(db, sponsor: User) -> None:
    now = iso_now()
    cases = [
        {
            "id": "AE-e2e-open-sae-01",
            "study_id": STUDY_ID,
            "subject_ref": "S-9002",
            "description": "Grade 3 infusion-related reaction (sponsor-reported)",
            "is_serious": True,
            "causality": "Possibly related",
            "outcome": "Recovering",
            "status": "Open",
            "pv_case_reference": None,
        },
        {
            "id": "AE-e2e-open-mild-01",
            "study_id": STUDY_ID,
            "subject_ref": "S-9011",
            "description": "Mild headache following screening visit",
            "is_serious": False,
            "causality": None,
            "outcome": None,
            "status": "Open",
            "pv_case_reference": None,
        },
        {
            "id": "AE-e2e-rec-01",
            "study_id": STUDY_ID,
            "subject_ref": "S-9017",
            "description": "Mild rash at injection site, resolved without sequelae",
            "is_serious": False,
            "causality": "Related",
            "outcome": "Recovered",
            "status": "Reconciled",
            "pv_case_reference": "PV-DEMO-0042",
        },
    ]
    for case in cases[:2]:
        data = dict(case)
        data.update(
            {
                "created_by": sponsor.username,
                "created_at": now,
                "updated_at": now,
                "history": {"events": [{"action": "CREATED", "by": sponsor.username, "at": now}]},
            }
        )
        ensure_row(
            db,
            CtmsAeCase,
            case["id"],
            organization_id=ORG_ID,
            study_id=case["study_id"],
            site_id=None,
            data=data,
        )
    # Reconciled case: converge on the pre-existing ad-hoc demo row when one
    # already exists in the org, so the Safety envelope stays total 3 / open 2
    # on pre-seeded databases as well as fresh ones.
    has_reconciled = (
        db.execute(
            select(CtmsAeCase.id)
            .where(
                CtmsAeCase.organization_id == ORG_ID,
                CtmsAeCase.data["status"].as_string() == "Reconciled",
            )
            .limit(1)
        ).first()
        is not None
    )
    if not has_reconciled:
        reconciled = cases[2]
        data = dict(reconciled)
        data.update(
            {
                "created_by": sponsor.username,
                "created_at": now,
                "updated_at": now,
                "history": {"events": [{"action": "CREATED", "by": sponsor.username, "at": now}]},
            }
        )
        ensure_row(
            db,
            CtmsAeCase,
            reconciled["id"],
            organization_id=ORG_ID,
            study_id=reconciled["study_id"],
            site_id=None,
            data=data,
        )


def seed_monitoring_requests(db, sponsor: User, staff: User) -> None:
    now = iso_now()
    requests = [
        {
            "id": "MA-e2e-pending-01",
            "site": "3",
            "site_name": "Boundary Probe",
            "requested_by_name": "Sponsor Demo",
            "start": day(3),
            "end": day(4),
            "reason": "Upcoming routine monitoring visit",
            "status": "pending",
            "decided_by": None,
            "decided_by_name": None,
            "decided_at": None,
        },
        {
            # Approved and covering today -> org-5 access-check on site 3
            # returns allowed: true (the deterministic negative case uses a
            # site with no approved coverage, e.g. site 2 in the CRO check).
            "id": "MA-e2e-approved-01",
            "site": "3",
            "site_name": "Boundary Probe",
            "requested_by_name": "Sponsor Demo",
            "start": day(-2),
            "end": day(2),
            "reason": "Routine oversight monitoring visit",
            "status": "approved",
            "decided_by": staff.username,
            "decided_by_name": "Site Staff Demo",
            "decided_at": day(-1),
        },
    ]
    for req in requests:
        # Converge: keep a pre-existing ad-hoc approved demo request instead
        # of adding a second approved twin.
        if req["status"] == "approved":
            already_approved = db.execute(
                select(CtmsMonitoringRequest.id)
                .where(
                    CtmsMonitoringRequest.organization_id == ORG_ID,
                    CtmsMonitoringRequest.data["status"].as_string() == "approved",
                )
                .limit(1)
            ).first()
            if already_approved is not None:
                continue
        data = {
            "id": req["id"],
            "site": req["site"],
            "site_name": req["site_name"],
            "requested_by": sponsor.username,
            "requested_by_name": req["requested_by_name"],
            "requester_role": "SPONSOR",
            "requester_role_label": "Sponsor",
            "start_date": req["start"],
            "end_date": req["end"],
            "reason": req["reason"],
            "note": None,
            "status": req["status"],
            "decided_by": req["decided_by"],
            "decided_by_name": req["decided_by_name"],
            "decided_at": req["decided_at"],
            "created_at": now,
            "updated_at": now,
            "history": {"events": [{"action": "CREATED", "by": sponsor.username, "at": now}]},
        }
        ensure_row(
            db,
            CtmsMonitoringRequest,
            req["id"],
            organization_id=ORG_ID,
            study_id=None,
            site_id=None,
            data=data,
        )


def _subject_record(ident: str, status: str, screening: str, enrollment: str | None) -> dict:
    record = {
        "id": ident,
        "subjectId": ident,
        "studyId": STUDY_ID,
        "initials": f"DEMO {ident[-3:]}",
        "principalInvestigator": PI_NAME,
        "pi": PI_NAME,
        "site": SITE_NO,
        "siteName": SITE_NAME,
        "siteNo": SITE_NO,
        "status": status,
        "screeningDate": screening,
        "enrollmentDate": enrollment,
        "currentVisit": "Screening" if status == "Screened" else "Enrollment",
        "createdAt": iso_now(),
        "updatedAt": iso_now(),
        "updatedBy": "Sponsor",
    }
    if status in ("Enrolled", "Ongoing", "Completed"):
        record["currentVisit"] = "Cycle 1" if status == "Ongoing" else (
            "End of Study" if status == "Completed" else "Day 1")
    return record


def seed_subjects_and_visits(db) -> None:
    # (id, status, screening day, enrollment day, [(visit, day, status), ...])
    plans = [
        ("E2E-DEMO-001", "Screened", -1, None,
         [("Screening", -1, "Completed"), ("Day 1", 14, "Scheduled"), ("Day 8", 21, "Scheduled")]),
        ("E2E-DEMO-002", "Enrolled", -30, -21,
         [("Screening", -30, "Completed"), ("Enrollment", -21, "Completed"), ("Day 8", 7, "Scheduled")]),
        ("E2E-DEMO-003", "Ongoing", -60, -49,
         [("Screening", -60, "Completed"), ("Enrollment", -49, "Completed"),
          ("Cycle 1 Day 15", -10, "Completed"), ("Cycle 1 Day 22", 5, "Scheduled"),
          ("Cycle 1 Day 29", 12, "Scheduled")]),
        ("E2E-DEMO-004", "Completed", -300, -289,
         [("Screening", -300, "Completed"), ("Enrollment", -289, "Completed"),
          ("End of Study", -7, "Completed")]),
        ("E2E-DEMO-005", "Withdrawn", -120, -110,
         [("Screening", -120, "Completed"), ("Enrollment", -110, "Completed"),
          ("Cycle 1 Day 15", -86, "Missed"), ("Withdrawal Visit", -80, "Completed")]),
        ("E2E-DEMO-006", "Dropout", -90, -80,
         [("Screening", -90, "Completed"), ("Enrollment", -80, "Completed"),
          ("Cycle 1 Day 8", -68, "Cancelled")]),
    ]
    for ident, status, screen, enroll, visits in plans:
        record = _subject_record(ident, status, day(screen), day(enroll) if enroll else None)
        ensure_row(
            db,
            CtmsSubject,
            f"{STUDY_ID}::{ident}",
            organization_id=ORG_ID,
            study_id=STUDY_ID,
            site_id=SITE_NO,
            data=record,
        )
        subject_ref = {"subjectId": ident, "studyId": STUDY_ID,
                       "initials": record["initials"], "status": status}
        for visit_name, day_offset, visit_status in visits:
            visit_id = f"{STUDY_ID}::{ident}::{visit_name.replace(' ', '-')}"
            visit_data = {
                "id": visit_id,
                "study": STUDY_ID,
                "studyKey": STUDY_ID,
                "subjectId": ident,
                "subject": subject_ref,
                "visit": visit_name,
                "date": day(day_offset),
                "status": visit_status,
                "time": "09:00 AM",
                "source": "subject" if visit_name in ("Screening", "Enrollment") else "visit-record",
            }
            ensure_row(
                db,
                CtmsVisit,
                visit_id,
                organization_id=ORG_ID,
                study_id=STUDY_ID,
                site_id=SITE_NO,
                data=visit_data,
            )


def seed() -> None:
    db = SessionLocal()
    try:
        ensure_org(db)
        users = {spec["role"]: ensure_user(db, spec) for spec in DEMO_USERS}
        sponsor = users["Sponsor"]
        staff = users["Site Staff"]

        seed_ae_cases(db, sponsor)
        seed_monitoring_requests(db, sponsor, staff)
        seed_subjects_and_visits(db)

        db.commit()

        ae_count = db.execute(select(CtmsAeCase)).scalars().all()
        ma_count = db.execute(select(CtmsMonitoringRequest)).scalars().all()
        sub_count = db.execute(select(CtmsSubject)).scalars().all()
        vis_count = db.execute(select(CtmsVisit)).scalars().all()
        print("OK demo environment provisioned (idempotent, safe to re-run)")
        print(f"   users  : " + ", ".join(
            f"{u['role']}={u['email']} / {u['password']}" for u in DEMO_USERS))
        print(f"   org    : {ORG_ID} {ORG_NAME}  study={STUDY_ID}")
        print(f"   ae_cases={len(ae_count)} monitoring_requests={len(ma_count)}")
        print(f"   subjects={len(sub_count)} visits={len(vis_count)}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
