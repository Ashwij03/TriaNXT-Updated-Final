import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdClose,
  MdDriveFileRenameOutline,
  MdErrorOutline,
} from "react-icons/md";

/**
 * Subject Explorer - Rename Folder modal (Phase 3).
 *
 * Pre-fills the current name and pre-selects it so the user can type over
 * it immediately. Validation is delegated to the caller (FolderTreeService)
 * which excludes the folder itself from the duplicate check.
 *
 * Props
 *   folder       the node being renamed ({ id, name, ... })
 *   parentName   display name of its parent ("" = root level)
 *   validate     (name) => { valid, error }
 *   submitError  error returned by the service on submit
 *   onSubmit     (name) => void
 *   onClose      () => void
 */
function RenameFolderModal({
  folder,
  parentName = "",
  validate,
  submitError = "",
  onSubmit,
  onClose,
}: any) {
  const [name, setName] = useState(folder?.name || "");
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

  const validation = useMemo(() => {
    if (typeof validate !== "function") return { valid: true, error: "" };
    return validate(name);
  }, [validate, name]);

  const liveError = touched && !validation.valid ? validation.error : "";
  const error = liveError || submitError;

  const unchanged = name.trim() === (folder?.name || "").trim();

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
    onSubmit?.(name.trim());
  };

  // Portalled to <body> so the sidebar's overflow cannot clip the modal.
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
        aria-label="Rename folder"
      >
        <div className="sxm-header">
          <div className="sxm-header-title">
            <span className="sxm-header-icon">
              <MdDriveFileRenameOutline size={17} />
            </span>
            <div>
              <h3>Rename Folder</h3>
              <p>Update the folder name shown in the explorer.</p>
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
            <span className="sxm-context-value" title={folder?.name}>
              {folder?.name}
            </span>
          </div>

          {parentName && (
            <div className="sxm-context">
              <span className="sxm-context-label">Parent</span>
              <span className="sxm-context-value" title={parentName}>
                {parentName}
              </span>
            </div>
          )}

          <label className="sxm-field">
            <span>
              New Name <em>*</em>
            </span>
            <input
              ref={inputRef}
              type="text"
              className={error ? "has-error" : ""}
              placeholder="Enter a new folder name"
              value={name}
              maxLength={80}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "sxm-rename-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setTouched(true);
              }}
            />
          </label>

          {error ? (
            <div className="sxm-error" id="sxm-rename-error" role="alert">
              <MdErrorOutline size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : (
            <p className="sxm-hint">
              Subfolders and their contents stay unchanged.
            </p>
          )}

          <div className="sxm-footer">
            <button type="button" className="sxm-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="sxm-btn sxm-btn--primary"
              disabled={!name.trim()}
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

export default RenameFolderModal;
