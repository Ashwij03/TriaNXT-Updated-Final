import React, { useState } from "react";
import AppLayout from "./AppLayout";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

const RiskDetails = () => {

  const location = useLocation();
  const navigate = useNavigate();
 
const docData = location.state;

const [riskStatus, setRiskStatus] = useState(
  docData?.status || "Open"
);

  const risk = location.state;

  if (!risk) {
    return (
      <AppLayout>
        <div style={{ padding: "1.5rem" }} className="risk-details-page tnxt-compact">
          <h2>No Risk Selected</h2>
        </div>
      </AppLayout>
    );
  }

  const generateReport = () => {

    const doc = new jsPDF();

    doc.text("Risk Management Report", 20, 20);

    doc.text(`Risk ID: ${risk.id}`, 20, 40);
    doc.text(`Study: ${risk.study}`, 20, 50);
    doc.text(`Category: ${risk.category}`, 20, 60);
    doc.text(`Severity: ${risk.severity}`, 20, 70);
    doc.text(`Status: ${risk.status}`, 20, 80);

    doc.save("RiskReport.pdf");
  };

  const exportData = () => {
    

    const csvData =
`RiskID,Study,Category,Severity,Status
${risk.id},
${risk.study},
${risk.category},
${risk.severity},
${risk.status}`;

    const blob = new Blob(
      [csvData],
      { type: "text/csv" }
    );

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download = "RiskData.csv";
    a.click();
  };
const handleResolveRisk = () => {
  setRiskStatus("Resolved");

  alert(
    `Risk ${risk.id} has been successfully resolved`
  );
};

  return (
    <AppLayout>

      <div className="page-container">

        <button
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <h1>Risk Details</h1>

        {/* KPI Cards */}
        <div className="kpi-grid">

          <div className="kpi-card">
            <h3>Risk ID</h3>
            <h2>{risk.id}</h2>
          </div>

          <div className="kpi-card">
            <h3>Severity</h3>
            <h2>{risk.severity}</h2>
          </div>

          <div className="kpi-card">
            <h3>Status</h3>
            <h2>{riskStatus}</h2>
          </div>

          <div className="kpi-card">
            <h3>Category</h3>
            <h2>{risk.category}</h2>
          </div>

        </div>

        {/* Risk Information */}
        <div className="details-card">

          <h2>Risk Information</h2>

          <div className="details-grid">

            <div>
              <strong>Risk ID</strong>
              <p>{risk.id}</p>
            </div>

            <div>
              <strong>Study</strong>
              <p>{risk.study}</p>
            </div>

            <div>
              <strong>Category</strong>
              <p>{risk.category}</p>
            </div>

            <div>
              <strong>Severity</strong>
              <p>{risk.severity}</p>
            </div>

            <div>
              <strong>Status</strong>
              <p>{riskStatus}</p>
            </div>

          </div>

        </div>

        <div className="details-card">
  <h2>Risk Description</h2>

  <p>
    Enrollment performance at multiple sites is below target,
    potentially impacting overall study timelines and milestone
    commitments.
  </p>
</div>

<div className="details-card">
  <h2>Impact Assessment</h2>

  <div className="details-grid">
    <div>
      <strong>Timeline Impact</strong>
      <p>High</p>
    </div>

    <div>
      <strong>Budget Impact</strong>
      <p>Medium</p>
    </div>

    <div>
      <strong>Quality Impact</strong>
      <p>Low</p>
    </div>

    <div>
      <strong>Patient Safety</strong>
      <p>No Impact</p>
    </div>
  </div>
</div>

<div className="details-card">
  <h2>Risk Ownership</h2>

  <div className="details-grid">
    <div>
      <strong>Owner</strong>
      <p>CRO Manager</p>
    </div>

    <div>
      <strong>Assigned Date</strong>
      <p>2026-06-01</p>
    </div>

    <div>
      <strong>Review Date</strong>
      <p>2026-06-25</p>
    </div>

    <div>
      <strong>Escalation Level</strong>
      <p>Level 2</p>
    </div>
  </div>
</div>

<div className="details-card">
  <h2>Affected Sites</h2>

  <table className="sponsor-table ctms-standard-table">
    <thead>
      <tr>
        <th>Site</th>
        <th>Status</th>
        <th>Enrollment</th>
        <th>Risk Level</th>
      </tr>
    </thead>

    <tbody>
      <tr>
        <td>{resolveSiteDisplay("Apollo Hospital", { sources: getStudies() })}</td>
        <td>Active</td>
        <td>72%</td>
        <td>High</td>
      </tr>

      <tr>
        <td>{resolveSiteDisplay("Care Hospital", { sources: getStudies() })}</td>
        <td>Active</td>
        <td>68%</td>
        <td>Medium</td>
      </tr>
    </tbody>
  </table>
</div>

<div className="details-card">
  <h2>Risk Timeline</h2>

  <table className="sponsor-table ctms-standard-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Event</th>
        <th>User</th>
      </tr>
    </thead>

    <tbody>
      <tr>
        <td>01-Jun-2026</td>
        <td>Risk Identified</td>
        <td>CRA</td>
      </tr>

      <tr>
        <td>03-Jun-2026</td>
        <td>Risk Assessed</td>
        <td>CRO Manager</td>
      </tr>

      <tr>
        <td>05-Jun-2026</td>
        <td>Mitigation Started</td>
        <td>Study Lead</td>
      </tr>
    </tbody>
  </table>
</div>

        {/* Mitigation Plan */}
        <div className="details-card">

          <h2>Mitigation Plan</h2>

          <table className="metrics-table ctms-standard-table">

            <thead>
              <tr>
                <th>Activity</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              <tr>
                <td>Risk Identified</td>
                <td>Completed</td>
              </tr>

              <tr>
                <td>Assessment</td>
                <td>Completed</td>
              </tr>

              <tr>
                <td>Mitigation Plan</td>
                <td>In Progress</td>
              </tr>

             <tr>
  <td>Closure</td>
  <td>
    {riskStatus === "Resolved"
      ? "Completed"
      : "Pending"}
  </td>
</tr>

            </tbody>

          </table>

        </div>

        {/* Quick Actions */}
        <div className="details-card">

          <h2>Quick Actions</h2>

          <div className="action-buttons">

            <button
  onClick={handleResolveRisk}
  disabled={riskStatus === "Resolved"}
            >
  {riskStatus === "Resolved"
    ? "Risk Resolved"
    : "Resolve Risk"}
</button>

            <button onClick={generateReport}>
              Generate Report
            </button>

            <button onClick={exportData}>
              Export Data
            </button>

            <button onClick={() => navigate(-1)}>
              Back
            </button>

          </div>

        </div>

      </div>

    </AppLayout>
  );
};

export default RiskDetails;