import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaFileAlt,
  FaCalendarAlt,
  FaBook,
  FaHourglassHalf,
  FaShieldAlt,
  FaDownload,
  FaEye,
} from "react-icons/fa";
import PIKpiCard from "./PIKpiCard";
import { downloadCsvReport } from "../../shared/utils/exportReport";
import {
  canManageReports,
  createReport,
  canEditReport,
  updateReport,
  getReportsForStudy,
} from "../../shared/services/reportService";
import { getCurrentUser, getAccessibleStudies } from "../../shared/services/roleService";

const REPORT_TYPE_OPTIONS = [
  "Enrollment",
  "Compliance",
  "Safety",
  "Study Progress",
  "Visit",
  "Regulatory",
];

function matchesSelectedStudy(study, selectedStudy) {
  if (!selectedStudy || selectedStudy === "All Studies") {
    return true;
  }

  const candidates = [study.code, study.id, study.studyId, study.name].map((value) =>
    String(value ?? "")
  );

  return candidates.includes(String(selectedStudy));
}

function PIReports({ selectedStudy = "All Studies" }: any) {
  const user = getCurrentUser();
  const canManage = canManageReports(user);

  const studies = useMemo(() => getAccessibleStudies(user), [user]);

  const targetStudies = useMemo(
    () => studies.filter((study) => matchesSelectedStudy(study, selectedStudy)),
    [studies, selectedStudy]
  );

  const [reports, setReports] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState("All");
  const [downloadMsg, setDownloadMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    reportType: REPORT_TYPE_OPTIONS[0],
    studyCode: "",
  });

  const refresh = useCallback(() => {
    const currentUser = getCurrentUser();
    const currentStudies = getAccessibleStudies(currentUser).filter((study) =>
      matchesSelectedStudy(study, selectedStudy)
    );

    setReports(
      currentStudies.flatMap((study) => getReportsForStudy(study.code, currentUser))
    );
  }, [selectedStudy]);

  useEffect(() => {
    refresh();

    window.addEventListener("reports-updated", refresh);
    window.addEventListener("sponsor-data-updated", refresh);
    window.addEventListener("studies-updated", refresh);

    return () => {
      window.removeEventListener("reports-updated", refresh);
      window.removeEventListener("sponsor-data-updated", refresh);
      window.removeEventListener("studies-updated", refresh);
    };
  }, [refresh]);

  const displayReports =
    typeFilter === "All"
      ? reports
      : reports.filter((report) => report.reportType === typeFilter);

  const generatedCount = reports.filter((report) => report.status === "Generated").length;
  const pendingCount = reports.filter((report) => report.status === "Pending").length;

  const dynamicKpis = {
    total: reports.length,
    generated: generatedCount,
    study: reports.filter((report) => report.reportType === "Study Progress").length,
    pending: pendingCount,
    compliance: reports.filter((report) => report.reportType === "Compliance").length,
    safety: reports.filter((report) => report.reportType === "Safety").length,
  };

  const handleOpenForm = () => {
    setForm({
      name: "",
      reportType: REPORT_TYPE_OPTIONS[0],
      studyCode: targetStudies[0]?.code || "",
    });
    setShowForm(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.studyCode) {
      return;
    }

    const created = createReport(
      {
        name: form.name.trim(),
        reportType: form.reportType,
        status: "Pending",
        studyCode: form.studyCode,
      },
      getCurrentUser()
    );

    if (created) {
      setShowForm(false);
      refresh();
    }
  };

  const handleDownload = (report) => {
    const rows = [
      ["Report Name", report.name],
      ["Type", report.reportType],
      ["Study", report.studyCode || "—"],
      ["Created", report.createdAt],
      ["Status", report.status],
      [],
      ["Field", "Value"],
      ["Report ID", report.id],
      ["Created By", report.createdBy || "—"],
    ];

    downloadCsvReport(
      `${report.name.replace(/\s+/g, "-")}-${Date.now()}.csv`,
      rows
    );
    setDownloadMsg(`Downloaded: ${report.name} (CSV)`);
    setTimeout(() => setDownloadMsg(""), 3000);
  };

  const handleMarkGenerated = (report) => {
    if (report.status === "Generated" || !canEditReport(report, getCurrentUser())) {
      return;
    }

    if (updateReport(report.id, { status: "Generated" }, getCurrentUser())) {
      refresh();
    }
  };

  return (
    <div className="pi-page-content tnxt-compact">
      <div className="dashboard-header">
        <div>
          <h2>Reports Dashboard</h2>
          <p className="pi-subtitle">
            Generate and manage study reports
            {selectedStudy !== "All Studies" && ` — ${selectedStudy}`}
          </p>
        </div>
        <div className="dashboard-actions">
          <select
            className="pi-filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {REPORT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {canManage && (
            <button type="button" className="export-btn" onClick={handleOpenForm}>
              Generate Report
            </button>
          )}
        </div>
      </div>

      {downloadMsg && <div className="pi-toast-info">{downloadMsg}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="pi-table-responsive" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", padding: "1rem" }}>
            <input
              type="text"
              placeholder="Report name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />

            <select
              value={form.reportType}
              onChange={(event) => setForm({ ...form, reportType: event.target.value })}
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={form.studyCode}
              onChange={(event) => setForm({ ...form, studyCode: event.target.value })}
              required
            >
              <option value="" disabled>
                Select study
              </option>
              {targetStudies.map((study) => (
                <option key={study.code} value={study.code}>
                  {study.name || study.code}
                </option>
              ))}
            </select>

            <button type="submit">Save</button>
            <button type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="pi-kpi-grid pi-kpi-grid-4">
        <PIKpiCard title="Total Reports" value={dynamicKpis.total} icon={FaFileAlt} color="blue" clickable onClick={() => setTypeFilter("All")} />
        <PIKpiCard title="Generated" value={dynamicKpis.generated} icon={FaCalendarAlt} color="green" clickable />
        <PIKpiCard title="Study Reports" value={dynamicKpis.study} icon={FaBook} color="purple" clickable onClick={() => setTypeFilter("Study Progress")} />
        <PIKpiCard title="Pending Reports" value={dynamicKpis.pending} icon={FaHourglassHalf} color="orange" clickable onClick={() => setTypeFilter("All")} />
        <PIKpiCard title="Compliance Reports" value={dynamicKpis.compliance} icon={FaShieldAlt} color="teal" clickable onClick={() => setTypeFilter("Compliance")} />
        <PIKpiCard title="Safety Reports" value={dynamicKpis.safety} icon={FaFileAlt} color="red" clickable onClick={() => setTypeFilter("Safety")} />
      </div>

      <div className="table-container">
        <div className="section-header">
          <h2>Report List</h2>
          <button type="button" className="view-all-btn" onClick={() => setTypeFilter("All")}>View All</button>
        </div>
        <div className="pi-table-responsive">
          <table className="pi-table ctms-standard-table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Type</th>
                <th>Study</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayReports.map((report) => (
                <tr key={report.id} className="pi-table-clickable">
                  <td>{report.name}</td>
                  <td>{report.reportType}</td>
                  <td>{report.studyCode || "—"}</td>
                  <td>{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <span className={report.status === "Generated" ? "status-success" : "status-danger"}>
                      {report.status}
                    </span>
                  </td>
                  <td>
                    {canEditReport(report, user) && report.status !== "Generated" && (
                      <button type="button" className="view-all-btn pi-btn-icon" onClick={() => handleMarkGenerated(report)} title="Mark Generated">
                        <FaEye /> View
                      </button>
                    )}
                    <button type="button" className="export-btn pi-btn-sm pi-btn-icon" onClick={() => handleDownload(report)} title="Download">
                      <FaDownload /> Download
                    </button>
                  </td>
                </tr>
              ))}
              {displayReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="pi-table-empty">
                    No reports yet for this selection
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PIReports;