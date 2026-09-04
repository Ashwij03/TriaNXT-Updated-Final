import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import "../styles/Reports.css";
import "../styles/SponsorShared.css";
import KpiCard from "./KpiCard";
import RequestPermissionButton from "../../shared/components/RequestPermissionButton";
import { FiFileText, FiCheckCircle, FiClock, FiDownload } from "react-icons/fi";
import { getSponsorDocumentReportCards } from "../data/sponsorDocumentReportService";
import { getReportsForStudy } from "../../shared/services/reportService";
import { getCurrentUser, getAccessibleStudies } from "../../shared/services/roleService";

// Reads reports through reportService's own study-scoped, permission-aware
// getter rather than the old sponsorDataStore path. getReports()/saveReports()
// in sponsorDataStore read from getAdminReports() but wrote to a completely
// different, never-read storage key — so "generating" a report there
// silently vanished and nothing here ever reflected reports created
// elsewhere. getReportsForStudy() is the single shared source of truth
// (see reportService.js), and unioning it only across this user's
// accessible studies keeps another study's reports from ever leaking in.
function loadReportsForCurrentUser() {
  const user = getCurrentUser();
  const accessibleStudies = getAccessibleStudies(user);

  return {
    reports: accessibleStudies.flatMap((study) =>
      getReportsForStudy(study.code, user),
    ),
    studyNameByCode: accessibleStudies.reduce((map, study) => {
      map[String(study.code)] = study.name || study.code;
      return map;
    }, {}),
    studies: accessibleStudies,
  };
}

const Reports = () => {
  const navigate = useNavigate();
  const [{ reports, studyNameByCode, studies }, setReportState] = useState(() =>
    loadReportsForCurrentUser(),
  );
  const [statusFilter, setStatusFilter] = useState("All");
  const [studyCode, setStudyCode] = useState("");

  const documentReportCards = useMemo(
    () => getSponsorDocumentReportCards(),
    [],
  );

  const refresh = useCallback(() => {
    setReportState(loadReportsForCurrentUser());
  }, []);

  useEffect(() => {
    refresh();

    window.addEventListener("sponsor-data-updated", refresh);
    window.addEventListener("reports-updated", refresh);
    window.addEventListener("studies-updated", refresh);

    return () => {
      window.removeEventListener("sponsor-data-updated", refresh);
      window.removeEventListener("reports-updated", refresh);
      window.removeEventListener("studies-updated", refresh);
    };
  }, [refresh]);

  const kpis = {
    total: reports.length,
    ready: reports.filter((report) => report.status === "Generated").length,
    pending: reports.filter((report) => report.status === "Pending").length,
  };

  const filteredReports = reports.filter(
    (report) => statusFilter === "All" || report.status === statusFilter,
  );

  const reportTemplates = [
    {
      title: "Study Reports",
      description: "Study performance and milestone reports",
      type: "Study",
    },
    {
      title: "Enrollment Reports",
      description: "Enrollment progress across studies",
      type: "Enrollment",
    },
    {
      title: "Compliance Reports",
      description: "Regulatory and eTMF compliance reports",
      type: "Compliance",
    },
    {
      title: "Executive Reports",
      description: "Executive level KPIs and portfolio summary",
      type: "Executive",
    },
    {
      title: "Operational Reports",
      description: "Site, CRO and PI operational performance",
      type: "Operations",
    },
    {
      title: "Export Dashboard",
      description: "Download dashboard metrics and charts",
      type: "Export",
    },
  ];

  const openReport = (reportType) => {
    navigate("/report-details", { state: { reportType } });
  };

  return (
    <AppLayout>
      <div className="reports-page tnxt-compact">
        <div className="sponsor-page-header">
          <h1>Reports</h1>
          <p>Generate and access clinical trial reports and analytics.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard
            title="Total Reports"
            value={kpis.total}
            subtitle="Available reports"
            icon={<FiFileText size={24} />}
            iconBg="#eff6ff"
            iconColor="#2563eb"
            onClick={() => setStatusFilter("All")}
          />

          <KpiCard
            title="Ready"
            value={kpis.ready}
            subtitle="Ready for download"
            icon={<FiCheckCircle size={24} />}
            iconBg="#ecfdf5"
            iconColor="#16a34a"
            onClick={() => setStatusFilter("Generated")}
          />

          <KpiCard
            title="Pending"
            value={kpis.pending}
            subtitle="Being generated"
            icon={<FiClock size={24} />}
            iconBg="#fef3c7"
            iconColor="#d97706"
            onClick={() => setStatusFilter("Pending")}
          />

          <KpiCard
            title="Templates"
            value={reportTemplates.length + documentReportCards.length}
            subtitle="Report categories"
            icon={<FiDownload size={24} />}
            iconBg="#ede9fe"
            iconColor="#7c3aed"
          />
        </div>

        <div className="sponsor-toolbar">
          <select
            value={studyCode}
            onChange={(e) => setStudyCode(e.target.value)}
            aria-label="Select study for new report"
          >
            <option value="">Select study…</option>
            {studies.map((study) => (
              <option key={study.code} value={study.code}>
                {study.name || study.code}
              </option>
            ))}
          </select>
          {studyCode && (
            <RequestPermissionButton
              action="Generate Report"
              module="Reports"
              studyCode={studyCode}
              label="+ Generate Report"
              className="sponsor-btn-primary"
            />
          )}
        </div>

        <h2 className="reports-section-title">Sponsor Document Reports</h2>

        <div className="reports-grid">
          {documentReportCards.map((report) => (
            <div
              key={report.title}
              className="report-card report-card--compliance"
              onClick={() => openReport(report.type)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openReport(report.type);
                }
              }}
            >
              <h3>{report.title}</h3>
              <p>{report.description}</p>

              <button
                type="button"
                className="open-report-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  openReport(report.type);
                }}
              >
                Open Report
              </button>
            </div>
          ))}
        </div>

        <h2 className="reports-section-title">Standard Reports</h2>

        <div className="reports-grid">
          {reportTemplates.map((report) => (
            <div
              key={report.title}
              className="report-card"
              onClick={() => openReport(report.title)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  openReport(report.title);
                }
              }}
            >
              <h3>{report.title}</h3>
              <p>{report.description}</p>

              <button
                type="button"
                className="open-report-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  openReport(report.title);
                }}
              >
                Open Report
              </button>
            </div>
          ))}
        </div>

        <div className="sponsor-table-wrap" style={{ marginTop: "1.5rem" }}>
          <h2>Recent Reports</h2>

          <table className="sponsor-table ctms-standard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Study</th>
                <th>Created</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    No data available yet
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() =>
                      navigate("/report-details", { state: { report } })
                    }
                  >
                    <td>{report.id}</td>
                    <td>{report.name}</td>
                    <td>{report.reportType}</td>
                    <td>
                      {studyNameByCode[String(report.studyCode)] ||
                        report.studyCode}
                    </td>
                    <td>{report.createdAt}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          report.status === "Generated" ? "active" : "planning"
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="view-btn"
                        onClick={() =>
                          navigate("/report-details", { state: { report } })
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;