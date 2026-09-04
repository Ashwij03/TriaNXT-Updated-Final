import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DataTable from "../../components/dashboard/shared/DataTable";
import {
  canResolveComments,
  canViewComment,
  canWriteComments,
} from "../../services/commentService";
import { getCurrentUser, getAssignedSite } from "../../services/roleService";
import { getStudyByCode } from "../../services/studyService";
import { useComments } from "../../comments/CommentsContext";
import CommentModal from "../../comments/CommentModal";

function StudyComments() {
  const { id } = useParams();
  const study = getStudyByCode(id);
  const studyCode = study?.code || id;
  const currentUser = getCurrentUser();
  const assignedSite = getAssignedSite() || "";
  const {
    comments: liveComments,
    addComment,
    resolveComment,
    reopenComment,
  } = useComments();
  const [showAddModal, setShowAddModal] = useState(false);

  // ===== NEW: Search + Filter state =====
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [commentText, setCommentText] = useState("");

  // ===== Canonical pipeline =====
  // authorized → study filter → search/filter → table
  const comments = useMemo(() => {
    let result = liveComments
      .filter((comment) =>
        canViewComment(comment, currentUser, study?.status),
      )
      .filter(
        (comment) => !studyCode || String(comment.study) === String(studyCode),
      );

    if (statusFilter !== "All") {
      result = result.filter((comment) => comment.status === statusFilter);
    }

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

    return result.map((comment) => ({
        id: `C-${String(comment.id).slice(-6)}`,
        studyId: comment.study || studyCode || "—",
        subjectDocument: comment.documentDeleted
          ? `${comment.subjectId} / ${comment.document || "Deleted document"}`
          : comment.document
            ? `${comment.subjectId} / ${comment.document}`
            : comment.subjectId,
        comment: (
          <div
            style={{
              whiteSpace: "normal",
              wordBreak: "break-word",
              maxWidth: "15.625rem",
            }}>

            {comment.description || "—"}
          </div>
        ),
        by: comment.createdBy || "—",
        date: comment.createdAt || "—",
        status: comment.status,
        action:
          comment.status === "Open" && canResolveComments(currentUser) ? (
            <button type="button" onClick={() => resolveComment(comment.id)}>
              Resolve
            </button>
          ) : comment.status === "Resolved" && canResolveComments(currentUser) ? (
            <button type="button" onClick={() => reopenComment(comment.id)}>
              Reopen
            </button>
          ) : (
            "—"
          ),
    }));
  }, [
    liveComments,
    studyCode,
    study?.status,
    currentUser,
    resolveComment,
    reopenComment,
    statusFilter,
    searchTerm,
  ]);

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
      module: "StudyComments",
      sourceView: "study-comments",
      activity: "Study",
    });

    setShowAddModal(false);
  };

  return (
    <div className="module-card">
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

      {/* ===== Search + Filter ===== */}
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

          <option value="All">All Comments</option>
          <option value="Open">Open / Unresolved</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
        }}>

        <DataTable
          title={`Comments — ${study?.name || studyCode}`}
          columns={[
            { key: "id", label: "ID", width: "90px" },
            { key: "studyId", label: "Study ID", width: "120px" },
            {
              key: "subjectDocument",
              label: "Subject / Document",
              width: "220px",
            },
            { key: "comment", label: "Comment", width: "320px" },
            { key: "by", label: "By", width: "170px" },
            { key: "date", label: "Date", width: "180px" },
            { key: "status", label: "Status", width: "120px" },
            ...(canResolveComments(currentUser)
              ? [{ key: "action", label: "Action", width: "120px" }]
              : []),
          ]}
          data={comments}
          emptyMessage="No comments for this study"
          pagination
          searchable={false}
        />
      </div>
    </div>
  );
}

export default StudyComments;