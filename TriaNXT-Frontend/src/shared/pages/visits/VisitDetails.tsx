import { useState } from "react";
import { useParams } from "react-router-dom";

import VisitHeader from "./VisitHeader";
import VisitProcedures from "./VisitProcedures";

import CommentModal from "../../comments/CommentModal";
import { useComments } from "../../comments/CommentsContext";

import "./VisitDetails.css";

export default function VisitDetails() {

  // Existing code
  const [activeVisit, setActiveVisit] = useState("visit2");
  const [activeTab,setActiveTab] = useState("procedures");

  // Friend code
  const { visitId } = useParams();
  const { comments } = useComments();
  const [showModal, setShowModal] = useState(false);

  const [documents] = useState(
    JSON.parse(
      localStorage.getItem(
        `visit_${visitId}_documents`
      )
    ) || []
  );

  // Filter comments for this visit
  const visitComments = comments.filter(
    (c) => c.visitId === visitId
  );

  return (
    <div id="print-area" className="visit-details-page tnxt-compact">

     

      {/* EXISTING HEADER */}
      <VisitHeader
        activeVisit={activeVisit}
        onVisitChange={setActiveVisit}
      />

      {/* EXISTING PROCEDURES */}
      <div className="visit-workspace-tabs">

        <button
          className={
            activeTab === "procedures"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("procedures")
          }
        >
          Procedures
        </button>
        
        <button
          className={
            activeTab === "documents"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("documents")
          }
        >
          Documents
        </button>
        
        {/* <button
          className={
            activeTab === "comments"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("comments")
          }

          Comments
        </button> */}
        
        {/* <button
          className={
            activeTab === "audit"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("audit")
          }

          Audit Trail
        </button> */}
        
      </div>
        
      {activeTab === "procedures" && (
        <VisitProcedures activeVisit={activeVisit} />
      )}

      {activeTab === "documents" && (

        <div className="visit-tab-content">
        
          <h3>Documents</h3>

          <button
            className="add-doc-btn"
          >
            + Upload Document
          </button>

          <table className="ctms-standard-table">

            <thead>
              <tr>
                <th>Name</th>
                <th>Uploaded By</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>

              {documents.map(doc => (
              
                <tr key={doc.id}>
                
                  <td>{doc.name}</td>
              
                  <td>{doc.uploadedBy}</td>
              
                  <td>{doc.uploadedAt}</td>
              
                </tr>

              ))}

            </tbody>
            
          </table>
            
        </div>

      )}

      {/* {activeTab === "audit" && (

        <div className="visit-tab-content">
        
          <h3>
            Audit Trail
          </h3>

          <table className="ctms-standard-table">

            <thead>

              <tr>
                <th>Action</th>
                <th>User</th>
                <th>Timestamp</th>
              </tr>

            </thead>

            <tbody>

              {(
                JSON.parse(
                  localStorage.getItem(
                    "auditLogs"
                  )
                ) || []
              ).map((log,index)=>(
              
                <tr key={index}>
                
                  <td>{log.action}</td>
              
                  <td>
                    {
                      log.deletedBy ||
                      log.updatedBy ||
                      log.performedBy
                    }
                  </td>
                  
                  <td>
                    {
                      new Date(
                        log.deletedAt ||
                        log.updatedAt ||
                        log.timestamp
                      ).toLocaleString()
                    }
                  </td>
                  
                </tr>

              ))}

            </tbody>
            
          </table>
            
        </div>

      )} */}

      {/* Comments SECTION */}
      <div style={{ padding: "1.25rem" }}>

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
    </div>
  );
}