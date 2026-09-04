import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdClose,
  MdDriveFileRenameOutline,
  MdErrorOutline,
} from "react-icons/md";

import { getBaseName, getExtension } from "./fileTypes";

/**
 * Subject Explorer - Rename File modal (Phase 4, requirement 4).
 *
 * Only the base name is editable; the extension is shown as a fixed suffix.
 * That keeps the derived file type and icon consistent and removes a whole
 * class of validation failures (a user cannot rename `.pdf` to `.exe`).
 *
 * Validation is delegated to the `validate` prop (FileService), which
 * excludes this file from the duplicate check, so the same rules drive live
 * typing feedback and the final submit.
 *
 * Props
 *   file         the record being renamed
 *   folderName   display name of the owning folder
 *   validate     (fullName) => { valid, error }
 *   submitError  error returned by the service on submit
 *   onSubmit     (fullName) => void
 *   onClose      () => void
 */
function RenameFileModal({
  file,
  folderName = "",
  validate,
  submitError = "",
  onSubmit,
  onClose,
}: any) {
  const extension = getExtension(file?.name);
  const [baseName, setBaseName] = useState(getBaseName(file?.name));
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /* Rebuild the full name so validation always sees the real filename. */
  const fullName = useMemo(() => {
    const trimmed = baseName.trim();
    if (!trimmed) return "";
    return extension ? `${trimmed}.${extension}` : trimmed;
  }, [baseName, extension]);

  const validation = useMemo(() => {
    if (typeof validate !== "function") return { valid: true, error: "" };
    return validate(fullName);
  }, [validate, fullName]);

  const liveError = touched && !validation.valid ? validation.error : "";
  const error = liveError || submitError;

  const unchanged = fullName === (file?.name || "").trim();

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched(true);

    if (!validation.valid) {
      inputRef.current?.focus();
      return;
    }
    // Nothing to persist - close quietly.
    if (unchanged) {
      onClose?.();
      return;
    }
    onSubmit?.(fullName);
  };

  // Portalled to <body> so no page wrapper's overflow can clip the modal.
  return createPortal(
    <div
      className="sxm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="sxm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Rename file"
      >
        <div className="sxm-header">
          <div className="sxm-header-title">
            <span className="sxm-header-icon">
              <MdDriveFileRenameOutline size={17} />
            </span>
            <div>
              <h3>Rename File</h3>
              <p>The file extension and type stay unchanged.</p>
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

        <form className="sxm-body" onSubmit={handleSubmit} noValidate>
          <div className="sxm-context">
            <span className="sxm-context-label">Current</span>
            <span className="sxm-context-value" title={file?.name}>
              {file?.name}
            </span>
          </div>

          {folderName && (
            <div className="sxm-context">
              <span className="sxm-context-label">Folder</span>
              <span className="sxm-context-value" title={folderName}>
                {folderName}
              </span>
            </div>
          )}

          <label className="sxm-field">
            <span>
              New Name <em>*</em>
            </span>
            <div className={`sf-rename-input${error ? " has-error" : ""}`}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter a new file name"
                value={baseName}
                maxLength={100}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "sf-rename-error" : undefined}
                onChange={(event) => {
                  setBaseName(event.target.value);
                  setTouched(true);
                }}
              />
              {extension && (
                <span className="sf-rename-ext" aria-hidden="true">
                  .{extension}
                </span>
              )}
            </div>
          </label>

          {error ? (
            <div className="sxm-error" id="sf-rename-error" role="alert">
              <MdErrorOutline size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : (
            <p className="sxm-hint">
              Names must be unique within this folder.
            </p>
          )}

          <div className="sxm-footer">
            <button type="button" className="sxm-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="sxm-btn sxm-btn--primary"
              disabled={!baseName.trim()}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default RenameFileModal;
