import React from "react";

function Regulatory() {

  const documents = [
    {
      name: "Protocol v3.0",
      version: "3.0",
      expiry: "31-Dec-2026",
      status: "Approved"
    },
    {
      name: "Investigator Brochure",
      version: "5.0",
      expiry: "15-Nov-2026",
      status: "Approved"
    },
    {
      name: "Informed Consent Form",
      version: "2.1",
      expiry: "10-Oct-2026",
      status: "Pending Review"
    }
  ];

  return (
    <div style={{ padding: "1.875rem" }} className="regulatory-documents-page tnxt-compact">

      <h1>Regulatory Documents</h1>

      <table className="ctms-standard-table">
        <thead>
          <tr>
            <th>Document Name</th>
            <th>Version</th>
            <th>Expiry Date</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {documents.map((doc, index) => (
            <tr key={index}>
              <td>{doc.name}</td>
              <td>{doc.version}</td>
              <td>{doc.expiry}</td>
              <td>{doc.status}</td>
            </tr>
          ))}
        </tbody>

      </table>

    </div>
  );
}

export default Regulatory;