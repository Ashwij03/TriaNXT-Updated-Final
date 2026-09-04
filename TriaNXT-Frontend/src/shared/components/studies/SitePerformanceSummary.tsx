import { FiTrendingUp } from "react-icons/fi";

// Item 14 — Site Performance Summary.
// Both the table columns and their rows are fully dynamic: every column is
// derived from the actual keys/labels present in the records supplied by
// useStudyOverview (which itself pulls from the shared study/site/subject/
// visit data sources). No static/mock/hardcoded rows or columns are
// rendered here — if a field isn't present in the live data source, the
// corresponding column simply isn't shown.

// Site Number column must show only the actual Site Number per the shared
// site display ownership rules — never a site name or a fabricated fallback.
function pickSiteNumberOnly(site) {
  if (!site || typeof site !== "object") return "";
  return (
    site.siteNumber ||
    site.number ||
    site.siteNo ||
    site.site_number ||
    ""
  );
}

function formatEnrollment(site) {
  const enrolled = site?.enrolled ?? site?.subjectsEnrolled;
  const target = site?.enrollmentTarget ?? site?.targetSubjects;
  const hasEnrolled = enrolled != null && enrolled !== "";
  const hasTarget = target != null && target !== "" && Number(target) > 0;

  if (!hasEnrolled && !hasTarget) return "—";
  if (hasEnrolled && hasTarget) return `${Number(enrolled)}/${Number(target)}`;
  if (hasEnrolled) return `${Number(enrolled)}`;
  return `0/${Number(target)}`;
}

function formatPercent(value, fallback?) {
  if (value == null || value === "") {
    if (fallback == null || fallback === "") return "—";
    return String(fallback);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric}%`;
}

function formatPlain(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

// Column catalog — each entry knows how to pull its value out of a row
// and how to render it. A column is only surfaced in the table when at
// least one row in the live data source has a non-empty value for it, so
// the header layout follows whatever the current data actually contains.
const COLUMN_CATALOG = [
  {
    key: "siteNumber",
    label: "Site Number",
    always: true,
    hasValue: (row) => Boolean(pickSiteNumberOnly(row)),
    render: (row) => pickSiteNumberOnly(row) || "—"
  },
  {
    key: "enrollment",
    label: "Enrolled",
    hasValue: (row) => {
      const enrolled = row?.enrolled ?? row?.subjectsEnrolled;
      const target = row?.enrollmentTarget ?? row?.targetSubjects;
      return (
        (enrolled != null && enrolled !== "") ||
        (target != null && target !== "" && Number(target) > 0)
      );
    },
    render: (row) => formatEnrollment(row)
  },
  {
    key: "screeningRate",
    label: "Screening",
    hasValue: (row) => row?.screeningRate != null && row?.screeningRate !== "",
    render: (row) => formatPercent(row.screeningRate)
  },
  {
    key: "screenFailure",
    label: "Screen Failure",
    hasValue: (row) =>
      row?.screenFailure != null && row?.screenFailure !== "",
    render: (row) => formatPercent(row.screenFailure)
  },
  {
    key: "visitCompliance",
    label: "Compliance",
    hasValue: (row) =>
      (row?.visitCompliance != null && row?.visitCompliance !== "") ||
      (row?.compliance != null && row?.compliance !== ""),
    render: (row) => formatPercent(row.visitCompliance, row.compliance)
  },
  {
    key: "status",
    label: "Status",
    hasValue: (row) => Boolean(row?.status),
    render: (row) => formatPlain(row.status)
  }
];

function buildColumns(list) {
  return COLUMN_CATALOG.filter(
    (column) => column.always || list.some((row) => column.hasValue(row))
  );
}

function SitePerformanceSummary({ records }: any) {
  const list = Array.isArray(records) ? records : [];
  const columns = buildColumns(list);

  return (
    <div className="study-widget-card">
      <div className="study-widget-header">
        <FiTrendingUp />
        <h3>Site Performance Summary</h3>
      </div>
      {list.length === 0 ? (
        <p className="study-widget-empty">No site performance data for this study</p>
      ) : (
        <div className="study-table-wrap">
          <table className="ctms-standard-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((site, index) => {
                const siteNumber = pickSiteNumberOnly(site);
                return (
                  <tr
                    key={
                      site.siteId ||
                      siteNumber ||
                      site.siteName ||
                      index
                    }
                  >
                    {columns.map((column) => (
                      <td key={column.key}>{column.render(site)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SitePerformanceSummary;
