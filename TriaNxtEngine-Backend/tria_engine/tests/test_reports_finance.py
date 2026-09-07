# tria_engine/tests/test_reports_finance.py
#
# Varsha's scope — Custom Report Builder / Standard Report Center +
# Financials & Milestones:
#   * standard reports run against real (mirror) data with correct metrics
#   * builder run/filter/aggregate + template CRUD + RBAC on template writes
#   * CSV/XLSX/PDF export formats carry the company header + summary
#   * finance variance (actual spend vs baseline, incl. pending commitments)
#   * invoice workflow, payout approval workflow, weighted milestone %
#   * every surface requires auth and is org-scoped

from __future__ import annotations

import re
import uuid

import pytest
from sqlalchemy import select

from tria_engine.apps.accounts.models import User
from tria_engine.apps.ctms.models import CtmsSubject, CtmsVisit
from tria_engine.apps.organizations.models import Organization, Role
from tria_engine.apps.reporting.models import (
    ReportDeviation,
    ReportStudyDocument,
)
from tria_engine.core.database import SessionLocal
from tria_engine.core.security import hash_password
from tria_engine.core.timeutils import utcnow

# ---------------------------------------------------------------------------
# The suite shares one SQLite database for the whole session and the legacy
# subject/visit mirror tests count the rows they create with a superuser
# (wildcard across every org). To avoid polluting those counts, tests in
# this module register the study codes they seed mirrors for and remove
# their rows again after each test (autouse fixture below).
# ---------------------------------------------------------------------------

_TRACKED_STUDIES: set[str] = set()


def _track_study(study: str) -> None:
    _TRACKED_STUDIES.add(study)


@pytest.fixture(autouse=True)
def _cleanup_seeded_mirrors():
    yield
    db = SessionLocal()
    try:
        for study in _TRACKED_STUDIES:
            for model in (CtmsSubject, CtmsVisit, ReportDeviation, ReportStudyDocument):
                rows = db.execute(select(model).where(model.study_id == study)).scalars().all()
                for row in rows:
                    db.delete(row)
        db.commit()
    finally:
        db.close()

PASSWORD = "RolePass123!"
SUBJECTS_SYNC = "/api/site/subjects/sync"
VISITS_SYNC = "/api/site/visits/sync"
TEMPLATES = "/api/reports/templates"


def _org(name: str) -> int:
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.name == name).first()
        if org is None:
            org = Organization(name=name)
            db.add(org)
            db.flush()
        org_id = org.id
        db.commit()
        return org_id
    finally:
        db.close()


def _seed_user(role_name: str, org_name: str, scope_data: dict | None = None) -> str:
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.name == org_name).one()
        role = (
            db.query(Role)
            .filter(Role.name == role_name, Role.organization_id == org.id)
            .first()
        )
        if role is None:
            role = Role(name=role_name, organization_id=org.id)
            db.add(role)
            db.flush()
        email = f"{role_name.lower().replace(' ', '.')}.{uuid.uuid4().hex[:6]}@test.local"
        db.add(
            User(
                username=email.split("@")[0],
                email=email,
                password=hash_password(PASSWORD),
                first_name=role_name,
                last_name="User",
                is_active=True,
                organization_id=org.id,
                role_id=role.id,
                scope_data=scope_data,
            )
        )
        db.commit()
        return email
    finally:
        db.close()


def _login(client, email: str, password: str = PASSWORD):
    res = client.post("/api/accounts/login/", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return client


def _as_admin(client):
    return _login(client, "admin@test.local", "AdminPass123!")


def _subject(study: str, subj: str, status: str = "Screened", **over) -> dict:
    return {
        "id": subj,
        "subjectId": subj,
        "studyId": study,
        "initials": "SJ",
        "site": "SITE-A",
        "siteNo": "SITE-A",
        "siteName": "Site Alpha",
        "status": status,
        "screeningDate": "2026-09-01",
        "enrollmentDate": "—",
        "currentVisit": "Screening",
        "createdAt": "2026-09-01T08:00:00.000Z",
        "updatedAt": "2026-09-01T08:00:00.000Z",
        **over,
    }


def _visit(study: str, subj: str, name: str = "Screening", **over) -> dict:
    return {
        "id": f"{study}::{subj}::{name}",
        "date": "2026-09-02",
        "subjectId": subj,
        "subjectName": subj,
        "visit": name,
        "status": "Scheduled",
        "study": study,
        "site": "—",
        "time": "09:00 AM",
        "studyKey": study,
        "source": "subject",
        **over,
    }


def _sync(client, path: str, records) -> dict:
    res = client.post(path, json={"records": records})
    assert res.status_code == 200, res.text
    return res.json()


def _insert_mirror(model, code: str, organization_id: int, data: dict) -> None:
    db = SessionLocal()
    try:
        exists = db.execute(select(model).where(model.code == code)).scalar_one_or_none()
        if exists is None:
            db.add(
                model(
                    code=code,
                    organization_id=organization_id,
                    study_id=data.get("studyId") or data.get("study_id"),
                    site_id=data.get("siteNo") or data.get("site"),
                    data=data,
                    created_at=utcnow(),
                    updated_at=utcnow(),
                )
            )
            db.commit()
    finally:
        db.close()


def _admin_org_id() -> int:
    db = SessionLocal()
    try:
        admin = db.execute(select(User).where(User.email == "admin@test.local")).scalar_one()
        return admin.organization_id
    finally:
        db.close()


# ===========================================================================
# Auth
# ===========================================================================


def test_reporting_finance_surfaces_require_auth(client):
    assert client.get("/api/reports/catalog").status_code == 401
    assert client.get("/api/reports/standard").status_code == 401
    assert client.get("/api/finance/summary").status_code == 401
    assert client.get("/api/milestones/").status_code == 401
    assert client.post("/api/reports/templates", json={}).status_code == 401


# ===========================================================================
# Standard reports over real mirror data
# ===========================================================================


def test_enrollment_velocity_standard_report(client):
    _as_admin(client)
    study = "TNX-EVEL-01"
    _track_study(study)
    _sync(
        client,
        SUBJECTS_SYNC,
        [
            _subject(study, "S-01", status="Enrolled", screeningDate="2025-11-02", enrollmentDate="2025-11-10"),
            _subject(study, "S-02", status="Enrolled", screeningDate="2025-11-05", enrollmentDate="2025-11-18"),
            _subject(study, "S-03", status="Ongoing", screeningDate="2025-12-01", enrollmentDate="2025-12-09"),
            _subject(study, "S-04", status="Completed", screeningDate="2026-01-03", enrollmentDate="2026-01-12"),
            _subject(study, "S-05", status="Screened", screeningDate="2026-01-20"),
        ],
    )
    result = client.get("/api/reports/standard/enrollment-velocity", params={"study": study}).json()
    assert result["title"] == "Enrollment Velocity"
    summary = {item["label"]: item["value"] for item in result["summary"]}
    assert summary["Total subjects"] == 5
    assert summary["Enrolled to date"] == 4
    months = [(row["month"], row["newEnrollments"], row["cumulativeEnrolled"]) for row in result["rows"]]
    assert months == [
        ("2025-11", 2, 2),
        ("2025-12", 1, 3),
        ("2026-01", 1, 4),
    ]


def test_visit_compliance_standard_report(client):
    _as_admin(client)
    study = "TNX-VC-01"
    _track_study(study)
    _sync(
        client,
        VISITS_SYNC,
        [
            _visit(study, "S-1", "Screening", date="2026-08-01", status="Completed"),
            _visit(study, "S-1", "Day 1", date="2026-08-10", status="Completed"),
            _visit(study, "S-1", "Day 8", date="2026-08-17", status="Missed"),
            _visit(study, "S-1", "Day 15", date="2026-08-24", status="Scheduled"),
            _visit(study, "S-2", "Screening", date="2026-08-02", status="Completed"),
            _visit(study, "S-2", "Day 1", date="2026-08-12", status="Cancelled"),
            _visit(study, "S-2", "Day 8", date="2026-08-19", status="Cancelled"),
        ],
    )
    result = client.get("/api/reports/standard/visit-compliance", params={"study": study}).json()
    rows = {row["subjectId"]: row for row in result["rows"]}
    assert rows["S-1"]["completed"] == 2
    assert rows["S-1"]["missed"] == 1
    assert rows["S-1"]["expectedVisits"] == 3
    assert round(rows["S-1"]["compliancePct"], 1) == 66.7
    # S-2: cancellations are excluded from the compliance expectation.
    assert rows["S-2"]["completed"] == 1
    assert rows["S-2"]["expectedVisits"] == 1
    assert rows["S-2"]["compliancePct"] == 100.0
    summary = {item["label"]: item["value"] for item in result["summary"]}
    assert summary["Completed visits"] == 3
    assert summary["Missed visits"] == 1
    assert summary["Overall compliance"] == "75.0%"


def test_deviation_and_eisf_standard_reports(client):
    _as_admin(client)
    org_id = _admin_org_id()
    study = "TNX-DE-01"
    _track_study(study)
    for index, status in enumerate(["Open", "Open", "Closed"], start=1):
        _insert_mirror(
            ReportDeviation,
            f"TD-{study}-{index}",
            org_id,
            {
                "studyId": study,
                "subjectId": f"S-{index}",
                "siteNo": "SA-1",
                "siteName": "Site A",
                "category": "Protocol Procedure" if index != 3 else "Informed Consent",
                "severity": "Major" if index != 3 else "Minor",
                "status": status,
                "description": "test deviation",
                "identifiedDate": "2026-08-01",
            },
        )
    result = client.get("/api/reports/standard/deviation-summary", params={"study": study}).json()
    summary = {item["label"]: item["value"] for item in result["summary"]}
    assert summary["Total deviations"] == 3
    assert summary["Open / under review"] == 2
    assert summary["Closed / resolved"] == 1
    grouped = {row["status"]: row["count"] for row in result["rows"]}
    assert grouped == {"Open": 2, "Closed": 1}

    for index, status in enumerate(["Uploaded", "Uploaded", "Missing"], start=1):
        _insert_mirror(
            ReportStudyDocument,
            f"TDOC-{study}-{index}",
            org_id,
            {
                "studyId": study,
                "siteNo": "SA-1",
                "siteName": "Site A",
                "folder": "Regulatory Binder",
                "documentName": f"Doc {index}",
                "status": status,
                "uploadedDate": "2026-08-02" if status == "Uploaded" else None,
            },
        )
    result = client.get("/api/reports/standard/eisf-completeness", params={"study": study}).json()
    summary = {item["label"]: item["value"] for item in result["summary"]}
    assert summary["Document records"] == 3
    assert summary["Uploaded"] == 2
    assert summary["Overall completeness"] == "66.7%"
    assert result["rows"][0]["completenessPct"] == round(2 / 3 * 100, 1)


def test_standard_report_unknown_key_404(client):
    _as_admin(client)
    assert client.get("/api/reports/standard/nope").status_code == 404


# ===========================================================================
# Builder: catalog, run, filters, aggregates
# ===========================================================================


def test_builder_catalog_and_run(client):
    _as_admin(client)
    catalog = client.get("/api/reports/catalog").json()
    assert {source["key"] for source in catalog["sources"]} >= {
        "subjects",
        "visits",
        "deviations",
        "documents",
        "studies",
    }
    assert {agg["key"] for agg in catalog["aggregates"]} >= {"count", "sum", "avg"}

    study = "TNX-BUILD-01"
    _track_study(study)
    _sync(
        client,
        SUBJECTS_SYNC,
        [
            _subject(study, "S-1", status="Enrolled", enrollmentDate="2026-07-01"),
            _subject(study, "S-2", status="Enrolled", enrollmentDate="2026-08-01"),
            _subject(study, "S-3", status="Screened"),
        ],
    )
    run = client.post(
        "/api/reports/run",
        json={
            "source": "subjects",
            "columns": ["subjectId", "status", "enrollmentDate"],
            "filters": [{"field": "studyId", "op": "eq", "value": study}],
            "aggregate": {"type": "none"},
        },
    ).json()
    assert sorted(row["subjectId"] for row in run["rows"]) == ["S-1", "S-2", "S-3"]
    summary = {item["label"]: item["value"] for item in run["summary"]}
    assert summary["Rows after filters"] == 3

    # aggregate count grouped by status
    grouped = client.post(
        "/api/reports/run",
        json={
            "source": "subjects",
            "columns": [],
            "filters": [{"field": "studyId", "op": "eq", "value": study}],
            "aggregate": {"type": "count", "groupBy": "status"},
        },
    ).json()
    by_status = {row["group"]: row["count"] for row in grouped["rows"]}
    assert by_status == {"Enrolled": 2, "Screened": 1}

    # date-range filter (between) narrows the enrolled rows
    ranged = client.post(
        "/api/reports/run",
        json={
            "source": "subjects",
            "columns": ["subjectId"],
            "filters": [
                {"field": "studyId", "op": "eq", "value": study},
                {"field": "enrollmentDate", "op": "between", "value": ["2026-07-01", "2026-07-31"]},
            ],
            "aggregate": {"type": "none"},
        },
    ).json()
    assert [row["subjectId"] for row in ranged["rows"]] == ["S-1"]


def test_builder_unknown_source_400(client):
    _as_admin(client)
    res = client.post("/api/reports/run", json={"source": "aliens", "aggregate": {"type": "none"}})
    assert res.status_code == 400


# ===========================================================================
# Exports (CSV / XLSX / PDF carry header + summary)
# ===========================================================================


def test_exports_all_formats(client):
    _as_admin(client)
    org_id = _admin_org_id()
    study = "TNX-EXP-01"
    _track_study(study)
    _sync(client, SUBJECTS_SYNC, [_subject(study, "S-1", status="Enrolled", enrollmentDate="2026-06-01")])

    csv_res = client.get(
        "/api/reports/standard/enrollment-velocity/export",
        params={"study": study, "format": "csv"},
    )
    assert csv_res.status_code == 200
    assert csv_res.headers["content-type"].startswith("text/csv")
    csv_body = csv_res.content.decode("utf-8")
    assert "TriaNXT CTMS" in csv_body
    assert "Generated:" in csv_body
    assert "Summary" in csv_body
    assert "filename=" in csv_res.headers["content-disposition"]

    xlsx_res = client.get(
        "/api/reports/standard/enrollment-velocity/export",
        params={"study": study, "format": "xlsx"},
    )
    assert xlsx_res.status_code == 200
    assert xlsx_res.content[:2] == b"PK"
    assert "spreadsheetml" in xlsx_res.headers["content-type"]

    pdf_res = client.get(
        "/api/reports/standard/enrollment-velocity/export",
        params={"study": study, "format": "pdf"},
    )
    assert pdf_res.status_code == 200
    assert pdf_res.content[:5] == b"%PDF-"
    assert pdf_res.headers["content-type"] == "application/pdf"

    # POST export endpoint with a builder config
    post_res = client.post(
        "/api/reports/export",
        json={
            "format": "csv",
            "config": {"source": "subjects", "aggregate": {"type": "none"}},
        },
    )
    assert post_res.status_code == 200


def _pdf_text_draws(content: bytes):
    """Yield (y, text) for every Tj text draw in a generated PDF.

    The hand-rolled PDF writer emits each content stream as latin-1 text with
    escaped parens, so a regex over the raw bytes is a reliable proxy for what
    a viewer would render.
    """
    for _x, _y, text in re.findall(rb"([0-9.]+) ([0-9.]+) Tm \(((?:[^()\\]|\\.)*)\) Tj", content):
        yield float(_y), text.decode("latin-1")


def _pdf_streams_valid(content: bytes) -> bool:
    """Every page's /Contents target must be a *stream* object:
    `<< /Length N >> stream ... endstream` with N matching the bytes between
    the markers.

    Regression (blank PDF): the content streams were emitted as bare object
    bodies (raw operators with no stream/endstream wrapper), so a viewer like
    Chrome's PDFium treated each page as having NO content and rendered a
    completely blank white page — even though the operators, headers and rows
    were all present in the file bytes.
    """
    text = content.decode("latin-1")
    objects = dict(re.findall(r"(\d+) 0 obj\n(.*?)\nendobj", text, re.S))
    refs = re.findall(r"/Contents\s+(\d+)\s+0 R", text)
    if not refs:
        return False
    for ref in refs:
        body = objects.get(ref, "")
        match = re.match(
            r"<<\s*/Length\s+(\d+)\s*>>\s*\nstream\n(.*?)\nendstream",
            body,
            re.S,
        )
        if not match:
            return False
        if int(match.group(1)) != len(match.group(2).encode("latin-1")):
            return False
    return True


# Each standard report's own columns — cross-report mixing would put the wrong
# headers in a report's table.
_PDF_REPORT_EXPECTATIONS = {
    "enrollment-velocity": {"label": "Enrollment Velocity", "headers": ["Study", "Month", "New Enrollments", "Cumulative Enrolled"]},
    "deviation-summary": {"label": "Protocol Deviation Summary", "headers": ["Study", "Site No", "Category", "Severity", "Status", "Deviations"]},
    "visit-compliance": {"label": "Subject Visit Compliance", "headers": ["Study", "Subject ID", "Scheduled", "Completed", "Missed", "Cancelled", "Expected", "Compliance"]},
    "eisf-completeness": {"label": "eISF Completeness Index", "headers": ["Study", "Site No", "Folder", "Expected", "Uploaded", "Missing", "Completeness"]},
    "site-budget-spend": {"label": "Site Budget Spend", "headers": ["Study", "Site No", "Site", "Budget", "Baseline", "Actual", "Pending", "Variance", "Spent"]},
}


def test_pdf_export_all_five_standard_reports(client):
    """PDF export must succeed for every standard report, carry that report's
    own title/column headers, and draw its body text in the printable area.

    Regression 1: site-budget-spend renders 9 columns, so each column width is
    ~usable/9. The header-fit logic compared `header * 5.2` (str * float)
    against the column budget and raised TypeError, failing the download.
    The header-fit loop runs on the column headers alone, so a study with no
    budget rows still exercises the crash path (and avoids polluting other
    finance tests' org-scoped budget lists).

    Regression 2 (blank PDF, y-origin): body_top was computed as `band_h + 16`
    = 76, i.e. 76pt from the page BOTTOM, so the title/summary/table were drawn
    at the bottom margin — overlapping the footer and running below the page
    edge. PDF y grows upward, so body content must start just under the top
    band: every body draw must sit above the footer band and at least the
    report title must be in the upper page area (max y > 600).

    Regression 3 (blank PDF, structure): content streams must be wrapped as
    real stream objects (`<< /Length N >> stream ... endstream`). Without the
    wrapper a viewer treats the page as having no content at all — a completely
    blank white page — so `_pdf_streams_valid` asserts every /Contents target
    is a proper stream with a matching /Length.
    """
    _as_admin(client)
    study = "TNX-PDF-01"
    _track_study(study)
    _sync(client, SUBJECTS_SYNC, [_subject(study, "S-1", status="Enrolled", enrollmentDate="2026-06-01")])

    keys = [
        "enrollment-velocity",
        "deviation-summary",
        "visit-compliance",
        "eisf-completeness",
        "site-budget-spend",
    ]
    for key in keys:
        res = client.get(
            f"/api/reports/standard/{key}/export",
            params={"study": study, "format": "pdf"},
        )
        assert res.status_code == 200, f"{key}: {res.status_code} {res.text[:200]}"
        assert res.content[:5] == b"%PDF-", f"{key}: not a PDF"
        assert res.headers["content-type"] == "application/pdf"
        assert _pdf_streams_valid(res.content), (
            f"{key}: content streams are not wrapped stream objects "
            "(blank-PDF regression — viewer would render an empty page)"
        )

        draws = list(_pdf_text_draws(res.content))
        assert draws, f"{key}: PDF has no text draws"

        # Layout: body text must start near the TOP of the page (below the
        # blue band), not at the bottom edge. Wide reports switch to landscape
        # (842x595), so the threshold is relative to the page height parsed
        # from the MediaBox. Before the y-origin fix every draw was <= ~76pt
        # from the bottom and table rows fell below the page edge.
        media = re.search(rb"/MediaBox \[0 0 (\d+) (\d+)\]", res.content)
        page_h = float(media.group(2)) if media else 842.0
        max_body_y = max(y for y, _ in draws)
        assert max_body_y > page_h * 0.7, (
            f"{key}: report body is not drawn in the printable area "
            f"(max text y={max_body_y}, page height={page_h}, "
            f"expected >{page_h * 0.7:.0f}) — blank-PDF regression"
        )
        non_footer_below = [t for y, t in draws if y < 60 and "Page " not in t]
        assert not non_footer_below, f"{key}: body text overlaps the footer: {non_footer_below[:3]}"

        # Content: the report's own title + column headers are present.
        joined = " ".join(text for _, text in draws)
        expectation = _PDF_REPORT_EXPECTATIONS[key]
        assert expectation["label"].lower() in joined.lower(), f"{key}: missing report title"
        for header in expectation["headers"]:
            assert header.lower() in joined.lower(), f"{key}: missing column header {header!r}"


def test_pdf_export_builder_config_structural(client):
    """The Report Builder's POST /api/reports/export?format=pdf must pass the
    same structural checks as the standard reports — real stream objects,
    body drawn in the printable area, the requested title, the selected
    column headers, and the actual result rows (not a blank page).

    The builder POST goes through the same build_pdf() as the standard
    exports, so it shares the three regressions covered above: header-fit
    TypeError, bottom-edge y-origin (blank body), and unwrapped content
    streams (blank page). Without this test a future break in the POST path
    would only surface as "a .pdf file downloaded", not a verifiable one.
    """
    _as_admin(client)
    study = "TNX-PDF-02"
    _track_study(study)
    _sync(client, SUBJECTS_SYNC, [_subject(study, "S-1", status="Enrolled", enrollmentDate="2026-06-01")])

    config = {
        "source": "subjects",
        "columns": [
            "subjectId", "studyId", "status", "siteNo", "siteName",
            "initials", "screeningDate", "enrollmentDate", "currentVisit",
            "principalInvestigator",
        ],
        "filters": [],
        "aggregate": {"type": "none"},
        "limit": 500,
    }
    res = client.post("/api/reports/export", params={"format": "pdf"}, json={"format": "pdf", "title": "Builder Export Check", "config": config})
    assert res.status_code == 200, f"{res.status_code} {res.text[:200]}"
    assert res.content[:5] == b"%PDF-"
    assert res.headers["content-type"] == "application/pdf"
    assert "filename=" in res.headers["content-disposition"]
    assert _pdf_streams_valid(res.content), (
        "builder PDF: content streams are not wrapped stream objects "
        "(blank-PDF regression — viewer would render an empty page)"
    )

    draws = list(_pdf_text_draws(res.content))
    assert draws, "builder PDF has no text draws"

    # Layout (orientation-aware, same as the standard-report test).
    media = re.search(rb"/MediaBox \[0 0 (\d+) (\d+)\]", res.content)
    page_h = float(media.group(2)) if media else 842.0
    max_body_y = max(y for y, _ in draws)
    assert max_body_y > page_h * 0.7, (
        f"builder PDF: body not drawn in the printable area "
        f"(max text y={max_body_y}, page height={page_h}) — blank-PDF regression"
    )
    non_footer_below = [t for y, t in draws if y < 60 and "Page " not in t]
    assert not non_footer_below, f"builder PDF: body text overlaps the footer: {non_footer_below[:3]}"

    # Content: requested title, the selected columns' labels, and real rows.
    joined = " ".join(text for _, text in draws)
    assert "builder export check" in joined.lower(), "builder PDF missing requested title"
    for header in [
        "Subject ID", "Study", "Status", "Site No", "Site", "Initials",
        "Screening Date", "Enrollment Date", "Current Visit",
        "Principal Investigator",
    ]:
        assert header.lower() in joined.lower(), f"builder PDF missing column header {header!r}"
    assert "S-1" in joined, "builder PDF missing the report's actual data row (S-1)"
    assert "Source: Subjects" in joined, "builder PDF missing the report summary"


# ===========================================================================
# Templates (save / list / RBAC)
# ===========================================================================


def test_template_crud_and_rbac(client):
    sponsor = _seed_user("Sponsor", "Test Org")
    cro = _seed_user("CRO", "Test Org")
    staff = _seed_user("Site Staff", "Test Org")

    # CRO is view-only: cannot save a template.
    _login(client, cro)
    assert client.post(TEMPLATES, json={"name": "Cro tpl", "config": {"source": "subjects"}}).status_code == 403

    _login(client, sponsor)
    created = client.post(
        TEMPLATES,
        json={
            "name": "My enrollments",
            "config": {
                "source": "subjects",
                "columns": ["subjectId", "status"],
                "filters": [{"field": "status", "op": "eq", "value": "Enrolled"}],
                "aggregate": {"type": "none"},
            },
        },
    ).json()
    assert created["code"].startswith("RPT-")
    assert created["source"] == "subjects"

    listed = client.get(TEMPLATES).json()
    assert any(t["code"] == created["code"] for t in listed)

    # Another non-owner (Site Staff) may not edit someone else's template.
    _login(client, staff)
    res = client.put(TEMPLATES + f"/{created['code']}", json={"name": "Hijack", "config": {"source": "visits"}})
    assert res.status_code == 403

    # The owner can update; update is visible on read-back.
    _login(client, sponsor)
    updated = client.put(
        TEMPLATES + f"/{created['code']}",
        json={"name": "My enrollments v2", "config": {"source": "subjects", "columns": ["subjectId"]}},
    ).json()
    assert updated["name"] == "My enrollments v2"
    deleted = client.delete(TEMPLATES + f"/{created['code']}")
    assert deleted.status_code == 200
    assert client.get(TEMPLATES + f"/{created['code']}").status_code == 404


# ===========================================================================
# Finance: variance, invoices, payout approvals
# ===========================================================================


def test_finance_variance_and_summary(client):
    sponsor = _seed_user("Sponsor", "Test Org")
    cro = _seed_user("CRO", "Test Org")
    _login(client, sponsor)

    budget = client.post(
        "/api/finance/budgets",
        json={
            "name": "Site Alpha execution",
            "studyId": "TNX-FIN-01",
            "siteId": "SA-1",
            "siteName": "Site Alpha",
            "baselineAmount": 10000,
            "periodLabel": "Y1",
        },
    ).json()
    assert budget["code"].startswith("BGT-")

    payout_ok = client.post(
        "/api/finance/payouts",
        json={
            "budgetCode": budget["code"],
            "studyId": "TNX-FIN-01",
            "siteId": "SA-1",
            "reason": "Q1 grant payment",
            "amount": 4000,
        },
    ).json()
    client.post(
        "/api/finance/payouts",
        json={
            "budgetCode": budget["code"],
            "studyId": "TNX-FIN-01",
            "siteId": "SA-1",
            "reason": "Pending lab reimbursement",
            "amount": 2000,
        },
    ).json()
    assert payout_ok["status"] == "Pending"

    summary = client.get("/api/finance/summary").json()
    budget_row = next(row for row in summary["budgets"] if row["code"] == budget["code"])
    assert budget_row["baselineAmount"] == 10000.0
    assert budget_row["actualSpend"] == 0.0  # nothing approved/paid yet
    assert budget_row["committedPending"] == 6000.0

    # CRO can read the org summary but cannot approve payouts.
    _login(client, cro)
    assert client.get("/api/finance/summary").status_code == 200
    approve_res = client.post(f"/api/finance/payouts/{payout_ok['code']}/approve")
    assert approve_res.status_code == 403

    _login(client, sponsor)
    approved = client.post(f"/api/finance/payouts/{payout_ok['code']}/approve")
    assert approved.status_code == 200
    assert approved.json()["status"] == "Approved"
    assert approved.json()["decidedBy"] != ""

    summary = client.get("/api/finance/summary").json()
    budget_row = next(row for row in summary["budgets"] if row["code"] == budget["code"])
    assert budget_row["actualSpend"] == 4000.0
    assert budget_row["committedPending"] == 2000.0
    # explicit variance = actual spend - baseline
    assert budget_row["variance"] == -6000.0
    totals = summary["summary"]
    assert totals["totalBudgetBaseline"] == 10000.0
    assert totals["totalActualSpend"] == 4000.0
    assert totals["totalVariance"] == -6000.0
    assert totals["pendingPayoutApprovals"] == 1

    # approving twice is rejected
    assert client.post(f"/api/finance/payouts/{payout_ok['code']}/approve").status_code == 400


def test_invoice_workflow(client):
    _as_admin(client)
    created = client.post(
        "/api/finance/invoices",
        json={
            "studyId": "TNX-FIN-02",
            "siteId": "SA-1",
            "description": "Milestone invoice",
            "amount": 15000,
            "periodLabel": "Q2",
        },
    ).json()
    assert created["status"] == "Draft"
    issued = client.post(f"/api/finance/invoices/{created['code']}/issue").json()
    assert issued["status"] == "Issued"
    assert issued["issueDate"] is not None
    paid = client.post(f"/api/finance/invoices/{created['code']}/pay").json()
    assert paid["status"] == "Paid"
    # cannot pay twice / issue from Paid
    assert client.post(f"/api/finance/invoices/{created['code']}/pay").status_code == 400
    assert client.post(f"/api/finance/invoices/{created['code']}/issue").status_code == 400


def test_payout_workflow_roles(client):
    staff = _seed_user("Site Staff", "Test Org")
    cro = _seed_user("CRO", "Test Org")
    _login(client, staff)
    payout = client.post(
        "/api/finance/payouts",
        json={
            "studyId": "TNX-FIN-03",
            "siteId": "SA-1",
            "budgetCode": "",
            "reason": "Site requested reimbursement",
            "amount": 1200,
        },
    ).json()
    assert payout["status"] == "Pending"
    assert payout["requestedBy"] != ""
    # A Site Staff member may not approve; CRO may not either.
    assert client.post(f"/api/finance/payouts/{payout['code']}/approve").status_code == 403
    _login(client, cro)
    assert client.post(f"/api/finance/payouts/{payout['code']}/approve").status_code == 403
    _as_admin(client)
    assert client.post(f"/api/finance/payouts/{payout['code']}/approve").status_code == 200
    paid = client.post(f"/api/finance/payouts/{payout['code']}/pay")
    assert paid.status_code == 200 and paid.json()["status"] == "Paid"


# ===========================================================================
# Milestones (weighted completion %)
# ===========================================================================


def test_milestone_completion_percentage(client):
    sponsor = _seed_user("Sponsor", "Test Org")
    cro = _seed_user("CRO", "Test Org")
    _login(client, sponsor)
    study = "TNX-MS-01"
    for name, weight, status in [
        ("Site activation", 25, "Completed"),
        ("First subject enrolled", 25, "Completed"),
        ("Enrollment 75%", 25, "In Progress"),
        ("Close-out", 25, "Not Started"),
    ]:
        client.post(
            "/api/milestones/",
            json={
                "name": name,
                "studyId": study,
                "siteId": "SA-1",
                "category": "Contractual",
                "weight": weight,
                "status": status,
            },
        )
    data = client.get("/api/milestones/", params={"studyId": study}).json()
    assert len(data["milestones"]) == 4
    # (25+25)/100 completed -> 50% for the site
    site_row = next(
        row
        for row in data["completion"]["bySite"]
        if row["studyId"] == study and row["siteId"] == "SA-1"
    )
    assert site_row["completionPct"] == 50.0
    study_row = next(
        row for row in data["completion"]["byStudy"] if row["studyId"] == study
    )
    assert study_row["completionPct"] == 50.0

    # advancing an in-progress milestone updates the percentage
    code = next(
        row["code"]
        for row in data["milestones"]
        if row["status"] != "Completed"
    )
    updated = client.patch(
        f"/api/milestones/{code}/status",
        json={"status": "Completed"},
    )
    assert updated.status_code == 200
    data = client.get("/api/milestones/", params={"studyId": study}).json()
    site_row = next(
        row
        for row in data["completion"]["bySite"]
        if row["studyId"] == study and row["siteId"] == "SA-1"
    )
    assert site_row["completionPct"] == 75.0

    # CRO is read-only: cannot create milestones or move statuses.
    _login(client, cro)
    assert client.post("/api/milestones/", json={"name": "x", "studyId": study, "weight": 1}).status_code == 403
    assert client.patch(f"/api/milestones/{code}/status", json={"status": "Completed"}).status_code == 403


# ===========================================================================
# Org isolation
# ===========================================================================


def test_reporting_finance_org_isolation(client):
    _as_admin(client)
    org_b = _org("ReportOrgB")
    sponsor_b = _seed_user("Sponsor", "ReportOrgB")
    cro_a = _seed_user("CRO", "Test Org")

    budget_a = client.post(
        "/api/finance/budgets",
        json={"name": "Org A budget", "studyId": "ORG-A-ST", "siteId": "S-1", "baselineAmount": 5000},
    ).json()

    _login(client, sponsor_b)
    client.post(
        "/api/finance/budgets",
        json={"name": "Org B budget", "studyId": "ORG-B-ST", "siteId": "S-1", "baselineAmount": 9000},
    ).json()
    budgets_b = client.get("/api/finance/budgets").json()
    assert [b["studyId"] for b in budgets_b] == ["ORG-B-ST"]

    _login(client, cro_a)
    budgets_a = client.get("/api/finance/budgets").json()
    # Org A (Test Org) sees its own rows (incl. the budget created earlier in
    # this file's finance tests) — and never Org B's.
    assert {b["studyId"] for b in budgets_a} == {"ORG-A-ST", "TNX-FIN-01"}
    assert budget_a["code"] in {b["code"] for b in budgets_a}
    assert org_b is not None
