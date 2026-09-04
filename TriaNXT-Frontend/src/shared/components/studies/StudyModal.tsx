import { useEffect } from "react";
import "../../pages/studies/Studies.css";

/**
 * StudyModal
 * ----------------------------------------------------------------
 * Phase 7 — IMP-MOD-1 "Standardize Study Modal"
 *
 * A single, reusable modal shell for every Study create/edit modal
 * flow (currently duplicated by hand in Studies.js "Add Study" and
 * StudyDashboard.js "Edit Study"). This component owns ONLY the
 * standardized structure — title, subtitle, close button, body
 * wrapper, error banner, loading state, and Cancel/Submit actions.
 * It intentionally does NOT own field definitions or form state, so
 * each existing consumer keeps its own `form`/`editForm` state and
 * `handleChange`/`handleSubmit` logic untouched; they only need to
 * render their existing <div className="study-form-grid"> fields as
 * `children`.
 *
 * This keeps the visual output byte-identical to what Studies.css
 * already styles today (.study-modal-overlay, .study-modal,
 * .study-modal-header, .study-form-grid, .study-modal-actions), so
 * wiring existing pages up to this component is a drop-in, zero
 * regression change. It additionally stamps the generic
 * `.tnxt-modal-header` / `.tnxt-modal-body` / `.tnxt-modal-footer`
 * hooks that the Shared Compact UI System (IMP-6.3,
 * src/styles/ctms-compact.css) already anticipates, and exposes a
 * `compact` prop that opts a given modal instance into
 * `.tnxt-compact-modal` spacing without affecting any other modal.
 *
 * Props:
 *  - isOpen         {boolean}  Whether the modal is rendered. Defaults to
 *                              true so callers may keep using their existing
 *                              `{flag && <StudyModal>...</StudyModal>}` guard.
 *  - mode           {"add"|"edit"} Controls default title/labels. Default "add".
 *  - title          {string}   Overrides the default mode-based title.
 *  - subtitle       {string}   Overrides the default mode-based subtitle.
 *  - onClose        {function} Called on close button, overlay click, Escape,
 *                              and (unless a custom footer is supplied) Cancel.
 *  - onSubmit       {function} Called with the form submit event.
 *  - submitLabel    {string}   Overrides the default mode-based submit label.
 *  - cancelLabel    {string}   Defaults to "Cancel".
 *  - submitDisabled {boolean}  Disables the submit button (in addition to loading).
 *  - loading        {boolean}  Shows a saving state and disables Cancel/Submit.
 *  - error          {string}   Renders a standardized error banner in the body.
 *  - compact        {boolean}  Opts into Shared Compact UI System modal spacing.
 *  - closeAriaLabel {string}   Overrides the default mode-based aria-label.
 *  - footer         {node}     Optional custom footer; replaces the default
 *                              Cancel/Submit action bar entirely when provided.
 *  - children       {node}     The modal body content (e.g. the existing
 *                              .study-form-grid field markup).
 */
function StudyModal({
  isOpen = true,
  mode = "add",
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel,
  cancelLabel = "Cancel",
  submitDisabled = false,
  loading = false,
  error = "",
  compact = false,
  closeAriaLabel,
  footer,
  children,
}: any) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading && onClose) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) {
    return null;
  }

  const resolvedTitle = title || (mode === "edit" ? "Edit Study" : "Add Study");
  const resolvedSubtitle =
    subtitle !== undefined
      ? subtitle
      : mode === "edit"
      ? "Update all study details and save changes."
      : "Enter the study, site and subject details.";
  const resolvedSubmitLabel =
    submitLabel || (mode === "edit" ? "Save Changes" : "Submit Study");
  const resolvedCloseAriaLabel =
    closeAriaLabel ||
    (mode === "edit" ? "Close edit study modal" : "Close add study form");

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget && !loading && onClose) {
      onClose();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }
    if (onSubmit) {
      onSubmit(event);
    }
  };

  const handleCancel = () => {
    if (!loading && onClose) {
      onClose();
    }
  };

  return (
    <div
      className="study-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      role="presentation"
    >
      <form
        className={`study-modal${compact ? " tnxt-compact-modal" : ""}`}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={resolvedTitle}
      >
        <div className="study-modal-header tnxt-modal-header">
          <div>
            <h2>{resolvedTitle}</h2>
            {resolvedSubtitle && <p>{resolvedSubtitle}</p>}
          </div>

          <button
            type="button"
            onClick={handleCancel}
            aria-label={resolvedCloseAriaLabel}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="study-modal-body tnxt-modal-body">
          {error && (
            <div
              className="study-modal-error"
              role="alert"
              style={{
                marginBottom: "1rem",
                padding: "10px 14px",
                borderRadius: "0.5rem",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: "0.8125rem",
                fontWeight: 600,
              }}>

              {error}
            </div>
          )}

          {children}
        </div>

        {footer !== undefined ? (
          footer
        ) : (
          <div className="study-modal-actions tnxt-modal-footer">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleCancel}
              disabled={loading}>

              {cancelLabel}
            </button>

            <button
              type="submit"
              className="add-study-btn"
              disabled={loading || submitDisabled}>

              {loading ? "Saving..." : resolvedSubmitLabel}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default StudyModal;