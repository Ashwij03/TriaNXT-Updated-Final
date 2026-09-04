import React from "react";
import AppLayout from "./AppLayout";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
const QueryDetails = () => {
const location = useLocation();
const navigate = useNavigate();

  const query = location.state;
  const resolveQuery = () => {
  alert(`Query ${query.id} marked as Resolved`);
};
const generateReport = () => {

  const doc = new jsPDF();

  doc.text("Query Report", 20, 20);

  doc.text(`Query ID: ${query.id}`, 20, 40);
  doc.text(`Study: ${query.study}`, 20, 50);
  doc.text(`Site: ${query.site}`, 20, 60);
  doc.text(`Status: ${query.status}`, 20, 70);

  doc.save("QueryReport.pdf");
};
const exportData = () => {

  const csvData =
`QueryID,Study,Site,Status
${query.id},
${query.study},
${query.site},
${query.status}`;

  const blob = new Blob(
    [csvData],
    { type: "text/csv" }
  );

  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "QueryData.csv";
  a.click();
};
  return (
    <AppLayout>
      <div style={{ padding: "1.5rem" }} className="query-details-page tnxt-compact">
        <h1>Query Details</h1>
        <div className="kpi-grid">

  <div className="kpi-card">
    <h3>Query ID</h3>
    <h2>{query?.id}</h2>
  </div>

  <div className="kpi-card">
    <h3>Status</h3>
    <h2>{query?.status}</h2>
  </div>

  <div className="kpi-card">
    <h3>Age</h3>
    <h2>{query?.age}</h2>
  </div>

  <div className="kpi-card">
    <h3>Type</h3>
    <h2>{query?.type}</h2>
  </div>

</div>
<div className="details-card">

  <h2>Query Information</h2>

  <div className="details-grid">

    <div>
      <strong>Study</strong>
      <p>{query?.study}</p>
    </div>

    <div>
      <strong>Site</strong>
      <p>{query?.site}</p>
    </div>

    <div>
      <strong>Query Type</strong>
      <p>{query?.type}</p>
    </div>

    <div>
      <strong>Status</strong>
      <p>{query?.status}</p>
    </div>

  </div>

</div>
<div className="details-card">

  <h2>Resolution Tracking</h2>

  <table className="metrics-table ctms-standard-table">

    <thead>
      <tr>
        <th>Activity</th>
        <th>Status</th>
      </tr>
    </thead>

    <tbody>

      <tr>
        <td>Query Raised</td>
        <td>Completed</td>
      </tr>

      <tr>
        <td>Site Response</td>
        <td>Pending</td>
      </tr>

      <tr>
        <td>CRO Review</td>
        <td>Pending</td>
      </tr>

      <tr>
        <td>Final Resolution</td>
        <td>Pending</td>
      </tr>

    </tbody>

  </table>

</div>
<div className="details-card">

  <h2>Quick Actions</h2>

  <div className="action-buttons">

    <button onClick={resolveQuery}>
  Resolve Query
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

export default QueryDetails;