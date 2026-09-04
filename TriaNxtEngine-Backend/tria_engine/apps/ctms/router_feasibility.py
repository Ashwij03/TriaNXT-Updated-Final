# tria_engine/apps/ctms/router_feasibility.py
#
# M23 Site Feasibility & Selection REST surface (mirrors
# feasibilityService.ts):
#   GET/POST /feasibility(?studyCode=)     GET/PATCH/DELETE /feasibility/{code}
#   POST /feasibility/{code}/send-questionnaire
#   POST /feasibility/{code}/questionnaire-response  {patientPopulation, ...}
#   POST /feasibility/{code}/score         {scores: {...}}
#   POST /feasibility/{code}/decide        {decision, rationale}
#   POST /feasibility/{code}/convert
#   GET/PUT /feasibility-scoring?studyCode=  {criteria, minScore}

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from . import schemas
from .common import (
    enforce_for_model,
    CtmsError,
    actor_name,
    audit,
    create_record,
    filter_study,
    guarded,
    list_records,
    load_row,
    ok_response,
    save_record,
)
from .feasibility_logic import (
    add_candidate,
    can_delete_candidate,
    convert_candidate_to_site,
    decide_candidate,
    default_scoring_config,
    normalize_candidate,
    score_candidate,
    send_questionnaire,
    submit_questionnaire_response,
    update_candidate_profile,
)
from .models import CtmsFeasibilityCandidate, CtmsFeasibilityScoring

router = APIRouter(prefix="/feasibility", tags=["ctms-feasibility"])
scoring_router = APIRouter(prefix="/feasibility-scoring", tags=["ctms-feasibility"])


def _scoring_config(db, user, study_code: str) -> dict:
    key = (study_code or "").strip().lower()
    records = list_records(db, CtmsFeasibilityScoring, user)
    for record in records:
        if str(record.get("id") or "").strip().lower() == key:
            config = record
            return {
                "criteria": config.get("criteria") or [],
                "minScore": config.get("minScore") if config.get("minScore") is not None else 60,
            }
    return default_scoring_config()


# ----------------------------------------------------------------------
# Candidate lifecycle
# ----------------------------------------------------------------------


@router.get("")
@router.get("/")
def feasibility_list(
    request: Request,
    studyCode: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: filter_study(list_records(db, CtmsFeasibilityCandidate, user), studyCode))


@router.post("")
@router.post("/")
def feasibility_create(
    body: schemas.CandidateCreateBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = add_candidate(db, user, body.model_dump(), actor_name(user))
        return create_record(db, CtmsFeasibilityCandidate, user, record["id"], record), 201

    return guarded(_create)


@router.get("/{code}")
def feasibility_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        return record

    return guarded(_detail)


@router.patch("/{code}")
def feasibility_update(
    code: str,
    body: schemas.CandidatePatchBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _update():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        updated = update_candidate_profile(
            record, {k: v for k, v in body.model_dump().items() if v is not None}, actor_name(user)
        )
        return save_record(db, user, row, updated)

    return guarded(_update)


@router.post("/{code}/send-questionnaire")
def feasibility_send_questionnaire(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _send():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        send_questionnaire(record, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_send)


@router.post("/{code}/questionnaire-response")
def feasibility_response(
    code: str,
    body: schemas.QuestionnaireResponseBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _respond():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        submit_questionnaire_response(record, body.model_dump(), actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_respond)


@router.post("/{code}/score")
def feasibility_score(
    code: str,
    body: schemas.ScoresBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _score():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        config = _scoring_config(db, user, record.get("studyCode") or "")
        score_candidate(db, user, record, body.scores or {}, config, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_score)


@router.post("/{code}/decide")
def feasibility_decide(
    code: str,
    body: schemas.DecideBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _decide():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        # The selection threshold is the *current* per-study scoring config,
        # not the value snapshotted when the candidate was scored (the
        # sponsor may lower/raise it between scoring and decision).
        if record.get("score") is not None:
            config = _scoring_config(db, user, record.get("studyCode") or "")
            record["minScoreRequired"] = config.get("minScore")
        decide_candidate(db, user, record, body.decision, body.rationale, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_decide)


@router.post("/{code}/convert")
def feasibility_convert(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _convert():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        convert_candidate_to_site(db, user, record, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_convert)


@router.delete("/{code}")
def feasibility_delete(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _delete():
        row, record = load_row(db, CtmsFeasibilityCandidate, user, code, "Candidate not found.")
        enforce_for_model(user, CtmsFeasibilityCandidate, "delete")
        can_delete_candidate(record)
        audit(
            db,
            user,
            "FEASIBILITY_CANDIDATE_REMOVED",
            details={"candidateId": code, "institution": record.get("institution")},
        )
        db.delete(row)
        db.commit()
        return {"deleted": True, "id": code}

    return guarded(_delete)


# ----------------------------------------------------------------------
# Per-study scoring configuration
# ----------------------------------------------------------------------


@scoring_router.get("")
@scoring_router.get("/")
def feasibility_scoring_get(
    request: Request,
    studyCode: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return guarded(lambda: _scoring_config(db, user, studyCode))


@scoring_router.put("")
@scoring_router.put("/")
def feasibility_scoring_put(
    body: schemas.ScoringConfigBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _put():
        criteria = body.criteria or []
        if not criteria:
            raise CtmsError("At least one scoring criterion is required.")
        total_weight = sum(float(c.get("weight") or 0) for c in criteria)
        if abs(total_weight - 1.0) > 0.0001:
            raise CtmsError("Scoring criteria weights must sum to 1.0.")
        study_code = body.studyCode or ""
        key = study_code.strip().lower()
        normalized = {
            "id": key,
            "criteria": [
                {"key": c.get("key"), "label": c.get("label") or c.get("key"), "weight": float(c.get("weight") or 0)}
                for c in criteria
            ],
            "minScore": body.minScore if body.minScore is not None else 60,
        }
        existing = None
        for row in db.query(CtmsFeasibilityScoring).all():
            if row.organization_id == user.organization_id and str(row.code).strip().lower() == key:
                existing = row
                break
        if existing is None:
            create_record(db, CtmsFeasibilityScoring, user, key, normalized)
        else:
            save_record(db, user, existing, normalized)
        return _scoring_config(db, user, study_code)

    return guarded(_put)
