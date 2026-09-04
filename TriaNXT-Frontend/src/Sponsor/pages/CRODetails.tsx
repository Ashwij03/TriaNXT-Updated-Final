import React from "react";
import AppLayout from "./AppLayout";
import { useLocation, useNavigate } from "react-router-dom";

const CRODetails = () => {

  const location = useLocation();
  const navigate = useNavigate();

  const croData = location.state || {
    croName: "IQVIA",
    studies: 12,
    sites: 45,
    performance: "95%"
  };

  const {
    croName,
    studies,
    sites,
    performance
  } = croData;

  return (
    <AppLayout>

      <div style={{ padding: "1.5rem" }}>
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
        <h1>{croName} Details</h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1.25rem",
            marginTop: "1.25rem"
          }}
        >
          <div
            style={{
              background: "white",
              padding: "1.25rem",
              borderRadius: "0.625rem",
              textAlign: "center"
            }}
          >
            <h3>Studies</h3>
            <h2>{studies}</h2>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.25rem",
              borderRadius: "0.625rem",
              textAlign: "center"
            }}
          >
            <h3>Sites</h3>
            <h2>{sites}</h2>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.25rem",
              borderRadius: "0.625rem",
              textAlign: "center"
            }}
          >
            <h3>Performance</h3>
            <h2>{performance}</h2>
          </div>

        </div>

      </div>

    </AppLayout>
  );
};

export default CRODetails;