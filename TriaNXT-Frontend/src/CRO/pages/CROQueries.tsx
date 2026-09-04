import React from "react";
import CROSidebar from "./CROSidebar";
import CRONavbar from "./CRONavbar";

function Queries() {
  return (
    <div className="dashboard-layout tnxt-compact">

      <CROSidebar />

      <div className="main-content">

        <CRONavbar />

        <div style={{ padding: "1.875rem" }}>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <h1>Queries Management</h1>

            <button
              style={{
                padding: "10px 20px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "0.3125rem"
              }}
            >
              Raise Query
            </button>
          </div>

          <div
            style={{
              background: "#fff",
              padding: "1.25rem",
              borderRadius: "0.625rem",
              marginTop: "1.25rem"
            }}
          >
            <input
              type="text"
              placeholder="Search Query..."
              style={{
                padding: "0.625rem",
                width: "18.75rem",
                marginBottom: "1.25rem"
              }}
            />

            <table
              className="ctms-standard-table"
              style={{
                width: "100%",
                borderCollapse: "collapse"
              }}
            >
              <thead>
                <tr>
                  <th>Query ID</th>
                  <th>Study</th>
                  <th>Site</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>Q001</td>
                  <td>ST101</td>
                  <td>Site-01</td>
                  <td>High</td>
                  <td>Open</td>
                  <td><button>View</button></td>
                </tr>

                <tr>
                  <td>Q002</td>
                  <td>ST102</td>
                  <td>Site-02</td>
                  <td>Medium</td>
                  <td>Closed</td>
                  <td><button>View</button></td>
                </tr>
              </tbody>

            </table>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Queries;