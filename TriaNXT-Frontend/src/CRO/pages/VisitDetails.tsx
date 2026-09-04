import { useState } from "react";
import { useParams } from "react-router-dom";

import VisitHeader from "./VisitHeader";
import VisitProcedures from "./VisitProcedures";

import CommentModal from "../../shared/comments/CommentModal";
import { useComments } from "../../shared/comments/CommentsContext";

import "./VisitDetails.js";

export default function VisitDetails() {

  // Existing code
  const [activeVisit, setActiveVisit] = useState("visit2");

  // Friend code
  const { visitId } = useParams();
  const { comments } = useComments();
  const [showModal, setShowModal] = useState(false);

  // Filter comments for this visit
  const visitComments = comments.filter(
    (c) => c.visitId === visitId
  );

  return (
    <div id="print-area">

     

      {/* EXISTING HEADER */}
      <VisitHeader
        activeVisit={activeVisit}
        onVisitChange={setActiveVisit}
      />

      {/* EXISTING PROCEDURES */}
      <VisitProcedures activeVisit={activeVisit} />

      {/* COMMENT SECTION */}
      <div style={{ padding: "1.25rem" }}>

        <h3>VISIT 1 : Screening</h3>

        {/* PROCEDURE HEADER */}
        <div className="procedure-bar">

          <span className="check-icon">
            ✔
          </span>

          <span className="procedure-title">
            Full Physical Exam
          </span>

          <button
            className="procedure-plus"
            onClick={() => setShowModal(true)}
          >
            +
          </button>

        </div>

        {/* INLINE COMMENTS */}
        {visitComments.map((c) => (
          <div
            key={c.id}
            className="comment-inline"
          >
            <div className="avatar">

              {c.id}

              {c.resolved && (
                <span className="blue-tick">
                  ✓
                </span>
              )}

            </div>

            <div className="comment-body">

              <b>{c.author}</b>

              <div>{c.text}</div>

              <small>{c.date}</small>

            </div>

          </div>
        ))}

        {/* COMMENT MODAL */}
        {showModal && (
          <CommentModal
            visitId={visitId}
            onClose={() => setShowModal(false)}
          />
        )}

      </div>

    </div>
  );
}