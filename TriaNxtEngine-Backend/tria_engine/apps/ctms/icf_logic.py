# tria_engine/apps/ctms/icf_logic.py
#
# M21 eConsent / ICF Version & Re-consent (spec 6.28) — Python port of
# src/shared/services/icfConsentService.ts. Operates on the versions,
# events and campaigns lists (loaded by the router from their tables) so
# cross-list rules (ENR-01 consent gate, auto-supersede, campaign events)
# behave exactly like the frontend store.

from __future__ import annotations

from .common import CtmsError, audit, iso_now, new_id, stamp

ICF_VERSION_STATUSES = ["Draft", "Approved", "Active", "Superseded", "Archived"]

RE_CONSENT_STATUSES = ["Open", "Completed"]


def _norm(value) -> str:
    return str(value or "").strip().lower()


def _site_key(study_code, site_code) -> str:
    return _norm(study_code) + "::" + _norm(site_code)


def _find(list_, code):
    return next((item for item in list_ if str(item.get("id")) == str(code)), None)


# ----------------------------------------------------------------------
# ICF versions
# ----------------------------------------------------------------------


def create_icf_version(db, user, payload: dict, actor: str) -> dict:
    if not payload.get("studyCode") or not payload.get("siteCode") or not payload.get("version"):
        raise CtmsError("studyCode, siteCode and version are required.")
    version = {
        "id": new_id("ICFV-", upper=True),
        "studyCode": payload.get("studyCode"),
        "siteCode": payload.get("siteCode"),
        "language": payload.get("language") or "English",
        "version": payload.get("version"),
        "amendmentId": payload.get("amendmentId") or "",
        "witnessRequired": bool(payload.get("witnessRequired")),
        "status": "Draft",
        "approvedAt": None,
        "activatedAt": None,
        "createdAt": iso_now(),
        "updatedAt": None,
        "updatedBy": actor,
        "history": [],
    }
    version["updatedAt"] = version["createdAt"]
    version["history"] = stamp(version, "ICF_VERSION_CREATED:v" + str(version["version"]), actor)
    audit(
        db,
        user,
        "ICF_VERSION_CREATED",
        details={"versionId": version["id"], "version": version["version"]},
    )
    return version


def approve_icf_version(version: dict, actor: str) -> dict:
    if version["status"] != "Draft":
        raise CtmsError("Only Draft ICF versions can be approved.")
    version["status"] = "Approved"
    version["approvedAt"] = iso_now()
    version["updatedAt"] = version["approvedAt"]
    version["updatedBy"] = actor
    version["history"] = stamp(version, "ICF_VERSION_APPROVED", actor)
    return version


def activate_icf_version(versions: list[dict], version: dict, actor: str) -> dict:
    if version["status"] != "Approved":
        raise CtmsError("Only Approved ICF versions can be activated.")
    key = _site_key(version["studyCode"], version["siteCode"])
    for candidate in versions:
        if (
            _site_key(candidate["studyCode"], candidate["siteCode"]) == key
            and candidate["status"] == "Active"
            and candidate["id"] != version["id"]
        ):
            candidate["status"] = "Superseded"
            candidate["updatedAt"] = iso_now()
            candidate["history"] = stamp(candidate, "ICF_VERSION_SUPERSEDED", actor)
    version["status"] = "Active"
    version["activatedAt"] = iso_now()
    version["updatedAt"] = version["activatedAt"]
    version["updatedBy"] = actor
    version["history"] = stamp(version, "ICF_VERSION_ACTIVATED", actor)
    return version


def get_active_icf_version(versions: list[dict], study_code, site_code):
    key = _site_key(study_code, site_code)
    return next(
        (v for v in versions if _site_key(v["studyCode"], v["siteCode"]) == key and v["status"] == "Active"),
        None,
    )


# ----------------------------------------------------------------------
# Subject consent events (ENR-01)
# ----------------------------------------------------------------------


def record_consent_event(db, user, versions: list[dict], payload: dict, actor: str) -> dict:
    if not payload.get("studyCode") or not payload.get("subjectId") or not payload.get("icfVersionId"):
        raise CtmsError("studyCode, subjectId and icfVersionId are required.")
    version = _find(versions, payload["icfVersionId"])
    if version is None:
        raise CtmsError("ICF version not found.")
    if version["status"] != "Active":
        raise CtmsError(
            "Consent can only be recorded against the ACTIVE ICF version for the site."
        )
    if version.get("witnessRequired") and not str(payload.get("witness") or "").strip():
        raise CtmsError("A witness is required for this ICF version.")

    now = iso_now()
    date_value = payload.get("date") or now.split("T")[0]
    event = {
        "id": new_id("CNS-", upper=True),
        "studyCode": version["studyCode"],
        "siteCode": version["siteCode"],
        "subjectId": payload["subjectId"],
        "icfVersionId": version["id"],
        "icfVersion": version["version"],
        "date": date_value,
        "witness": payload.get("witness") or "",
        "createdAt": now,
        "createdBy": actor,
    }
    audit(
        db,
        user,
        "CONSENT_EVENT_RECORDED",
        details={"eventId": event["id"], "subjectId": event["subjectId"], "icfVersion": version["version"]},
    )
    return event


def can_enroll_subject(versions: list[dict], events: list[dict], study_code, site_code, subject_id) -> dict:
    active = get_active_icf_version(versions, study_code, site_code)
    if active is None:
        return {"ok": False, "reason": "No ACTIVE ICF version exists for this site yet."}
    matching = next(
        (
            event
            for event in events
            if _norm(event.get("subjectId")) == _norm(subject_id)
            and _norm(event.get("studyCode")) == _norm(study_code)
            and _norm(event.get("icfVersionId")) == _norm(active["id"])
        ),
        None,
    )
    if matching is None:
        return {
            "ok": False,
            "reason": "No consent event recorded against the active ICF version v"
            + str(active["version"])
            + " for this subject.",
        }
    return {
        "ok": True,
        "reason": "Consent confirmed on ICF v" + str(active["version"]) + ".",
        "eventId": matching["id"],
    }


# ----------------------------------------------------------------------
# Re-consent campaigns
# ----------------------------------------------------------------------


def create_reconsent_campaign(db, user, versions: list[dict], payload: dict, actor: str) -> dict:
    if not payload.get("studyCode") or not payload.get("amendmentId"):
        raise CtmsError("studyCode and amendmentId are required for a re-consent campaign.")
    if not payload.get("icfVersionId"):
        raise CtmsError("A new active ICF version is required for re-consent.")
    version = _find(versions, payload["icfVersionId"])
    if version is None or version["status"] != "Active":
        raise CtmsError("Re-consent must target an ACTIVE ICF version.")
    subject_ids = [str(s) for s in (payload.get("subjectIds") or []) if s]
    if not subject_ids:
        raise CtmsError("Add at least one affected subject.")

    now = iso_now()
    campaign = {
        "id": new_id("RC-", upper=True),
        "studyCode": payload["studyCode"],
        "siteCode": version["siteCode"],
        "amendmentId": payload["amendmentId"],
        "icfVersionId": version["id"],
        "icfVersion": version["version"],
        "dueDate": payload.get("dueDate") or "",
        "status": "Open",
        "subjects": [{"subjectId": sid, "completedAt": None} for sid in subject_ids],
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": actor,
        "history": [],
    }
    campaign["history"] = stamp(campaign, "RE_CONSENT_CAMPAIGN_OPENED", actor)
    audit(
        db,
        user,
        "RE_CONSENT_CAMPAIGN_CREATED",
        details={"campaignId": campaign["id"], "amendmentId": campaign["amendmentId"], "affectedSubjects": len(subject_ids)},
    )
    return campaign


def is_subject_procedures_blocked(campaigns: list[dict], subject_id, study_code) -> bool:
    return any(
        campaign.get("status") == "Open"
        and _norm(campaign.get("studyCode")) == _norm(study_code)
        and any(
            _norm(entry.get("subjectId")) == _norm(subject_id) and not entry.get("completedAt")
            for entry in (campaign.get("subjects") or [])
        )
        for campaign in campaigns
    )


def complete_reconsent(campaigns: list[dict], campaign: dict, subject_id: str, actor: str) -> dict:
    if campaign["status"] != "Open":
        raise CtmsError("Campaign is not open.")
    entry = next(
        (s for s in (campaign.get("subjects") or []) if _norm(s.get("subjectId")) == _norm(subject_id)),
        None,
    )
    if entry is None:
        raise CtmsError("Subject is not part of this campaign.")
    if entry.get("completedAt"):
        raise CtmsError("Re-consent already completed for this subject.")

    entry["completedAt"] = iso_now()
    campaign["updatedAt"] = entry["completedAt"]
    campaign["updatedBy"] = actor
    all_done = all(s.get("completedAt") for s in (campaign.get("subjects") or []))
    if all_done:
        campaign["status"] = "Completed"
    campaign["history"] = stamp(campaign, "RE_CONSENT_COMPLETED:" + subject_id, actor)
    return campaign


def build_reconsent_event(campaign: dict, subject_id: str) -> dict:
    """The consent event written when re-consent completes (audit evidence)."""
    return {
        "id": new_id("CNS-", upper=True),
        "studyCode": campaign["studyCode"],
        "siteCode": campaign["siteCode"],
        "subjectId": subject_id,
        "icfVersionId": campaign["icfVersionId"],
        "icfVersion": campaign["icfVersion"],
        "date": campaign["updatedAt"].split("T")[0],
        "witness": "",
        "campaignId": campaign["id"],
        "createdAt": campaign["updatedAt"],
        "createdBy": "",
    }
