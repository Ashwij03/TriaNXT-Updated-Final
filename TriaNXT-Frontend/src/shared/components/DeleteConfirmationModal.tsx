import { useState } from "react";
import "./DeleteConfirmationModal.css";

export default function DeleteConfirmationModal({
  onClose,
  onConfirm,
  title = "Delete Item",
  message = "Are you sure you want to delete this item?",
  itemType = "item"
}: any) {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [deletedBy, setDeletedBy] = useState("");
  const [errors, setErrors] = useState<Record<string, any>>({});

  const validateForm = () => {
    const newErrors: Record<string, any> = {};;

    if (!confirmed) {
      newErrors.confirmed = "Please confirm the deletion";
    }

    if (!reason.trim()) {
      newErrors.reason = "Please provide a reason for deletion";
    }

    if (!deletedBy.trim()) {
      newErrors.deletedBy = "Please enter your name";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onConfirm({
        reason: reason.trim(),
        deletedBy: deletedBy.trim()
      });
    }
  };

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal-box">
        <div className="delete-modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="delete-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="delete-modal-content">
          <p className="delete-message">{message}</p>

          <div className="delete-form-group">
            <label htmlFor="reason">
              <span className="required">*</span> Reason for Deletion
            </label>
            <textarea
              id="reason"
              className={`delete-textarea ${
                errors.reason ? "error" : ""
              }`}
              placeholder={`Please provide a detailed reason for deleting this ${itemType}...`}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errors.reason) {
                  setErrors({ ...errors, reason: "" });
                }
              }}
              rows={4}
            />
            {errors.reason && (
              <span className="error-message">{errors.reason}</span>
            )}
          </div>

          <div className="delete-form-group">
            <label htmlFor="deletedBy">
              <span className="required">*</span> Your Name
            </label>
            <input
              id="deletedBy"
              type="text"
              className={`delete-input ${
                errors.deletedBy ? "error" : ""
              }`}
              placeholder="Enter your full name"
              value={deletedBy}
              onChange={(e) => {
                setDeletedBy(e.target.value);
                if (errors.deletedBy) {
                  setErrors({ ...errors, deletedBy: "" });
                }
              }}
            />
            {errors.deletedBy && (
              <span className="error-message">{errors.deletedBy}</span>
            )}
          </div>

          <div className="delete-checkbox-group">
            <label htmlFor="confirmation">
              <input
                id="confirmation"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => {
                  setConfirmed(e.target.checked);
                  if (errors.confirmed) {
                    setErrors({ ...errors, confirmed: "" });
                  }
                }}
              />
              <span>I understand this action cannot be undone</span>
            </label>
            {errors.confirmed && (
              <span className="error-message">{errors.confirmed}</span>
            )}
          </div>
        </div>

        <div className="delete-modal-actions">
          <button
            type="button"
            className="delete-cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-confirm-btn"
            onClick={handleSubmit}
            disabled={!confirmed}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
