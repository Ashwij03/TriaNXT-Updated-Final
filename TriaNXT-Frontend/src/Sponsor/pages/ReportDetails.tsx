import React, { useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import EnterpriseModal from "./EnterpriseModal";
import { downloadCsvReport } from "../../shared/utils/exportReport";
import {
  DOCUMENT_REPORTS_EVENT,
  getComplianceAnalytics,
  getDocumentCompletionReport,
  getDocumentStatusSummary,
  getExpiredDocumentsReport,
  getMissingDocumentsReport,
  getMissingMetadataReport,
  getPendingReviewReport,
  getReportFilterOptions,
  getReportSubscriptions,
  saveReportSubscription
} from "../data/sponsorDocumentReportService";
import "../styles/ReportDetails.css";

const COMPLIANCE_REPORTS = new Set<any>([
  "Missing Metadata Report",
  "Missing Documents Report",
  "Expired Documents Report",
  "Pending Review Report",
  "Document Completion Report",
  "Document Status Summary",
  "Compliance Analytics Chart"
]);

const CHART_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

const ReportDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reportType = location.state?.reportType || "Study Reports";
  const isComplianceReport = COMPLIANCE_REPORTS.has(reportType);

  const filterOptions = useMemo(() => getReportFilterOptions(), []);
  const [filters, setFilters] = useState({
    study: "All",
    site: "All",
    folder: "All",
    status: "All"
  });
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState(() => {
    const existing = getReportSubscriptions().find(
      (item) => item.reportType === reportType
    );

    return (
      existing || {
        id: "",
        reportType,
        study: "All",
        site: "All",
        folder: "All",
        status: "All",
        frequency: "Weekly",
        recipients: "sponsor@trianxt.com",
        enabled: true
      }
    );
  });

  const complianceRows = useMemo(() => {
    if (!isComplianceReport) {
      return [];
    }

    if (reportType === "Missing Metadata Report") {
      return getMissingMetadataReport(filters);
    }

    if (reportType === "Missing Documents Report") {
      return getMissingDocumentsReport(filters);
    }

    if (reportType === "Expired Documents Report") {
      return getExpiredDocumentsReport(filters);
    }

    if (reportType === "Pending Review Report") {
      return getPendingReviewReport(filters);
    }

    if (reportType === "Document Completion Report") {
      return getDocumentCompletionReport(filters);
    }

    return [];
  }, [filters, isComplianceReport, reportType]);

  const statusSummary = useMemo(
    () => (isComplianceReport ? getDocumentStatusSummary(filters) : []),
    [filters, isComplianceReport]
  );

  const complianceAnalytics = useMemo(
    () => (isComplianceReport ? getComplianceAnalytics(filters) : []),
    [filters, isComplianceReport]
  );

  let reportData = [];

  if (reportType === "Study Reports") {
    reportData = [
      { name: "COVID-19", status: "On Track", value: "2200" },
      { name: "Diabetes", status: "Delayed", value: "900" }
    ];
  } else if (reportType === "Enrollment Reports") {
    reportData = [
      { name: "Apollo Site", status: "83%", value: "250" },
      { name: "AIG Site", status: "60%", value: "180" }
    ];
  } else if (reportType === "Compliance Reports") {
    reportData = [
      { name: "eTMF", status: "Completed", value: "98%" },
      { name: "Regulatory", status: "Pending", value: "90%" }
    ];
  } else if (reportType === "Executive Reports") {
    reportData = [{ name: "Portfolio", status: "24 Studies", value: "18 Active" }];
  } else if (reportType === "Operational Reports") {
    reportData = [{ name: "Sites", status: "156", value: "142 Active" }];
  } else if (!isComplianceReport) {
    reportData = [{ name: "Dashboard Export", status: "Ready", value: "PDF" }];
  }

  const exportComplianceCsv = () => {
    const rows = [
      [reportType],
      ["Study", filters.study],
      ["Site", filters.site],
      ["Folder", filters.folder],
      ["Status", filters.status],
      [],
      ["Document", "Study", "Site", "Folder", "Status", "Owner", "Expiry"]
    ];

    complianceRows.forEach((row) => {
      rows.push([
        row.name,
        row.study,
        row.site,
        row.folder,
        row.status,
        row.owner || "—",
        row.expiryDate || "—"
      ]);
    });

    downloadCsvReport(`${reportType.replace(/\s+/g, "-")}.csv`, rows);
  };

  const handleSaveSubscription = () => {
    saveReportSubscription({
      ...subscriptionForm,
      reportType,
      study: filters.study,
      site: filters.site,
      folder: filters.folder,
      status: filters.status
    });
    window.dispatchEvent(new CustomEvent(DOCUMENT_REPORTS_EVENT));
    setShowSubscriptionModal(false);
  };

  const exportData = () => {
    if (isComplianceReport) {
      exportComplianceCsv();
      return;
    }

    const csvData = `
Study,Enrollment,Compliance
TRIA-001,2200,96%
COVID-19,2200,On Track
Diabetes,900,Delayed
`;

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "StudyReport.csv";
    link.click();
  };

  return (
    <AppLayout>
      <div className="report-details-page tnxt-compact">
        <div className="page-header">
          <h1 className="report-title">{reportType}</h1>
        </div>

        {isComplianceReport && (
          <div className="details-card report-filter-card">
            <h2>Report Filters</h2>
            <div className="report-filter-grid">
              <label>
                Study
                <select
                  value={filters.study}
                  onChange={(event) =>
                    setFilters({ ...filters, study: event.target.value })
                  }
                >
                  {filterOptions.studies.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Site
                <select
                  value={filters.site}
                  onChange={(event) =>
                    setFilters({ ...filters, site: event.target.value })
                  }
                >
                  {filterOptions.sites.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Folder
                <select
                  value={filters.folder}
                  onChange={(event) =>
                    setFilters({ ...filters, folder: event.target.value })
                  }
                >
                  {filterOptions.folders.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters({ ...filters, status: event.target.value })
                  }
                >
                  {filterOptions.statuses.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        <div className="kpi-grid">
          <div className="kpi-card">
            <h3>Total Reports</h3>
            <h2>{isComplianceReport ? complianceRows.length : 24}</h2>
          </div>
          <div className="kpi-card">
            <h3>Generated Today</h3>
            <h2>{isComplianceReport ? complianceRows.length : 8}</h2>
          </div>
          <div className="kpi-card">
            <h3>Exports</h3>
            <h2>{isComplianceReport ? 1 : 15}</h2>
          </div>
          <div className="kpi-card">
            <h3>Pending</h3>
            <h2>{isComplianceReport ? 0 : 3}</h2>
          </div>
        </div>

        {isComplianceReport &&
          (reportType === "Document Status Summary" ||
            reportType === "Compliance Analytics Chart") && (
            <div className="details-card">
              <h2>
                {reportType === "Compliance Analytics Chart"
                  ? "Compliance Analytics Chart"
                  : "Document Status Summary"}
              </h2>
              <div className="report-chart-grid">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusSummary}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label
                    >
                      {statusSummary.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>

                {reportType === "Compliance Analytics Chart" && (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={complianceAnalytics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

        {isComplianceReport &&
          reportType !== "Document Status Summary" &&
          reportType !== "Compliance Analytics Chart" && (
            <div className="report-table-section">
              <h2>{reportType}</h2>
              <table className="report-table ctms-standard-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Study</th>
                    <th>Site</th>
                    <th>Folder</th>
                    <th>Status</th>
                    {reportType === "Document Completion Report" && (
                      <th>Completion</th>
                    )}
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceRows.length === 0 && (
                    <tr>
                      <td colSpan={reportType === "Document Completion Report" ? 7 : 6}>
                        No records match the selected filters.
                      </td>
                    </tr>
                  )}
                  {complianceRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.study}</td>
                      <td>{row.site}</td>
                      <td>{row.folder}</td>
                      <td>{row.status}</td>
                      {reportType === "Document Completion Report" && (
                        <td>{row.completionScore}%</td>
                      )}
                      <td>{row.expiryDate || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {!isComplianceReport && (
          <>
            <div className="details-card">
              <h2>Report Overview</h2>
              <div className="details-grid">
                <div>
                  <strong>Report ID</strong>
                  <p>RPT-001</p>
                </div>
                <div>
                  <strong>Generated By</strong>
                  <p>Sponsor Admin</p>
                </div>
                <div>
                  <strong>Generated Date</strong>
                  <p>2026-06-01</p>
                </div>
                <div>
                  <strong>Status</strong>
                  <p>Ready</p>
                </div>
              </div>
            </div>

            <div className="report-table-section">
              <h2>{reportType} Summary</h2>
              <table className="report-table ctms-standard-table">
                <thead>
                  <tr>
                    <th>Study</th>
                    <th>Status</th>
                    <th>Enrollment</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.status}</td>
                      <td>{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="details-card">
          <h2>Report Actions</h2>
          <div className="action-buttons">
            <button type="button" onClick={exportData}>
              Export CSV
            </button>
            {isComplianceReport && (
              <button
                type="button"
                onClick={() => setShowSubscriptionModal(true)}
              >
                Edit Report Subscription
              </button>
            )}
            <button type="button" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </div>
      </div>

      {showSubscriptionModal && (
        <EnterpriseModal
          title="Edit Report Subscription"
          onClose={() => setShowSubscriptionModal(false)}
          onSave={handleSaveSubscription}
          saveLabel="Save Subscription"
        >
          <label>
            Frequency
            <select
              value={subscriptionForm.frequency}
              onChange={(event) =>
                setSubscriptionForm({
                  ...subscriptionForm,
                  frequency: event.target.value
                })
              }
            >
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </label>
          <label>
            Recipients
            <input
              value={subscriptionForm.recipients}
              onChange={(event) =>
                setSubscriptionForm({
                  ...subscriptionForm,
                  recipients: event.target.value
                })
              }
              placeholder="email@example.com"
            />
          </label>
          <label className="report-subscription-toggle">
            <input
              type="checkbox"
              checked={subscriptionForm.enabled}
              onChange={(event) =>
                setSubscriptionForm({
                  ...subscriptionForm,
                  enabled: event.target.checked
                })
              }
            />
            Enable subscription for {reportType}
          </label>
        </EnterpriseModal>
      )}
    </AppLayout>
  );
};

export default ReportDetails;
