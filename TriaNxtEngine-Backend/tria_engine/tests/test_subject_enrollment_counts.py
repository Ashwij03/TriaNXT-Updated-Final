# Tests for GET /api/site/subjects/enrollment-counts:
#   - per-study DISTINCT-subject counts with canonical Screened/Enrolled
#     membership (legacy tokens normalized through _canonical_status),
#   - optional ?studyId= scope,
#   - cache serving + invalidation on POST /subjects/sync (the Redis
#     hot-cache bust — exercised against the in-process cache here since
#     REDIS_URL is unset in tests).

import uuid

from tria_engine.apps.ctms.models import CtmsSubject
from tria_engine.apps.ctms.router_subjects import invalidate_subject_enrollment_counts
from tria_engine.core.database import SessionLocal

ENROLLMENT_COUNTS = "/api/site/subjects/enrollment-counts"
SUBJECTS_SYNC = "/api/site/subjects/sync"

PASSWORD = "AdminPass123!"


def _login(client, email, password=PASSWORD):
    res = client.post(
        "/api/accounts/login/", json={"email": email, "password": password}
    )
    assert res.status_code == 200, res.text
    return client


def _as_admin(client):
    return _login(client, "admin@test.local", "AdminPass123!")


def _subject(study, subj, status="Screened", **over):
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


def _wipe_subjects(*studies):
    db = SessionLocal()
    try:
        rows = db.query(CtmsSubject).filter(CtmsSubject.study_id.in_(studies)).all()
        for row in rows:
            db.delete(row)
        db.commit()
    finally:
        db.close()
    invalidate_subject_enrollment_counts()


def _sync(client, records):
    res = client.post(SUBJECTS_SYNC, json={"records": records})
    assert res.status_code == 200, res.text


def _counts(client, study=None):
    url = ENROLLMENT_COUNTS + (f"?studyId={study}" if study else "")
    res = client.get(url)
    assert res.status_code == 200, res.text
    return res.json()["data"]


def test_enrollment_counts_require_auth(client):
    assert client.get(ENROLLMENT_COUNTS).status_code == 401
    assert client.get(f"{ENROLLMENT_COUNTS}?studyId=TNX-001").status_code == 401


def test_per_study_counts_use_canonical_screened_enrolled(client):
    _as_admin(client)
    _wipe_subjects("TNX-001", "TNX-002")
    _sync(
        client,
        [
            _subject("TNX-001", "S-1", "Screened"),
            _subject("TNX-001", "S-2", "Enrolled"),
            _subject("TNX-001", "S-3", "Ongoing"),
            # Legacy token normalizes into the Screened bucket.
            _subject("TNX-001", "S-4", "Screening"),
            _subject("TNX-002", "S-5", "Enrolled"),
            _subject("TNX-002", "S-6", "Dropout"),
        ],
    )

    data = _counts(client)
    by_study = data["byStudy"]

    assert by_study["TNX-001"] == {
        "studyId": "TNX-001",
        "total": 4,
        "screened": 2,  # S-1 + S-4
        "enrolled": 3,  # S-1 + S-2 + S-4 (Screened or Enrolled roster)
    }
    assert by_study["TNX-002"] == {
        "studyId": "TNX-002",
        "total": 2,
        "screened": 0,
        "enrolled": 1,  # only S-5
    }
    assert "generatedAt" in data


def test_study_filter_returns_only_requested_study(client):
    _as_admin(client)
    _wipe_subjects("TNX-001", "TNX-002")
    _sync(
        client,
        [
            _subject("TNX-001", "S-1", "Screened"),
            _subject("TNX-002", "S-9", "Enrolled"),
        ],
    )
    data = _counts(client, study="TNX-002")
    assert set(data["byStudy"].keys()) == {"TNX-002"}
    assert data["byStudy"]["TNX-002"]["enrolled"] == 1


def test_sync_invalidates_cached_counts(client):
    _as_admin(client)
    _wipe_subjects("TNX-003")
    _sync(client, [_subject("TNX-003", "S-1", "Screened")])

    # First read populates the hot cache.
    assert _counts(client, study="TNX-003")["byStudy"]["TNX-003"]["enrolled"] == 1

    # Registering a new subject must bust the cache — the next read reflects
    # the new roster instead of serving the stale TTL value.
    _sync(client, [_subject("TNX-003", "S-2", "Enrolled")])
    data = _counts(client, study="TNX-003")
    assert data["byStudy"]["TNX-003"]["total"] == 2
    assert data["byStudy"]["TNX-003"]["enrolled"] == 2


def test_resyncing_a_subject_does_not_double_count(client):
    _as_admin(client)
    _wipe_subjects("TNX-004")
    _sync(client, [_subject("TNX-004", "S-1", "Screened"), _subject("TNX-004", "S-2", "Enrolled")])

    # Re-sync the same subject (upsert) — DISTINCT semantics must hold.
    _sync(
        client,
        [
            _subject("TNX-004", "S-1", "Screened", initials="RS"),
            _subject("TNX-004", "S-2", "Enrolled", initials="RS"),
        ],
    )
    data = _counts(client, study="TNX-004")
    assert data["byStudy"]["TNX-004"]["total"] == 2
    assert data["byStudy"]["TNX-004"]["enrolled"] == 2
