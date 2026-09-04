import React from "react";
import AppLayout from "./AppLayout";
import { downloadPdfReport } from "../../shared/utils/exportPdfReport";

const SiteDocuments = () => {
  const documents = [
  {
    documentName: "Protocol.pdf",
    version: "V1.0",
    category: "Protocol",
    status: "Approved"
  },
  {
    documentName: "ICF.pdf",
    version: "V3.0",
    category: "Consent",
    status: "Approved"
  },
  {
    documentName: "Monitoring Report.pdf",
    version: "V2.0",
    category: "Monitoring",
    status: "Uploaded"
  }
];
  return (
    <AppLayout>
      <div className="page-container tnxt-compact">

        <h1>Site Documents</h1>
        <button onClick={() => downloadPdfReport(documents)}>
  Export PDF
</button>

<button onClick={() => window.print()}>
  Print
</button>

        <table className="report-table ctms-standard-table">
          <thead>
            <tr>
              <th>Document Name</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Protocol.pdf</td>
              <td>V1.0</td>
              <td>Approved</td>
            </tr>

            <tr>
              <td>ICF.pdf</td>
              <td>V3.0</td>
              <td>Approved</td>
            </tr>

            <tr>
              <td>Monitoring Report.pdf</td>
              <td>V2.0</td>
              <td>Uploaded</td>
            </tr>
          </tbody>

        </table>

      </div>
    </AppLayout>
  );
};

export default SiteDocuments;