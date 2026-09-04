import React, { useCallback, useEffect, useState } from "react";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import CROStatusBadge from "./CROStatusBadge";
import EmptyState from "./EmptyState";
import RequestPermissionButton from "../../shared/components/RequestPermissionButton";
import { downloadCsvReport } from "../../shared/utils/exportReport";
import { getCurrentUser, getAccessibleStudies } from "../../shared/services/roleService";
import { getReportsForStudy } from "../../shared/services/reportService";

// Reads reports through reportService's own study-scoped, permission-aware
// getter rather than a raw shared array. getReportsForStudy() already
// enforces per-study visibility and returns [] for studies the current
// user can't see, so unioning across only the user's accessible studies
// can never leak another study's reports into this list.
function loadReportsForCurrentUser() {
  const user = getCurrentUser();
  const accessibleStudies = getAccessibleStudies(user);

  return accessibleStudies.flatMap((study) =>
    getReportsForStudy(study.code, user),
  );
}

function CROReports() {
  const { studies, showModal } = useCROData();
  const [searchTerm, setSearchTerm] = useState("");
  const [reports, setReports] = useState(() => loadReportsForCurrentUser());

  const refreshReports = useCallback(() => {
    setReports(loadReportsForCurrentUser());
  }, []);

  useEffect(() => {
    refreshReports();

    window.addEventListener("reports-updated", refreshReports);
    window.addEventListener("sponsor-data-updated", refreshReports);
    window.addEventListener("studies-updated", refreshReports);

    return () => {
      window.removeEventListener("reports-updated", refreshReports);
      window.removeEventListener("sponsor-data-updated", refreshReports);
      window.removeEventListener("studies-updated", refreshReports);
    };
  }, [refreshReports]);

  const studyNameByCode = studies.reduce((map, study) => {
    map[String(study.code)] = study.name || study.code;
    return map;
  }, {});

  const filteredReports = reports.filter((report) =>
    String(report.name || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleViewReport = (report) => {
    showModal({
      title: "Report Details",
      message: `ID: ${report.id}\nName: ${report.name}\nType: ${report.reportType}\nStudy: ${
        studyNameByCode[String(report.studyCode)] || report.studyCode
      }\nStatus: ${report.status}`,
    });
  };

  const handleDownloadReport = (report) => {
    const rows = [
      ["Report ID", report.id],
      ["Report Name", report.name],
      ["Type", report.reportType],
      ["Study", studyNameByCode[String(report.studyCode)] || report.studyCode],
      ["Created On", report.createdAt],
      ["Status", report.status],
    ];

    downloadCsvReport(
      `${report.name.replace(/\s+/g, "-")}-${Date.now()}.csv`,
      rows,
    );
  };

  return (
    <CROLayout>
      <h1 style={{ marginBottom: "1.5625rem" }}>Reports</h1>

      <div className="cro-summary-cards">
        <div className="dashboard-card">
          <h3>Total Reports</h3>
          <h1>{reports.length}</h1>
        </div>
        <div className="dashboard-card">
          <h3>Generated</h3>
          <h1>{reports.filter((r) => r.status === "Generated").length}</h1>
        </div>
        <div className="dashboard-card">
          <h3>Pending</h3>
          <h1>{reports.filter((r) => r.status === "Pending").length}</h1>
        </div>
        <div className="dashboard-card">
          <h3>This Month</h3>
          <h1>{reports.length}</h1>
        </div>
      </div>

      <div className="cro-panel">
        <div className="cro-panel-header">
          <input
            type="text"
            placeholder="Search Report..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cro-input"
          />
          <RequestPermissionButton
            action="Create Report"
            module="Reports"
            label="+ Request Report"
            className="cro-btn-primary-inline request-permission-btn"
          />
        </div>

        {filteredReports.length === 0 ? (
          <EmptyState title="No Reports Found" />
        ) : (
          <div className="cro-table-wrap tnxt-compact">
            <table className="cro-data-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Report Name</th>
                  <th>Type</th>
                  <th>Study</th>
                  <th>Created On</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.id}</td>
                    <td>{report.name}</td>
                    <td>{report.reportType}</td>
                    <td>{studyNameByCode[String(report.studyCode)] || report.studyCode}</td>
                    <td>{report.createdAt}</td>
                    <td>
                      <CROStatusBadge status={report.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cro-btn-sm"
                        onClick={() => handleViewReport(report)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="cro-btn-sm"
                        onClick={() => handleDownloadReport(report)}
                        style={{ marginLeft: "0.5rem" }}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CROLayout>
  );
}

export default CROReports;