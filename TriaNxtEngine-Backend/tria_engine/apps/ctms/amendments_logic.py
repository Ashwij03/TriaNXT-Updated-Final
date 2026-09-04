# tria_engine/apps/ctms/amendments_logic.py
#
# M18 Protocol Amendment & Impact Management (spec 6.25) — Python port of
# src/shared/services/amendmentService.ts. Operates on record dicts that
# round-trip through the ctms_amendment JSON row, preserving the exact
# record shape, business-rule error messages and audit action names the
# frontend service implements.

from __future__ import annotations

from .common import CtmsError, audit, iso_now, new_id, stamp

AMENDMENT_STATUSES = [
    "Draft",
    "Under Assessment",
    "Published",
    "Site Rollout",
    "Compliant",
    "Closed",
]

AMENDMENT_CLASSIFICATIONS = [
    "Substantial",
    "Non-substantial",
    "Administrative",
]

SITE_IMPLEMENTATION_STATUSES = [
    "Not Started",
    "Tasks Assigned",
    "In Progress",
    "Compliant",
]

TASK_KIND_LABELS = {
    "document": "Document replacement",
    "training": "Re-training",
    "consent": "Re-consent",
}


def _build_site_task_pack(amendment: dict, site_code: str) -> list[dict]:
    version = amendment.get("version") or ""
    tasks: list[dict] = []
    if amendment.get("binderUpdateRequired"):
        tasks.append(
            {
                "id": f"{amendment['id']}-{site_code}-doc",
                "kind": "document",
                "label": "Replace impacted binder/folder documents (amendment v" + version + ")",
                "done": False,
                "doneAt": None,
            }
        )
    if amendment.get("trainingRequired"):
        tasks.append(
            {
                "id": f"{amendment['id']}-{site_code}-trn",
                "kind": "training",
                "label": (
                    "Assign re-training to site staff for amendment v"
                    + version
                    + " (ref "
                    + str(amendment.get("amendmentNumber"))
                    + ")"
                ),
                "done": False,
                "doneAt": None,
            }
        )
    if amendment.get("reConsentRequired"):
        tasks.append(
            {
                "id": f"{amendment['id']}-{site_code}-cns",
                "kind": "consent",
                "label": "Re-consent affected subjects (amendment v" + version + ")",
                "done": False,
                "doneAt": None,
            }
        )
    return tasks


def _build_initial_sites(amendment: dict) -> dict:
    sites: dict[str, dict] = {}
    for site_code in amendment.get("impactedSiteCodes") or []:
        sites[str(site_code)] = {
            "siteCode": str(site_code),
            "status": "Not Started",
            "tasks": _build_site_task_pack(amendment, str(site_code)),
            "complianceDate": None,
        }
    return sites


def create_amendment(db, user, payload: dict, actor: str) -> dict:
    if not payload.get("studyCode") or not payload.get("amendmentNumber") or not payload.get("version"):
        raise CtmsError(
            "studyCode, amendmentNumber and version are required to create an amendment."
        )
    classification = payload.get("classification")
    if classification not in AMENDMENT_CLASSIFICATIONS:
        raise CtmsError("A valid amendment classification is required.")
    if not payload.get("effectiveDate"):
        raise CtmsError("Effective date is required.")
    if classification == "Substantial" and not payload.get("summary"):
        raise CtmsError("A summary of change is required for substantial amendments.")

    now = iso_now()
    amendment = {
        "id": new_id("AMD-", upper=True),
        "studyCode": payload.get("studyCode"),
        "amendmentNumber": payload.get("amendmentNumber"),
        "version": payload.get("version"),
        "classification": classification,
        "effectiveDate": payload.get("effectiveDate"),
        "summary": payload.get("summary") or "",
        "status": "Draft",
        "reConsentRequired": bool(payload.get("reConsentRequired")),
        "binderUpdateRequired": bool(payload.get("binderUpdateRequired")),
        "trainingRequired": bool(payload.get("trainingRequired")),
        "irbSubmissionRef": payload.get("irbSubmissionRef") or "",
        "impactedSiteCodes": [
            str(s) for s in (payload.get("impactedSiteCodes") or [])
        ],
        "sites": {},
        "createdAt": now,
        "updatedAt": now,
        "updatedBy": actor,
        "history": [],
    }
    amendment["sites"] = _build_initial_sites(amendment)
    amendment["history"] = stamp(amendment, "AMENDMENT_CREATED", actor)

    audit(
        db,
        user,
        "AMENDMENT_CREATED",
        details={
            "amendmentId": amendment["id"],
            "amendmentNumber": amendment["amendmentNumber"],
            "studyCode": amendment["studyCode"],
            "version": amendment["version"],
        },
    )
    return amendment


def _normalize(value) -> str:
    return str(value or "").strip().lower()


def run_impact_assessment(amendment: dict, actor: str) -> dict:
    if amendment["status"] not in ("Draft", "Under Assessment"):
        raise CtmsError(
            "Impact assessment can only run while the amendment is Draft or Under Assessment."
        )
    amendment["status"] = "Under Assessment"
    amendment["updatedAt"] = iso_now()
    amendment["updatedBy"] = actor
    amendment["history"] = stamp(amendment, "IMPACT_ASSESSMENT_RUN", actor)
    return amendment


def publish_amendment(amendment: dict, actor: str) -> dict:
    if amendment["status"] not in ("Draft", "Under Assessment"):
        raise CtmsError("Only Draft / Under Assessment amendments can be published.")
    if not amendment.get("impactedSiteCodes"):
        raise CtmsError("Publish at least one impacted site before publishing.")

    amendment["status"] = "Published"
    amendment["updatedAt"] = iso_now()
    amendment["updatedBy"] = actor
    amendment["history"] = stamp(amendment, "AMENDMENT_PUBLISHED", actor)

    for site_code, site in (amendment.get("sites") or {}).items():
        site["status"] = "Tasks Assigned" if site.get("tasks") else "Not Started"
    return amendment


def _site_tasks_complete(site: dict) -> bool:
    tasks = site.get("tasks") or []
    return all(task.get("done") for task in tasks)


def _recompute_status(amendment: dict) -> None:
    sites = amendment.get("sites") or {}
    codes = list(sites.keys())
    if not codes:
        return
    all_compliant = all(sites[code].get("status") == "Compliant" for code in codes)
    any_task_done = any(
        (sites[code].get("tasks") or []) and any(t.get("done") for t in sites[code]["tasks"])
        for code in codes
    )
    if all_compliant and amendment["status"] != "Closed":
        amendment["status"] = "Compliant"
    elif any_task_done and amendment["status"] != "Compliant":
        amendment["status"] = "Site Rollout"


def complete_site_task(amendment: dict, site_code: str, task_id: str, actor: str) -> dict:
    site = (amendment.get("sites") or {}).get(str(site_code))
    if site is None:
        raise CtmsError("Site is not part of this amendment's impact scope.")
    if amendment["status"] not in ("Published", "Site Rollout"):
        raise CtmsError(
            "Amendment must be published before implementation tasks can be completed."
        )
    task = next(
        (t for t in (site.get("tasks") or []) if str(t.get("id")) == str(task_id)),
        None,
    )
    if task is None:
        raise CtmsError("Task not found for this site.")

    task["done"] = True
    task["doneAt"] = iso_now()
    site["status"] = "In Progress"
    amendment["updatedAt"] = iso_now()
    amendment["updatedBy"] = actor
    amendment["history"] = stamp(
        amendment,
        f"SITE_TASK_COMPLETED:{site_code}:{task.get('kind')}",
        actor,
    )
    _recompute_status(amendment)
    return amendment


def mark_site_compliant(amendment: dict, site_code: str, actor: str) -> dict:
    site = (amendment.get("sites") or {}).get(str(site_code))
    if site is None:
        raise CtmsError("Site is not part of this amendment's impact scope.")
    if amendment["status"] not in ("Published", "Site Rollout"):
        raise CtmsError(
            "Amendment must be published before sites can be marked compliant."
        )
    if not _site_tasks_complete(site):
        raise CtmsError(
            "All implementation tasks (documents / training / re-consent) must be completed for this site."
        )
    # AMD-02
    if (
        amendment.get("classification") == "Substantial"
        and not str(amendment.get("irbSubmissionRef") or "").strip()
    ):
        raise CtmsError(
            "Substantial amendments require a linked IRB/IEC submission reference before a site can be marked compliant."
        )

    site["status"] = "Compliant"
    site["complianceDate"] = iso_now()
    amendment["updatedAt"] = iso_now()
    amendment["updatedBy"] = actor
    amendment["history"] = stamp(amendment, f"SITE_COMPLIANT:{site_code}", actor)
    _recompute_status(amendment)
    return amendment


def close_amendment(amendment: dict, actor: str) -> dict:
    sites = amendment.get("sites") or {}
    non_compliant = [
        code for code, site in sites.items() if site.get("status") != "Compliant"
    ]
    # AMD-01
    if non_compliant:
        raise CtmsError(
            str(len(non_compliant)) + " impacted site(s) remain non-compliant."
        )
    amendment["status"] = "Closed"
    amendment["closedAt"] = iso_now()
    amendment["updatedAt"] = amendment["closedAt"]
    amendment["updatedBy"] = actor
    amendment["history"] = stamp(amendment, "AMENDMENT_CLOSED", actor)
    return amendment


def delete_amendment(amendment: dict, db, user, *, delete) -> bool:
    if amendment["status"] != "Draft":
        raise CtmsError("Only Draft amendments can be deleted.")
    audit(
        db,
        user,
        "AMENDMENT_DELETED",
        details={"amendmentId": amendment.get("id"), "amendmentNumber": amendment.get("amendmentNumber")},
    )
    delete()
    return True


def set_irb_submission_ref(amendment: dict, irb_ref: str, actor: str) -> dict:
    if amendment["status"] == "Closed":
        raise CtmsError("A closed amendment cannot be changed.")
    amendment["irbSubmissionRef"] = str(irb_ref or "").strip()
    amendment["updatedAt"] = iso_now()
    amendment["updatedBy"] = actor
    amendment["history"] = stamp(amendment, "IRB_SUBMISSION_REF_UPDATED", actor)
    return amendment
