# tria_engine/apps/reporting/report_generator.py
#
# Export generator for the Report Center / Report Builder: clean CSV, styled
# XLSX and styled PDF from a common in-memory payload.
#
# Dependency policy: the engine's requirements files intentionally keep the
# base stack small, so the generators use only the Python standard library
# (csv, zipfile + hand-written spreadsheet XML, and a minimal hand-rolled
# PDF writer) — no openpyxl / reportlab install is required.
#
# Every export carries the same envelope, required by the product spec:
#   * a company header line,
#   * the report title,
#   * a date stamp ("Generated ..."),
#   * summary statistics block,
#   * the tabular data.

from __future__ import annotations

import csv
import io
import re
import zipfile
from datetime import datetime, timezone
from xml.sax.saxutils import escape

COMPANY_NAME = "TriaNXT CTMS"
SUBTITLE = "Clinical Trial Management System"


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return slug or "report"


def _now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _today_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value)


def _cell_value(value):
    """JSON-ish value for spreadsheet cells; unambiguous numbers become
    numeric cells, everything else stays text."""
    if value is None or value == "":
        return ""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, (list, dict)):
        return str(value)
    text = str(value).strip()
    if re.fullmatch(r"-?\d+(\.\d+)?", text):
        try:
            return float(text) if "." in text else int(text)
        except ValueError:
            pass
    return text


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------


def build_csv(payload: dict, *, title: str = "", columns=None, rows=None, summary=None) -> bytes:
    columns = columns if columns is not None else payload.get("columns", [])
    rows = rows if rows is not None else payload.get("rows", [])
    summary = summary if summary is not None else payload.get("summary", [])
    title = title or payload.get("title") or "Report"

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([COMPANY_NAME, SUBTITLE])
    writer.writerow([title])
    writer.writerow([f"Generated: {_now_stamp()}"])
    writer.writerow([])
    if summary:
        writer.writerow(["Summary", "Value"])
        for item in summary:
            writer.writerow([item.get("label", ""), item.get("value", "")])
        writer.writerow([])
    headers = [c.get("label") if isinstance(c, dict) else str(c) for c in columns]
    writer.writerow(headers)
    for row in rows:
        writer.writerow(
            [
                _cell_text(row.get(c.get("key") if isinstance(c, dict) else c))
                for c in columns
            ]
        )
    return buffer.getvalue().encode("utf-8")


# ---------------------------------------------------------------------------
# XLSX (minimal OOXML spreadsheet, styled via xl/styles.xml)
# ---------------------------------------------------------------------------


def _xlsx_col_ref(col_index: int) -> str:
    letters = ""
    index = col_index + 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def _xlsx_cell(col_index: int, row_index: int, value, style: int) -> str:
    reference = f"{_xlsx_col_ref(col_index)}{row_index}"
    text = _cell_value(value)
    if isinstance(text, bool):
        return f'<c r="{reference}" t="b" s="{style}"><v>{"1" if text else "0"}</v></c>'
    if isinstance(text, (int, float)):
        return f'<c r="{reference}" s="{style}"><v>{text}</v></c>'
    return (
        f'<c r="{reference}" t="inlineStr" s="{style}">'
        f"<is><t xml:space=\"preserve\">{escape(str(text))}</t></is></c>"
    )


def _xlsx_row(values, style: int, row_index: int) -> str:
    cells = "".join(
        _xlsx_cell(idx, row_index, value, style) for idx, (_, value) in enumerate(values)
    )
    return f'<row r="{row_index}">{cells}</row>'


def build_xlsx(payload: dict, *, title: str = "", columns=None, rows=None, summary=None) -> bytes:
    columns = columns if columns is not None else payload.get("columns", [])
    rows = rows if rows is not None else payload.get("rows", [])
    summary = summary if summary is not None else payload.get("summary", [])
    title = title or payload.get("title") or "Report"
    generated = payload.get("generatedAt") or _now_stamp()

    def col(key):
        return (key.get("key") if isinstance(key, dict) else key)

    def col_label(key):
        return key.get("label") if isinstance(key, dict) else str(key)

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<fonts count=\"4\">"
        '<font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="13"/><color rgb="FF1F3864"/><name val="Calibri"/></font>'
        '<font><sz val="10"/><color rgb="FF595959"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
        "</fonts>"
        "<fills count=\"3\">"
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF2E5E9E"/><bgColor indexed="64"/></patternFill></fill>'
        "</fills>"
        "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>"
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="5">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        "</cellXfs>"
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )

    row_index = 1
    sheet_rows: list[str] = []
    first_key = col(columns[0]) if columns else "report"
    sheet_rows.append(_xlsx_row([(first_key, COMPANY_NAME)], 1, row_index))
    row_index += 1
    sheet_rows.append(_xlsx_row([(first_key, SUBTITLE)], 1, row_index))
    row_index += 1
    sheet_rows.append(_xlsx_row([(first_key, title)], 2, row_index))
    row_index += 1
    sheet_rows.append(_xlsx_row([(first_key, f"Generated: {generated}")], 2, row_index))
    row_index += 1
    if summary:
        row_index += 1
        sheet_rows.append(_xlsx_row([("summary", "Summary"), ("value", "Value")], 3, row_index))
        row_index += 1
        for item in summary:
            sheet_rows.append(
                _xlsx_row(
                    [("label", item.get("label", "")), ("value", item.get("value", ""))],
                    4,
                    row_index,
                )
            )
            row_index += 1
        row_index += 1
    sheet_rows.append(
        _xlsx_row([(col(c), col_label(c)) for c in columns], 3, row_index)
    )
    row_index += 1
    for row in rows:
        sheet_rows.append(
            _xlsx_row(
                [(col(c), row.get(col(c))) for c in columns],
                0,
                row_index,
            )
        )
        row_index += 1

    widths_xml = "<cols>"
    for idx, column in enumerate(columns, start=1):
        label_len = len(col_label(column)) if columns else 12
        width = max(10, min(42, 10 + int(label_len * 1.1)))
        widths_xml += f'<col min="{idx}" max="{idx}" width="{width}" customWidth="1"/>'
    widths_xml += "</cols>"

    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"{widths_xml}<sheetData>{''.join(sheet_rows)}</sheetData></worksheet>"
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("xl/workbook.xml", workbook)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        archive.writestr("xl/styles.xml", styles)
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# PDF (minimal styled multi-page PDF — Helvetica, blue band + header row)
# ---------------------------------------------------------------------------


def _pdf_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", "")
        .replace("\n", " ")
    )


def build_pdf(payload: dict, *, title: str = "", columns=None, rows=None, summary=None) -> bytes:
    columns = columns if columns is not None else payload.get("columns", [])
    rows = rows if rows is not None else payload.get("rows", [])
    summary = summary if summary is not None else payload.get("summary", [])
    title = title or payload.get("title") or "Report"
    generated = payload.get("generatedAt") or _now_stamp()

    # ---- layout metrics (A4, points; PDF y grows UP from the page bottom,
    # so the body starts just BELOW the top band) ----
    margin = 42.0
    band_h = 60.0
    line_h = 13.0
    footer_h = 26.0

    headers = [c.get("label") if isinstance(c, dict) else str(c) for c in columns]
    keys = [c.get("key") if isinstance(c, dict) else str(c) for c in columns]
    n_cols = max(1, len(keys))

    # Pick portrait (595x842) unless the widest header/cell cannot fit — wide
    # tables (e.g. Site Budget Spend's 9 columns) switch to landscape so no
    # text is silently cut off.
    widest_cell = max(
        [len(h) for h in headers]
        + [len(_cell_text(row.get(k))) for row in rows for k in keys],
        default=0,
    )
    portrait_w = 595.0
    if n_cols * 5.2 * max(widest_cell, 1) > portrait_w - 2 * margin:
        page_w, page_h = 842.0, 595.0
    else:
        page_w, page_h = portrait_w, 842.0

    body_top = page_h - band_h - 16.0  # y from bottom: just under the top band
    usable_h = body_top - footer_h - line_h
    usable_w = page_w - 2 * margin
    col_widths = [usable_w / n_cols] * n_cols
    for idx, header in enumerate(headers):
        budget = col_widths[idx] / 5.2
        if len(header) > budget:
            # Widen the column so the header fits — `len(header)` (char count),
            # not the string itself. (header * 5.2 raised a TypeError for
            # reports with many/narrow columns, e.g. Site Budget Spend.)
            col_widths[idx] = min(len(header) * 5.2, col_widths[idx] * 2.0)

    def truncate(text: str, col_idx: int) -> str:
        # +1 char: 9pt Helvetica averages ~4.8pt/char, so 5.2 is a conservative
        # estimate — one extra char keeps full words like long site names.
        budget = max(4, int(col_widths[col_idx] / 5.2) + 1)
        text = str(text).replace("\n", " ")
        # ASCII marker only — content streams are latin-1 encoded, so a real
        # ellipsis would be replaced with '?' when the stream is written.
        return text if len(text) <= budget else text[: budget - 1] + "~"

    # ---- assemble a flat list of (kind, text, size, bold, color) ----
    flow: list[tuple] = []
    flow.append(("text", title, 14.0, True, (0.09, 0.13, 0.30)))
    flow.append(("text", f"Generated: {generated}", 8.5, False, (0.42, 0.42, 0.42)))
    flow.append(("gap", "", 6.0, False, None))
    if summary:
        flow.append(("text", "Summary", 11.0, True, (0.12, 0.16, 0.36)))
        for item in summary:
            label = str(item.get("label", ""))
            value = str(item.get("value", ""))
            flow.append(("text", f"{label}: {value}", 9.0, False, (0.2, 0.2, 0.2)))
        flow.append(("gap", "", 6.0, False, None))
    header_cells = [
        truncate(header, idx) for idx, header in enumerate(headers)
    ]
    flow.append(("table_header", "   ".join(header_cells), None, None, None))
    for row in rows:
        cells = [
            truncate(_cell_text(row.get(key)), idx)
            for idx, key in enumerate(keys)
        ]
        flow.append(("table_row", "   ".join(cells), None, None, None))

    # ---- paginate: draw up to `max_lines` per page body ----
    # Estimate rows per page from average line height.
    max_lines_per_page = max(8, int(usable_h // (line_h + 2)))

    pages: list[list[str]] = []
    current: list[str] = []
    count = 0
    in_table = False
    table_header_item = None

    def flush_page():
        nonlocal current, count
        if current:
            pages.append(current)
        current = []
        count = 0

    for item in flow:
        kind = item[0]
        if kind == "gap":
            if current:
                current.append(("gap", ""))
                count += 1
            continue
        if kind == "table_header":
            table_header_item = item
            # table headers start on a fresh page unless room for header+3 rows
            if count > max_lines_per_page - 4 or count >= max_lines_per_page:
                flush_page()
            current.append(item)
            count += 1
            in_table = True
            continue
        if kind in ("text", "table_row"):
            if count >= max_lines_per_page:
                flush_page()
                # repeat the column header at the top of a continuation page
                if in_table and table_header_item is not None:
                    current.append(table_header_item)
                    count += 1
            current.append(item)
            count += 1
            continue
        current.append(item)
        count += 1  # pragma: no cover - defensive
    flush_page()
    if not pages:
        pages = [[]]

    # ---- PDF object model ----
    # 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold,
    # then per page: page dict (5 + 2*i), content stream (6 + 2*i).
    n_pages = len(pages)
    n_objects = 4 + 2 * n_pages

    def obj_id(page_index: int, kind: str) -> int:
        base = 5 + 2 * page_index
        return base if kind == "page" else base + 1

    def page_dict(page_index: int) -> str:
        content_ref = obj_id(page_index, "content")
        return (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w:.0f} {page_h:.0f}] "
            "/Resources << /Font << /FN 3 0 R /FB 4 0 R >> >> "
            f"/Contents {content_ref} 0 R >>"
        )

    def content_stream(page_index: int) -> str:
        ops: list[str] = []
        # company band on top of the page
        ops.append(f"0.18 0.36 0.62 rg 0 {page_h - band_h:.1f} {page_w:.1f} {band_h:.1f} re f")
        ops.append("1 1 1 rg")
        ops.append(f"BT /FB 15 Tf 1 0 0 1 42 {page_h - 36:.1f} Tm ({_pdf_escape(COMPANY_NAME)}) Tj ET")
        ops.append(f"BT /FN 9 Tf 0.88 0.92 0.98 rg 1 0 0 1 42 {page_h - 51:.1f} Tm ({_pdf_escape(SUBTITLE)}) Tj ET")
        y = body_top
        for item in pages[page_index]:
            kind = item[0]
            if kind == "gap":
                y -= 8
                continue
            if kind == "text":
                _, text, size, bold, color = item
                r, g, b = color
                font = "FB" if bold else "FN"
                ops.append(
                    f"BT /{font} {size:.1f} Tf {r:.3f} {g:.3f} {b:.3f} rg "
                    f"1 0 0 1 42 {y:.1f} Tm ({_pdf_escape(text)}) Tj ET"
                )
                y -= size + 4.5
                continue
            if kind == "table_header":
                ops.append("0.18 0.36 0.62 rg")
                ops.append(f"42 {y - 2:.1f} {usable_w:.1f} 13 re f")
                ops.append("1 1 1 rg")
                ops.append(
                    f"BT /FB 9 Tf 1 0 0 1 44 {y:.1f} Tm ({_pdf_escape(item[1])}) Tj ET"
                )
                y -= 17
                continue
            if kind == "table_row":
                ops.append(f"BT /FN 9 Tf 0.15 0.15 0.15 rg 1 0 0 1 44 {y:.1f} Tm ({_pdf_escape(item[1])}) Tj ET")
                y -= 13.5
        # footer
        ops.append(
            f"BT /FN 8 Tf 0.5 0.5 0.5 rg 1 0 0 1 42 18 Tm "
            f"({_pdf_escape(title)} - Page {page_index + 1} of {n_pages}) Tj ET"
        )
        return "\n".join(ops)

    buffer = io.BytesIO()
    buffer.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: dict[int, int] = {}

    def write_obj(obj_id: int, body: str, *, stream: bool = False) -> None:
        offsets[obj_id] = buffer.tell()
        # Content streams are latin-1 by default; anything outside the
        # WinAnsi range (em-dashes, bullets, non-English text) is replaced
        # so one odd cell can never break a whole export.
        if stream:
            data = body.encode("latin-1", errors="replace")
            # A page's /Contents must be a *stream* object. Without the
            # stream/endstream wrapper and /Length, viewers treat the page
            # as having no content at all (a blank white page).
            buffer.write(
                f"{obj_id} 0 obj\n<< /Length {len(data)} >>\nstream\n".encode("latin-1")
            )
            buffer.write(data)
            buffer.write(b"\nendstream\nendobj\n")
        else:
            buffer.write(
                f"{obj_id} 0 obj\n{body}\nendobj\n".encode("latin-1", errors="replace")
            )

    write_obj(1, "<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{obj_id(i, 'page')} 0 R" for i in range(n_pages))
    write_obj(2, f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>")
    write_obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    write_obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    for page_index in range(n_pages):
        write_obj(obj_id(page_index, "page"), page_dict(page_index))
        write_obj(
            obj_id(page_index, "content"), content_stream(page_index), stream=True
        )

    xref_pos = buffer.tell()
    buffer.write(f"xref\n0 {n_objects + 1}\n".encode("latin-1", errors="replace"))
    buffer.write(b"0000000000 65535 f \n")
    for obj_id in range(1, n_objects + 1):
        buffer.write(f"{offsets.get(obj_id, 0):010d} 00000 n \n".encode("latin-1", errors="replace"))
    buffer.write(
        f"trailer\n<< /Size {n_objects + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("latin-1", errors="replace")
    )
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Public API: render a report payload into bytes for the requested format
# ---------------------------------------------------------------------------

FORMATS = {"csv": "csv", "xlsx": "xlsx", "excel": "xlsx", "pdf": "pdf"}

MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}

FILE_EXTENSIONS = {"csv": "csv", "xlsx": "xlsx", "pdf": "pdf"}


def render_export(payload: dict, fmt: str) -> tuple[bytes, str, str]:
    """Return (bytes, filename, media_type) for the requested format.

    `payload` is a ReportResult dict: {title, columns, rows, summary,
    generatedAt}. Accepts xlsx/excel/csv/pdf (case-insensitive).
    """
    key = FORMATS.get(str(fmt or "").strip().lower(), "csv")
    if key == "csv":
        body = build_csv(payload)
    elif key == "xlsx":
        body = build_xlsx(payload)
    else:
        body = build_pdf(payload)
    filename = f"{_slugify(payload.get('title') or 'report')}-{_today_stamp()}.{FILE_EXTENSIONS[key]}"
    return body, filename, MEDIA_TYPES[key]
