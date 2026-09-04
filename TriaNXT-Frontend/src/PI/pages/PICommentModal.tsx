import { useState } from "react";
import { useComments } from "../../shared/comments/CommentsContext";
import { getCurrentUser } from "../../shared/services/roleService";
import "../styles/PICommentModal.css";

export default function PICommentModal({
  onClose,
  onSubmit,
  subject = "",
  visit = "",
  study = "",
}: any) {
  const { addComment, resolveComment } = useComments();
  const currentUser = getCurrentUser();
  const [text, setText] = useState("");
  const [resolved, setResolved] = useState(false);

  const submit = () => {
    if (onSubmit) {
      onSubmit({
        text,
        subject,
        visit,
        study,
        status: resolved ? "resolved" : "open",
      });
    } else {
      const record = addComment?.("", {
        text,
        subjectId: subject,
        visitName: visit,
        study,
      });

      if (resolved && record?.id) {
        resolveComment?.(record.id);
      }
    }

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Add Comment</h2>

        <label>
          <input
            type="checkbox"
            checked={resolved}
            onChange={(event) => setResolved(event.target.checked)}
          />
          Mark Resolved
        </label>

        <div className="comment-user">
          <b>{currentUser?.name || "Current User"}</b>
          <small>{new Date().toLocaleDateString()}</small>
        </div>

        <textarea
          placeholder="Write a comment..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>

          <button className="submit-btn" onClick={submit}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
