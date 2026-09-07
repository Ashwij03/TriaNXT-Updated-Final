import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBarChart2,
  FiDownload,
  FiEdit3,
  FiRefreshCw,
} from "react-icons/fi";

import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import KPICard from "../../components/dashboard/shared/KPICard";
import DataTable from "../../components/dashboard/shared/DataTable";
import { isApiEnabled, reportingApi } from "../../services/api";
import { getAccessibleStudies, getCurrentUser } from "../../services/roleService";
import ROLES from "../../constants/roles";

import "./reports.css";

const EXPORT_FORMATS = [
  { key: "csv", label: "CSV" },
  { key: "xlsx", label: "Excel" },
  { key: "pdf", label: "PDF" },
];

function ReportCenter() {
  const [reports, setReports] = useState<any[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyFilter, setStudyFilter] = useState("");

  const user = getCurrentUser();
  const isAdmin = user?.role === ROLES.ADMIN;
  const canRunAdvanced =
    isAdmin ||
    [ROLES.SPONSOR, ROLES.CRO, ROLES.PI, ROLES.SITE_STAFF].includes(user?.role);

  const studies = useMemo(() => getAccessibleStudies(user), [user]);
  const studyOptions = useMemo(
    () =>
      studies.map((study) => ({
        value: String(study?.code || study?.studyId || study?.id || ""),
        label:
          study?.name || study?.title || study?.protocolTitle || study?.code,
      })),
    [studies],
  );

  const params = useMemo(() => {
    const query: any = {};
    if (studyFilter) {
      query.study = studyFilter;
    }
    return query;
  }, [studyFilter]);

  const loadReports = useCallback(async () => {
    if (!isApiEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await reportingApi.listStandardReports();
      const rows = res?.reports || res || [];
      setReports(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load standard reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const runReport = useCallback(
    async (key: string) => {
      if (!isApiEnabled()) return;
      setRunning(true);
      setError(null);
      try {
        const res = await reportingApi.runStandardReport(key, params);
        setResult(res || null);
        setActiveKey(key);
      } catch (err: any) {
        setError(err?.message || `Failed to run "${key}".`);
      } finally {
        setRunning(false);
      }
    },
    [params],
  );

  const exportReport = useCallback(
    async (key: string, format: string) => {
      setError(null);
      try {
        await reportingApi.exportStandardReport(key, format, params);
      } catch (err: any) {
        setError(err?.message || `Failed to export ${format.toUpperCase()}.`);
      }
    },
    [params],
  );

  const columns = useMemo(() => {
    if (!result) return [];
    return (result.columns || []).map((column: any) => ({
      key: column.key,
      label: column.label,
      render: (value: any) => {
        if (value === null || value === undefined || value === "") return "—";
        if (typeof value === "number") {
          return Number.isInteger(value)
            ? String(value)
            : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
        return String(value);
      },
    }));
  }, [result]);

  if (!isApiEnabled()) {
    return (
      <DashboardLayout>
        <div className="rpt-page">
          <div className="rpt-empty-state">
            <FiBarChart2 size={28} />
            <p>
              The Report Center needs the backend API configured (
              <code>VITE_API_URL</code>). Start the FastAPI engine and relaunch
              the app in API mode — see SETUP.md §4/§5.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const activeReport = reports.find((report) => report.key === activeKey);

  return (
    <DashboardLayout>
      <div className="rpt-page">
        <div className="rpt-header">
          <div>
            <h1>Report Center</h1>
            <p className="rpt-subtitle">
              Pre-built operational reports — run them against live study data
              and export to CSV, Excel or PDF.
            </p>
          </div>
          <div className="rpt-header-actions">
            <select
              aria-label="Filter reports by study"
              value={studyFilter}
              onChange={(e) => setStudyFilter(e.target.value)}
            >
              <option value="">All studies</option>
              {studyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Link to="/reports/builder" className="rpt-btn">
              <FiEdit3 size={15} /> Report Builder
            </Link>
          </div>
        </div>

        {error && <div className="rpt-error-banner">{error}</div>}
        {!canRunAdvanced && (
          <div className="rpt-info-banner">
            Reports are scoped to your accessible studies and sites.
          </div>
        )}

        <div className="rpt-card-grid">
          {(reports.length ? reports : []).map((report) => (
            <div
              key={report.key}
              className={`rpt-card${activeKey === report.key ? " active" : ""}`}
            >
              <h3>{report.label}</h3>
              <p>{report.description}</p>
              <div className="rpt-card-footer">
                <button
                  type="button"
                  className="rpt-btn rpt-btn--sm"
                  onClick={() => runReport(report.key)}
                  disabled={running || loading}
                >
                  {running && activeKey === report.key ? (
                    "Running..."
                  ) : (
                    <>
                      <FiRefreshCw size={13} /> Run report
                    </>
                  )}
                </button>
                {result && activeKey === report.key && (
                  <div className="rpt-header-actions">
                    {EXPORT_FORMATS.map((format) => (
                      <button
                        key={format.key}
                        type="button"
                        className="rpt-btn rpt-btn--ghost rpt-btn--sm"
                        title={`Download as ${format.label}`}
                        onClick={() => exportReport(report.key, format.key)}
                      >
                        <FiDownload size={13} /> {format.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {loading && reports.length === 0 && (
          <p className="rpt-subtitle" style={{ marginTop: "1.5rem" }}>
            Loading standard reports...
          </p>
        )}

        {result && activeReport && (
          <>
            <h2 className="rpt-section-title">Results — {activeReport.label}</h2>
            {(result.summary || []).length > 0 && (
              <div className="rpt-summary-row">
                {result.summary.map((item: any, index: number) => (
                  <span key={index} className="rpt-summary-chip">
                    {item.label}: <strong>{String(item.value ?? "—")}</strong>
                  </span>
                ))}
              </div>
            )}

            <div className="rpt-header-actions" style={{ marginBottom: "1rem" }}>
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format.key}
                  type="button"
                  className="rpt-btn rpt-btn--sm"
                  onClick={() => exportReport(activeReport.key, format.key)}
                >
                  <FiDownload size={13} /> Download {format.label}
                </button>
              ))}
            </div>

            <DataTable
              title={result.title || activeReport.label}
              columns={columns}
              data={result.rows || []}
              pagination
              emptyMessage={
                running
                  ? "Running report..."
                  : "No rows match the current selection."
              }
            />
          </>
        )}

        {!result && !loading && (
          <div className="rpt-empty-state">
            <FiBarChart2 size={28} />
            <p>
              Choose one of the {reports.length || "five"} standard reports
              above to see live results.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ReportCenter;
