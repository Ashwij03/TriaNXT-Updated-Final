import { useEffect, useMemo, useState } from "react";
import DataTable from "../../components/dashboard/shared/DataTable";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { canWriteComments, canViewComment } from "../../services/commentService";
import { getAllSubjects } from "../../services/subjectService";
import { getCurrentUser } from "../../services/roleService";
import { readJson } from "../../utils/storageHelpers";
import { useComments } from "../../comments/CommentsContext";
import CommentModal from "../../comments/CommentModal";
import "./SubjectComments.css";

// Resolve a Subject → Study ID mapping from the shared subjectsByStudy store,
// used as a fallback Study ID when a comment record itself does not carry an
// explicit study code (e.g. legacy records or subject-only scoped comments).
function resolveStudyIdForSubject(subjectId) {
  if (!subjectId) {
    return "";
  }

  try {
    const allSubjects = getAllSubjects();
    const normalized = String(subjectId).toLowerCase();

    const match = allSubjects.find((subject) => {
      const candidateId = subject?.subjectId || subject?.id || "";
      return String(candidateId).toLowerCase() === normalized;
    });

    if (match) {
      return match.studyId || "";
    }
  } catch {
    // ignore
  }

  return "";
}

// Phase-7 Subject Comments.
//
// Same component as before, now also usable as a large modal via the
// `asModal` prop. The presentation layer decides between:
//   • inline (default, used inside Subject Details tabs), or
//   • modal (used when the Subject Details "Comments" button is clicked).
//
// The underlying table + Add Comment flow is reused from the existing
// DataTable and CommentModal components — no separate SubjectComments
// modal component is introduced.
//
// Phase 7 (Cross-View Comments Synchronization): this view reads from
// the shared CommentsContext instead of pulling from getVisibleComments()
// on every "comments-updated" event via a local refreshTick. That local
// listener duplicated work already done by CommentsProvider and left
// this table one render behind the counters/widgets. All authorization
// filtering still runs through canViewComment, unchanged.
function SubjectComments({
  subjectId,
  asModal = false,
  onClose,
  studyId: studyIdProp,
}: any) {
  const currentUser = getCurrentUser();
  const {
    comments: liveComments,
    addComment,
    updateComment,
    deleteComment,
  } = useComments() || {};

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Phase-6 Subject Comments Pagination.
  // Bumped whenever we want the shared DataTable to reset to page 1
  // without changing what data it holds. Driven  by:
  //   • subject switch (subjectId change) — Behaviour: "Reset to Page 1
  //     when Subject changes"
  //   • successful Add Comment — Behaviour: "Reset to Page 1 after
  //     Add Comment"
  // Everything else (Rows per page 5/10/20/50 default 10, Previous /
  // Next) is inherited unchanged from the existing DataTable
  // pagination controls used elsewhere in the app — no new pagination
  // code was introduced.
  const [paginationResetKey, setPaginationResetKey] = useState(0);

  // Reset pagination to page 1 whenever the Subject context changes.
  // Kept as an effect (not derived) so that we never remount the
  // DataTable — page size, filters, search input state are all
  // preserved by the same shared component instance.
  useEffect(() => {
    setPaginationResetKey((value) => value + 1);
  }, [subjectId]);

  const fallbackStudyId = useMemo(
    () => studyIdProp || resolveStudyIdForSubject(subjectId),
    [subjectId, studyIdProp]
  );

  const comments = useMemo(() => {
    return liveComments
      .filter((comment) => canViewComment(comment, currentUser))
      .filter(
        (comment) => String(comment.subjectId || "") === String(subjectId || "")
      )
      .map((comment) => ({
        id: comment.id,
        studyId: comment.study || fallbackStudyId || "—",
        subjectDocument: comment.document
          ? `${comment.subjectId} / ${comment.document}`
          : comment.subjectId,
        comment: comment.description || "—",
        by: comment.createdBy || "—",
        author: comment.createdBy || "—",
        date: comment.createdAt || "—",
        status: comment.status,
        _raw: comment,
      }));
  }, [liveComments, subjectId, currentUser, fallbackStudyId]);

  const canEditRow = (row) => {
    if (!row) {
      return false;
    }
    const record = row._raw || row;
    return (
      canWriteComments(currentUser) &&
      (record.createdBy === currentUser?.name ||
        ["Admin", "Site Staff", "PI"].includes(currentUser?.role))
    );
  };

  const handleAddClick = () => {
    if (!canWriteComments(currentUser)) {
      return;
    }
    setShowAddModal(true);
  };

  // Route the modal payload through the same useComments().addComment used
  // everywhere else. It calls addCommentRecord under the hood, which updates
  // CommentsContext so this table refreshes automatically.
  const handleAddSubmit = (payload) => {
    const text = (payload?.comment || payload?.text || "").trim();
    if (!text || !subjectId) {
      setShowAddModal(false);
      return;
    }

    addComment?.("", {
      text,
      subjectId,
      study: fallbackStudyId,
    });

    // Behaviour: "Reset to Page 1 after Add Comment". The row count
    // change alone would already trigger the DataTable's built-in
    // reset, but we bump the reset key explicitly so the requirement
    // is honoured even in edge cases (e.g. filter/search hides the
    // newly-added row).
    setPaginationResetKey((value) => value + 1);
    setShowAddModal(false);
  };

  const handleEditSubmit = (payload) => {
    const text = (payload?.comment || payload?.text || "").trim();
    if (!text || !editTarget) {
      setEditTarget(null);
      return;
    }

    updateComment?.(editTarget.id, { description: text });
    setEditTarget(null);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) {
      return;
    }

    deleteComment?.(deleteTarget.id);
    setDeleteTarget(null);
  };

  const tableColumns = [
    { key: "id", label: "ID" },
    { key: "studyId", label: "Study ID" },
    { key: "subjectDocument", label: "Subject/Document" },
    { key: "comment", label: "Comment" },
    { key: "author", label: "Author" },
    { key: "date", label: "Date" },
    { key: "status", label: "Status" },
    {
      key: "_actions",
      label: "Actions",
      render: (_value, row) => (
        <div className="subject-comments-row-actions">
          <button
            type="button"
            className="subject-comments-action-btn"
            onClick={() => setEditTarget(row)}
            disabled={!canEditRow(row)}>

            Edit
          </button>
          <button
            type="button"
            className="subject-comments-action-btn danger"
            onClick={() => setDeleteTarget(row)}
            disabled={!canEditRow(row)}>

            Delete
          </button>
        </div>
      ),
    },
  ];

  const tableFilters = [
    { key: "status", label: "Status" },
    { key: "author", label: "Author" },
    { key: "date", label: "Date" },
  ];

  const body = (
    <div className="subject-comments-body">
      {canWriteComments(currentUser) && (
        <div className="subject-comments-toolbar">
          <button
            type="button"
            className="subject-comments-add-btn"
            onClick={handleAddClick}>

            + Add Comment
          </button>
        </div>
      )}

      <DataTable
        title="Subject Comments"
        columns={tableColumns}
        data={comments}
        emptyMessage="No comments for this subject"
        pagination
        initialPageSize={10}
        pageSizeOptions={[5, 10, 20, 50]}
        // Phase-6 Subject Comments Pagination:
        //   • initialPageSize=10           → Default 10 rows
        //   • pageSizeOptions=[5,10,20,50] → Rows per page picker
        //   • Previous / Next buttons come from the shared DataTable
        //   • resetPageKey                 → jump to page 1 on Add
        //     Comment and on Subject change, without duplicating any
        //     pagination code here.
        resetPageKey={`${subjectId || ""}::${paginationResetKey}`}
        searchable
        searchPlaceholder="Search comments..."
        searchFields={[
          "id",
          "studyId",
          "subjectDocument",
          "comment",
          "author",
          "date",
          "status",
        ]}
        filters={tableFilters}
      />

      {showAddModal && (
        <CommentModal
          visitId=""
          subject={subjectId || ""}
          visit=""
          onSubmit={handleAddSubmit}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editTarget && (
        <CommentModal
          visitId=""
          subject={subjectId || ""}
          visit=""
          mode="edit"
          initialText={
            editTarget._raw?.description ||
            (editTarget.comment === "—" ? "" : editTarget.comment) ||
            ""
          }
          initialResolved={
            String(editTarget.status || "").toLowerCase() === "resolved"
          }
          onSubmit={handleEditSubmit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmationModal
          title="Delete Comment"
          itemType="comment"
          message={`Delete comment ${deleteTarget.id}? This cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );

  if (!asModal) {
    return <div className="subject-comments-inline">{body}</div>;
  }

  return (
    <div
      className="subject-comments-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Subject Comments">

      <div className="subject-comments-modal">
        <div className="subject-comments-modal-header">
          <h2>Subject Comments</h2>
          <button
            type="button"
            className="subject-comments-modal-close"
            onClick={onClose}
            aria-label="Close Subject Comments">

            ×
          </button>
        </div>
        <div className="subject-comments-modal-content">{body}</div>
        <div className="subject-comments-modal-footer">
          <button
            type="button"
            className="subject-comments-close-btn"
            onClick={onClose}>

            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubjectComments;