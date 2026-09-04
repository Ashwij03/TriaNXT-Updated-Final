# tria_engine/apps/ctms/router_icf.py
#
# M21 ICF / eConsent REST surface (mirrors icfConsentService.ts):
#   versions:  GET/POST /icf/versions(?studyCode=)  GET /icf/versions/{code}
#              POST /icf/versions/{code}/approve  POST /icf/versions/{code}/activate
#   events:    GET/POST /icf/events(?studyCode=&subjectId=)
#   check:     GET /icf/enroll-check?studyCode=&siteCode=&subjectId=
#              GET /icf/procedures-blocked?studyCode=&subjectId=
#   campaigns: GET/POST /icf/campaigns(?studyCode=)  GET /icf/campaigns/{code}
#              POST /icf/campaigns/{code}/complete-subject  {subjectId}

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ...apps.accounts.dependencies import get_current_user
from ...apps.accounts.models import User
from ...core.database import get_db
from . import schemas
from .common import (
    actor_name,
    audit,
    create_record,
    guarded,
    list_records,
    load_row,
    save_record,
)
from .icf_logic import (
    activate_icf_version,
    approve_icf_version,
    build_reconsent_event,
    can_enroll_subject,
    complete_reconsent,
    create_icf_version,
    create_reconsent_campaign,
    is_subject_procedures_blocked,
    record_consent_event,
)
from .models import (
    CtmsConsentEvent,
    CtmsIcfVersion,
    CtmsReConsentCampaign,
)

router = APIRouter(prefix="/icf", tags=["ctms-icf"])


def _versions(db, user) -> list[dict]:
    return list_records(db, CtmsIcfVersion, user)


# ----------------------------------------------------------------------
# ICF versions
# ----------------------------------------------------------------------


@router.get("/versions")
@router.get("/versions/")
def icf_version_list(
    request: Request,
    studyCode: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = _versions(db, user)
    if studyCode:
        key = str(studyCode).strip().lower()
        records = [v for v in records if str(v.get("studyCode") or "").strip().lower() == key]
    records.sort(key=lambda v: v.get("createdAt") or "", reverse=True)
    return guarded(lambda: records)


@router.post("/versions")
@router.post("/versions/")
def icf_version_create(
    body: schemas.IcfVersionBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        payload = body.model_dump()
        records = _versions(db, user)
        for version in records:
            if (
                str(version.get("studyCode") or "").strip().lower()
                == str(payload["studyCode"]).strip().lower()
                and str(version.get("siteCode") or "").strip().lower()
                == str(payload["siteCode"]).strip().lower()
                and str(version.get("version") or "").strip().lower()
                == str(payload["version"]).strip().lower()
            ):
                from .common import CtmsError

                raise CtmsError("That ICF version already exists for this site.")
        record = create_icf_version(db, user, payload, actor_name(user))
        return create_record(db, CtmsIcfVersion, user, record["id"], record), 201

    return guarded(_create)


@router.get("/versions/{code}")
def icf_version_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsIcfVersion, user, code, "ICF version not found.")
        return record

    return guarded(_detail)


@router.post("/versions/{code}/approve")
def icf_version_approve(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _approve():
        row, record = load_row(db, CtmsIcfVersion, user, code, "ICF version not found.")
        approve_icf_version(record, actor_name(user))
        return save_record(db, user, row, record)

    return guarded(_approve)


@router.post("/versions/{code}/activate")
def icf_version_activate(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _activate():
        row, record = load_row(db, CtmsIcfVersion, user, code, "ICF version not found.")
        changed = [dict(v) for v in _versions(db, user)]
        activate_icf_version(changed, record, actor_name(user))
        # The activated record is a separate dict from the `changed` list
        # snapshot (whose element for this id still holds the pre-activation
        # status) — merge the mutated record back so the persisted copy is
        # Active, not the stale Approved snapshot.
        record_id = record["id"]
        for i, candidate in enumerate(changed):
            if str(candidate.get("id")) == str(record_id):
                changed[i] = record
                break
        # persist every row (superseded siblings + the activated one)
        for candidate in changed:
            target = next(
                (
                    r
                    for r in db.query(CtmsIcfVersion)
                    if str(r.code) == str(candidate["id"])
                    and (user.is_superuser or r.organization_id == user.organization_id)
                ),
                None,
            )
            if target is not None:
                target.data = candidate
        db.commit()
        audit(
            db,
            user,
            "ICF_VERSION_ACTIVATED",
            details={"versionId": record["id"], "version": record.get("version")},
        )
        return dict(record)

    return guarded(_activate)


# ----------------------------------------------------------------------
# Consent events + enrollment checks
# ----------------------------------------------------------------------


@router.get("/events")
@router.get("/events/")
def icf_event_list(
    request: Request,
    studyCode: str = Query(None),
    subjectId: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = list_records(db, CtmsConsentEvent, user)
    if studyCode:
        key = str(studyCode).strip().lower()
        records = [e for e in records if str(e.get("studyCode") or "").strip().lower() == key]
    if subjectId:
        skey = str(subjectId).strip().lower()
        records = [e for e in records if str(e.get("subjectId") or "").strip().lower() == skey]
    records.sort(key=lambda e: e.get("createdAt") or "", reverse=True)
    return guarded(lambda: records)


@router.post("/events")
@router.post("/events/")
def icf_event_create(
    body: schemas.ConsentEventBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = record_consent_event(db, user, _versions(db, user), body.model_dump(), actor_name(user))
        return create_record(db, CtmsConsentEvent, user, record["id"], record), 201

    return guarded(_create)


@router.get("/enroll-check")
def icf_enroll_check(
    request: Request,
    studyCode: str = Query(None),
    siteCode: str = Query(None),
    subjectId: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _check():
        return can_enroll_subject(
            _versions(db, user),
            list_records(db, CtmsConsentEvent, user),
            studyCode,
            siteCode,
            subjectId,
        )

    return guarded(_check)


@router.get("/procedures-blocked")
def icf_procedures_blocked(
    request: Request,
    studyCode: str = Query(None),
    subjectId: str = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _check():
        return {
            "blocked": is_subject_procedures_blocked(
                list_records(db, CtmsReConsentCampaign, user), subjectId, studyCode
            )
        }

    return guarded(_check)


# ----------------------------------------------------------------------
# Re-consent campaigns
# ----------------------------------------------------------------------


@router.get("/campaigns")
@router.get("/campaigns/")
def icf_campaign_list(
    request: Request,
    studyCode: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    records = list_records(db, CtmsReConsentCampaign, user)
    if studyCode:
        key = str(studyCode).strip().lower()
        records = [c for c in records if str(c.get("studyCode") or "").strip().lower() == key]
    records.sort(key=lambda c: c.get("createdAt") or "", reverse=True)
    return guarded(lambda: records)


@router.get("/campaigns/{code}")
def icf_campaign_detail(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        _, record = load_row(db, CtmsReConsentCampaign, user, code, "Re-consent campaign not found.")
        return record

    return guarded(_detail)


@router.post("/campaigns")
@router.post("/campaigns/")
def icf_campaign_create(
    body: schemas.CampaignBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        record = create_reconsent_campaign(db, user, _versions(db, user), body.model_dump(), actor_name(user))
        return create_record(db, CtmsReConsentCampaign, user, record["id"], record), 201

    return guarded(_create)


@router.post("/campaigns/{code}/complete-subject")
def icf_campaign_complete_subject(
    code: str,
    body: schemas.CampaignSubjectBody,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _complete():
        row, record = load_row(db, CtmsReConsentCampaign, user, code, "Re-consent campaign not found.")
        campaigns = list_records(db, CtmsReConsentCampaign, user)
        complete_reconsent(campaigns, record, body.subjectId, actor_name(user))
        event = build_reconsent_event(record, body.subjectId)
        event_row = CtmsConsentEvent(
            code=event["id"], organization_id=user.organization_id, data=event
        )
        db.add(event_row)
        audit(
            db,
            user,
            "RE_CONSENT_COMPLETED",
            details={"campaignId": record["id"], "subjectId": body.subjectId},
        )
        return save_record(db, user, row, record)

    return guarded(_complete)
