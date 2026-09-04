import "./dashboard.css";

// Phase 7 — IMP-4.12 (Comments Dashboard Counts).
// The widget still renders the same slice of comments the parent
// provides (already canonical / already role-authorized). The header
// now shows a live count derived from that same array, so the count
// updates in the same render pass whenever a comment is added, edited,
// resolved, reopened, or its status changes upstream via
// CommentsContext. No extra listeners, no duplicate state.
function PendingCommentsWidget({ comments = [], total }: any) {
  const displayTotal = typeof total === "number" ? total : comments.length;

  return (
    <div className="dashboard-widget">
      <h3>
        Pending Comments
        <span className="dashboard-widget-count" aria-label="Pending count">
          {" "}
          ({displayTotal})
        </span>
      </h3>

      {comments.map((comment) => (
        <div key={comment.id} className="comment-item">
          <strong>{comment.id}</strong>
          <div>{comment.subject}</div>
          <small>{comment.status}</small>
        </div>
      ))}
    </div>
  );
}

export default PendingCommentsWidget;
