import React from "react";
import DocumentFolderManager from "../../shared/components/DocumentFolderManager";

function StudyFolderDashboard() {
  return (
    <div className="pi-page-content tnxt-compact">
      <h1>Study Folder</h1>

      <div className="cards-container">

        <div className="dashboard-card">
          <h3>Total Documents</h3>
          <h2>45</h2>
        </div>

        <div className="dashboard-card">
          <h3>Protocols</h3>
          <h2>8</h2>
        </div>

        <div className="dashboard-card">
          <h3>Reports</h3>
          <h2>12</h2>
        </div>

        <div className="dashboard-card">
          <h3>Correspondence</h3>
          <h2>25</h2>
        </div>

      </div>

      <div className="table-container">
        <h2>Study Documents</h2>

        <table className="ctms-standard-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Category</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Protocol</td>
              <td>Study Protocol</td>
              <td>v3.0</td>
              <td>Approved</td>
            </tr>

            <tr>
              <td>Investigator Brochure</td>
              <td>Reference</td>
              <td>v2.0</td>
              <td>Active</td>
            </tr>

            <tr>
              <td>Monitoring Report</td>
              <td>Report</td>
              <td>v1.0</td>
              <td>Completed</td>
            </tr>
          </tbody>
        </table> 
      </div>

      <DocumentFolderManager
        sectionId="studyFolder"
        contextKey="pi-global"
        title="Study Documents"
        layout="explorer"
      />

    </div>
  );
}

export default StudyFolderDashboard;