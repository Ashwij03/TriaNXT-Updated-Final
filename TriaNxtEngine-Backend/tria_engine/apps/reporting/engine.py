# tria_engine/apps/reporting/engine.py
#
# Reporting data layer for the Custom Report Builder and the five standard
# reports. Pure helpers on top of the JSON mirrors (ctms subjects / visits /
# safety-AE cases) plus this app's own deviation & study-document mirrors and
# the finance tables. Every entry point receives a SQLAlchemy session and the
# authenticated user, so org / study / site scoping stays consistent with the
# ctms record layer (scope filtering applied at the SQL level).
#
# A "report result" is a dict:
#   {title, columns: [{key,label,type}], rows: [dict...], summary:
#    [{label,value}], generatedAt}   <- exactly what the export generators eat.

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..accounts.models import User
from ..accounts.rbac import resolve_user_scope
from ..ctms.models import CtmsAeCase, CtmsSubject, CtmsVisit
from .models import (
    FinanceBudget,
    FinanceInvoice,
    FinanceMilestone,
    FinancePayout,
    ReportDeviation,
    ReportStudyDocument,
)
from .report_generator import _now_stamp


def iso_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _num(value, default=0):
    try:
        if value is None or value == "" or value == "—":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _pct(numerator, denominator, digits=1):
    if not denominator:
        return 0.0
    return round((float(numerator) / float(denominator)) * 100.0, digits)


def _month_key(value) -> str | None:
    """Normalize a date-ish value to YYYY-MM ('' -> None)."""
    text = str(value or "").strip()
    if not text:
        return None
    match = re.match(r"(\d{4})-(\d{2})", text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    return None


def _status_of(record: dict) -> str:
    return str(record.get("status") or "Unknown").strip() or "Unknown"


# ---------------------------------------------------------------------------
# SQL scope helper for the finance/template tables (org + study/site scope)
# ---------------------------------------------------------------------------


def scope_condition(model, user):
    if user is None or getattr(user, "is_superuser", False):
        return None
    conds = [model.organization_id == user.organization_id]
    scope = resolve_user_scope(user)
    if scope["studies"]:
        conds.append(or_(model.study_id.is_(None), model.study_id.in_(scope["studies"])))
    if scope["sites"]:
        conds.append(or_(model.site_id.is_(None), model.site_id.in_(scope["sites"])))
    return and_(*conds)


def scoped_rows(db: Session, model, user) -> list:
    stmt = select(model)
    cond = scope_condition(model, user)
    if cond is not None:
        stmt = stmt.where(cond)
    stmt = stmt.order_by(model.created_at.desc(), model.id.desc())
    return list(db.execute(stmt).scalars().all())


def _filter_pair(rows, study=None, site=None):
    """Narrow ORM rows by study/site query params (None = keep all)."""
    out = rows
    if study:
        want = str(study).strip()
        out = [r for r in out if (r.study_id or "") == want]
    if site:
        want = str(site).strip()
        out = [r for r in out if (r.site_id or "") == want]
    return out


# ---------------------------------------------------------------------------
# Finance snapshot + variance (explicit variance: actual vs baseline)
# ---------------------------------------------------------------------------

_ACTUAL_PAYOUT_STATUSES = {"Approved", "Paid", "approved", "paid"}


def finance_rows(db: Session, user, *, study=None, site=None) -> dict:
    """Load the finance tables scoped for `user` and return a dict with
    JSON-ready lists (Decimal -> float, dates -> iso)."""
    budgets = _filter_pair(scoped_rows(db, FinanceBudget, user), study, site)
    payouts = _filter_pair(scoped_rows(db, FinancePayout, user), study, site)
    invoices = _filter_pair(scoped_rows(db, FinanceInvoice, user), study, site)
    milestones = _filter_pair(scoped_rows(db, FinanceMilestone, user), study, site)

    payout_by_budget: dict[str, dict] = defaultdict(
        lambda: {"actual": 0.0, "committed": 0.0, "count": 0}
    )
    for payout in payouts:
        bucket = payout_by_budget[payout.budget_code or ""]
        bucket["count"] += 1
        amount = float(payout.amount or 0)
        status = str(payout.status or "").strip()
        if status in _ACTUAL_PAYOUT_STATUSES:
            bucket["actual"] += amount
        elif status == "Pending":
            bucket["committed"] += amount

    budget_rows: list[dict] = []
    for budget in budgets:
        bucket = payout_by_budget.get(budget.code or "", {})
        baseline = float(budget.baseline_amount or 0)
        actual = bucket.get("actual", 0.0)
        committed = bucket.get("committed", 0.0)
        variance = round(actual - baseline, 2)
        variance_pct = round((variance / baseline) * 100.0, 1) if baseline else 0.0
        budget_rows.append(
            {
                "code": budget.code,
                "name": budget.name,
                "studyId": budget.study_id,
                "siteId": budget.site_id,
                "siteName": budget.site_name,
                "currency": budget.currency,
                "periodLabel": budget.period_label,
                "status": budget.status,
                "baselineAmount": baseline,
                "actualSpend": round(actual, 2),
                "committedPending": round(committed, 2),
                "payoutCount": bucket.get("count", 0),
                "variance": variance,
                "variancePct": variance_pct,
                "notes": budget.notes,
            }
        )
    budget_rows.sort(key=lambda row: (row["studyId"] or "", row["siteId"] or ""))

    total_baseline = round(sum(row["baselineAmount"] for row in budget_rows), 2)
    total_actual = round(sum(row["actualSpend"] for row in budget_rows), 2)
    total_committed = round(sum(row["committedPending"] for row in budget_rows), 2)

    def _serialize_invoice(row) -> dict:
        return {
            "code": row.code,
            "number": row.number,
            "studyId": row.study_id,
            "siteId": row.site_id,
            "budgetCode": row.budget_code,
            "description": row.description,
            "amount": float(row.amount or 0),
            "currency": row.currency,
            "status": row.status,
            "periodLabel": row.period_label,
            "issueDate": row.issue_date.isoformat() if row.issue_date else None,
            "dueDate": row.due_date.isoformat() if row.due_date else None,
            "createdBy": row.created_by,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
        }

    invoice_rows = [_serialize_invoice(row) for row in invoices]

    def _serialize_payout(row) -> dict:
        return {
            "code": row.code,
            "budgetCode": row.budget_code,
            "invoiceCode": row.invoice_code,
            "studyId": row.study_id,
            "siteId": row.site_id,
            "reason": row.reason,
            "amount": float(row.amount or 0),
            "currency": row.currency,
            "status": row.status,
            "requestedBy": row.requested_by,
            "requestedAt": row.requested_at.isoformat() if row.requested_at else None,
            "decidedBy": row.decided_by,
            "decidedAt": row.decided_at.isoformat() if row.decided_at else None,
        }

    payout_rows = [_serialize_payout(row) for row in payouts]

    invoice_status: dict[str, int] = Counter(row["status"] for row in invoice_rows)
    payout_status: dict[str, int] = Counter(row["status"] for row in payout_rows)

    def _serialize_milestone(row) -> dict:
        return {
            "code": row.code,
            "name": row.name,
            "studyId": row.study_id,
            "siteId": row.site_id,
            "category": row.category,
            "weight": float(row.weight or 1),
            "targetDate": row.target_date.isoformat() if row.target_date else None,
            "status": row.status,
        }

    milestone_rows = [_serialize_milestone(row) for row in milestones]

    # Per-study and per-site contractual milestone completion percentages
    # (weighted by milestone weight; Completed/Approved count as done).
    done_statuses = {"Completed", "Approved", "completed", "approved"}

    def _weighted_completion(group_rows) -> float | None:
        if not group_rows:
            return None
        total_weight = sum(float(row["weight"] or 0) for row in group_rows)
        if not total_weight:
            return None
        done = sum(
            float(row["weight"] or 0)
            for row in group_rows
            if row["status"] in done_statuses
        )
        return round((done / total_weight) * 100.0, 1)

    milestone_studies: dict[str, list] = defaultdict(list)
    milestone_sites: dict[str, list] = defaultdict(list)
    for row in milestone_rows:
        milestone_studies[row["studyId"] or ""].append(row)
        key = (row["studyId"] or "") + "::" + (row["siteId"] or "")
        milestone_sites[key].append(row)

    study_completion = [
        {"studyId": study or "", "completionPct": _weighted_completion(rows)}
        for study, rows in milestone_studies.items()
        if study
    ]
    site_completion = [
        {
            "studyId": key.split("::")[0],
            "siteId": key.split("::")[1] if "::" in key else "",
            "completionPct": _weighted_completion(rows),
        }
        for key, rows in milestone_sites.items()
        if key
    ]
    overall_completion = _weighted_completion(milestone_rows)

    by_study: dict[str, dict] = {}
    by_site: dict[str, dict] = {}
    for row in budget_rows:
        study = row["studyId"] or ""
        site = row["siteId"] or ""
        study_group = by_study.setdefault(
            study, {"studyId": study, "baseline": 0.0, "actual": 0.0}
        )
        study_group["baseline"] += row["baselineAmount"]
        study_group["actual"] += row["actualSpend"]
        site_key = f"{study}::{site}"
        site_group = by_site.setdefault(
            site_key,
            {"studyId": study, "siteId": site, "siteName": row["siteName"], "baseline": 0.0, "actual": 0.0},
        )
        site_group["baseline"] += row["baselineAmount"]
        site_group["actual"] += row["actualSpend"]

    def _finalize(group):
        baseline = round(group["baseline"], 2)
        actual = round(group["actual"], 2)
        variance = round(actual - baseline, 2)
        group["baselineAmount"] = baseline
        group["actualSpend"] = actual
        group["variance"] = variance
        group["variancePct"] = round((variance / baseline) * 100.0, 1) if baseline else 0.0
        group.pop("baseline", None)
        group.pop("actual", None)
        return group

    return {
        "summary": {
            "totalBudgetBaseline": total_baseline,
            "totalActualSpend": total_actual,
            "totalCommittedPending": total_committed,
            "totalVariance": round(total_actual - total_baseline, 2),
            "budgetCount": len(budget_rows),
            "milestoneCount": len(milestone_rows),
            "milestoneCompletionPct": overall_completion,
            "invoiceStatus": dict(invoice_status),
            "payoutStatus": dict(payout_status),
            "pendingPayoutApprovals": payout_status.get("Pending", 0),
        },
        "budgets": budget_rows,
        "invoices": invoice_rows,
        "payouts": payout_rows,
        "milestones": milestone_rows,
        "completion": {
            "overallPct": overall_completion,
            "byStudy": study_completion,
            "bySite": site_completion,
        },
        "spendByStudy": [_finalize(g) for g in by_study.values()],
        "spendBySite": [_finalize(g) for g in by_site.values()],
    }


# ---------------------------------------------------------------------------
# Report sources: catalog + row extraction
# ---------------------------------------------------------------------------

# Column type is one of: text | number | date
CATALOG: list[dict] = [
    {
        "key": "subjects",
        "label": "Subjects",
        "description": "Enrolled and screened subject records across studies",
        "columns": [
            {"key": "subjectId", "label": "Subject ID", "type": "text"},
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "siteNo", "label": "Site No", "type": "text"},
            {"key": "siteName", "label": "Site", "type": "text"},
            {"key": "initials", "label": "Initials", "type": "text"},
            {"key": "screeningDate", "label": "Screening Date", "type": "date"},
            {"key": "enrollmentDate", "label": "Enrollment Date", "type": "date"},
            {"key": "currentVisit", "label": "Current Visit", "type": "text"},
            {"key": "principalInvestigator", "label": "Principal Investigator", "type": "text"},
        ],
        "filterFields": ["studyId", "siteNo", "status", "enrollmentDate", "screeningDate"],
        "groupFields": ["status", "studyId", "siteNo"],
        "metricColumns": [],
    },
    {
        "key": "visits",
        "label": "Visits",
        "description": "Per-subject scheduled visit records",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "subjectId", "label": "Subject ID", "type": "text"},
            {"key": "visit", "label": "Visit Name", "type": "text"},
            {"key": "date", "label": "Visit Date", "type": "date"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "siteNo", "label": "Site No", "type": "text"},
            {"key": "time", "label": "Time", "type": "text"},
        ],
        "filterFields": ["studyId", "siteNo", "status", "date", "visit"],
        "groupFields": ["status", "visit", "studyId", "siteNo"],
        "metricColumns": [],
    },
    {
        "key": "safety",
        "label": "AE / SAE Safety Cases",
        "description": "Adverse-event and serious adverse-event cases",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "subjectId", "label": "Subject", "type": "text"},
            {"key": "severity", "label": "Severity", "type": "text"},
            {"key": "description", "label": "Description", "type": "text"},
            {"key": "causality", "label": "Causality", "type": "text"},
            {"key": "outcome", "label": "Outcome", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
        ],
        "filterFields": ["studyId", "status", "severity"],
        "groupFields": ["status", "severity", "studyId"],
        "metricColumns": [],
    },
    {
        "key": "deviations",
        "label": "Deviations",
        "description": "Protocol deviations reported at the sites",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "subjectId", "label": "Subject ID", "type": "text"},
            {"key": "siteNo", "label": "Site No", "type": "text"},
            {"key": "category", "label": "Category", "type": "text"},
            {"key": "severity", "label": "Severity", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "description", "label": "Description", "type": "text"},
            {"key": "identifiedDate", "label": "Identified Date", "type": "date"},
            {"key": "closedDate", "label": "Closed Date", "type": "date"},
        ],
        "filterFields": ["studyId", "siteNo", "status", "severity", "category", "identifiedDate"],
        "groupFields": ["category", "severity", "status", "studyId", "siteNo"],
        "metricColumns": [],
    },
    {
        "key": "documents",
        "label": "Documents",
        "description": "Study document / eISF completeness records",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "siteNo", "label": "Site No", "type": "text"},
            {"key": "folder", "label": "Folder", "type": "text"},
            {"key": "documentName", "label": "Document", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "uploadedDate", "label": "Uploaded Date", "type": "date"},
        ],
        "filterFields": ["studyId", "siteNo", "status", "folder"],
        "groupFields": ["status", "folder", "studyId", "siteNo"],
        "metricColumns": [],
    },
    {
        "key": "studies",
        "label": "Studies",
        "description": "Study-level rollup: subject / visit / deviation metrics per study-site",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "siteNo", "label": "Site No", "type": "text"},
            {"key": "siteName", "label": "Site", "type": "text"},
            {"key": "subjectCount", "label": "Subjects", "type": "number"},
            {"key": "enrolledCount", "label": "Enrolled", "type": "number"},
            {"key": "visitCount", "label": "Visits", "type": "number"},
            {"key": "visitCompliancePct", "label": "Visit Compliance %", "type": "number"},
            {"key": "openDeviations", "label": "Open Deviations", "type": "number"},
            {"key": "documentsUploaded", "label": "Documents Uploaded", "type": "number"},
            {"key": "openAeCases", "label": "Open AE Cases", "type": "number"},
        ],
        "filterFields": ["studyId", "siteNo"],
        "groupFields": ["studyId", "siteNo"],
        "metricColumns": ["subjectCount", "enrolledCount", "visitCount", "openDeviations", "documentsUploaded", "openAeCases"],
    },
]

SOURCE_BY_KEY = {source["key"]: source for source in CATALOG}


def source_rows(db: Session, user, source: str) -> list[dict]:
    """Fetch the raw rows for a source, org/study/site scoped and mapped to
    the catalog column keys."""
    records: list[dict] = []
    if source == "subjects":
        for row in list_records(db, CtmsSubject, user):
            records.append(_map_subject(row))
    elif source == "visits":
        for row in list_records(db, CtmsVisit, user):
            records.append(_map_visit(row))
    elif source == "safety":
        for row in list_records(db, CtmsAeCase, user):
            records.append(_map_safety(row))
    elif source == "deviations":
        for row in scoped_rows(db, ReportDeviation, user):
            records.append(dict(row.data or {}))
    elif source == "documents":
        for row in scoped_rows(db, ReportStudyDocument, user):
            records.append(dict(row.data or {}))
    elif source == "studies":
        records = _studies_rollup(db, user)
    else:
        records = []
    return records


def _map_subject(record: dict) -> dict:
    return {
        "subjectId": record.get("subjectId") or record.get("id"),
        "studyId": record.get("studyId") or record.get("studyCode"),
        "status": _status_of(record),
        "siteNo": record.get("siteNo") or record.get("site"),
        "siteName": record.get("siteName") or record.get("site"),
        "initials": record.get("initials"),
        "screeningDate": record.get("screeningDate"),
        "enrollmentDate": record.get("enrollmentDate"),
        "currentVisit": record.get("currentVisit"),
        "principalInvestigator": record.get("principalInvestigator") or record.get("pi"),
    }


def _map_visit(record: dict) -> dict:
    return {
        "studyId": record.get("study") or record.get("studyKey"),
        "subjectId": record.get("subjectId"),
        "visit": record.get("visit"),
        "date": record.get("date"),
        "status": _status_of(record),
        "siteNo": record.get("siteNo") or record.get("site"),
        "time": record.get("time"),
    }


def _map_safety(record: dict) -> dict:
    serious = bool(record.get("is_serious") or record.get("isSerious"))
    return {
        "studyId": record.get("study_id") or record.get("studyId"),
        "subjectId": record.get("subject_ref") or record.get("subjectRef"),
        "severity": "SAE" if serious else "AE",
        "description": record.get("description"),
        "causality": record.get("causality"),
        "outcome": record.get("outcome"),
        "status": _status_of(record),
    }


def _studies_rollup(db: Session, user) -> list[dict]:
    """Derive one record per (study, site) from the live mirrors."""
    subjects = [_map_subject(r) for r in list_records(db, CtmsSubject, user)]
    visits = [_map_visit(r) for r in list_records(db, CtmsVisit, user)]
    deviations = [dict(r.data or {}) for r in scoped_rows(db, ReportDeviation, user)]
    documents = [dict(r.data or {}) for r in scoped_rows(db, ReportStudyDocument, user)]
    safety = [_map_safety(r) for r in list_records(db, CtmsAeCase, user)]

    buckets: dict[tuple, dict] = {}
    enrolled_statuses = {"Enrolled", "Ongoing", "Completed"}

    for subject in subjects:
        study = str(subject.get("studyId") or "").strip()
        site = str(subject.get("siteNo") or "").strip()
        if not study:
            continue
        bucket = buckets.setdefault(
            (study, site),
            {
                "studyId": study,
                "siteNo": site,
                "siteName": subject.get("siteName") or site,
                "subjectCount": 0,
                "enrolledCount": 0,
                "visitCount": 0,
                "visitCompleted": 0,
                "openDeviations": 0,
                "documentsUploaded": 0,
                "openAeCases": 0,
            },
        )
        if not bucket["siteName"]:
            bucket["siteName"] = subject.get("siteName") or site
        bucket["subjectCount"] += 1
        if subject.get("status") in enrolled_statuses:
            bucket["enrolledCount"] += 1

    for visit in visits:
        study = str(visit.get("studyId") or "").strip()
        site = str(visit.get("siteNo") or "").strip()
        if not study:
            continue
        bucket = buckets.setdefault(
            (study, site),
            {
                "studyId": study,
                "siteNo": site,
                "siteName": site,
                "subjectCount": 0,
                "enrolledCount": 0,
                "visitCount": 0,
                "visitCompleted": 0,
                "openDeviations": 0,
                "documentsUploaded": 0,
                "openAeCases": 0,
            },
        )
        bucket["visitCount"] += 1
        if str(visit.get("status") or "").lower() == "completed":
            bucket["visitCompleted"] += 1

    for deviation in deviations:
        study = str(deviation.get("studyId") or "").strip()
        site = str(deviation.get("siteNo") or deviation.get("site") or "").strip()
        if not study:
            continue
        bucket = buckets.setdefault(
            (study, site),
            {
                "studyId": study,
                "siteNo": site,
                "siteName": site,
                "subjectCount": 0,
                "enrolledCount": 0,
                "visitCount": 0,
                "visitCompleted": 0,
                "openDeviations": 0,
                "documentsUploaded": 0,
                "openAeCases": 0,
            },
        )
        if str(deviation.get("status") or "").lower() in ("open", "under review"):
            bucket["openDeviations"] += 1

    for document in documents:
        study = str(document.get("studyId") or "").strip()
        site = str(document.get("siteNo") or "").strip()
        if not study:
            continue
        bucket = buckets.setdefault(
            (study, site),
            {
                "studyId": study,
                "siteNo": site,
                "siteName": site,
                "subjectCount": 0,
                "enrolledCount": 0,
                "visitCount": 0,
                "visitCompleted": 0,
                "openDeviations": 0,
                "documentsUploaded": 0,
                "openAeCases": 0,
            },
        )
        if str(document.get("status") or "").lower() == "uploaded":
            bucket["documentsUploaded"] += 1

    for case in safety:
        study = str(case.get("studyId") or "").strip()
        site = str(case.get("siteNo") or "").strip()
        if not study:
            continue
        bucket = buckets.setdefault(
            (study, site),
            {
                "studyId": study,
                "siteNo": site,
                "siteName": site,
                "subjectCount": 0,
                "enrolledCount": 0,
                "visitCount": 0,
                "visitCompleted": 0,
                "openDeviations": 0,
                "documentsUploaded": 0,
                "openAeCases": 0,
            },
        )
        if str(case.get("status") or "").lower() in ("open", "under review"):
            bucket["openAeCases"] += 1

    out = []
    for bucket in buckets.values():
        completed = bucket.pop("visitCompleted", 0)
        total = bucket.get("visitCount", 0)
        bucket["visitCompliancePct"] = round(
            (completed / total) * 100.0, 1
        ) if total else 0.0
        out.append(bucket)
    out.sort(key=lambda row: (row["studyId"], row["siteNo"]))
    return out


# Re-export so routers can avoid importing ctms.common directly.
from ..ctms.common import list_records  # noqa: E402  (intentional: after helpers)


# ---------------------------------------------------------------------------
# Generic run: filters + columns + aggregation
# ---------------------------------------------------------------------------

_OPS = {
    "eq": lambda value, target: str(value).lower() == str(target).lower(),
    "neq": lambda value, target: str(value).lower() != str(target).lower(),
    "contains": lambda value, target: str(target).lower() in str(value).lower(),
    "gt": lambda value, target: _compare(value, target, "gt"),
    "gte": lambda value, target: _compare(value, target, "gte"),
    "lt": lambda value, target: _compare(value, target, "lt"),
    "lte": lambda value, target: _compare(value, target, "lte"),
    "between": lambda value, target: _between(value, target),
}


def _compare(value, target, op):
    if value in (None, "") and target not in (None, ""):
        return False
    if target in (None, ""):
        return False
    try:
        left = float(str(value).replace(",", "").strip())
        right = float(str(target).replace(",", "").strip())
        if op == "gt":
            return left > right
        if op == "gte":
            return left >= right
        if op == "lt":
            return left < right
        return left <= right
    except (TypeError, ValueError):
        text_value = str(value or "")[:10]
        text_target = str(target or "")[:10]
        if op == "gt":
            return text_value > text_target
        if op == "gte":
            return text_value >= text_target
        if op == "lt":
            return text_value < text_target
        return text_value <= text_target


def _between(value, target):
    if not isinstance(target, (list, tuple)) or len(target) < 2:
        return True
    low, high = target[0], target[1]
    return _compare(value, low, "gte") and _compare(value, high, "lte")


def apply_filters(rows: list[dict], filters) -> list[dict]:
    if not filters:
        return rows
    out = rows
    for item in filters or []:
        field = (item or {}).get("field")
        op = (item or {}).get("op", "eq")
        value = (item or {}).get("value")
        if not field or op not in _OPS or value in (None, ""):
            continue
        predicate = _OPS[op]
        out = [row for row in out if predicate(row.get(field), value)]
    return out


def _column_label(source: dict, key: str) -> str:
    for column in source["columns"]:
        if column["key"] == key:
            return column["label"]
    return key


def run_builder_report(db: Session, user, config: dict) -> dict:
    """Execute a Report Builder configuration.

    config: {source, columns[], filters[], aggregate: {type, column?,
    groupBy?}, limit?}
    """
    source_key = str((config or {}).get("source") or "").strip()
    source = SOURCE_BY_KEY.get(source_key)
    if source is None:
        raise ValueError(f"Unknown report source '{source_key}'.")
    columns = [str(c) for c in (config or {}).get("columns") or []]
    filters = (config or {}).get("filters") or []
    aggregate = (config or {}).get("aggregate") or {}
    limit = (config or {}).get("limit") or 500

    raw_rows = source_rows(db, user, source_key)
    filtered = apply_filters(raw_rows, filters)

    agg_type = str((aggregate or {}).get("type") or "none").lower()
    group_by = str((aggregate or {}).get("groupBy") or "").strip() or None
    agg_column = str((aggregate or {}).get("column") or "").strip() or None

    if agg_type in ("count", "sum", "avg") and group_by:
        # group-by metric rows: [{"group": <dimension>, "count"|"value": n}]
        buckets: dict[str, list[dict]] = defaultdict(list)
        for row in filtered:
            label = str(row.get(group_by) if row.get(group_by) is not None else "Unknown")
            buckets[label].append(row)
        metric_name = "count" if agg_type == "count" else "value"
        out_rows: list[dict] = []
        for label, group_rows in sorted(buckets.items()):
            if agg_type == "count":
                out_rows.append({"group": label, "count": len(group_rows)})
            else:
                values = [_num(r.get(agg_column)) for r in group_rows if agg_column]
                total = sum(values)
                value = total if agg_type == "sum" else (
                    round(total / len(values), 2) if values else 0.0
                )
                out_rows.append({"group": label, "value": value})
        result_columns = [
            {"key": "group", "label": _column_label(source, group_by), "type": "text"},
            {
                "key": metric_name,
                "label": (
                    f"Count by {_column_label(source, group_by)}"
                    if agg_type == "count"
                    else f"{agg_type.upper()} of {_column_label(source, agg_column)} by {_column_label(source, group_by)}"
                ),
                "type": "number",
            },
        ]
        summary = _run_summary(source_key, raw_rows, filtered, len(out_rows))
        return {
            "title": f"{_column_label(source, group_by)} — {agg_type} summary",
            "columns": result_columns,
            "rows": out_rows,
            "summary": summary,
            "generatedAt": iso_now(),
        }

    if agg_type in ("sum", "avg"):
        values = [_num(r.get(agg_column)) for r in filtered if agg_column]
        total = sum(values)
        result = total if agg_type == "sum" else (round(total / len(values), 2) if values else 0.0)
        metric_name = "count" if agg_type == "count" else "value"
        result_columns = [{"key": "group", "label": "Metric", "type": "text"}, {"key": metric_name, "label": f"{agg_type.upper()} — {_column_label(source, agg_column)}", "type": "number"}]
        summary = [
            {"label": "Source", "value": source["label"]},
            {"label": "Records scanned", "value": len(filtered)},
            {"label": f"{agg_type.upper()} of {_column_label(source, agg_column)}", "value": result},
        ]
        return {
            "title": f"{agg_type.upper()} — {_column_label(source, agg_column)}",
            "columns": result_columns,
            "rows": [{"group": "Overall", metric_name: result}],
            "summary": summary,
            "generatedAt": iso_now(),
        }

    # plain tabular output (default: all catalog columns when none chosen)
    if not columns:
        columns = [column["key"] for column in source["columns"]]
    projectable = {column["key"] for column in source["columns"]}
    selected = [key for key in columns if key in projectable][: int(limit)]
    out_rows = []
    for row in filtered[: int(limit)]:
        out_rows.append({key: row.get(key) for key in selected})
    result_columns = [
        {"key": key, "label": _column_label(source, key), "type": _column_type(source, key)}
        for key in selected
    ]
    summary = _run_summary(source_key, raw_rows, filtered, len(out_rows))
    return {
        "title": f"{source['label']} report",
        "columns": result_columns,
        "rows": out_rows,
        "summary": summary,
        "generatedAt": iso_now(),
    }


def _column_type(source: dict, key: str) -> str:
    for column in source["columns"]:
        if column["key"] == key:
            return column["type"]
    return "text"


def _run_summary(source_key: str, raw: list, filtered: list, shown: int) -> list[dict]:
    studies = {str(r.get("studyId") or "") for r in filtered if r.get("studyId")}
    sites = {str(r.get("siteNo") or "") for r in filtered if r.get("siteNo")}
    summary = [
        {"label": "Source", "value": SOURCE_BY_KEY[source_key]["label"]},
        {"label": "Rows in source", "value": len(raw)},
        {"label": "Rows after filters", "value": len(filtered)},
        {"label": "Studies", "value": len(studies)},
        {"label": "Sites", "value": len(sites)},
    ]
    if shown != len(filtered):
        summary.append({"label": "Rows returned", "value": shown})
    return summary


def option_values(db: Session, user, source_key: str) -> dict:
    """Distinct values for the source's filter fields (builder dropdowns)."""
    source = SOURCE_BY_KEY.get(source_key or "")
    if source is None:
        return {"source": source_key, "options": {}}
    rows = source_rows(db, user, source_key)
    fields = source.get("filterFields", [])
    options: dict[str, list] = {}
    for field in fields:
        values = sorted(
            {
                str(row.get(field))
                for row in rows
                if row.get(field) not in (None, "", "—")
            }
        )
        if values:
            options[field] = values
    return {"source": source_key, "options": options}


# ---------------------------------------------------------------------------
# The five standard reports
# ---------------------------------------------------------------------------

STANDARD_REPORTS: list[dict] = [
    {
        "key": "enrollment-velocity",
        "label": "Enrollment Velocity",
        "description": "New enrollments and cumulative enrollment over time, by month.",
    },
    {
        "key": "deviation-summary",
        "label": "Protocol Deviation Summary",
        "description": "Protocol deviations grouped by category, severity and status.",
    },
    {
        "key": "visit-compliance",
        "label": "Subject Visit Compliance",
        "description": "Per-subject completed / missed / cancelled visit counts and compliance.",
    },
    {
        "key": "eisf-completeness",
        "label": "eISF Completeness Index",
        "description": "Study document completeness per study and site (uploaded vs expected).",
    },
    {
        "key": "site-budget-spend",
        "label": "Site Budget Spend",
        "description": "Site budget baseline vs actual spend with variance (incl. pending payouts).",
    },
]

STANDARD_BY_KEY = {report["key"]: report for report in STANDARD_REPORTS}


def _flat_map(records: list[dict]) -> dict:
    """Count records per tuple of (study, site, category) keys -> metrics."""
    return records


def run_standard_report(db: Session, user, key: str, study: str | None = None, site: str | None = None) -> dict:
    """Run one of the five standard reports (rows scoped to the user)."""
    if key == "enrollment-velocity":
        return _report_enrollment_velocity(db, user, study, site)
    if key == "deviation-summary":
        return _report_deviation_summary(db, user, study, site)
    if key == "visit-compliance":
        return _report_visit_compliance(db, user, study, site)
    if key == "eisf-completeness":
        return _report_eisf_completeness(db, user, study, site)
    if key == "site-budget-spend":
        return _report_site_budget_spend(db, user, study, site)
    raise KeyError(key)


def _report_enrollment_velocity(db, user, study, site):
    subjects = [
        _map_subject(r) for r in list_records(db, CtmsSubject, user)
    ]
    rows: list[dict] = []
    series: dict[str, dict] = {}
    cumulative = 0
    enrolled_statuses = {"Enrolled", "Ongoing", "Completed"}
    for subject in subjects:
        if study and subject.get("studyId") != study:
            continue
        if site and str(subject.get("siteNo") or "") != str(site):
            continue
        study_code = subject.get("studyId") or "—"
        month = _month_key(subject.get("enrollmentDate"))
        if month:
            bucket = series.setdefault(
                (study_code, month), {"studyId": study_code, "month": month, "new": 0}
            )
            bucket["new"] += 1
        cumulative += 1 if subject.get("status") in enrolled_statuses else 0
    running = 0
    for (study_code, month), bucket in sorted(series.items()):
        running += bucket["new"]
        rows.append(
            {
                "studyId": bucket["studyId"],
                "month": bucket["month"],
                "newEnrollments": bucket["new"],
                "cumulativeEnrolled": running,
            }
        )
    total = len(subjects)
    enrolled = sum(1 for s in subjects if s.get("status") in enrolled_statuses)
    by_status: Counter = Counter(s.get("status") or "Unknown" for s in subjects)
    summary = [
        {"label": "Total subjects", "value": total},
        {"label": "Enrolled to date", "value": enrolled},
        {"label": "Screened", "value": by_status.get("Screened", 0)},
        {"label": "Ongoing", "value": by_status.get("Ongoing", 0)},
        {"label": "Completed", "value": by_status.get("Completed", 0)},
        {"label": "Withdrawn", "value": by_status.get("Withdrawn", 0)},
        {"label": "Dropout", "value": by_status.get("Dropout", 0)},
        {"label": "Studies", "value": len({s.get("studyId") for s in subjects})},
    ]
    return {
        "title": "Enrollment Velocity",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "month", "label": "Month", "type": "text"},
            {"key": "newEnrollments", "label": "New Enrollments", "type": "number"},
            {"key": "cumulativeEnrolled", "label": "Cumulative Enrolled", "type": "number"},
        ],
        "rows": rows,
        "summary": summary,
        "generatedAt": iso_now(),
    }


def _report_deviation_summary(db, user, study, site):
    deviations = [dict(r.data or {}) for r in scoped_rows(db, ReportDeviation, user)]
    buckets: dict[tuple, dict] = {}
    for deviation in deviations:
        if study and deviation.get("studyId") != study:
            continue
        if site and str(deviation.get("siteNo") or "") != str(site):
            continue
        key = (
            deviation.get("studyId") or "—",
            str(deviation.get("siteNo") or "—"),
            deviation.get("category") or "Uncategorised",
            deviation.get("severity") or "Unknown",
            deviation.get("status") or "Unknown",
        )
        bucket = buckets.setdefault(
            key,
            {
                "studyId": key[0],
                "siteNo": key[1],
                "category": key[2],
                "severity": key[3],
                "status": key[4],
                "count": 0,
            },
        )
        bucket["count"] += 1
    rows = sorted(buckets.values(), key=lambda r: (-r["count"], r["studyId"]))
    open_count = sum(
        1
        for d in deviations
        if str(d.get("status") or "").lower() in ("open", "under review", "new")
    )
    closed = sum(1 for d in deviations if str(d.get("status") or "").lower() in ("closed", "resolved"))
    summary = [
        {"label": "Total deviations", "value": len(deviations)},
        {"label": "Open / under review", "value": open_count},
        {"label": "Closed / resolved", "value": closed},
        {"label": "Studies", "value": len({d.get("studyId") for d in deviations})},
        {"label": "Sites", "value": len({d.get("siteNo") for d in deviations})},
    ]
    return {
        "title": "Protocol Deviation Summary",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "siteNo", "label": "Site No", "type": "text"},
            {"key": "category", "label": "Category", "type": "text"},
            {"key": "severity", "label": "Severity", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "count", "label": "Deviations", "type": "number"},
        ],
        "rows": rows,
        "summary": summary,
        "generatedAt": iso_now(),
    }


def _report_visit_compliance(db, user, study, site):
    visits = [_map_visit(r) for r in list_records(db, CtmsVisit, user)]
    per_subject: dict[tuple, dict] = {}
    for visit in visits:
        if study and visit.get("studyId") != study:
            continue
        if site and str(visit.get("siteNo") or "") != str(site):
            continue
        key = (visit.get("studyId") or "—", visit.get("subjectId") or "—")
        bucket = per_subject.setdefault(
            key,
            {
                "studyId": key[0],
                "subjectId": key[1],
                "scheduled": 0,
                "completed": 0,
                "missed": 0,
                "cancelled": 0,
            },
        )
        status = str(visit.get("status") or "").lower()
        if status == "completed":
            bucket["completed"] += 1
        elif status == "missed":
            bucket["missed"] += 1
        elif status == "cancelled":
            bucket["cancelled"] += 1
        elif status == "scheduled":
            bucket["scheduled"] += 1
    rows = []
    for _key, bucket in sorted(per_subject.items()):
        expected = bucket["completed"] + bucket["missed"]
        bucket["expectedVisits"] = expected
        bucket["compliancePct"] = _pct(bucket["completed"], expected)
        rows.append(bucket)
    completed_total = sum(r["completed"] for r in rows)
    missed_total = sum(r["missed"] for r in rows)
    cancelled_total = sum(r["cancelled"] for r in rows)
    scheduled_total = sum(r["scheduled"] for r in rows)
    overall = _pct(completed_total, completed_total + missed_total)
    summary = [
        {"label": "Subjects", "value": len(rows)},
        {"label": "Completed visits", "value": completed_total},
        {"label": "Missed visits", "value": missed_total},
        {"label": "Cancelled visits", "value": cancelled_total},
        {"label": "Upcoming (scheduled)", "value": scheduled_total},
        {"label": "Overall compliance", "value": f"{overall:.1f}%"},
    ]
    return {
        "title": "Subject Visit Compliance",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "subjectId", "label": "Subject ID", "type": "text"},
            {"key": "scheduled", "label": "Scheduled", "type": "number"},
            {"key": "completed", "label": "Completed", "type": "number"},
            {"key": "missed", "label": "Missed", "type": "number"},
            {"key": "cancelled", "label": "Cancelled", "type": "number"},
            {"key": "expectedVisits", "label": "Expected", "type": "number"},
            {"key": "compliancePct", "label": "Compliance %", "type": "number"},
        ],
        "rows": rows,
        "summary": summary,
        "generatedAt": iso_now(),
    }


def _report_eisf_completeness(db, user, study, site):
    documents = [dict(r.data or {}) for r in scoped_rows(db, ReportStudyDocument, user)]
    buckets: dict[tuple, dict] = {}
    for document in documents:
        if study and document.get("studyId") != study:
            continue
        if site and str(document.get("siteNo") or "") != str(site):
            continue
        key = (
            document.get("studyId") or "—",
            str(document.get("siteNo") or "—"),
            document.get("folder") or "General",
        )
        bucket = buckets.setdefault(
            key,
            {
                "studyId": key[0],
                "siteNo": key[1],
                "folder": key[2],
                "expected": 0,
                "uploaded": 0,
                "missing": 0,
            },
        )
        bucket["expected"] += 1
        if str(document.get("status") or "").lower() == "uploaded":
            bucket["uploaded"] += 1
        else:
            bucket["missing"] += 1
    rows = []
    for _key, bucket in sorted(buckets.items()):
        bucket["completenessPct"] = _pct(bucket["uploaded"], bucket["expected"])
        rows.append(bucket)
    uploaded_total = sum(r["uploaded"] for r in rows)
    expected_total = sum(r["expected"] for r in rows)
    summary = [
        {"label": "Document records", "value": expected_total},
        {"label": "Uploaded", "value": uploaded_total},
        {"label": "Missing / pending", "value": expected_total - uploaded_total},
        {"label": "Overall completeness", "value": f"{_pct(uploaded_total, expected_total):.1f}%"},
        {"label": "Studies", "value": len({d.get("studyId") for d in documents})},
    ]
    return {
        "title": "eISF Completeness Index",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "siteNo", "label": "Site No", "type": "text"},
            {"key": "folder", "label": "Folder", "type": "text"},
            {"key": "expected", "label": "Expected", "type": "number"},
            {"key": "uploaded", "label": "Uploaded", "type": "number"},
            {"key": "missing", "label": "Missing", "type": "number"},
            {"key": "completenessPct", "label": "Completeness %", "type": "number"},
        ],
        "rows": rows,
        "summary": summary,
        "generatedAt": iso_now(),
    }


def _report_site_budget_spend(db, user, study, site):
    snapshot = finance_rows(db, user, study=study, site=site)
    budget_rows = snapshot["budgets"]
    over_budget = sum(1 for row in budget_rows if row["variance"] > 0)
    summary = [
        {"label": "Budget lines", "value": snapshot["summary"]["budgetCount"]},
        {"label": "Baseline total", "value": f"{snapshot['summary']['totalBudgetBaseline']:,.2f}"},
        {"label": "Actual spend", "value": f"{snapshot['summary']['totalActualSpend']:,.2f}"},
        {"label": "Variance", "value": f"{snapshot['summary']['totalVariance']:+,.2f}"},
        {"label": "Pending payout commitments", "value": f"{snapshot['summary']['totalCommittedPending']:,.2f}"},
        {"label": "Sites over budget", "value": over_budget},
    ]
    rows = [
        {
            "studyId": row["studyId"] or "—",
            "siteId": row["siteId"] or "—",
            "siteName": row["siteName"],
            "budgetCode": row["code"],
            "baselineAmount": row["baselineAmount"],
            "actualSpend": row["actualSpend"],
            "committedPending": row["committedPending"],
            "variance": row["variance"],
            "spentPct": round((row["actualSpend"] / row["baselineAmount"]) * 100.0, 1)
            if row["baselineAmount"]
            else 0.0,
        }
        for row in budget_rows
    ]
    rows.sort(key=lambda r: (r["studyId"], r["siteId"], r["budgetCode"]))
    return {
        "title": "Site Budget Spend",
        "columns": [
            {"key": "studyId", "label": "Study", "type": "text"},
            {"key": "siteId", "label": "Site No", "type": "text"},
            {"key": "siteName", "label": "Site", "type": "text"},
            {"key": "budgetCode", "label": "Budget", "type": "text"},
            {"key": "baselineAmount", "label": "Baseline ($)", "type": "number"},
            {"key": "actualSpend", "label": "Actual ($)", "type": "number"},
            {"key": "committedPending", "label": "Pending ($)", "type": "number"},
            {"key": "variance", "label": "Variance ($)", "type": "number"},
            {"key": "spentPct", "label": "Spent %", "type": "number"},
        ],
        "rows": rows,
        "summary": summary,
        "generatedAt": iso_now(),
    }
