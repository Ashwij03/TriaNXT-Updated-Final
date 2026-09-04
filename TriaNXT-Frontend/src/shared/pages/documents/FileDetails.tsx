import { useState } from "react";
import "./FileDetails.css";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";

export default function FileDetails() {
  const [showAnnotations, setShowAnnotations] = useState(false);

  return (
    <DashboardLayout>
    <div className="file-details-page tnxt-compact">

      {/* TOP CARD */}
      <div className="file-card">

        <h3>Lab Report – Sample Report Comp Blood</h3>

        <div className="file-row">
          <div>
            <p><b>Study:</b> 747-303 OBETICHOLIC ACID (OCA)</p>
            <p><b>File Type:</b> Lab Report</p>
          </div>

          <div>
            <p><b>Subject:</b> T-S - 123-0001</p>
            <p><b>Visit:</b> Visit 1 - Screening 1</p>
          </div>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="file-actions">
          <span className="action-link">🔗 View Logs</span>
          <span className="divider">|</span>
          <span className="action-link">⬅ Back</span>

          {/* 🔥 Annotation button (fix warning) */}
          <div
            className="annotation-btn"
            onClick={() => setShowAnnotations(!showAnnotations)}>

            A
          </div>
        </div>

        {/* TABLE */}
        <table className="report-table ctms-standard-table">
          <thead>
            <tr>
              <th>Result</th>
              <th>Range</th>
            </tr>
          </thead>

          <tbody>
            {[
              {
                value: "1.75",
                range: "0.78 - 1.79 Premeno-luteal",
                note: "ncs",
              },
              {
                value: "6.2",
                range: "2.27 - 5.22 Premeno-luteal",
                note: "high",
              },
              {
                value: "3.21",
                range: "0.78 - 1.98 Premeno-luteal",
                note: "high",
              },
              {
                value: "0.40",
                range: ">0.2 (median value)",
                note: "low",
              },
              {
                value: "0.70",
                range: "0.17 - 0.70 Premeno-luteal",
                note: "normal",
              },
            ].map((item, index) => (
              <tr key={index}>
                <td className="cell-with-annotation">
                  <span className="value">{item.value}</span>

                  <span className="annotation-dot">
                    {index + 1}
                  </span>

                  <div className="annotation-tooltip">
                    {item.note}
                  </div>
                </td>

                <td>{item.range}</td>
              </tr>
            ))}
          </tbody>
        </table>

      </div> {/* ✅ CLOSE file-card */}

      {/* SIDEBAR */}
      {showAnnotations && (
        <div className="annotation-sidebar">
          <p>Annotations Panel</p>
        </div>
      )}

    </div>
    </DashboardLayout>
  );
}