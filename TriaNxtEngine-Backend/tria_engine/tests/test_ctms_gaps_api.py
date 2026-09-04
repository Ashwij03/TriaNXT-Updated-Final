# tria_engine/tests/test_ctms_gaps_api.py
#
# End-to-end coverage for the Site CTMS gap-module API (/api/site/*):
#   M18 amendments, M19 IP/supply, M20 IRB/IEC, M21 ICF/eConsent,
#   M22 vendor/lab, M23 site feasibility.
#
# Every flow exercises the happy path AND the rule-error parity messages
# that the frontend localStorage services enforce (AMD-01/02/03, IP-01/02/03,
# ENR-01 consent gate, witness/destruction rules, forward-only kit flow,
# scoring thresholds, etc.), proving the backend contract matches the UI.

from __future__ import annotations

import pytest
from sqlalchemy import select

from tria_engine.apps.accounts.models import AuditLog
from tria_engine.core.database import SessionLocal


@pytest.fixture
def authed(client):
    res = client.post(
        "/api/accounts/login/",
        json={"email": "admin@test.local", "password": "AdminPass123!"},
    )
    assert res.status_code == 200, res.text
    return client


def _last_audit_actions(client) -> list[str]:
    res = client.get("/api/accounts/audit-logs/?page_size=100")
    assert res.status_code == 200, res.text
    return [row["action"] for row in res.json()["results"]]


def _assert_message(res, expected: str, status: int = 400):
    assert res.status_code == status, res.text
    assert res.json().get("message") == expected, res.json()


# ==========================================================================
# M18 Protocol Amendments
# ==========================================================================


def test_amendment_full_lifecycle_with_rule_parity(authed):
    client = authed

    # -- create (validation parity) --------------------------------------
    res = client.post("/api/site/amendments/", json={"amendmentNumber": "AM-001", "version": "2.0"})
    _assert_message(res, "studyCode, amendmentNumber and version are required to create an amendment.")

    res = client.post(
        "/api/site/amendments/",
        json={"studyCode": "STUDY-A", "amendmentNumber": "AM-001", "version": "2.0", "classification": "Substantial", "effectiveDate": "2026-09-01"},
    )
    _assert_message(res, "A summary of change is required for substantial amendments.")

    payload = {
        "studyCode": "STUDY-A",
        "amendmentNumber": "AM-001",
        "version": "2.0",
        "classification": "Non-substantial",
        "effectiveDate": "2026-09-01",
        "summary": "Revised eligibility criteria",
        "impactedSiteCodes": ["SITE-01"],
        "binderUpdateRequired": True,
    }
    res = client.post("/api/site/amendments/", json=payload)
    assert res.status_code == 201, res.text
    amendment = res.json()
    aid = amendment["id"]
    assert amendment["status"] == "Draft"
    assert aid.startswith("AMD-")
    assert "SITE-01" in amendment["sites"]
    assert amendment["sites"]["SITE-01"]["tasks"][0]["kind"] == "document"

    # AMD-01/02 parity + transitions
    assert "AMENDMENT_CREATED" in _last_audit_actions(client)

    # AMD-01: cannot close while an impacted site is not compliant
    res = client.post(f"/api/site/amendments/{aid}/close")
    _assert_message(res, "1 impacted site(s) remain non-compliant.")

    res = client.post(f"/api/site/amendments/{aid}/assess")
    assert res.json()["status"] == "Under Assessment"

    res = client.post(f"/api/site/amendments/{aid}/complete-task",
                      json={"siteCode": "SITE-01", "taskId": amendment["sites"]["SITE-01"]["tasks"][0]["id"]})
    # publish first -> must error while Draft/Under Assessment
    _assert_message(res, "Amendment must be published before implementation tasks can be completed.")

    res = client.post(f"/api/site/amendments/{aid}/publish")
    assert res.json()["status"] == "Published"

    res = client.post(f"/api/site/amendments/{aid}/complete-task",
                      json={"siteCode": "SITE-01", "taskId": amendment["sites"]["SITE-01"]["tasks"][0]["id"]})
    assert res.status_code == 200
    assert res.json()["status"] == "Site Rollout"

    res = client.post(f"/api/site/amendments/{aid}/sites/SITE-01/compliant")
    assert res.status_code == 200
    assert res.json()["sites"]["SITE-01"]["status"] == "Compliant"
    assert res.json()["status"] == "Compliant"

    res = client.post(f"/api/site/amendments/{aid}/close")
    assert res.json()["status"] == "Closed"

    # deleted only while Draft
    res = client.delete(f"/api/site/amendments/{aid}")
    _assert_message(res, "Only Draft amendments can be deleted.")

    # list/detail
    res = client.get("/api/site/amendments/?studyCode=STUDY-A")
    assert res.status_code == 200
    assert len(res.json()) == 1
    res = client.get(f"/api/site/amendments/{aid}")
    assert res.status_code == 200


def test_amendment_amd01_substantial_irb_gate(authed):
    client = authed
    payload = {
        "studyCode": "STUDY-B",
        "amendmentNumber": "AM-002",
        "version": "3.0",
        "classification": "Substantial",
        "effectiveDate": "2026-09-01",
        "summary": "New endpoint",
        "impactedSiteCodes": ["SITE-02"],
        "binderUpdateRequired": True,
    }
    res = client.post("/api/site/amendments/", json=payload)
    aid = res.json()["id"]
    client.post(f"/api/site/amendments/{aid}/assess")
    client.post(f"/api/site/amendments/{aid}/publish")
    task_id = res.json()["sites"]["SITE-02"]["tasks"][0]["id"]
    client.post(f"/api/site/amendments/{aid}/complete-task", json={"siteCode": "SITE-02", "taskId": task_id})
    # AMD-02: substantial requires IRB ref
    res = client.post(f"/api/site/amendments/{aid}/sites/SITE-02/compliant")
    _assert_message(
        res,
        "Substantial amendments require a linked IRB/IEC submission reference before a site can be marked compliant.",
    )
    res = client.patch(f"/api/site/amendments/{aid}/irb-ref", json={"irbSubmissionRef": "IRB-2026-014"})
    assert res.status_code == 200
    assert res.json()["irbSubmissionRef"] == "IRB-2026-014"
    res = client.post(f"/api/site/amendments/{aid}/sites/SITE-02/compliant")
    assert res.json()["sites"]["SITE-02"]["status"] == "Compliant"
    res = client.post(f"/api/site/amendments/{aid}/close")
    assert res.json()["status"] == "Closed"


# ==========================================================================
# M19 IP / Supply Accountability
# ==========================================================================


def test_ip_chain_of_custody_and_rules(authed):
    client = authed
    res = client.post(
        "/api/site/ip/shipments/",
        json={"studyCode": "STUDY-A", "siteCode": "SITE-01", "lotNumber": "LOT-001", "quantity": 10},
    )
    assert res.status_code == 201, res.text
    lot = res.json()
    lid = lot["id"]
    assert lot["status"] == "Shipped"
    assert lot["quantityOnHand"] == 0
    assert lot["quantityReceived"] == 10

    # invalid quantity
    res = client.post(
        "/api/site/ip/shipments/",
        json={"studyCode": "STUDY-A", "siteCode": "SITE-01", "lotNumber": "LOT-002", "quantity": -3},
    )
    _assert_message(res, "Quantity received must be a positive number.")

    # receive with excursion -> open excursion (IP-02)
    res = client.post(f"/api/site/ip/lots/{lid}/receive", json={"condition": "Excursion", "temperature": "27.5"})
    assert res.status_code == 200
    assert res.json()["status"] == "Received"
    assert len(res.json()["excursions"]) == 1

    # dispense blocked while excursion unresolved
    res = client.post(f"/api/site/ip/lots/{lid}/dispense", json={"subjectId": "SUBJ-01", "quantity": 2})
    _assert_message(
        res,
        "A temperature excursion requires a disposition decision before further dispensation from this lot.",
    )

    # discard requires witness (IP-03)
    exc_id = res  # placeholder re-fetch
    lot2 = client.get(f"/api/site/ip/lots/{lid}").json()
    exc_id = lot2["excursions"][0]["id"]
    res = client.post(
        f"/api/site/ip/lots/{lid}/excursions/{exc_id}/disposition",
        json={"disposition": "Discard", "witness": ""},
    )
    _assert_message(res, "Discard requires a two-person (witness) approval signature.")

    res = client.post(
        f"/api/site/ip/lots/{lid}/excursions/{exc_id}/disposition",
        json={"disposition": "Use"},
    )
    assert res.status_code == 200
    assert res.json()["excursions"][0]["disposition"] == "Use"

    # IP-01: dispense beyond on-hand
    res = client.post(f"/api/site/ip/lots/{lid}/dispense", json={"subjectId": "SUBJ-01", "quantity": 99})
    _assert_message(
        res,
        "Dispensation cannot exceed on-hand quantity (on hand: 10, requested: 99).",
    )

    res = client.post(f"/api/site/ip/lots/{lid}/dispense", json={"subjectId": "SUBJ-01", "quantity": 4, "visitCode": "V1"})
    assert res.json()["status"] == "In Use"
    assert res.json()["quantityOnHand"] == 6

    # return quantity validation
    res = client.post(f"/api/site/ip/lots/{lid}/return", json={"quantity": 99})
    _assert_message(res, "Return quantity must be positive and no more than on-hand.")

    # destroy requires witness
    res = client.post(f"/api/site/ip/lots/{lid}/destroy", json={"witness": ""})
    _assert_message(res, "Destruction requires two-person (witness) approval evidence.")

    res = client.post(f"/api/site/ip/lots/{lid}/return", json={"quantity": 2, "reason": "expiry"})
    assert res.json()["quantityOnHand"] == 4

    res = client.post(f"/api/site/ip/lots/{lid}/destroy", json={"witness": "Dr. Witness"})
    assert res.json()["status"] == "Destroyed"

    # reconcile a second lot for balanced path
    res = client.post(
        "/api/site/ip/shipments/",
        json={"studyCode": "STUDY-A", "siteCode": "SITE-01", "lotNumber": "LOT-003", "quantity": 5},
    )
    lid3 = res.json()["id"]
    client.post(f"/api/site/ip/lots/{lid3}/receive", json={"condition": "Acceptable"})
    res = client.post(f"/api/site/ip/lots/{lid3}/dispense", json={"subjectId": "SUBJ-01", "quantity": 5})
    assert res.status_code == 200
    res = client.post(f"/api/site/ip/lots/{lid3}/reconcile")
    assert res.json()["reconciliationStatus"] == "Balanced"
    assert res.json()["status"] == "Reconciled"
    assert "IP_RECONCILIATION" in _last_audit_actions(client)

    res = client.get("/api/site/ip/lots/?studyCode=STUDY-A")
    assert len(res.json()) == 2


# ==========================================================================
# M20 IRB / IEC submissions
# ==========================================================================


def test_irb_submission_lifecycle(authed):
    client = authed
    # reportable event requires linked ref
    res = client.post("/api/site/irb/", json={"studyCode": "STUDY-A", "type": "Reportable event"})
    _assert_message(
        res,
        "Reportable-event submissions must link the originating Finding / SAE reference.",
    )
    res = client.post(
        "/api/site/irb/",
        json={
            "studyCode": "STUDY-A",
            "siteCode": "SITE-01",
            "type": "Initial",
            "committee": "Central IRB",
            "reviewCycleMonths": 12,
        },
    )
    assert res.status_code == 201, res.text
    sid = res.json()["id"]

    res = client.post(f"/api/site/irb/{sid}/decision", json={"outcome": "Approved"})
    _assert_message(res, "Only Under Review submissions can receive a decision.")

    client.post(f"/api/site/irb/{sid}/submit")
    client.post(f"/api/site/irb/{sid}/start-review")

    res = client.post(f"/api/site/irb/{sid}/decision", json={"outcome": "Contingent", "note": "Update consent\nAdd safety language"})
    assert res.status_code == 200
    assert len(res.json()["conditions"]) == 2
    assert res.json()["status"] == "Contingent"

    # conditions resolvable
    res = client.post(f"/api/site/irb/{sid}/conditions/0/resolve")
    assert res.status_code == 200
    assert res.json()["conditions"][0]["resolved"] is True

    # correspondence
    res = client.post(f"/api/site/irb/{sid}/correspondence", json={"message": "Docs sent"})
    assert res.status_code == 200
    assert len(res.json()["correspondence"]) == 1

    # fresh submission approved with next continuing review date
    res = client.post(
        "/api/site/irb/",
        json={"studyCode": "STUDY-A", "type": "Initial", "committee": "Site IRB", "reviewCycleMonths": 6},
    )
    sid2 = res.json()["id"]
    client.post(f"/api/site/irb/{sid2}/submit")
    client.post(f"/api/site/irb/{sid2}/start-review")
    res = client.post(f"/api/site/irb/{sid2}/decision", json={"outcome": "Approved", "note": ""})
    assert res.status_code == 200
    assert res.json()["status"] == "Approved"
    assert res.json()["approvedAt"] is not None
    assert res.json()["nextDueDate"] is not None

    assert "IRB_SUBMISSION_DECISION" in _last_audit_actions(client)


# ==========================================================================
# M21 ICF / eConsent
# ==========================================================================


def test_icf_versions_consent_and_reconsent(authed):
    client = authed
    res = client.post(
        "/api/site/icf/versions/",
        json={"studyCode": "STUDY-A", "siteCode": "SITE-01", "version": "1.0", "language": "English", "witnessRequired": True},
    )
    assert res.status_code == 201, res.text
    vid = res.json()["id"]

    # duplicate version error
    res = client.post(
        "/api/site/icf/versions/",
        json={"studyCode": "STUDY-A", "siteCode": "SITE-01", "version": "1.0"},
    )
    _assert_message(res, "That ICF version already exists for this site.")

    # consent before active -> ENR-01 style error
    res = client.post(
        "/api/site/icf/events/",
        json={"studyCode": "STUDY-A", "subjectId": "SUBJ-01", "icfVersionId": vid},
    )
    _assert_message(res, "Consent can only be recorded against the ACTIVE ICF version for the site.")

    client.post(f"/api/site/icf/versions/{vid}/approve")
    res = client.post(f"/api/site/icf/versions/{vid}/activate")
    assert res.status_code == 200
    assert res.json()["status"] == "Active"

    # witness required
    res = client.post(
        "/api/site/icf/events/",
        json={"studyCode": "STUDY-A", "subjectId": "SUBJ-01", "icfVersionId": vid},
    )
    _assert_message(res, "A witness is required for this ICF version.")

    res = client.post(
        "/api/site/icf/events/",
        json={"studyCode": "STUDY-A", "subjectId": "SUBJ-01", "icfVersionId": vid, "witness": "Nurse W."},
    )
    assert res.status_code == 201, res.text

    # enroll check passes / blocked for a subject without consent
    res = client.get("/api/site/icf/enroll-check?studyCode=STUDY-A&siteCode=SITE-01&subjectId=SUBJ-01")
    assert res.json()["ok"] is True
    res = client.get("/api/site/icf/enroll-check?studyCode=STUDY-A&siteCode=SITE-01&subjectId=SUBJ-02")
    assert res.json()["ok"] is False

    # second version activation auto-supersedes the first
    res = client.post(
        "/api/site/icf/versions/",
        json={"studyCode": "STUDY-A", "siteCode": "SITE-01", "version": "2.0", "amendmentId": "AMD-X", "witnessRequired": False},
    )
    vid2 = res.json()["id"]
    client.post(f"/api/site/icf/versions/{vid2}/approve")
    client.post(f"/api/site/icf/versions/{vid2}/activate")
    versions = client.get("/api/site/icf/versions/?studyCode=STUDY-A").json()
    by_version = {v["version"]: v["status"] for v in versions}
    assert by_version["1.0"] == "Superseded"
    assert by_version["2.0"] == "Active"

    # re-consent campaign flow (amendment driven)
    res = client.post(
        "/api/site/icf/campaigns/",
        json={"studyCode": "STUDY-A", "amendmentId": "AMD-X", "icfVersionId": vid2, "subjectIds": ["SUBJ-01", "SUBJ-02"]},
    )
    assert res.status_code == 201, res.text
    cid = res.json()["id"]
    res = client.post(f"/api/site/icf/campaigns/{cid}/complete-subject", json={"subjectId": "SUBJ-01"})
    assert res.status_code == 200
    assert res.json()["subjects"][0]["completedAt"] is not None
    assert res.json()["status"] == "Open"

    res = client.get("/api/site/icf/procedures-blocked?studyCode=STUDY-A&subjectId=SUBJ-02")
    assert res.json()["blocked"] is True

    res = client.post(f"/api/site/icf/campaigns/{cid}/complete-subject", json={"subjectId": "SUBJ-02"})
    assert res.json()["status"] == "Completed"
    res = client.get("/api/site/icf/procedures-blocked?studyCode=STUDY-A&subjectId=SUBJ-02")
    assert res.json()["blocked"] is False

    # completing re-consent wrote a consent event on v2.0
    events = client.get("/api/site/icf/events/?studyCode=STUDY-A&subjectId=SUBJ-01").json()
    assert any(e["icfVersion"] == "2.0" and e.get("campaignId") == cid for e in events)

    assert "ICF_VERSION_ACTIVATED" in _last_audit_actions(client)


# ==========================================================================
# M22 Vendor & Lab management
# ==========================================================================


def test_vendor_and_kit_flow(authed):
    client = authed
    res = client.post("/api/site/vendors/", json={"name": "MedLab Central", "type": "Central Lab"})
    assert res.status_code == 201, res.text
    vid = res.json()["id"]

    # duplicate vendor name
    res = client.post("/api/site/vendors/", json={"name": "MedLab Central", "type": "Central Lab"})
    _assert_message(res, "A vendor with this name already exists.")

    res = client.post("/api/site/vendors/", json={"name": "ScanCo Imaging", "type": "Imaging"})
    assert res.status_code == 201

    # offboard requires reason
    res = client.post(f"/api/site/vendors/{vid}/offboard", json={"reason": ""})
    _assert_message(res, "An offboarding reason is required.")

    client.post(f"/api/site/vendors/{vid}/activate")

    # register kit on active vendor
    res = client.post(
        "/api/site/vendors/kits/",
        json={"vendorId": vid, "studyCode": "STUDY-A", "subjectId": "SUBJ-01", "visitCode": "V1", "kitType": "Blood", "specimenId": "SP-01"},
    )
    assert res.status_code == 201, res.text
    kid = res.json()["id"]
    assert res.json()["status"] == "Collected"

    # forward-only flow
    res = client.post(f"/api/site/vendors/kits/{kid}/advance", json={"nextStatus": "Collected"})
    assert res.status_code == 200
    res = client.post(f"/api/site/vendors/kits/{kid}/advance", json={"nextStatus": "Shipped", "location": "Courier"})
    assert res.status_code == 200
    assert res.json()["status"] == "Shipped"
    # forward moves may skip stages, backward moves are rejected
    res = client.post(f"/api/site/vendors/kits/{kid}/advance", json={"nextStatus": "Archived", "location": "Archive"})
    assert res.status_code == 200
    assert res.json()["status"] == "Archived"
    assert len(res.json()["chainOfCustody"]) == 3
    res = client.post(f"/api/site/vendors/kits/{kid}/advance", json={"nextStatus": "Resulted", "location": "Lab"})
    _assert_message(res, "Kit status can only move forward through the flow.")

    # offboard then kit registration must fail
    client.post(f"/api/site/vendors/{vid}/offboard", json={"reason": "contract ended"})
    res = client.post(
        "/api/site/vendors/kits/",
        json={"vendorId": vid, "subjectId": "SUBJ-01", "visitCode": "V2", "kitType": "Blood"},
    )
    _assert_message(res, "Kit vendor must exist and not be offboarded.")

    vendors = client.get("/api/site/vendors/").json()
    assert len(vendors) == 2
    assert "VENDOR_OFFBOARDED" in _last_audit_actions(client)


# ==========================================================================
# M23 Site Feasibility & selection
# ==========================================================================


def test_feasibility_pipeline_and_scoring(authed):
    client = authed
    # invalid scoring config (weights must sum to 1.0)
    res = client.put(
        "/api/site/feasibility-scoring/",
        json={"studyCode": "STUDY-A", "criteria": [{"key": "population", "label": "Population", "weight": 0.5}], "minScore": 60},
    )
    _assert_message(res, "Scoring criteria weights must sum to 1.0.")

    criteria = [
        {"key": "population", "label": "Patient population", "weight": 0.5},
        {"key": "competingTrials", "label": "Competing trials", "weight": 0.5},
    ]
    res = client.put(
        "/api/site/feasibility-scoring/",
        json={"studyCode": "STUDY-A", "criteria": criteria, "minScore": 70},
    )
    assert res.status_code == 200, res.text
    assert res.json()["minScore"] == 70

    res = client.post("/api/site/feasibility/", json={"institution": "City Medical Center", "studyCode": "STUDY-A", "email": "site@city.example"})
    assert res.status_code == 201, res.text
    cid = res.json()["id"]

    # response requires sent questionnaire
    res = client.post(f"/api/site/feasibility/{cid}/questionnaire-response", json={"patientPopulation": 200})
    _assert_message(res, "Candidate must have a sent questionnaire before responding.")

    client.post(f"/api/site/feasibility/{cid}/send-questionnaire")
    res = client.post(
        f"/api/site/feasibility/{cid}/questionnaire-response",
        json={"patientPopulation": 200, "competingTrials": True, "competingTrialDetails": "one", "infrastructure": "beds", "staffAvailability": "2 coordinators"},
    )
    assert res.status_code == 200

    # scoring uses the configured weights (50/50)
    res = client.post(
        f"/api/site/feasibility/{cid}/score",
        json={"scores": {"population": 80, "competingTrials": 40}},
    )
    assert res.status_code == 200, res.text
    assert res.json()["score"] == 60  # (80*0.5 + 40*0.5)
    assert res.json()["status"] == "Scored"

    # decision without rationale
    res = client.post(f"/api/site/feasibility/{cid}/decide", json={"decision": "Selected", "rationale": ""})
    _assert_message(res, "A rationale is required to record a selection decision.")

    # below-threshold selection blocked (60 < 70)
    res = client.post(f"/api/site/feasibility/{cid}/decide", json={"decision": "Selected", "rationale": "good"})
    _assert_message(
        res,
        "Candidate score (60) is below the study selection threshold (70).",
    )

    # lower threshold then select + convert
    client.put(
        "/api/site/feasibility-scoring/",
        json={"studyCode": "STUDY-A", "criteria": criteria, "minScore": 50},
    )
    res = client.post(f"/api/site/feasibility/{cid}/decide", json={"decision": "Selected", "rationale": "Strong population"})
    assert res.json()["status"] == "Selected"

    res = client.post(f"/api/site/feasibility/{cid}/convert")
    assert res.status_code == 200, res.text
    assert res.json()["converted"]["siteCode"].startswith("ST-")

    # decided candidates cannot be deleted / re-decided
    res = client.delete(f"/api/site/feasibility/{cid}")
    _assert_message(res, "Decided candidates are retained for audit and future feasibility.")

    # rejected retention + delete restriction on fresh identified
    res = client.post("/api/site/feasibility/", json={"institution": "Northside Research"})
    cid2 = res.json()["id"]
    res = client.delete(f"/api/site/feasibility/{cid2}")
    assert res.status_code == 200

    res = client.get("/api/site/feasibility/?studyCode=STUDY-A")
    assert len(res.json()) == 1
    assert "FEASIBILITY_CANDIDATE_SELECTED" in _last_audit_actions(client)


# ==========================================================================
# Auth + isolation
# ==========================================================================


def test_site_api_requires_session(client):
    res = client.get("/api/site/amendments/")
    assert res.status_code == 401
    res = client.post("/api/site/vendors/", json={"name": "x", "type": "Central Lab"})
    assert res.status_code == 401


def test_audit_rows_persist_after_mutations(authed):
    client = authed
    client.post(
        "/api/site/amendments/",
        json={"studyCode": "STUDY-Z", "amendmentNumber": "AM-900", "version": "1.0", "classification": "Administrative", "effectiveDate": "2026-09-01"},
    )
    actions = _last_audit_actions(client)
    assert "AMENDMENT_CREATED" in actions

    # the row exists on the audit table with a signature token
    from tria_engine.core.database import SessionLocal as SL

    with SL() as db:
        rows = db.execute(select(AuditLog).where(AuditLog.action == "AMENDMENT_CREATED")).scalars().all()
        assert rows, "expected an audit log row"
        assert rows[0].signature_token and rows[0].signature_meaning
