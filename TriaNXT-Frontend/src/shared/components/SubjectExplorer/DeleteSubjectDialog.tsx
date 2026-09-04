import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdWarningAmber, MdErrorOutline } from "react-icons/md";

/**
 * Subject Explorer - Delete Subject confirmation dialog (Update 6).
 *
 * Mirrors DeleteFolderDialog: deleting a subject also removes every folder
 * nested inside it, so the dialog states that count explicitly before
 * confirming (SUB-003 simply shows 0, since it starts empty).
 *
 * Props
 *   subject         subject node being deleted
 *   descendantCount number of nested folders that will also be removed
 *   submitError     error returned by the service on confirm
 *   onConfirm       () => void
 *   onClose         () => void
 */
function DeleteSubjectDialog({
  subject,
  descendantCount = 0,
  submitError = "",
  onConfirm,
  onClose,
}: any) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hasChildren = descendantCount > 0;

  // Portalled to <body> so the sidebar's overflow cannot clip the dialog.
  return createPortal(
    <div
      className="sxm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="sxm-modal sxm-modal--sm"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete subject"
      >

        <div className="sxm-header">
          <div className="sxm-header-title">
            <span className="sxm-header-icon sxm-header-icon--danger">
              <MdWarningAmber size={17} />
            </span>
            <div>
              <h3>Delete Subject</h3>
              <p>This action cannot be undone.</p>
            </div>
          </div>

          <button
            type="button"
            className="sxm-close"
            aria-label="Close"
            onClick={onClose}
          >
            <MdClose size={17} />
          </button>
        </div>

        <div className="sxm-body">
          <p className="sxm-confirm-text">
            Are you sure you want to delete <strong>{subject?.name}</strong>?
          </p>

          {hasChildren && (
            <div className="sxm-warning" role="note">
              <MdWarningAmber size={15} aria-hidden="true" />
              <span>
                {descendantCount} nested{" "}
                {descendantCount === 1 ? "folder" : "folders"} inside will also
                be deleted.
              </span>
            </div>
          )}

          {submitError && (
            <div className="sxm-error" role="alert">
              <MdErrorOutline size={15} aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="sxm-footer">
            <button type="button" className="sxm-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              ref={confirmRef}
              className="sxm-btn sxm-btn--danger"
              onClick={onConfirm}
            >
              Delete {hasChildren ? "All" : "Subject"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DeleteSubjectDialog;
