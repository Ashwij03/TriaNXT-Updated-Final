import React, { useEffect, useRef } from "react";
import {
  MdClose,
  MdDownload,
  MdDriveFileRenameOutline,
  MdDeleteOutline,
  MdInfoOutline,
  MdCheckCircle,
} from "react-icons/md";

import { getFileTypeMeta, isPreviewableImage, getExtension } from "./fileTypes";
import { formatFileSize, formatDateTime } from "./fileService";

/**
 * Subject Explorer - File details panel (Update 7).
 *
 * ------------------------------------------------------------------
 * Renders INLINE, docked to the right of the Subject file table - this is
 * no longer a popup/modal. It is mounted directly by `SubjectFileManager`
 * inside its `.sf-body-details` pane, sitting beside `.sf-body-list`
 * (which holds the table) rather than being portalled over the page.
 *
 * The layout and interaction are modelled on the eISF `DocumentViewer`
 * split-view panel (its `inline` mode, in
 * `pages/shared/EISF/components/DocumentViewer.js`) purely as a visual/UX
 * reference: fixed metadata header up top (icon, name, actions, close),
 * a scrollable preview surface below it. Subjects does NOT import that
 * component - this file is Subjects' own implementation of the same
 * pattern, built from the file fields Subjects already tracks.
 * ------------------------------------------------------------------
 *
 * Props
 *   file        file record to show, or null/undefined to show the
 *               "nothing selected" placeholder
 *   folderName  display name of the owning folder
 *   onRename    () => void
 *   onDownload  () => void
 *   onDelete    () => void
 *   onClose     () => void  - closes the panel (hands control back to the
 *                             parent, which unmounts it)
 *   locked      true when the owning folder is a system folder (ICF) -
 *               Rename/Delete are not rendered at all (Update: this panel
 *               used to render them unconditionally, which is exactly the
 *               "hidden action" a locked file's Rename/Delete could still
 *               be reached through even with the row-level menu fixed)
 */

/**
 * Decode a `data:` URL back to text for the .txt preview.
 *
 * TextDecoder handles UTF-8 correctly, so accented and non-Latin characters
 * survive the base64 round-trip (a plain `atob` would mangle them).
 */
function decodeTextDataUrl(dataUrl) {
  try {
    const base64 = String(dataUrl).split(",")[1];
    if (!base64) return "";

    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function FilePreviewModal({
  file,
  folderName = "",
  onRename,
  onDownload,
  onDelete,
  onClose,
  locked = false,
  canApprove = false,
  onApprove,
}: any) {
  const closeRef = useRef(null);

  /* Move focus into the panel whenever it opens, or when the selected file
     changes while it's already open - same "here's what you just opened"
     cue the old modal gave, without stealing focus from the table on every
     re-render. */
  useEffect(() => {
    closeRef.current?.focus();
  }, [file?.id]);

  /* Escape closes the panel, same as it closed the old modal. Safe to keep
     global: this panel only exists while it's the thing the user is
     looking at. */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!file) {
    return (
      <div className="sf-details-panel sf-details-panel--empty">
        <span className="sf-details-empty-icon" aria-hidden="true">
          <MdInfoOutline size={26} />
        </span>
        <h3>No file selected</h3>
        <p>Select a file from the table to view its details here.</p>
      </div>
    );
  }

  const { Icon, label, tone, group } = getFileTypeMeta(file.name);
  const hasContent = Boolean(file.hasContent && file.dataUrl);
  const showImage = hasContent && isPreviewableImage(file.name);
  const showText = hasContent && group === "text";

  const extension = getExtension(file.name);

  const details = [
    { label: "File Name", value: file.name, wrap: true },
    {
      label: "File Type",
      value: extension ? `${label} (.${extension})` : label,
    },
    { label: "File Size", value: formatFileSize(file.size) },
    { label: "Folder", value: folderName || "—", wrap: true },
    { label: "Uploaded Date", value: formatDateTime(file.uploadedAt) },
    { label: "Last Modified", value: formatDateTime(file.modifiedAt) },
    { label: "Uploaded By", value: file.uploadedBy },
    { label: "Status", value: file.status },
    ...(file.approvedBy
      ? [{ label: "Approved By", value: file.approvedBy }]
      : []),
    ...(file.approvedAt
      ? [{ label: "Approved On", value: formatDateTime(file.approvedAt) }]
      : []),
  ];

  return (
    <div
      className="sf-details-panel"
      role="region"
      aria-label={`Details for ${file.name}`}
    >
      {/* Fixed header: title + metadata - never scrolls with the preview. */}
      <div className="sf-details-panel-meta">
        <div className="sf-details-panel-title">
          <span
            className={`sf-file-icon sf-file-icon--${tone} sf-file-icon--lg`}
            aria-hidden="true"
          >
            <Icon size={19} />
          </span>

          <div className="sf-details-panel-title-text">
            <h3 title={file.name}>{file.name}</h3>
            <span>
              {label} · {formatFileSize(file.size)}
            </span>
          </div>

          <div className="sf-details-panel-actions">
            {canApprove &&
              String(file.status || "").trim().toLowerCase() ===
                "pending review" && (
                <button
                  type="button"
                  className="sf-btn sf-btn--primary"
                  onClick={() => onApprove?.()}
                >
                  <MdCheckCircle size={14} aria-hidden="true" />
                  <span>Approve</span>
                </button>
              )}

            <button
              type="button"
              className="sf-btn sf-btn--ghost"
              onClick={() => onDownload?.()}
            >
              <MdDownload size={14} aria-hidden="true" />
              <span>Download</span>
            </button>

            {/* Fix (this update): Rename/Delete used to render unconditionally
                here regardless of the owning folder's lock state - a locked
                file's Rename/Delete were still reachable through this panel
                even after the row-level 3-dot menu correctly hid them. Now
                gone from the DOM entirely (not just hidden) when locked. */}
            {!locked && (
              <>
                <button
                  type="button"
                  className="sf-btn sf-btn--ghost"
                  onClick={() => onRename?.()}
                >
                  <MdDriveFileRenameOutline size={14} aria-hidden="true" />
                  <span>Rename</span>
                </button>

                <button
                  type="button"
                  className="sf-btn sf-btn--ghost sf-btn--danger"
                  onClick={() => onDelete?.()}
                >
                  <MdDeleteOutline size={14} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </>
            )}

            <button
              type="button"
              ref={closeRef}
              className="sf-details-panel-close"
              onClick={onClose}
              aria-label="Close details panel"
              title="Close details panel"
            >
              <MdClose size={15} />
            </button>
          </div>
        </div>

        <dl className="sf-detail-grid sf-details-panel-grid">
          {details.map(({ label: key, value, wrap }) => (
            <div className="sf-detail-item" key={key}>
              <dt>{key}</dt>
              <dd className={wrap ? "is-wrap" : ""} title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Scrollable preview surface. */}
      <div className="sf-details-panel-preview">
        <div className="sf-preview-stage sf-details-panel-stage">
          {showImage ? (
            <img src={file.dataUrl} alt={file.name} className="sf-preview-image" />
          ) : showText ? (
            <pre className="sf-preview-text">{decodeTextDataUrl(file.dataUrl)}</pre>
          ) : (
            <div className={`sf-preview-placeholder sf-preview-placeholder--${tone}`}>
              <Icon size={40} aria-hidden="true" />
              <strong>{label} document</strong>
              <span>
                {hasContent
                  ? "Inline preview is not available for this format."
                  : "File contents are not stored locally for this record."}
              </span>
            </div>
          )}
        </div>

        {!hasContent && (
          <div className="sf-preview-note" role="note">
            <MdInfoOutline size={15} aria-hidden="true" />
            <span>
              Only file details are stored for this record. Downloading
              produces a summary placeholder until the backend is connected.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default FilePreviewModal;
