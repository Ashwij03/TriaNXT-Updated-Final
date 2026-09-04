import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdCreateNewFolder, MdErrorOutline } from "react-icons/md";

/**
 * Subject Explorer - Create Folder / Create Subfolder modal (Phase 3).
 *
 * One component covers both cases; only the copy changes. The caller
 * resolves which parent the folder goes under, so nesting depth is
 * unlimited without any extra logic here.
 *
 * Validation is delegated to the `validate` prop (FolderTreeService), so the
 * same rules run for live typing feedback and for the final submit.
 *
 * Props
 *   parentName  display name of the target parent ("" = root level)
 *   parentType  "subject" | "folder" | null
 *   variant     "folder" | "subfolder" - copy only
 *   validate    (name) => { valid, error }
 *   submitError error returned by the service on submit
 *   onSubmit    (name) => void
 *   onClose     () => void
 */
function CreateFolderModal({
  parentName = "",
  parentType = null,
  variant = "folder",
  validate,
  submitError = "",
  onSubmit,
  onClose,
}: any) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  const isSubfolder = variant === "subfolder";
  const title = isSubfolder ? "Create Subfolder" : "Create Folder";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /* Live validation: only surfaced once the user has typed or submitted. */
  const validation = useMemo(() => {
    if (typeof validate !== "function") return { valid: true, error: "" };
    return validate(name);
  }, [validate, name]);

  const liveError = touched && !validation.valid ? validation.error : "";
  const error = liveError || submitError;

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (!validation.valid) {
      inputRef.current?.focus();
      return;
    }
    onSubmit?.(name.trim());
  };

  const locationLabel = parentName
    ? `${parentType === "subject" ? "Subject" : "Folder"} · ${parentName}`
    : "Explorer root";

  // Portalled to <body>: the sidebar clips its overflow, which would
  // otherwise cut the modal off inside the tree panel.
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
        aria-label={title}
      >
        <div className="sxm-header">
          <div className="sxm-header-title">
            <span className="sxm-header-icon">
              <MdCreateNewFolder size={17} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>
                {isSubfolder
                  ? "The new folder will be nested inside the selected folder."
                  : "The new folder will be added at this level."}
              </p>
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
            <span className="sxm-context-label">Location</span>
            <span className="sxm-context-value" title={locationLabel}>
              {locationLabel}
            </span>
          </div>

          <label className="sxm-field">
            <span>
              Folder Name <em>*</em>
            </span>
            <input
              ref={inputRef}
              type="text"
              className={error ? "has-error" : ""}
              placeholder="e.g. Lab Reports"
              value={name}
              maxLength={80}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "sxm-create-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setTouched(true);
              }}
            />
          </label>

          {error ? (
            <div className="sxm-error" id="sxm-create-error" role="alert">
              <MdErrorOutline size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : (
            <p className="sxm-hint">
              Names must be unique within the same parent folder.
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
              {isSubfolder ? "Create Subfolder" : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default CreateFolderModal;
