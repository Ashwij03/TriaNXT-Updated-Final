# tria_engine/apps/ctms/feasibility_logic.py
#
# M23 Site Feasibility & Selection (spec 6.30) — Python port of
# src/shared/services/feasibilityService.ts.

from __future__ import annotations

from .common import CtmsError, audit, iso_now, new_id, stamp

FEASIBILITY_STATUSES = [
    "Identified",
    "Questionnaire Sent",
    "Scored",
    "Selected",
    "Rejected",
]

DEFAULT_SCORING_CRITERIA = [
    {"key": "population", "label": "Patient population", "weight": 0.35},
    {"key": "competingTrials", "label": "Competing trials", "weight": 0.2},
    {"key": "infrastructure", "label": "Infrastructure", "weight": 0.2},
    {"key": "staff", "label": "Staff availability", "weight": 0.15},
    {"key": "timeline", "label": "Timeline", "weight": 0.1},
]

DEFAULT_MIN_SCORE = 60


def default_scoring_config() -> dict:
    return {
        "criteria": [dict(c) for c in DEFAULT_SCORING_CRITERIA],
        "minScore": DEFAULT_MIN_SCORE,
    }


def normalize_candidate(candidate: dict) -> dict:
    now = iso_now()
    return {
        "id": candidate.get("id") or new_id("FC-", upper=True),
        "studyCode": candidate.get("studyCode") or "",
        "institution": candidate.get("institution") or "",
        "contactName": candidate.get("contactName") or "",
        "email": candidate.get("email") or "",
        "phone": candidate.get("phone") or "",
        "department": candidate.get("department") or "",
        "status": (
            candidate["status"]
            if candidate.get("status") in FEASIBILITY_STATUSES
            else "Identified"
        ),
        "sentDate": candidate.get("sentDate"),
        "response": candidate.get("response"),
        "responseSubmittedAt": candidate.get("responseSubmittedAt"),
        "scores": dict(candidate.get("scores") or {}),
        "score": (
            None
            if candidate.get("score") is None
            else float(candidate.get("score"))
        ),
        "minScoreRequired": (
            None
            if candidate.get("minScoreRequired") is None
            else float(candidate.get("minScoreRequired"))
        ),
        "rationale": candidate.get("rationale") or "",
        "decidedAt": candidate.get("decidedAt"),
        "converted": candidate.get("converted"),
        "notes": candidate.get("notes") or "",
        "createdAt": candidate.get("createdAt") or now,
        "updatedAt": candidate.get("updatedAt") or now,
        "updatedBy": candidate.get("updatedBy") or "",
        "history": list(candidate.get("history") or []),
    }


def add_candidate(db, user, payload: dict, actor: str) -> dict:
    if not payload.get("institution"):
        raise CtmsError("Institution name is required.")
    candidate = normalize_candidate(
        {
            "institution": payload.get("institution"),
            "studyCode": payload.get("studyCode") or "",
            "contactName": payload.get("contactName") or "",
            "email": payload.get("email") or "",
            "phone": payload.get("phone") or "",
            "department": payload.get("department") or "",
            "notes": payload.get("notes") or "",
            "status": "Identified",
        }
    )
    candidate["history"] = stamp(candidate, "CANDIDATE_IDENTIFIED", actor)
    audit(
        db,
        user,
        "FEASIBILITY_CANDIDATE_ADDED",
        details={
            "candidateId": candidate["id"],
            "institution": candidate["institution"],
            "studyCode": candidate.get("studyCode") or "(portfolio)",
        },
    )
    return candidate


def update_candidate_profile(candidate: dict, updates: dict, actor: str) -> dict:
    if candidate["status"] in ("Selected", "Rejected"):
        raise CtmsError(
            "Selected/rejected candidates cannot be edited; record a new candidate."
        )
    merged = dict(candidate)
    merged.update({k: v for k, v in updates.items() if v is not None})
    merged["id"] = candidate["id"]
    merged["createdAt"] = candidate["createdAt"]
    merged["history"] = candidate["history"]
    next_candidate = normalize_candidate(merged)
    next_candidate["history"] = stamp(next_candidate, "CANDIDATE_UPDATED", actor)
    next_candidate["updatedBy"] = actor
    return next_candidate


def send_questionnaire(candidate: dict, actor: str) -> dict:
    if candidate["status"] not in ("Identified", "Questionnaire Sent"):
        raise CtmsError("Questionnaire can only be sent to Identified candidates.")
    candidate["status"] = "Questionnaire Sent"
    candidate["sentDate"] = iso_now()
    candidate["updatedAt"] = candidate["sentDate"]
    candidate["updatedBy"] = actor
    candidate["history"] = stamp(candidate, "QUESTIONNAIRE_SENT", actor)
    return candidate


def submit_questionnaire_response(candidate: dict, response: dict, actor: str) -> dict:
    if candidate["status"] != "Questionnaire Sent":
        raise CtmsError("Candidate must have a sent questionnaire before responding.")
    try:
        population = float(response.get("patientPopulation") or 0)
    except (TypeError, ValueError):
        population = 0
    candidate["response"] = {
        "patientPopulation": population,
        "competingTrials": bool(response.get("competingTrials")),
        "competingTrialDetails": response.get("competingTrialDetails") or "",
        "infrastructure": response.get("infrastructure") or "",
        "staffAvailability": response.get("staffAvailability") or "",
    }
    candidate["responseSubmittedAt"] = iso_now()
    candidate["updatedAt"] = candidate["responseSubmittedAt"]
    candidate["updatedBy"] = actor
    candidate["history"] = stamp(candidate, "QUESTIONNAIRE_RESPONSE_RECEIVED", actor)
    return candidate


def _compute_weighted_score(config: dict, raw_scores: dict) -> int:
    total = 0.0
    for criterion in config["criteria"]:
        key = criterion["key"]
        try:
            raw = float(raw_scores.get(key))
        except (TypeError, ValueError):
            raise CtmsError("Score for criterion '" + str(key) + "' is missing.")
        total += max(0.0, min(raw, 100.0)) * float(criterion.get("weight") or 0)
    return int(round(total))


def score_candidate(db, user, candidate: dict, raw_scores: dict, config: dict, actor: str) -> dict:
    if candidate["status"] not in ("Questionnaire Sent", "Scored"):
        raise CtmsError("Candidate must have returned the questionnaire before scoring.")
    score = _compute_weighted_score(config, raw_scores)
    candidate["score"] = score
    candidate["minScoreRequired"] = config["minScore"]
    candidate["scores"] = dict(raw_scores)
    candidate["status"] = "Scored"
    candidate["updatedAt"] = iso_now()
    candidate["updatedBy"] = actor
    candidate["history"] = stamp(candidate, "CANDIDATE_SCORED:" + str(score), actor)
    audit(
        db,
        user,
        "FEASIBILITY_CANDIDATE_SCORED",
        details={"candidateId": candidate["id"], "score": score},
    )
    return candidate


def decide_candidate(db, user, candidate: dict, decision: str, rationale: str, actor: str) -> dict:
    if decision not in ("Selected", "Rejected"):
        raise CtmsError("Decision must be 'Selected' or 'Rejected'.")
    if not str(rationale or "").strip():
        raise CtmsError("A rationale is required to record a selection decision.")
    if candidate["status"] not in ("Questionnaire Sent", "Scored"):
        raise CtmsError("Candidate must be scored (or responded) before a decision.")
    if decision == "Selected" and candidate["status"] == "Questionnaire Sent":
        raise CtmsError("Candidate must be scored before it can be selected.")
    if (
        decision == "Selected"
        and candidate.get("score") is not None
        and candidate.get("minScoreRequired") is not None
        and float(candidate["score"]) < float(candidate["minScoreRequired"])
    ):
        raise CtmsError(
            "Candidate score ("
            + str(int(candidate["score"]))
            + ") is below the study selection threshold ("
            + str(int(candidate["minScoreRequired"]))
            + ")."
        )

    candidate["status"] = decision
    candidate["rationale"] = rationale
    candidate["decidedAt"] = iso_now()
    candidate["updatedAt"] = candidate["decidedAt"]
    candidate["updatedBy"] = actor
    candidate["history"] = stamp(
        candidate,
        "CANDIDATE_SELECTED" if decision == "Selected" else "CANDIDATE_REJECTED",
        actor,
    )
    audit(
        db,
        user,
        "FEASIBILITY_CANDIDATE_SELECTED" if decision == "Selected" else "FEASIBILITY_CANDIDATE_REJECTED",
        details={"candidateId": candidate["id"], "rationale": rationale},
    )
    return candidate


def convert_candidate_to_site(db, user, candidate: dict, actor: str) -> dict:
    if candidate["status"] != "Selected":
        raise CtmsError("Only Selected candidates can be converted to a site.")
    if candidate.get("converted"):
        raise CtmsError("Candidate has already been converted to a site.")

    _rest = str(candidate["id"])
    if _rest.startswith("FC-"):
        _rest = _rest[3:]
    site_code = "ST-" + _rest[:8]
    candidate["converted"] = {
        "siteCode": site_code,
        "siteName": candidate["institution"],
        "convertedAt": iso_now(),
        "questionnaire": candidate.get("response"),
        "score": candidate.get("score"),
        "rationale": candidate.get("rationale"),
    }
    candidate["updatedAt"] = candidate["converted"]["convertedAt"]
    candidate["updatedBy"] = actor
    candidate["history"] = stamp(candidate, "CANDIDATE_CONVERTED:" + site_code, actor)
    audit(
        db,
        user,
        "FEASIBILITY_CANDIDATE_CONVERTED",
        details={"candidateId": candidate["id"], "siteCode": site_code},
    )
    return candidate


def can_delete_candidate(candidate: dict) -> bool:
    if candidate["status"] not in ("Identified", "Questionnaire Sent"):
        raise CtmsError("Decided candidates are retained for audit and future feasibility.")
    return True
