import React, { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import {
  canResolveComments,
  canViewComment,
  canWriteComments,
} from "../../services/commentService";

import CommentModal from "../../comments/CommentModal";
import { getCurrentUser, getAssignedSite } from "../../services/roleService";
import { useComments } from "../../comments/CommentsContext";
// This is the "Comments" tab rendered inside a study's detail page
// (StudyDetails.js → activeTab === "comments"), reached by opening a
// study and clicking Comments. It previously held its own hardcoded
// demo comments in local React state (never persisted, never scoped to
// a study, never shared with any other role), which is why a comment
// added here never survived a refresh and was never visible to any
// other role. It now reads/writes through the same shared commentService
// used everywhere else, scoped to the current study.

export default function CommentsPage({ embedded = false }: any) {
  const { code } = useParams();
  const studyCode = code || "";
  const currentUser = getCurrentUser();
  const assignedSite = getAssignedSite() || "";
  const {
    comments: liveComments,
    addComment,
    resolveComment,
  } = useComments();

  // UI state
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [commentText, setCommentText] = useState("");

  // Compute study-scoped, visible comments from canonical source
  const comments = useMemo(() => {
    return liveComments
      .filter((comment) => canViewComment(comment, currentUser))
      .filter(
        (comment) => !studyCode || String(comment.study) === String(studyCode)
      );
  }, [liveComments, studyCode, currentUser]);

  // ===== FILTER PIPELINE =====
  const filteredComments = useMemo(() => {
    let result = [...comments];

    // Status filter
    if (statusFilter === "resolved") {
      result = result.filter(
        (comment) => comment.status === "Resolved",
      );
    } else if (statusFilter === "unresolved") {
      result = result.filter(
        (comment) => comment.status !== "Resolved",
      );
    }

    // Search filter
    const query = searchTerm.trim().toLowerCase();

    if (query) {
      result = result.filter((comment) => {
        const searchableText = [
          comment.id,
          comment.study,
          comment.subjectId,
          comment.createdBy,
          comment.description,
          comment.status,
          comment.createdAt,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    return result;
  }, [comments, searchTerm, statusFilter]);

  // ===== RESET PAGE WHEN FILTERING =====
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // ===== PAGINATION CALCULATION =====
  const totalRows = filteredComments.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalRows / rowsPerPage),
  );

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const paginatedComments = filteredComments.slice(
    startIndex,
    endIndex,
  );

  const toggleStatus = (comment) => {
    if (comment.status !== "Resolved") {
      resolveComment(comment.id);
    }
  };

  const handleAddComment = () => {
    if (!studyCode) {
      return;
    }
    setShowAddModal(true);
  };

  const handleModalSubmit = (payload) => {
    const text = (payload?.comment || payload?.text || "").trim();

    if (!text || !studyCode) {
      return;
    }

    addComment("", {
      text,
      study: studyCode,
      site: assignedSite,
      module: "OperationsComments",
      sourceView: "operations",
      activity: "General",
    });

    setShowAddModal(false);
  };

  const content = (
    <div className="operations-comments-page tnxt-compact" style={{ padding: "1.25rem" }}>
      <h2 style={{ marginBottom: "1.25rem" }}>
        Comments — {studyCode || "Study"}
      </h2>

      {/* ===== ADD COMMENT ===== */}
      {canWriteComments(currentUser) && (
        <div style={{ marginBottom: "1.25rem" }}>
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Add a comment..."
            rows={3}
            style={{
              width: "100%",
              maxWidth: "35rem",
              display: "block",
            }}
            disabled={!studyCode}
          />

          <button
            type="button"
            onClick={handleAddComment}
            disabled={!studyCode}>

            Add Comment
          </button>
        </div>
      )}

      {showAddModal && (
        <CommentModal
          visitId=""
          subject=""
          visit=""
          onSubmit={handleModalSubmit}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <div style={{ marginBottom: "1.25rem", marginTop: "0.625rem" }}>
        <button type="button" onClick={() => setStatusFilter("unresolved")}>
          Unresolved Comments
        </button>
        <button type="button" onClick={() => setStatusFilter("resolved")}>
          Resolved Comments
        </button>
        <button type="button" onClick={() => setStatusFilter("all")}>
          All
        </button>
      </div>
      {/* ===== SEARCH + FILTER ===== */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}>

        <input
          type="text"
          placeholder="Search comments, subjects, users..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={{
            flex: "1 1 320px",
            minWidth: "16.25rem",
            padding: "10px 12px",
          }}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={{
            minWidth: "11.25rem",
            padding: "10px 12px",
          }}>

          <option value="all">All Comments</option>
          <option value="unresolved">Open / Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* ===== TABLE ===== */}
      <div style={{ overflowX: "auto" }}>
        <table
          border={1}
          cellPadding={10}
          width="100%"
          style={{ borderCollapse: "collapse" }}>

          <thead>
            <tr>
              <th>ID</th>
              <th>Study ID</th>
              <th>Subject</th>
              <th>Author</th>
              <th>Date</th>
              <th>Comment</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {paginatedComments.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  No Comments Found
                </td>
              </tr>
            ) : (
              paginatedComments.map((comment) => (
                <tr key={comment.id}>
                  <td>{comment.id}</td>
                  <td>{comment.study || studyCode || "—"}</td>
                  <td>{comment.subjectId || "—"}</td>
                  <td>
                    {comment.createdBy || "—"}
                    {comment.createdRole
                      ? ` (${comment.createdRole})`
                      : ""}
                  </td>
                  <td>{comment.createdAt || "—"}</td>
                  <td>{comment.description || "—"}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleStatus(comment)}
                      disabled={
                        comment.status === "Resolved" ||
                        !canResolveComments(currentUser)
                      }
                      style={{
                        background:
                          comment.status === "Resolved"
                            ? "#d4edda"
                            : "#fff3cd",
                        border: "1px solid #ccc",
                        padding: "5px 10px",
                        borderRadius: "0.3125rem",
                      }}>

                      {comment.status === "Resolved"
                        ? "Resolved"
                        : "Open"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== PAGINATION ===== */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}>

        <div>
          Showing {totalRows === 0 ? 0 : startIndex + 1}–
          {Math.min(endIndex, totalRows)} of {totalRows}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={rowsPerPage}
            onChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}>

            <option value={5}>5 rows</option>
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
          </select>

          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.max(1, page - 1))
            }
            disabled={currentPage === 1}>

            Previous
          </button>

          <span>
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) =>
                Math.min(totalPages, page + 1),
              )
            }
            disabled={currentPage === totalPages}>

            Next
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <DashboardLayout>{content}</DashboardLayout>;
}