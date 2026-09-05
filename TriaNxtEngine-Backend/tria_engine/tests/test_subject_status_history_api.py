# Tests for the Subject Profile backend surface:
#   GET /api/site/subjects/{study::subject}/history — merged chronological
#     feed (status transitions + completed visits + consent events),
#   GET /api/site/subjects/{study::subject}/consent — server-derived
#     consent state from ctms_consentevent + ctms_icfversion.

from tria_engine.apps.ctms.models import (
    CtmsConsentEvent,
    CtmsIcfVersion,
    CtmsSubjectStatusHistory,
    CtmsVisit,
)
from tria_engine.core.database import SessionLocal

HISTORY_SYNC = "/api/site/subjects/history/sync"
VISITS_SYNC = "/api/site/visits/sync"
ICF_VERSIONS_SYNC = "/api/site/icf/versions/sync"
ICF_EVENTS_SYNC = "/api/site/icf/events/sync"


def _login(client, email, password="AdminPass123!"):
    res = client.post(
        "/api/accounts/login/", json={"email": email, "password": password}
    )
    assert res.status_code == 200, res.text
    return client


def _as_admin(client):
    return _login(client, "admin@test.local", "AdminPass123!")


def _wipe(study: str):
    """Delete every row whose JSON document references the study (some ctms
    tables carry the study only inside `data`, not in the scope column)."""
    db = SessionLocal()
    try:
        for model in (
            CtmsSubjectStatusHistory,
            CtmsVisit,
            CtmsConsentEvent,
            CtmsIcfVersion,
        ):
            for row in db.query(model).all():
                data = dict(row.data or {})
                if any(
                    str(data.get(key) or "") == study
                    for key in ("studyId", "studyCode", "study", "studyKey")
                ):
                    db.delete(row)
        db.commit()
    finally:
        db.close()


def _sync(client, path: str, records):
    res = client.post(path, json={"records": records})
    assert res.status_code == 200, res.text


def test_history_feed_requires_auth(client):
    assert client.get("/api/site/subjects/TNX-001%3A%3AS-1/history").status_code == 401
    assert client.get("/api/site/subjects/TNX-001%3A%3AS-1/consent").status_code == 401


def test_history_feed_merges_status_visit_and_consent_events(client):
    _as_admin(client)
    _wipe("TNX-001")
    _sync(
        client,
        HISTORY_SYNC,
        [
            {
                "studyId": "TNX-001",
                "subjectId": "S-1",
                "status": "Screened",
                "reason": "Passed screening",
                "changedBy": "SiteStaff",
                "changedAt": "2026-09-01T08:00:00.000Z",
            },
            {
                "studyId": "TNX-001",
                "subjectId": "S-1",
                "status": "Enrolled",
                "reason": "",
                "changedBy": "PI",
                "changedAt": "2026-09-10T08:00:00.000Z",
            },
        ],
    )
    _sync(
        client,
        VISITS_SYNC,
        [
            {
                "id": "TNX-001::S-1::Visit 1",
                "date": "2026-09-20",
                "actualDate": "2026-09-20",
                "subjectId": "S-1",
                "visit": "Visit 1",
                "status": "Completed",
                "study": "TNX-001",
                "studyKey": "TNX-001",
                "source": "visit-record",
            }
        ],
    )
    _sync(
        client,
        ICF_EVENTS_SYNC,
        [
            {
                "id": "CNS-1",
                "studyCode": "TNX-001",
                "siteCode": "Site A",
                "subjectId": "S-1",
                "icfVersionId": "ICFV-1",
                "icfVersion": "1.0",
                "date": "2026-09-05",
                "createdAt": "2026-09-05T08:00:00.000Z",
                "createdBy": "PI",
            }
        ],
    )

    res = client.get("/api/site/subjects/TNX-001%3A%3AS-1/history")
    assert res.status_code == 200, res.text
    events = res.json()["data"]["events"]

    kinds = [event["kind"] for event in events]
    assert kinds.count("status") == 2
    assert "visit" in kinds
    assert "consent" in kinds

    # Newest-first ordering (Visit 1 on 09-20 is the latest event).
    assert events[0]["title"] == "Visit completed"
    status_titles = [event["title"] for event in events if event["kind"] == "status"]
    assert status_titles == ["Enrolled", "Screened"]


def test_history_feed_rejects_bad_code(client):
    _as_admin(client)
    assert client.get("/api/site/subjects/not-a-code/history").status_code == 400
    assert client.get("/api/site/subjects/not-a-code/consent").status_code == 400


def test_consent_state_signed_when_event_on_active_version(client):
    _as_admin(client)
    _wipe("TNX-002")
    _sync(
        client,
        ICF_VERSIONS_SYNC,
        [
            {
                "id": "ICFV-1",
                "studyCode": "TNX-002",
                "siteCode": "Site A",
                "version": "1.0",
                "status": "Active",
            }
        ],
    )
    _sync(
        client,
        ICF_EVENTS_SYNC,
        [
            {
                "id": "CNS-1",
                "studyCode": "TNX-002",
                "siteCode": "Site A",
                "subjectId": "S-1",
                "icfVersionId": "ICFV-1",
                "icfVersion": "1.0",
                "date": "2026-09-05",
                "createdAt": "2026-09-05T08:00:00.000Z",
                "createdBy": "PI",
            }
        ],
    )

    res = client.get("/api/site/subjects/TNX-002%3A%3AS-1/consent")
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["key"] == "signed"
    assert data["tone"] == "ok"
    assert "v1.0" in data["detail"]


def test_consent_state_pending_without_event(client):
    _as_admin(client)
    _wipe("TNX-003")
    _sync(
        client,
        ICF_VERSIONS_SYNC,
        [
            {
                "id": "ICFV-1",
                "studyCode": "TNX-003",
                "siteCode": "Site A",
                "version": "1.0",
                "status": "Active",
            }
        ],
    )
    res = client.get("/api/site/subjects/TNX-003%3A%3AS-1/consent")
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["key"] == "pending"
    assert data["tone"] == "warn"
