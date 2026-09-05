import { useEffect, useMemo, useState } from "react";
import "./ESignatureModal.css";
import {
  SIGNATURE_MEANINGS,
  createActionSignature,
  defaultMeaningForAction,
  confirmLabelForAction,
  getSignerIdentity,
  signatureMeaningLabel,
} from "../services/actionSignatureService";

/**
 * ESignatureModal — the mandatory E-Signature step shown BEFORE an
 * upload / create / edit (save, rename, replace) / delete of a document,
 * file or folder completes anywhere in the app.
 *
 * The acting user must:
 *   1. select the meaning of the signature (Approval / Review / Authorship /
 *      Verification),
 *   2. type their full printed name (pre-filled from the signed-in user).
 *
 * The signature is accepted on the strength of the already-authenticated
 * session — no password re-authentication step.
 *
 * On confirm the modal resolves with the recorded signature (identity,
 * meaning, printed name, timestamp and SHA-256 stamp) through `onSigned`.
 * The caller then performs the real mutation — if the user cancels the
 * signature step the action does NOT happen.
 *
 * Variants:
 *   mode === "delete"  danger layout: permanent-deletion warning banner and
 *                      red "Delete & Sign" button (same signature fields as
 *                      every other action).
 *   otherwise          upload / create -> "Upload & Sign",
 *                      edit / rename / replace -> "Save & Sign".
 */
export default function ESignatureModal({
  open,
  mode = "upload",
  entityType = "document",
  entityName = "",
  scope = {},
  actionLabel = "",
  confirmLabel = "",
  onClose,
  onSigned,
  submitting = false,
}: any) {
  const signer = useMemo(() => getSignerIdentity(), [open]);
  const actionKey = String(mode || "upload").toLowerCase();
  const isDelete = actionKey === "delete";

  const [meaning, setMeaning] = useState("");
  const [printedName, setPrintedName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMeaning(defaultMeaningForAction(actionKey));
      setPrintedName(signer.displayName || "");
      setError("");
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, entityName]);

  if (!open) return null;

  const meaningDescription = SIGNATURE_MEANINGS.find(
    (item) => item.value === meaning
  )?.description;

  const typeLabel =
    entityType === "folder"
      ? "folder"
      : entityType === "subject"
        ? "folder"
        : entityType === "file"
          ? "file"
          : "document";

  const entityDisplay =
    String(entityName || "").trim() || (isDelete ? "this item" : "your change");

  const finalConfirmLabel =
    confirmLabel ||
    (isDelete
      ? "Delete & Sign"
      : actionKey === "upload" || actionKey === "create"
        ? "Upload & Sign"
        : "Save & Sign");

  const handleConfirm = async () => {
    setError("");
    if (!meaning) {
      setError("Select the meaning of this signature.");
      return;
    }
    if (!String(printedName || "").trim()) {
      setError("Type your full printed name to sign.");
      return;
    }

    setBusy(true);
    const result = await createActionSignature({
      scope,
      entityType,
      entityName,
      action: actionKey,
      meaning,
      printedName,
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.error || "The E-Signature could not be recorded.");
      return;
    }
    try {
      await onSigned?.(result.signature);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="esig-backdrop" role="presentation">
      <div
        className={`esig-modal${isDelete ? " esig-modal--delete" : ""}${
          submitting || busy ? " esig-modal--busy" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="E-Signature"
      >
        <div className="esig-header">
          <div>
            <h3>
              {isDelete ? "Delete requires an E-Signature" : "E-Signature required"}
            </h3>
            <span>
              {isDelete
                ? `Confirm deletion of ${typeLabel} — "${entityDisplay}"`
                : actionKey === "upload" || actionKey === "create"
                  ? `Authorize uploading ${typeLabel} — "${entityDisplay}"`
                  : `Authorize the change to ${typeLabel} — "${entityDisplay}"`}
            </span>
          </div>
          <button
            type="button"
            className="esig-close"
            onClick={onClose}
            aria-label="Close E-Signature dialog"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="esig-body">
          {/* Danger banner — delete only */}
          {isDelete && (
            <div className="esig-danger-banner">
              <span className="esig-danger-icon" aria-hidden="true">
                ⚠
              </span>
              <div>
                <strong>You are about to permanently delete “{entityDisplay}”.</strong>
                <span>This cannot be undone.</span>
              </div>
            </div>
          )}

          {actionLabel && (
            <p className="esig-action-note">{actionLabel}</p>
          )}

          {/* What will be recorded */}
          <div className="esig-document-card">
            <span className="pdf-file-icon">{typeLabel === "folder" ? "DIR" : "PDF"}</span>
            <div className="esig-document-meta">
              <strong title={entityDisplay}>{entityDisplay}</strong>
              <span>
                {isDelete
                  ? "Permanent deletion — recorded in the audit trail"
                  : "This E-Signature records who performed this action, when, and why"}
              </span>
            </div>
          </div>

          {error && <div className="esig-error">{error}</div>}

          {/* 1 — meaning */}
          <label htmlFor="esig-meaning">Meaning of signature *</label>
          <select
            id="esig-meaning"
            value={meaning}
            onChange={(event) => setMeaning(event.target.value)}
          >
            <option value="">Select the purpose of this signature</option>
            {SIGNATURE_MEANINGS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {meaningDescription && (
            <p className="esig-hint">{meaningDescription}</p>
          )}

          {/* 2 — printed name */}
          <label htmlFor="esig-printed-name">Full printed name *</label>
          <input
            id="esig-printed-name"
            type="text"
            autoComplete="off"
            value={printedName}
            onChange={(event) => setPrintedName(event.target.value)}
            placeholder="Type your full name as it should appear on the record"
          />
          <p className="esig-hint">
            Signing as {signer.displayName || signer.email || "the signed-in user"}
            {signer.email ? ` · ${signer.email}` : ""}
          </p>

          {/* 3 — confirmation note (identity comes from the signed-in
              session) */}
          <p className="esig-hint esig-confirm-note">
            By signing, you confirm this action is performed by you and for
            the stated meaning — it will be recorded in the audit trail.
          </p>

          {/* Signature stamp preview */}
          <p className="esig-stamp-note">
            {signatureMeaningLabel(meaning) || "E-Signature"} by{" "}
            {printedName || "you"} — a SHA-256 stamp of the recorded facts
            will be stored with the audit entry.
          </p>
        </div>

        <div className="esig-footer">
          <button type="button" className="esig-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={isDelete ? "esig-danger" : "esig-primary"}
            onClick={handleConfirm}
            disabled={busy || submitting}
          >
            {busy || submitting ? "Recording signature…" : finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
