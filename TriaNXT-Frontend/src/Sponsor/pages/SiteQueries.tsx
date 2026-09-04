import React from "react";
import AppLayout from "./AppLayout";

const SiteQueries = () => {
  return (
    <AppLayout>
      <div className="page-container tnxt-compact">

        <h1>Site Queries</h1>

        <table className="report-table ctms-standard-table">
          <thead>
            <tr>
              <th>Query ID</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Raised Date</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Q001</td>
              <td>Missing Consent Form</td>
              <td>Open</td>
              <td>12-Jun-2026</td>
            </tr>

            <tr>
              <td>Q002</td>
              <td>Lab Report Delay</td>
              <td>In Progress</td>
              <td>14-Jun-2026</td>
            </tr>
          </tbody>
        </table>

      </div>
    </AppLayout>
  );
};

export default SiteQueries;