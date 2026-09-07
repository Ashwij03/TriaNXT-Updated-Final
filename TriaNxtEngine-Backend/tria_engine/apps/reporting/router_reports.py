# tria_engine/apps/reporting/router_reports.py
#
# Custom Report Builder / Standard Report Center REST surface:
#
#   GET  /api/reports/catalog              sources, columns, filters, aggregates
#   GET  /api/reports/options?source=      distinct filter values per source
#   POST /api/reports/run                  run a builder configuration
#   GET  /api/reports/standard             list of the 5 standard reports
#   GET  /api/reports/standard/{key}       run one standard report
#   GET  /api/reports/standard/{key}/export?format=csv|xlsx|pdf
#   POST /api/reports/export               export an arbitrary run payload
#   GET/POST/PUT/DELETE /api/reports/templates  saved Report Builder templates
#
# Every read is authenticated and scoped to the caller's organization (and
# their study/site assignment when one exists). Template writes follow the
# local reporting role matrix (rbac.py); the central auth matrix is untouched.

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.database import get_db
from ..accounts.dependencies import get_current_user
from ..accounts.models import User
from ..ctms.common import CtmsError, guarded, new_id
from .engine import (
    CATALOG,
    SOURCE_BY_KEY,
    option_values,
    run_builder_report,
    run_standard_report,
    scoped_rows,
    scope_condition,
    STANDARD_REPORTS,
)
from .models import ReportTemplate
from .rbac import enforce_reporting
from .report_generator import render_export

logger = logging.getLogger("tria_engine.reports")

router = APIRouter(prefix="/api/reports", tags=["reports"])

AGGREGATE_OPTIONS = [
    {"key": "none", "label": "None (list rows)"},
    {"key": "count", "label": "Count"},
    {"key": "sum", "label": "Sum"},
    {"key": "avg", "label": "Average"},
]

OPERATOR_OPTIONS = [
    {"key": "eq", "label": "equals"},
    {"key": "neq", "label": "does not equal"},
    {"key": "contains", "label": "contains"},
    {"key": "gt", "label": "greater than"},
    {"key": "gte", "label": "at least"},
    {"key": "lt", "label": "less than"},
    {"key": "lte", "label": "at most"},
    {"key": "between", "label": "between"},
]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class FilterItem(BaseModel):
    field: str
    op: str = "eq"
    value: object = None


class AggregateSpec(BaseModel):
    type: str = "none"  # none | count | sum | avg
    column: str | None = None
    groupBy: str | None = None


class RunReportRequest(BaseModel):
    source: str
    columns: list[str] = Field(default_factory=list)
    filters: list[FilterItem] = Field(default_factory=list)
    aggregate: AggregateSpec = Field(default_factory=AggregateSpec)
    limit: int | None = 500


class StandardExportRef(BaseModel):
    key: str
    study: str | None = None
    site: str | None = None


class ExportRequest(BaseModel):
    format: str = "csv"
    title: str | None = None
    config: RunReportRequest | None = None
    standard: StandardExportRef | None = None


class TemplatePayload(BaseModel):
    name: str
    studyId: str | None = None
    config: dict = Field(default_factory=dict)


def _config_from_payload(payload: TemplatePayload) -> dict:
    config = dict(payload.config or {})
    source = str(config.get("source") or "").strip()
    if source and source not in SOURCE_BY_KEY:
        raise CtmsError(f"Unknown report source '{source}'.", status=400)
    return config


def _serialize_template(row) -> dict:
    return {
        "code": row.code,
        "name": row.name,
        "studyId": row.study_id,
        "source": (row.config or {}).get("source", ""),
        "config": row.config or {},
        "ownerId": row.owner_id,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Catalog / options
# ---------------------------------------------------------------------------


@router.get("/catalog")
def report_catalog(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return {
        "sources": CATALOG,
        "aggregates": AGGREGATE_OPTIONS,
        "operators": OPERATOR_OPTIONS,
        "standard": STANDARD_REPORTS,
    }


@router.get("/options")
def report_options(
    request: Request,
    source: str = Query("subjects"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _run():
        return option_values(db, user, source)

    return guarded(_run)


# ---------------------------------------------------------------------------
# Run builder configuration / standard report
# ---------------------------------------------------------------------------


@router.post("/run")
def run_report(
    payload: RunReportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _run():
        config = {
            "source": payload.source,
            "columns": payload.columns or [],
            "filters": [item.model_dump() for item in payload.filters or []],
            "aggregate": payload.aggregate.model_dump() if payload.aggregate else {},
            "limit": payload.limit or 500,
        }
        try:
            return run_builder_report(db, user, config)
        except ValueError as exc:
            raise CtmsError(str(exc), status=400) from exc

    return guarded(_run)


@router.get("/standard")
def standard_reports_list(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return {"reports": STANDARD_REPORTS}


@router.get("/standard/{key}")
def standard_report_detail(
    key: str,
    request: Request,
    study: str | None = Query(None),
    site: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _run():
        try:
            return run_standard_report(db, user, key, study=study, site=site)
        except KeyError as exc:
            raise CtmsError(f"Unknown standard report '{key}'.", status=404) from exc

    return guarded(_run)


@router.get("/standard/{key}/export")
def standard_report_export(
    key: str,
    format: str = Query("csv"),
    study: str | None = Query(None),
    site: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download a standard report in csv/xlsx/pdf (GET-friendly URL)."""
    try:
        result = run_standard_report(db, user, key, study=study, site=site)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown standard report '{key}'.") from exc
    return _file_response(result, format)


@router.post("/export")
def report_export(
    payload: ExportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """POST export: either a standard report ref or an arbitrary builder run."""
    result = None
    if payload.standard is not None:
        try:
            result = run_standard_report(
                db,
                user,
                payload.standard.key,
                study=payload.standard.study,
                site=payload.standard.site,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=f"Unknown standard report '{payload.standard.key}'.") from exc
    elif payload.config is not None:
        config = {
            "source": payload.config.source,
            "columns": payload.config.columns or [],
            "filters": [item.model_dump() for item in payload.config.filters or []],
            "aggregate": payload.config.aggregate.model_dump() if payload.config.aggregate else {},
            "limit": payload.config.limit or 500,
        }
        try:
            result = run_builder_report(db, user, config)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    else:
        raise HTTPException(status_code=400, detail="Provide a `standard` report or a builder `config`.")
    if payload.title:
        result["title"] = payload.title
    return _file_response(result, payload.format)


def _file_response(result: dict, format: str) -> "Response":
    from fastapi import HTTPException as _HTTPException
    from fastapi.responses import Response

    try:
        body, filename, media_type = render_export(result, format)
    except Exception as exc:  # noqa: BLE001 — surface export failures as a
        # proper JSON error instead of a bare 500. An unhandled exception
        # bypasses the CORS middleware, so the browser sees a misleading
        # "CORS error" (no Access-Control-Allow-Origin on the response)
        # even though the real problem is the failed export.
        logger.exception("Report export failed (format=%s)", format)
        raise _HTTPException(
            status_code=500,
            detail=f"Report export failed: {exc}",
        ) from exc
    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Saved templates (Custom Report Builder)
# ---------------------------------------------------------------------------


def _load_own_template(db: Session, user: User, code: str):
    stmt = select(ReportTemplate).where(ReportTemplate.code == code)
    cond = scope_condition(ReportTemplate, user)
    if cond is not None:
        stmt = stmt.where(cond)
    row = db.execute(stmt).scalars().first()
    if row is None:
        raise CtmsError("Report template not found.", status=404)
    return row


@router.get("/templates")
def list_templates(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = scoped_rows(db, ReportTemplate, user)
    return [_serialize_template(row) for row in rows]


@router.post("/templates")
def create_template(
    payload: TemplatePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _create():
        enforce_reporting(user, "reports", "create")
        name = str(payload.name or "").strip()
        config = _config_from_payload(payload)
        if not name:
            raise CtmsError("Template name is required.", status=400)
        if not config.get("source"):
            raise CtmsError("Template must include a report source.", status=400)
        row = ReportTemplate(
            code=new_id("RPT-"),
            name=name,
            organization_id=user.organization_id,
            owner_id=user.id,
            study_id=(str(payload.studyId or "").strip() or None),
            config=config,
        )
        db.add(row)
        db.commit()
        return _serialize_template(row)

    return guarded(_create)


@router.get("/templates/{code}")
def get_template(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _detail():
        return _serialize_template(_load_own_template(db, user, code))

    return guarded(_detail)


def _assert_owner(row, user) -> None:
    """Only the template owner (or an Admin) may mutate a saved template."""
    if getattr(user, "is_superuser", False):
        return
    if row.owner_id not in (None, user.id):
        raise HTTPException(
            status_code=403, detail="Only the template owner may modify this report template."
        )


@router.put("/templates/{code}")
def update_template(
    code: str,
    payload: TemplatePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _update():
        row = _load_own_template(db, user, code)
        enforce_reporting(user, "reports", "update")
        _assert_owner(row, user)
        name = str(payload.name or "").strip()
        if not name:
            raise CtmsError("Template name is required.", status=400)
        config = _config_from_payload(payload)
        row.name = name
        row.study_id = str(payload.studyId or "").strip() or None
        if config.get("source"):
            row.config = config
        db.add(row)
        db.commit()
        return _serialize_template(row)

    return guarded(_update)


@router.delete("/templates/{code}")
def delete_template(
    code: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _delete():
        row = _load_own_template(db, user, code)
        enforce_reporting(user, "reports", "delete")
        _assert_owner(row, user)
        db.delete(row)
        db.commit()
        return {"deleted": code}

    return guarded(_delete)
