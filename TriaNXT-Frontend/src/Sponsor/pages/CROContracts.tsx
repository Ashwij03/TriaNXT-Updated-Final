import React from "react";
import AppLayout from "./AppLayout";
import { useNavigate } from "react-router-dom";

const CROContracts = () => {

  const navigate = useNavigate();

  return (
    <AppLayout>

      <div style={{ padding: "1.5rem" }} className="cro-contracts-page tnxt-compact">

        <button
          onClick={() => navigate(-1)}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            padding: "10px 18px",
            borderRadius: "0.5rem",
            cursor: "pointer",
            marginBottom: "1.25rem"
          }}
        >
          ← Back
        </button>

        <h1>CRO Contracts</h1>

        <table className="cro-table ctms-standard-table">

          <thead>
            <tr>
              <th>Contract ID</th>
              <th>CRO Name</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            <tr>
              <td>CON-001</td>
              <td>IQVIA</td>
              <td>01-Jan-2026</td>
              <td>31-Dec-2026</td>
              <td>Active</td>
            </tr>

            <tr>
              <td>CON-002</td>
              <td>Parexel</td>
              <td>15-Feb-2026</td>
              <td>15-Feb-2027</td>
              <td>Active</td>
            </tr>

            <tr>
              <td>CON-003</td>
              <td>ICON</td>
              <td>01-Mar-2026</td>
              <td>01-Mar-2027</td>
              <td>Under Review</td>
            </tr>

          </tbody>

        </table>

      </div>

    </AppLayout>
  );
};

export default CROContracts;