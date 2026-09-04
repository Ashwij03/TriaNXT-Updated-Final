import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdWarningAmber, MdErrorOutline } from "react-icons/md";

import { getFileTypeMeta } from "./fileTypes";
import { formatFileSize } from "./fileService";

/**
 * Subject Explorer - Delete File confirmation dialog (Phase 4, req. 4).
 *
 * Mirrors DeleteFolderDialog so folder and file deletion feel identical.
 * Shows the file's identity (icon, name, size, folder) before confirming,
 * because filenames alone are easy to mistake in a long list.
 *
 * Props
 *   file         record being deleted
 *   folderName   display name of the owning folder
 *   submitError  error returned by the service on confirm
 *   onConfirm    () => void
 *   onClose      () => void
 */
function DeleteFileDialog({
  file,
  folderName = "",
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

  const { Icon, label, tone } = getFileTypeMeta(file?.name);

  // Portalled to <body> so no page wrapper's overflow can clip the dialog.
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
        aria-label="Delete file"
      >
        <div className="sxm-header">
          <div className="sxm-header-title">
            <span className="sxm-header-icon sxm-header-icon--danger">
              <MdWarningAmber size={17} />
            </span>
            <div>
              <h3>Delete File</h3>
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
          <div className="sf-delete-target">
            <span className={`sf-file-icon sf-file-icon--${tone}`} aria-hidden="true">
              <Icon size={17} />
            </span>
            <div className="sf-delete-target-text">
              <strong title={file?.name}>{file?.name}</strong>
              <span>
                {label} · {formatFileSize(file?.size)}
              </span>
            </div>
          </div>

          <p className="sxm-confirm-text">
            This file will be removed from{" "}
            <strong>{folderName || "this folder"}</strong>.
          </p>

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
              Delete File
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DeleteFileDialog;
