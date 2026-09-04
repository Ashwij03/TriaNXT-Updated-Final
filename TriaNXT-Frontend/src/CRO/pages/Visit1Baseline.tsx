import { useState } from "react";

export default function Visit1Baseline() {
  const [activeProcedure, setActiveProcedure] = useState("inclusion");

  const menuStyle = (name) => ({
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "18px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: activeProcedure === name ? "#e6a760" : "transparent",
    color: activeProcedure === name ? "black" : "white",
    fontWeight: activeProcedure === name ? "700" : "500",
    cursor: "pointer",
    fontSize: "1.0625rem",
    transition: "0.2s",
  });

  return (
    
    <div
      style={{
        display: "flex",
        width: "100%",
        background: "#fff",
        border: "1px solid #dcdcdc",
        borderRadius: "0.375rem",
        overflow: "hidden",
      }}
    >
      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: "17.5rem",
          minWidth: "17.5rem",
          background: "#3f5f81",
          color: "white",
        }}
      >
        <div
          style={menuStyle("inclusion")}
          onClick={() => setActiveProcedure("inclusion")}
        >
          <span>✔</span>
          <span>Inclusion Criteria</span>
        </div>

        <div
          style={menuStyle("exclusion")}
          onClick={() => setActiveProcedure("exclusion")}
        >
          <span>✔</span>
          <span>Exclusion Criteria</span>
        </div>

        <div
          style={menuStyle("demographics")}
          onClick={() => setActiveProcedure("demographics")}
        >
          <span></span>
          <span>Demographics</span>
        </div>

        <div
          style={menuStyle("medical")}
          onClick={() => setActiveProcedure("medical")}
        >
          <span>✔</span>
          <span>Medical History</span>
        </div>

        <div
          style={menuStyle("surgical")}
          onClick={() => setActiveProcedure("surgical")}
        >
          <span></span>
          <span>Surgical History</span>
        </div>

        <div
          style={menuStyle("adverse")}
          onClick={() => setActiveProcedure("adverse")}
        >
          <span>!</span>
          <span>Adverse Events</span>
        </div>

        <div
          style={menuStyle("bmi")}
          onClick={() => setActiveProcedure("bmi")}
        >
          <span></span>
          <span>Ht/Wt/BMI (ins/lbs)</span>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div
        style={{
          flex: 1,
          background: "#f7f7f7",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            background: "#e6a760",
            padding: "18px 24px",
            fontWeight: "700",
            fontSize: "1.5rem",
            color: "#222",
          }}
        >
          {activeProcedure === "demographics"
            ? "Demographics"
            : activeProcedure === "exclusion"
            ? "Exclusion Criteria"
            : activeProcedure === "medical"
            ? "Medical History"
            : activeProcedure === "surgical"
            ? "Surgical History"
            : activeProcedure === "adverse"
            ? "Adverse Events"
            : activeProcedure === "bmi"
            ? "Ht/Wt/BMI (ins/lbs)"
            : "Inclusion Criteria"}
        </div>

        {/* BODY */}
        <div
          style={{
            padding: "2.1875rem",
            minHeight: "26.25rem",
            fontSize: "1.125rem",
            color: "#333",
          }}
        >
          {/* INCLUSION */}
          {activeProcedure === "inclusion" && (
            <>
              <div style={{ marginBottom: "1.875rem" }}>
                <strong style={{ fontSize: "1.25rem" }}>
                  1. INCLUSION CRITERIA
                </strong>{" "}
                — Yes

                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "#666",
                    marginTop: "0.5rem",
                  }}
                >
                  Kristen Bosse, 30-Jul-2019 16:08
                </div>
              </div>
            </>
          )}

          {/* EXCLUSION */}
          {activeProcedure === "exclusion" && (
            <p>No exclusion criteria violated.</p>
          )}

          {/* DEMOGRAPHICS */}
          {activeProcedure === "demographics" && (
            <>
              <div
                style={{
                  background: "#ffffff",
                  padding: "1.875rem",
                  borderRadius: "0.625rem",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                  maxWidth: "43.75rem",
                }}
              >
                {/* Gender */}
                <div
                  style={{
                    marginBottom: "1.75rem",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.625rem",
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      color: "#c62828",
                    }}
                  >
                    * Gender
                  </label>

                  <select
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      fontSize: "1rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #ccc",
                      background: "#fff",
                    }}
                  >
                    <option>Select Gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>

                {/* Ethnicity */}
                <div
                  style={{
                    marginBottom: "1.75rem",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.625rem",
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      color: "#c62828",
                    }}
                  >
                    * Ethnicity
                  </label>

                  <select
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      fontSize: "1rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #ccc",
                      background: "#fff",
                    }}
                  >
                    <option>Select Ethnicity</option>
                    <option>Asian</option>
                    <option>Hispanic</option>
                    <option>African</option>
                    <option>Other</option>
                  </select>
                </div>

                {/* Race */}
                <div
                  style={{
                    marginBottom: "1.25rem",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.625rem",
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      color: "#c62828",
                    }}
                  >
                    * Race
                  </label>

                  <select
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      fontSize: "1rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #ccc",
                      background: "#fff",
                    }}
                  >
                    <option>Select Race</option>
                    <option>White</option>
                    <option>Black</option>
                    <option>Asian</option>
                    <option>Mixed</option>
                  </select>
                </div>

                {/* Save Button */}
                <button
                  style={{
                    marginTop: "1.25rem",
                    background: "#e6a760",
                    border: "none",
                    padding: "12px 24px",
                    borderRadius: "0.375rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    color: "#222",
                  }}
                >
                  Save Demographics
                </button>
              </div>
            </>
          )}

          {/* MEDICAL */}
          {activeProcedure === "medical" && (
            <p>Medical history details here.</p>
          )}

          {/* SURGICAL */}
          {activeProcedure === "surgical" && (
            <p>Surgical history details here.</p>
          )}

          {/* ADVERSE */}
          {activeProcedure === "adverse" && (
            <p>Adverse event details here.</p>
          )}

          {/* BMI */}
          {activeProcedure === "bmi" && (
            <p>Height / Weight / BMI details here.</p>
          )}
        </div>
      </div>
    </div>
  );
}