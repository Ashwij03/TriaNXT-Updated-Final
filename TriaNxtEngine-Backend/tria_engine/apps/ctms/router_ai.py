# tria_engine/apps/ctms/router_ai.py
#
# AI Review & Risk Insights REST surface (mirrors
# src/shared/services/api/aiReviewApi.ts). Every response uses the
# {"data": ...} envelope the page reads (RiskInsights.tsx does res.data).
#
#   GET  /ai-review/sites/{site}/risk       -> {"data": {score, reasons,
#                                              model}}
#   GET  /ai-review/copilot?q=...           -> {"data": {answer_mode,
#                                              matches: [{id, code, name,
#                                              status}], note}}
#   POST /ai-review/documents/{id}/qc       -> advisory {"data": {...}}
#   POST /ai-review/comments/{id}/triage    -> advisory {"data": {...}}
#   POST /ai-review/findings/{id}/decision  -> advisory {"data": {...}}
#
# Design notes:
#   * These are DETERMINISTIC rule/keyword implementations — the UI itself
#     labels every output advisory and says the RAG/Bedrock pipeline
#     (Blueprint Section 6) is not provisioned. The risk score is computed
#     from real in-scope signals (pending monitoring access requests, open
#     AE/SAE cases); the copilot keyword-matches the query against
#     organizations and study codes actually referenced by the caller's
#     in-scope gap records. No client-side claim is ever trusted.
#   * The qc/triage/decision actions have no persisted source store in this
#     FastAPI deployment yet, so they return an explicit advisory envelope
#     instead of 404ing or pretending a document was reviewed.

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...apps.accounts.rbac import enforce
from ...core.database import get_db
from ..organizations.models import Organization
from . import schemas
from .common import CtmsError, audit, guarded, list_records
from .models import CtmsAeCase, CtmsMonitoringRequest

router = APIRouter(prefix="/ai-review", tags=["ai-review"])

MODEL_TAG = "deterministic-rules-v1 (RAG not provisioned)"


def _match_org(orgs: list, site_id: str) -> Organization | None:
    key = (site_id or "").strip()
    if not key:
        return None
    for org in orgs:
        if str(org.id) == key or org.name.lower() == key.lower():
            return org
    return None


def _corpus(db: Session, user: User) -> list[dict]:
    """Keyword-match corpus: organizations + study codes referenced by the
    caller's in-scope ctms records (org-scoped via the record layer)."""
    items: list[dict] = []
    for org in db.query(Organization).order_by(Organization.name).all():
        items.append(
            {"id": f"org-{org.id}", "code": org.name, "name": org.name, "status": "ACTIVE"}
        )
    seen: set[str] = set()
    for record in list_records(db, CtmsAeCase, user):
        code = str(record.get("study_id") or "").strip()
        if code and code not in seen:
            seen.add(code)
            items.append({"id": f"study-{code}", "code": code, "name": code, "status": "KNOWN"})
    return items


def _keyword_matches(query: str, items: list[dict]) -> list[dict]:
    tokens = [t.lower() for t in (query or "").replace(",", " ").split() if t.strip()]
    if not tokens:
        return []
    scored = []
    for item in items:
        hay = f"{item['name']} {item['code']}".lower()
        score = sum(1 for t in tokens if t in hay)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda pair: (-pair[0], pair[1]["name"].lower()))
    return [item for _, item in scored[:8]]


# ---------------------------------------------------------------------------
# Site risk score (page: RiskInsights "Score site")
# ---------------------------------------------------------------------------


@router.get("/sites/{site_id}/risk")
def ai_site_risk(
    site_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    orgs = db.query(Organization).order_by(Organization.name).all()
    org = _match_org(orgs, site_id)
    score = 0
    reasons: list[str] = []

    if org is not None:
        # Signal 1: pending date-scoped monitoring access requests for the site.
        pending = 0
        for record in list_records(db, CtmsMonitoringRequest, user):
            if str(record.get("site") or "") == str(org.id) and str(
                record.get("status") or ""
            ).lower() == "pending":
                pending += 1
        if pending:
            score += min(40, 20 * pending)
            reasons.append(f"{pending} pending monitoring access request(s) for this site")

        # Signal 2: open AE/SAE cases on file for that organization/site
        # (org-scoped rows only — never other sites' cases).
        open_cases = sum(
            1
            for row in db.query(CtmsAeCase).filter(CtmsAeCase.organization_id == org.id).all()
            if str((row.data or {}).get("status") or "").lower() in ("open", "underreview")
        )
        if open_cases:
            score += min(30, 10 * open_cases)
            reasons.append(f"{open_cases} open AE/SAE case(s) on file for this site")

        if not pending and not open_cases:
            reasons.append("No elevated risk signals found for this site.")
    else:
        reasons.append(
            f"Site '{site_id}' was not matched in the site directory; no signals to score."
        )

    return {"data": {"score": min(100, score), "reasons": reasons, "model": MODEL_TAG}}


# ---------------------------------------------------------------------------
# Study copilot (page: RiskInsights "Ask")
# ---------------------------------------------------------------------------


@router.get("/copilot")
def ai_copilot(
    request: Request,
    q: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    matches = _keyword_matches(q, _corpus(db, user))
    audit(db, user, "AI_COPILOT_QUERY", details={"q": (q or "")[:80]})
    return {
        "data": {
            "answer_mode": "keyword-fallback",
            "matches": matches,
            "note": (
                "Keyword fallback (Blueprint Section 6.2): matches scan "
                "organizations and study codes referenced by in-scope records. "
                "RAG/Bedrock retrieval is not provisioned in this deployment."
            ),
        }
    }


# ---------------------------------------------------------------------------
# Advisory write actions (no persisted source store yet — explicit, honest
# envelopes instead of 404s; every AI output remains advisory per the UI)
# ---------------------------------------------------------------------------


@router.post("/documents/{document_id}/qc")
def ai_review_document(
    document_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    enforce(user, "ai", "create")
    audit(db, user, "AI_DOCUMENT_QC_REQUESTED", details={"document": document_id})
    return {
        "data": {
            "document_id": document_id,
            "qc_status": "no-source-store",
            "finding": None,
            "message": (
                "Document QC requested, but this deployment has no persisted "
                "document/source store for AI extraction yet — no finding was "
                "created (Blueprint Section 6.3)."
            ),
            "model": MODEL_TAG,
        }
    }


@router.post("/comments/{comment_id}/triage")
def ai_triage_comment(
    comment_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    enforce(user, "ai", "create")
    audit(db, user, "AI_COMMENT_TRIAGE_REQUESTED", details={"comment": comment_id})
    return {
        "data": {
            "comment_id": comment_id,
            "urgency": "unknown",
            "message": (
                "Comment triage requested, but comments live in a module this "
                "deployment does not persist yet — no urgency was assigned."
            ),
            "model": MODEL_TAG,
        }
    }


@router.post("/findings/{finding_id}/decision")
def ai_decide_finding(
    finding_id: str,
    body: schemas.AiDecisionBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _decide():
        enforce(user, "ai", "update")
        decision = (body.decision or "").strip()
        if decision not in ("Accepted", "Rejected"):
            raise CtmsError("decision must be 'Accepted' or 'Rejected'.")
        audit(
            db,
            user,
            "AI_FINDING_DECISION",
            details={"finding": finding_id, "decision": decision},
        )
        return {
            "data": {
                "finding_id": finding_id,
                "decision": decision,
                "rationale": (body.rationale or "").strip() or None,
                "recorded": False,
                "message": (
                    "Decision recorded in the audit log. This deployment has no "
                    "persisted AI-finding store, so the finding row itself cannot "
                    "be updated (Blueprint Section 6.4)."
                ),
            }
        }

    return guarded(_decide)
