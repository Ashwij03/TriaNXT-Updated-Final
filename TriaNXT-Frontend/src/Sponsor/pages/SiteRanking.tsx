import React from "react";
import AppLayout from "./AppLayout";
import { useNavigate } from "react-router-dom";

const SiteRanking = () => {

  const navigate = useNavigate();

  return (
    <AppLayout>

      <div style={{ padding: "1.5rem" }} className="site-ranking-page tnxt-compact">

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
           Back
        </button>

        <h1>Site Ranking</h1>

        <table className="site-table">

          <thead>
            <tr>
              <th>Rank</th>
              <th>Site</th>
              <th>Enrollment</th>
              <th>Compliance</th>
            </tr>
          </thead>

          <tbody>

            <tr>
              <td>1</td>
              <td>SITE-001</td>
              <td>250</td>
              <td>96%</td>
            </tr>

            <tr>
              <td>2</td>
              <td>SITE-002</td>
              <td>180</td>
              <td>92%</td>
            </tr>

            <tr>
              <td>3</td>
              <td>SITE-003</td>
              <td>90</td>
              <td>85%</td>
            </tr>

          </tbody>

        </table>

      </div>

    </AppLayout>
  );
};

export default SiteRanking;