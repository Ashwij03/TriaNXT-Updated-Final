# tria_engine/apps/ctms/router_sync.py
#
# Bulk synchronization surface for the frontend integration. The six gap
# modules' frontend services persist flat local records; when the app runs
# in API mode they push their whole collections here so the FastAPI side is
# a live mirror, and pull collections back to hydrate empty stores on boot.
#
#   POST /api/site/amendments/sync            records -> ctms_amendment
#   POST /api/site/ip/sync                    lots    -> ctms_iplot
#   POST /api/site/irb/sync                   submissions -> ctms_irbsubmission
#   POST /api/site/icf/versions/sync          versions -> ctms_icfversion
#   POST /api/site/icf/events/sync            events   -> ctms_consentevent
#   POST /api/site/icf/campaigns/sync         campaigns -> ctms_reconsentcampaign
#   POST /api/site/vendors/sync               vendors  -> ctms_vendor
#   POST /api/site/vendors/kits/sync          kits     -> ctms_kit
#   POST /api/site/feasibility/sync           candidates -> ctms_feasibilitycandidate
#   POST /api/site/feasibility-scoring/sync   scoring config (code = study)
#   POST /api/site/subjects/sync              subjects  -> ctms_subject (study-
#                                          qualified sync codes + studyId scope)
#   POST /api/site/visits/sync                visit schedule rows -> ctms_visit
#
# Upsert semantics: a record whose `id` already exists in the caller's org
# is updated in place (data + study/site scope columns refreshed); a new id
# is inserted. Cross-org rows are never touched. Role enforcement and
# site/study write-scope assertion run per collection (rbac) and per record
# (assert_write_scope), so out-of-scope records are skipped, never written.

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from . import schemas
from .common import bulk_sync_records, ok_response
from .models import (
    CtmsAmendment,
    CtmsConsentEvent,
    CtmsFeasibilityCandidate,
    CtmsFeasibilityScoring,
    CtmsIcfVersion,
    CtmsIpLot,
    CtmsIrbSubmission,
    CtmsKit,
    CtmsReConsentCampaign,
    CtmsSubject,
    CtmsSubjectStatusHistory,
    CtmsVendor,
    CtmsVisit,
)

# No prefix of its own: this router is included under the ctms aggregate,
# which already carries the /api/site prefix (ctms/router.py).
router = APIRouter(tags=["ctms-site-sync"])


def _sync_endpoint(model, *, codes_fn=None, code_fn=None, after_sync=None):
    def _handler(
        body: schemas.SyncBody,
        request: Request,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        report = bulk_sync_records(
            db, model, user, body.records, codes_fn=codes_fn, code_fn=code_fn
        )
        if after_sync is not None:
            after_sync()
        return ok_response(report)

    return _handler


# --- Subjects / visits scope extractors ------------------------------------
# Subject rows carry their study under `studyId` (not `studyCode`), and two
# studies may each contain a subject numbered e.g. "S-1001" — so the row
# code is study-qualified (`study::subjectId`) and the scope column comes
# from `studyId`. Visit rows carry the study under `study`/`studyKey`; their
# schedule ids (`study::subjectId::visit`) are already unique per row.


def _subject_scope(record):
    study = str(record.get("studyId") or "").strip() or None
    return study, None


def _subject_code(record):
    study = str(record.get("studyId") or "").strip()
    ident = str(record.get("subjectId") or record.get("id") or "").strip()
    return f"{study}::{ident}" if study and ident else ""


def _visit_scope(record):
    study = str(record.get("study") or record.get("studyKey") or "").strip() or None
    return study, None


def _subject_history_scope(record):
    study = str(record.get("studyId") or "").strip() or None
    return study, None


def _subject_history_code(record):
    study = str(record.get("studyId") or "").strip()
    ident = str(record.get("subjectId") or record.get("id") or "").strip()
    stamp = str(record.get("changedAt") or record.get("at") or "")
    return f"{study}::{ident}::h{stamp}" if study and ident else ""


router.add_api_route(
    "/amendments/sync", _sync_endpoint(CtmsAmendment), methods=["POST"],
    summary="Bulk-sync protocol amendment records",
)
router.add_api_route(
    "/ip/sync", _sync_endpoint(CtmsIpLot), methods=["POST"],
    summary="Bulk-sync IP lot records",
)
router.add_api_route(
    "/irb/sync", _sync_endpoint(CtmsIrbSubmission), methods=["POST"],
    summary="Bulk-sync IRB/IEC submission records",
)
router.add_api_route(
    "/icf/versions/sync", _sync_endpoint(CtmsIcfVersion), methods=["POST"],
    summary="Bulk-sync ICF version records",
)
router.add_api_route(
    "/icf/events/sync", _sync_endpoint(CtmsConsentEvent), methods=["POST"],
    summary="Bulk-sync subject consent events",
)
router.add_api_route(
    "/icf/campaigns/sync", _sync_endpoint(CtmsReConsentCampaign), methods=["POST"],
    summary="Bulk-sync re-consent campaigns",
)
router.add_api_route(
    "/vendors/sync", _sync_endpoint(CtmsVendor), methods=["POST"],
    summary="Bulk-sync vendor records",
)
router.add_api_route(
    "/vendors/kits/sync", _sync_endpoint(CtmsKit), methods=["POST"],
    summary="Bulk-sync lab kit records",
)
router.add_api_route(
    "/feasibility/sync", _sync_endpoint(CtmsFeasibilityCandidate), methods=["POST"],
    summary="Bulk-sync feasibility candidate records",
)
router.add_api_route(
    "/feasibility-scoring/sync", _sync_endpoint(CtmsFeasibilityScoring), methods=["POST"],
    summary="Bulk-sync per-study feasibility scoring configuration",
)
# A subject registration/update is exactly the write that must invalidate
# the cached per-study enrollment counts (router_subjects) — otherwise the
# Studies list would keep serving the pre-registration numbers until the
# TTL expired (Redis hot-cache invalidation; in-process cache when no
# REDIS_URL is configured).
from .router_subjects import invalidate_subject_enrollment_counts  # noqa: E402

router.add_api_route(
    "/subjects/sync",
    _sync_endpoint(
        CtmsSubject,
        codes_fn=_subject_scope,
        code_fn=_subject_code,
        after_sync=invalidate_subject_enrollment_counts,
    ),
    methods=["POST"],
    summary="Bulk-sync subject records (enrollment/screening mirror)",
)
router.add_api_route(
    "/visits/sync",
    _sync_endpoint(CtmsVisit, codes_fn=_visit_scope),
    methods=["POST"],
    summary="Bulk-sync per-subject visit schedule rows",
)
router.add_api_route(
    "/subjects/history/sync",
    _sync_endpoint(
        CtmsSubjectStatusHistory,
        codes_fn=_subject_history_scope,
        code_fn=_subject_history_code,
    ),
    methods=["POST"],
    summary="Bulk-sync subject status-history rows (Subject Profile timeline)",
)
