import { useState } from "react";
import { useComments } from "./CommentsContext";
import { getCurrentUser, getEffectiveRole } from "../services/roleService";
import { canWriteComments, canResolveComments } from "../services/commentService";
import "./CommentModal.css";

export default function CommentModal({
  onClose,
  visitId,
  onSubmit,

  subject = "SUB001",
  visit = "Screening",

  // Phase-7: edit-mode support. When initialText is supplied the modal
  // re-uses the existing Add Comment layout for editing so no separate
  // component is introduced.
  initialText = "",
  initialResolved = false,
  mode = "add",
  title,
  submitLabel,

  context = {},
  activityId = "",
  activityName = "",
  activityType = "",
  module = "",
  sourceView = "",
  study = "",
}: any) {
  const commentsContext = useComments();
  const currentUser = getCurrentUser();
  const [text, setText] = useState(initialText);
  const [resolved, setResolved] = useState(initialResolved);
  const isEdit = mode === "edit";
  const headerTitle = title || (isEdit ? "Edit Comment" : "Add Comment");
  const submitText = submitLabel || (isEdit ? "Save" : "Submit");

  // Use context object if provided, otherwise fall back to legacy props
  const contextData = {
    study: context.study || study || "",
    subject: context.subject || subject,
    activity: context.activity || activityName || "",
    site: context.site || "",
    module: context.module || module || "",
    sourceView: context.sourceView || sourceView || "",
    role: context.role || getEffectiveRole(currentUser) || "",
  };

  const submit = () => {
    if (!canWriteComments(currentUser)) {
      return;
    }

    if (onSubmit) {
      onSubmit({
        id: Date.now(),
        subject: contextData.subject,
        visit,
        date: new Date().toLocaleDateString(),
        comment: text,
        status: resolved ? "resolved" : "open",
      });
    } else {
      const record = commentsContext?.addComment?.(visitId, {
        text,
        subjectId: contextData.subject,
        visitName: visit,
        study: contextData.study,
        activity: contextData.activity,
        site: contextData.site,
        module: contextData.module,
        sourceView: contextData.sourceView,
        role: contextData.role,
      });

      if (resolved && record?.id && canResolveComments(currentUser)) {
        commentsContext?.resolveComment?.(record.id);
      }
    }

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>{headerTitle}</h3>

        {/* Auto-populated context fields - read-only preview */}
        <div className="comment-context-preview">
          {contextData.study && (
            <div className="context-field">
              <span className="context-label">Study:</span>
              <span className="context-value">{contextData.study}</span>
            </div>
          )}
          {contextData.subject && (
            <div className="context-field">
              <span className="context-label">Subject:</span>
              <span className="context-value">{contextData.subject}</span>
            </div>
          )}
          {contextData.activity && (
            <div className="context-field">
              <span className="context-label">Activity:</span>
              <span className="context-value">{contextData.activity}</span>
            </div>
          )}
          {contextData.site && (
            <div className="context-field">
              <span className="context-label">Site:</span>
              <span className="context-value">{contextData.site}</span>
            </div>
          )}
          {contextData.module && (
            <div className="context-field">
              <span className="context-label">Module:</span>
              <span className="context-value">{contextData.module}</span>
            </div>
          )}
          {contextData.sourceView && (
            <div className="context-field">
              <span className="context-label">Source View:</span>
              <span className="context-value">{contextData.sourceView}</span>
            </div>
          )}
          {contextData.role && (
            <div className="context-field">
              <span className="context-label">Role:</span>
              <span className="context-value">{contextData.role}</span>
            </div>
          )}
        </div>

        <label>
          <input
            type="checkbox"
            checked={resolved}
            onChange={(e) => setResolved(e.target.checked)}
            disabled={!canResolveComments(currentUser)}
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
          onChange={(e) => setText(e.target.value)}
        />

        <button onClick={submit}>{submitText}</button>
        <button onClick={onClose} style={{ marginLeft: "0.625rem" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}