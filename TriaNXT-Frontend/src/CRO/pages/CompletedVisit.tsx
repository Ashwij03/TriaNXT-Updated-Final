import React, { useState } from "react";
import "./CompletedVisit.js";

export default function CompletedVisit() {
  const [open, setOpen] = useState({
    procedure: false,
    question: false,
    progress: false,
    document: false,
  });

  const toggle = (key) => {
    setOpen({ ...open, [key]: !open[key] });
  };

  return (
    <div className="visit-container">

      {/* PROCEDURE LEVEL */}
      <div className="card">

        <div className="procedure-header">
          <div className="header-left">
            <span className="tick">✔</span>
            <span>Demographics</span>
          </div>

          <button
            className="plus-btn"
            onClick={() => toggle("procedure")}
          >
            +
          </button>
        </div>

        {open.procedure && (
          <div className="comment-box">
            <textarea placeholder="Procedure-level comment" />

            <button className="save-btn">
              Save
            </button>
          </div>
        )}

        {/* QUESTION LEVEL */}
        <div className="question-row">

          <div className="question-left">
            <div className="question-title">
              Date of Birth
            </div>
          </div>

          <div className="question-right">

            <div className="question-value">
              15-JUN-1983
            </div>

            <div className="question-user">
              Raymond Nomizu, 08-FEB-2017 9:29 AM
            </div>

            <div className="audit-link">
              view audit trail (2)
            </div>
          </div>

          <button
            className="plus-btn"
            onClick={() => toggle("question")}
          >
            +
          </button>
        </div>

        {open.question && (
          <div className="comment-box">
            <textarea placeholder="Question-level comment" />

            <button className="save-btn">
              Save
            </button>
          </div>
        )}
      </div>

      {/* PROGRESS NOTES */}
      <div className="card">

        <div className="procedure-header">
          <span>Visit-Level Progress Notes</span>
        </div>

        <div className="progress-row">

          <div>
            <strong>PUBLISHED</strong>
            <br />
            Saved on 24-Jan-2020 10:04 by Megan Richards
          </div>

          <button
            className="plus-btn"
            onClick={() => toggle("progress")}
          >
            +
          </button>
        </div>

        {open.progress && (
          <div className="comment-box">
            <textarea placeholder="Progress note comment" />

            <button className="save-btn">
              Save
            </button>
          </div>
        )}
      </div>

      {/* DOCUMENT LEVEL */}
      <div className="card">

        <div className="procedure-header">

          <span>Lab Report - Sample Report</span>

          <button
            className="plus-btn"
            onClick={() => toggle("document")}
          >
            +
          </button>
        </div>

        {open.document && (
          <div className="comment-box">

            <textarea placeholder="Document-level comment" />

            <button className="save-btn">
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}