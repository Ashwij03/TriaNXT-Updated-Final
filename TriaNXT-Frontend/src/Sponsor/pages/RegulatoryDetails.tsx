import React from "react";
import AppLayout from "./AppLayout";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

const RegulatoryDetails = () => {

  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("details");
  const [selectedFile, setSelectedFile] = useState(null);

  const docData = location.state;

  if (!docData) {
    return (
      <AppLayout>
        <div style={{ padding: "1.5rem" }} className="regulatory-details-page tnxt-compact">
          <h2>No Document Selected</h2>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      <div className="page-container">

        <button
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <h1>{docData.study}</h1>

        {/* KPI Cards */}
        <div className="sponsor-kpi-grid">

  <div
    className="kpi-card"
    onClick={() => setActiveSection("approved")}
    style={{ cursor: "pointer" }}
  >
    <h3>Approved</h3>
    <h2>1</h2>
  </div>

  <div
    className="kpi-card"
    onClick={() => setActiveSection("review")}
    style={{ cursor: "pointer" }}
  >
    <h3>In Review</h3>
    <h2>1</h2>
  </div>

  <div
    className="kpi-card"
    onClick={() => setActiveSection("overdue")}
    style={{ cursor: "pointer" }}
  >
    <h3>Overdue</h3>
    <h2>1</h2>
  </div>

  <div
    className="kpi-card"
    onClick={() => setActiveSection("submitted")}
    style={{ cursor: "pointer" }}
  >
    <h3>Submitted</h3>
    <h2>1</h2>
  </div>

</div>

       <div className="details-card">

  <h2>Document Details</h2>

  <div className="details-grid">

    <div>
      <strong>Document ID</strong>
      <p>{docData.id}</p>
    </div>

    <div>
      <strong>Study</strong>
      <p>{docData.study}</p>
    </div>

    <div>
      <strong>Authority</strong>
      <p>{docData.authority}</p>
    </div>

    <div>
      <strong>Status</strong>
      <p>{docData.status}</p>
    </div>

    <div>
      <strong>Due Date</strong>
      <p>{docData.dueDate}</p>
    </div>

    <div>
      <strong>Version</strong>
      <p>v3.0</p>
    </div>

  </div>

</div>

<div className="details-card">

  <h2>Approval Workflow</h2>

  <div className="details-grid">

    <div>
      <strong>Submitted</strong>
      <p>✓ Completed</p>
    </div>

    <div>
      <strong>Internal Review</strong>
      <p>✓ Completed</p>
    </div>

    <div>
      <strong>Authority Review</strong>
      <p>✓ Completed</p>
    </div>

    <div>
      <strong>Approved</strong>
      <p>✓ Approved</p>
    </div>

  </div>

</div>

{
  activeSection === "approved" && (
    <div className="details-card">
      <h2>Approved Documents</h2>

      <table className="sponsor-table ctms-standard-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>Protocol Amendment v3</td>
            <td>Approved</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

{
  activeSection === "review" && (
    <div className="details-card">
      <h2>Review Queue</h2>

      <table className="sponsor-table ctms-standard-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Authority</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>ICF Version 2.1</td>
            <td>IRB</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

{
  activeSection === "review" && (
    <div className="details-card">
      <h2>Review Queue</h2>

      <table className="sponsor-table ctms-standard-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Authority</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>ICF Version 2.1</td>
            <td>IRB</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

{
  activeSection === "overdue" && (
    <div className="details-card">
      <h2>Overdue Documents</h2>

      <table className="sponsor-table ctms-standard-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Due Date</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>Annual Safety Report</td>
            <td>2026-05-20</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

<div className="details-card">

  <h2>Audit Trail</h2>

  <table className="sponsor-table ctms-standard-table">

    <thead>
      <tr>
        <th>Date</th>
        <th>Action</th>
        <th>User</th>
      </tr>
    </thead>

    <tbody>

      <tr>
        <td>01-May-2026</td>
        <td>Document Uploaded</td>
        <td>Ramya</td>
      </tr>

      <tr>
        <td>03-May-2026</td>
        <td>Internal Review Completed</td>
        <td>CRO Manager</td>
      </tr>

      <tr>
        <td>05-May-2026</td>
        <td>Authority Approval</td>
        <td>FDA Reviewer</td>
      </tr>

    </tbody>

  </table>

</div>

<div className="details-card">

  <h2>Attachments</h2>

  <table className="sponsor-table ctms-standard-table">

    <thead>
      <tr>
        <th>File Name</th>
        <th>Type</th>
        <th>Action</th>
      </tr>
    </thead>

    <tbody>

      <tr>
        <td>Protocol_Amendment_v3.pdf</td>
        <td>Protocol</td>
        <td>
  <button
  className="view-btn"
  onClick={() =>
    setSelectedFile({
      name: "Protocol_Amendment_v3.pdf",
      type: "Protocol",
      version: "v3.0",
      uploadedBy: "Regulatory Manager",
      uploadedDate: "01-May-2026"
    })
  }
  >
  View
</button>
</td>
      </tr>

      <tr>
        <td>FDA_Approval_Letter.pdf</td>
        <td>Approval Letter</td>
        <td>
 <button
  className="view-btn"
  onClick={() =>
    setSelectedFile({
      name: "FDA_Approval_Letter.pdf",
      type: "Approval Letter",
      version: "v1.0",
      uploadedBy: "FDA Reviewer",
      uploadedDate: "05-May-2026"
    })
  }
 >
  View
</button>
</td>
      </tr>

    </tbody>

  </table>

</div>
{selectedFile && (
  <div className="details-card">

    <h2>Document Preview</h2>

    <div className="details-grid">

      <div>
        <strong>File Name</strong>
        <p>{selectedFile.name}</p>
      </div>

      <div>
        <strong>Type</strong>
        <p>{selectedFile.type}</p>
      </div>

      <div>
        <strong>Version</strong>
        <p>{selectedFile.version}</p>
      </div>

      <div>
        <strong>Uploaded By</strong>
        <p>{selectedFile.uploadedBy}</p>
      </div>

      <div>
        <strong>Upload Date</strong>
        <p>{selectedFile.uploadedDate}</p>
      </div>

    </div>

    <div className="action-buttons">
      <button
  onClick={() => {
    const blob = new Blob(
      [
        `File Name: ${selectedFile.name}
Type: ${selectedFile.type}
Version: ${selectedFile.version}
Uploaded By: ${selectedFile.uploadedBy}`
      ],
      { type: "text/plain" }
    );

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = selectedFile.name;

    a.click();
  }}
      >
  Download
</button>
     <button
  onClick={() => {

    const csv =
`File Name,Type,Version,Uploaded By
${selectedFile.name},
${selectedFile.type},
${selectedFile.version},
${selectedFile.uploadedBy}`;

    const blob = new Blob(
      [csv],
      { type: "text/csv" }
    );

    const url =
      window.URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download = "DocumentExport.csv";

    a.click();
  }}
     >
  Export
</button>
      <button onClick={() => setSelectedFile(null)}>
        Close Preview
      </button>
    </div>

  </div>
)}

        {/* Compliance Summary */}
        <div className="details-card">

          <h2>Compliance Summary</h2>

          <table className="metrics-table ctms-standard-table">

            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              <tr>
                <td>Protocol</td>
                <td>{docData.protocol}</td>
              </tr>

              <tr>
                <td>IRB Approval</td>
                <td>{docData.irb}</td>
              </tr>

              <tr>
                <td>ICF</td>
                <td>{docData.icf}</td>
              </tr>

              <tr>
                <td>Investigator Brochure</td>
                <td>{docData.brochure}</td>
              </tr>

            </tbody>

          </table>

        </div>
    

      </div>
      

    </AppLayout>
  );
};

export default RegulatoryDetails;