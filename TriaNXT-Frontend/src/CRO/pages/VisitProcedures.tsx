import { useState } from "react";
import "./VisitProcedures.js";

export default function VisitProcedures(_props: any) {
  const [activeProcedure, setActiveProcedure] = useState("inclusion");

  return (
    <div className="visit-procedures-wrapper">

      {/* LEFT BLUE COLUMN */}
      <div className="procedures-left">

        <div
          className={`procedure-item ${activeProcedure === "inclusion" ? "active" : ""}`}
          onClick={() => setActiveProcedure("inclusion")}
        >
          ✓ Inclusion Criteria
        </div>

        <div
          className={`procedure-item ${activeProcedure === "exclusion" ? "active" : ""}`}
          onClick={() => setActiveProcedure("exclusion")}
        >
          ✓ Exclusion Criteria
        </div>

        <div
          className={`procedure-item ${activeProcedure === "demographics" ? "active" : ""}`}
          onClick={() => setActiveProcedure("demographics")}
        >
          Demographics
        </div>

        <div
          className={`procedure-item ${activeProcedure === "medical" ? "active" : ""}`}
          onClick={() => setActiveProcedure("medical")}
        >
          ✓ Medical History
        </div>

        <div
          className={`procedure-item ${activeProcedure === "surgical" ? "active" : ""}`}
          onClick={() => setActiveProcedure("surgical")}
        >
          Surgical History
        </div>

        <div
          className={`procedure-item ${activeProcedure === "adverse" ? "active" : ""}`}
          onClick={() => setActiveProcedure("adverse")}
        >
          ! Adverse Events
        </div>

        <div
          className={`procedure-item ${activeProcedure === "bmi" ? "active" : ""}`}
          onClick={() => setActiveProcedure("bmi")}
        >
          Ht/Wt/BMI (ins/lbs)
        </div>

      </div>

      {/* RIGHT SIDE CONTENT */}
      <div className="procedures-right">

        {activeProcedure === "inclusion" && (
          <>
            <div className="procedure-header">✓ Inclusion Criteria</div>
            <div className="procedure-body">
              <p><b>1. INCLUSION CRITERIA</b> — Yes</p>
              <p className="meta">Kristen Bosse, 30-Jul-2019 16:08</p>
            </div>
          </>
        )}

        {activeProcedure === "exclusion" && (
          <>
            <div className="procedure-header">✓ Exclusion Criteria</div>
            <div className="procedure-body">
              <p>No exclusion criteria violated.</p>
            </div>
          </>
        )}
       {activeProcedure === "demographics" && (
  <div
    style={{
      background: "#fff",
      border: "1px solid #ddd",
    }}
  >
    {/* Instructions Row */}
    <div
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid #ddd",
        background: "#fafafa",
        fontWeight: "600",
      }}
    >
      Instructions
    </div>

    {/* DOB Row */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "1.125rem",
        borderBottom: "1px solid #eee",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: "1.0625rem" }}>
        Date of Birth
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: "600" }}>
          15-JUN-1983
        </div>

        <div
          style={{
            color: "#777",
            fontSize: "0.8125rem",
            marginTop: "0.25rem",
          }}
        >
          Raymond Nomizu, 08-FEB-2017 9:29 AM
        </div>

        <div
          style={{
            color: "#2a6db0",
            fontSize: "0.8125rem",
            marginTop: "0.25rem",
            cursor: "pointer",
          }}
        >
          view audit trail (2)
        </div>
      </div>

      {/* Comment Circle */}
      <div
        style={{
          width: "1.75rem",
          height: "1.75rem",
          borderRadius: "50%",
          background: "#f1f1f1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          cursor: "pointer",
          marginLeft: "0.9375rem",
        }}
      >
        +
      </div>
    </div>
  </div>
)}

      </div>
    </div>
  );
}
