# tria_engine/apps/reporting/router_finance.py
#
# Financials & Milestones REST surface (Varsha's scope):
#
#   GET  /api/finance/summary      full finance snapshot (budgets w/ variance,
#                                  invoices, payouts, milestones, completion)
#   GET  /api/finance/budgets      budget lines (baseline vs actual vs variance)
#   POST /api/finance/budgets      create a budget line
#   PATCH /api/finance/budgets/{code}  update baseline/status of a budget
#   GET/POST /api/finance/invoices invoice list + generation
#   POST /api/finance/invoices/{code}/issue   Draft -> Issued
#   POST /api/finance/invoices/{code}/pay     -> Paid
#   GET/POST /api/finance/payouts  payout list + request
#   POST /api/finance/payouts/{code}/approve | /reject | /pay
#   GET  /api/milestones           milestone list w/ weighted completion per
#                                  study/site (query ?studyId= / ?siteId=)
#   POST /api/milestones           create a milestone
#   PATCH /api/milestones/{code}/status   advance milestone status
#
# All reads are authenticated + org-scoped. All writes go through the local
# reporting role matrix (rbac.py) — payout *approval* is Admin/Sponsor only.

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.timeutils import utcnow
from ..accounts.dependencies import get_current_user
from ..accounts.models import User
from ..ctms.common import CtmsError, guarded, new_id
from .engine import finance_rows, scope_condition, scoped_rows
from .models import (
    FinanceBudget,
    FinanceInvoice,
    FinanceMilestone,
    FinancePayout,
)
from .rbac import enforce_reporting

finance_router = APIRouter(prefix="/api/finance", tags=["finance"])
milestones_router = APIRouter(prefix="/api/milestones", tags=["milestones"])

_INVOICE_STATUSES = {"Draft", "Issued", "Paid", "Cancelled"}
_PAYOUT_STATUSES = {"Pending", "Approved", "Paid", "Rejected"}
_MILESTONE_STATUSES = {"Not Started", "In Progress", "Delayed", "Completed", "Approved"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class BudgetCreate(BaseModel):
    name: str
    studyId: str | None = None
    siteId: str | None = None
    siteName: str | None = None
    baselineAmount: float
    currency: str = "USD"
    periodLabel: str = ""
    status: str = "Active"
    notes: str = ""


class BudgetUpdate(BaseModel):
    name: str | None = None
    baselineAmount: float | None = None
    status: str | None = None
    notes: str | None = None


class MilestoneCreate(BaseModel):
    name: str
    studyId: str | None = None
    siteId: str | None = None
    category: str = "Contractual"
    weight: float = 1.0
    targetDate: date | None = None
    status: str = "Not Started"


class InvoiceCreate(BaseModel):
    studyId: str | None = None
    siteId: str | None = None
    budgetCode: str = ""
    description: str = ""
    amount: float
    currency: str = "USD"
    periodLabel: str = ""
    issueDate: date | None = None
    dueDate: date | None = None


class PayoutCreate(BaseModel):
    budgetCode: str = ""
    invoiceCode: str = ""
    studyId: str | None = None
    siteId: str | None = None
    reason: str = ""
    amount: float
    currency: str = "USD"


class StatusUpdate(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _load_row(db: Session, model, user, code: str, label: str):
    stmt = select(model).where(model.code == code)
    cond = scope_condition(model, user)
    if cond is not None:
        stmt = stmt.where(cond)
    row = db.execute(stmt).scalars().first()
    if row is None:
        raise CtmsError(f"{label} not found.", status=404)
    return row


# ---------------------------------------------------------------------------
# Finance summary / budgets
# ---------------------------------------------------------------------------


@finance_router.get("/summary")
def finance_summary(
    request: Request,
    studyId: str | None = Query(None),
    siteId: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return finance_rows(db, user, study=studyId, site=siteId)


@finance_router.get("/budgets")
def list_budgets(
    request: Request,
    studyId: str | None = Query(None),
    siteId: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return finance_rows(db, user, study=studyId, site=siteId)["budgets"]


@finance_router.post("/budgets")
def create_budget(
    payload: BudgetCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        enforce_reporting(user, "budgets", "create")
        if payload.baselineAmount < 0:
            raise CtmsError("Budget baseline cannot be negative.", status=400)
        row = FinanceBudget(
            code=new_id("BGT-"),
            name=str(payload.name or "").strip(),
            organization_id=user.organization_id,
            study_id=(str(payload.studyId or "").strip() or None),
            site_id=(str(payload.siteId or "").strip() or None),
            site_name=str(payload.siteName or "").strip(),
            baseline_amount=payload.baselineAmount,
            currency=payload.currency or "USD",
            period_label=payload.periodLabel or "",
            status=payload.status or "Active",
            notes=payload.notes or "",
        )
        db.add(row)
        db.commit()
        return _budget_json(row)

    return guarded(_create)


@finance_router.patch("/budgets/{code}")
def update_budget(
    code: str,
    payload: BudgetUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _update():
        row = _load_row(db, FinanceBudget, user, code, "Budget")
        enforce_reporting(user, "budgets", "update")
        if payload.name is not None:
            row.name = str(payload.name).strip()
        if payload.baselineAmount is not None:
            if payload.baselineAmount < 0:
                raise CtmsError("Budget baseline cannot be negative.", status=400)
            row.baseline_amount = payload.baselineAmount
        if payload.status is not None:
            row.status = payload.status
        if payload.notes is not None:
            row.notes = payload.notes
        db.add(row)
        db.commit()
        return _budget_json(row)

    return guarded(_update)


def _budget_json(row) -> dict:
    return {
        "code": row.code,
        "name": row.name,
        "studyId": row.study_id,
        "siteId": row.site_id,
        "siteName": row.site_name,
        "currency": row.currency,
        "periodLabel": row.period_label,
        "status": row.status,
        "baselineAmount": float(row.baseline_amount or 0),
        "notes": row.notes,
    }


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


@finance_router.get("/invoices")
def list_invoices(
    request: Request,
    studyId: str | None = Query(None),
    siteId: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return finance_rows(db, user, study=studyId, site=siteId)["invoices"]


@finance_router.post("/invoices")
def create_invoice(
    payload: InvoiceCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        enforce_reporting(user, "invoices", "create")
        if payload.amount <= 0:
            raise CtmsError("Invoice amount must be positive.", status=400)
        code = new_id("INV-")
        row = FinanceInvoice(
            code=code,
            number=code,
            organization_id=user.organization_id,
            study_id=(str(payload.studyId or "").strip() or None),
            site_id=(str(payload.siteId or "").strip() or None),
            budget_code=payload.budgetCode or "",
            description=str(payload.description or "").strip(),
            amount=payload.amount,
            currency=payload.currency or "USD",
            status="Draft",
            period_label=payload.periodLabel or "",
            issue_date=payload.issueDate,
            due_date=payload.dueDate,
            created_by=getattr(user, "username", None) or getattr(user, "email", ""),
        )
        db.add(row)
        db.commit()
        return _invoice_json(row)

    return guarded(_create)


@finance_router.post("/invoices/{code}/issue")
def issue_invoice(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _action():
        enforce_reporting(user, "invoices", "update")
        row = _load_row(db, FinanceInvoice, user, code, "Invoice")
        if row.status not in ("Draft", "Cancelled"):
            raise CtmsError(f"Cannot issue an invoice in status '{row.status}'.", status=400)
        row.status = "Issued"
        row.issue_date = row.issue_date or date.today()
        db.add(row)
        db.commit()
        return _invoice_json(row)

    return guarded(_action)


@finance_router.post("/invoices/{code}/pay")
def pay_invoice(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _action():
        enforce_reporting(user, "invoices", "update")
        row = _load_row(db, FinanceInvoice, user, code, "Invoice")
        if row.status != "Issued":
            raise CtmsError("Only issued invoices can be marked paid.", status=400)
        row.status = "Paid"
        db.add(row)
        db.commit()
        return _invoice_json(row)

    return guarded(_action)


def _invoice_json(row) -> dict:
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


# ---------------------------------------------------------------------------
# Payouts (request + approval workflow)
# ---------------------------------------------------------------------------


@finance_router.get("/payouts")
def list_payouts(
    request: Request,
    studyId: str | None = Query(None),
    siteId: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return finance_rows(db, user, study=studyId, site=siteId)["payouts"]


@finance_router.post("/payouts")
def create_payout(
    payload: PayoutCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        enforce_reporting(user, "payouts", "create")
        if payload.amount <= 0:
            raise CtmsError("Payout amount must be positive.", status=400)
        row = FinancePayout(
            code=new_id("PAY-"),
            organization_id=user.organization_id,
            budget_code=payload.budgetCode or "",
            invoice_code=payload.invoiceCode or "",
            study_id=(str(payload.studyId or "").strip() or None),
            site_id=(str(payload.siteId or "").strip() or None),
            reason=str(payload.reason or "").strip(),
            amount=payload.amount,
            currency=payload.currency or "USD",
            status="Pending",
            requested_by=getattr(user, "username", None) or getattr(user, "email", ""),
        )
        db.add(row)
        db.commit()
        return _payout_json(row)

    return guarded(_create)


@finance_router.post("/payouts/{code}/approve")
def approve_payout(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _action():
        enforce_reporting(user, "payouts", "approve")
        row = _load_row(db, FinancePayout, user, code, "Payout")
        if row.status != "Pending":
            raise CtmsError(f"Cannot approve a payout in status '{row.status}'.", status=400)
        row.status = "Approved"
        row.decided_by = getattr(user, "username", None) or getattr(user, "email", "")
        row.decided_at = utcnow()
        db.add(row)
        db.commit()
        return _payout_json(row)

    return guarded(_action)


@finance_router.post("/payouts/{code}/reject")
def reject_payout(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _action():
        enforce_reporting(user, "payouts", "approve")
        row = _load_row(db, FinancePayout, user, code, "Payout")
        if row.status != "Pending":
            raise CtmsError(f"Cannot reject a payout in status '{row.status}'.", status=400)
        row.status = "Rejected"
        row.decided_by = getattr(user, "username", None) or getattr(user, "email", "")
        row.decided_at = utcnow()
        db.add(row)
        db.commit()
        return _payout_json(row)

    return guarded(_action)


@finance_router.post("/payouts/{code}/pay")
def pay_payout(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _action():
        enforce_reporting(user, "payouts", "approve")
        row = _load_row(db, FinancePayout, user, code, "Payout")
        if row.status != "Approved":
            raise CtmsError("Only approved payouts can be marked paid.", status=400)
        row.status = "Paid"
        row.decided_by = getattr(user, "username", None) or getattr(user, "email", "")
        row.decided_at = utcnow()
        db.add(row)
        db.commit()
        return _payout_json(row)

    return guarded(_action)


def _payout_json(row) -> dict:
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


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------


@milestones_router.get("")
@milestones_router.get("/")
def list_milestones(
    request: Request,
    studyId: str | None = Query(None),
    siteId: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    snapshot = finance_rows(db, user, study=studyId, site=siteId)
    return {
        "milestones": snapshot["milestones"],
        "completion": snapshot["completion"],
    }


@milestones_router.post("")
@milestones_router.post("/")
def create_milestone(
    payload: MilestoneCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        enforce_reporting(user, "milestones", "create")
        if payload.weight <= 0:
            raise CtmsError("Milestone weight must be positive.", status=400)
        if payload.status not in _MILESTONE_STATUSES:
            raise CtmsError(f"Invalid milestone status '{payload.status}'.", status=400)
        row = FinanceMilestone(
            code=new_id("MS-"),
            name=str(payload.name or "").strip(),
            organization_id=user.organization_id,
            study_id=(str(payload.studyId or "").strip() or None),
            site_id=(str(payload.siteId or "").strip() or None),
            category=payload.category or "Contractual",
            weight=payload.weight,
            target_date=payload.targetDate,
            status=payload.status or "Not Started",
        )
        db.add(row)
        db.commit()
        return _milestone_json(row)

    return guarded(_create)


@milestones_router.patch("/{code}/status")
def update_milestone_status(
    code: str,
    payload: StatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _update():
        enforce_reporting(user, "milestones", "update")
        row = _load_row(db, FinanceMilestone, user, code, "Milestone")
        if payload.status not in _MILESTONE_STATUSES:
            raise CtmsError(f"Invalid milestone status '{payload.status}'.", status=400)
        row.status = payload.status
        db.add(row)
        db.commit()
        return _milestone_json(row)

    return guarded(_update)


def _milestone_json(row) -> dict:
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
