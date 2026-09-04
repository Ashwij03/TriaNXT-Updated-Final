import React, { useMemo, useState } from "react";

import CROLayout from "./CROLayout";

import { useCROData } from "./CRODATAContext";
import { isOpenComment } from "../../shared/services/commentService";

import CROStatusBadge from "./CROStatusBadge";

import EmptyState from "./EmptyState";

import CROModal from "./CROModal";

import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

function CROComments() {

  const { comments, addComment, showAlert } = useCROData();

  const [searchTerm, setSearchTerm] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);

  const siteSources = useMemo(() => getStudies(), []);

  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const [newComment, setNewComment] = useState({

    subject: "",

    site: "",

    author: "",

    message: "",

    status: "Open",

    date: new Date().toISOString().split("T")[0],

  });

  const filteredComments = comments.filter(

    (c) =>

      c.message.toLowerCase().includes(searchTerm.toLowerCase()) ||

      c.subject?.toLowerCase().includes(searchTerm.toLowerCase())

  );

  const handleAddComment = () => {

    if (!newComment.message.trim()) {

      showAlert("Validation", "Please enter a comment message.");

      return;

    }

    addComment(newComment);

    setNewComment({

      subject: "",

      site: "",

      author: "",

      message: "",

      status: "Open",

      date: new Date().toISOString().split("T")[0],

    });

    setShowAddModal(false);

    showAlert("Success", "Comment added successfully.");

  };

  return (

    <CROLayout>

      <h1 style={{ marginBottom: "1.5625rem" }}>Comments</h1>

      <div className="cro-summary-cards">

        <div className="dashboard-card">

          <h3>Total Comments</h3>

          <h1>{comments.length}</h1>

        </div>

        <div className="dashboard-card">

          <h3>Open</h3>

          <h1>{comments.filter(isOpenComment).length}</h1>

        </div>

        <div className="dashboard-card">

          <h3>Resolved</h3>

          <h1>
            {
              comments.filter(
                (comment) =>
                  String(comment?.status || "").toLowerCase() === "resolved"
              ).length
            }
          </h1>

        </div>

      </div>

      <div className="cro-panel">

        <div className="cro-panel-header">

          <input

            type="text"

            placeholder="Search Comments..."

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

            className="cro-input"

          />

          <h2>Comments List</h2>

          <button

            type="button"

            className="cro-btn-primary"

            onClick={() => setShowAddModal(true)}
          >
            + Add Comment

          </button>

        </div>

        {filteredComments.length === 0 ? (

          <EmptyState title="No Comments Found" />

        ) : (

          <div className="cro-table-wrap tnxt-compact">

            <table className="cro-data-table ctms-standard-table">

              <thead>

                <tr>

                  <th>ID</th>

                  <th>Subject</th>

                  <th>Site</th>

                  <th>Author</th>

                  <th>Message</th>

                  <th>Status</th>

                  <th>Actions</th>

                </tr>

              </thead>

              <tbody>

                {filteredComments.map((comment) => (

                  <tr key={comment.id}>

                    <td>{comment.id}</td>

                    <td>{comment.subject}</td>

                    <td>{displaySite(comment.site)}</td>

                    <td>{comment.author}</td>

                    <td>{comment.message.substring(0, 40)}...</td>

                    <td>

                      <CROStatusBadge status={comment.status} />

                    </td>

                    <td>

                      <button

                        type="button"

                        className="cro-btn-sm"

                        onClick={() =>

                          showAlert(

                            comment.id,

                            `${comment.message}\n\nReplies: ${(comment.replies || []).length}`

                          )

                        }
                      >
                        View

                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>

      <CROModal

        isOpen={showAddModal}

        onClose={() => setShowAddModal(false)}

        title="Add Comment"

        footer={

          <>

            <button type="button" className="cro-btn cro-btn-secondary" onClick={() => setShowAddModal(false)}>

              Cancel

            </button>

            <button type="button" className="cro-btn cro-btn-primary" onClick={handleAddComment}>

              Save

            </button>

          </>

        }
      >
        <input

          className="cro-input"

          placeholder="Subject ID"

          value={newComment.subject}

          onChange={(e) => setNewComment({ ...newComment, subject: e.target.value })}

        />

        <input

          className="cro-input"

          placeholder="Site"

          value={newComment.site}

          onChange={(e) => setNewComment({ ...newComment, site: e.target.value })}

        />

        <input

          className="cro-input"

          placeholder="Author"

          value={newComment.author}

          onChange={(e) => setNewComment({ ...newComment, author: e.target.value })}

        />

        <textarea

          placeholder="Message"

          value={newComment.message}

          onChange={(e) => setNewComment({ ...newComment, message: e.target.value })}

          rows={4}

          style={{ width: "100%", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #d1d5db" }}

        />

      </CROModal>

    </CROLayout>

  );

}

export default CROComments;