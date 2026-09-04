import { useState } from "react";
import { submitAccessRequest } from "../services/accessPermissionService";
import { getCurrentUser } from "../services/roleService";
import "./RequestPermissionButton.css";

function RequestPermissionButton({
  action,
  module,
  recordId = "",
  recordName = "",
  studyCode = "",
  label = "Request Permission",
  className = "request-permission-btn",
  variant = "button",
}: any) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      alert("Please provide a reason for this permission request.");
      return;
    }

    setSubmitting(true);
    const user = getCurrentUser();
    submitAccessRequest(
      {
        action,
        module,
        recordId,
        recordName,
        studyCode,
        reason: reason.trim(),
        studySubject: recordName || recordId || module,
        accessType: action,
        notes: reason.trim(),
      },
      user,
    );
    setSubmitting(false);
    setOpen(false);
    setReason("");
    alert("Permission request submitted. An admin will review it shortly.");
  };

  return (
    <>
      <button
        type="button"
        className={`${className}${variant === "link" ? " request-permission-link" : ""}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>

      {open && (
        <div
          className="request-permission-overlay"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="request-permission-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-labelledby="request-permission-title"
          >
            <h3 id="request-permission-title">Request Permission</h3>
            <p className="request-permission-subtitle">
              Submit a request for admin approval to perform this action.
            </p>

            <dl className="request-permission-details">
              <div>
                <dt>Action</dt>
                <dd>{action}</dd>
              </div>
              <div>
                <dt>Module</dt>
                <dd>{module}</dd>
              </div>
              {studyCode && (
                <div>
                  <dt>Study</dt>
                  <dd>{studyCode}</dd>
                </div>
              )}
              {recordId && (
                <div>
                  <dt>Record ID</dt>
                  <dd>{recordId}</dd>
                </div>
              )}
              {recordName && (
                <div>
                  <dt>Record</dt>
                  <dd>{recordName}</dd>
                </div>
              )}
            </dl>

            <form onSubmit={handleSubmit}>
              <label className="request-permission-label">
                Reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  placeholder="Explain why you need this permission..."
                  required
                />
              </label>

              <div className="request-permission-actions">
                <button
                  type="button"
                  className="request-permission-cancel"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="request-permission-submit"
                  disabled={submitting}
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default RequestPermissionButton;