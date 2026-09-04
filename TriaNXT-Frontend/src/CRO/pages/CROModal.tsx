import React from "react";
import { FaTimes } from "react-icons/fa";
import "../styles/CROModal.css";

function CROModal({
  open,
  isOpen,
  title,
  message,
  confirmLabel = "OK",
  onConfirm,
  onClose,
  children,
  footer,
  size,
}: any) {
  const visible = open ?? isOpen;
  if (!visible) return null;

  const isFormMode = Boolean(children || footer);

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    if (onClose) onClose();
  };

  return (
    <div className="cro-modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`cro-modal${size === "large" ? " cro-modal--large" : ""}${isFormMode ? " cro-modal--form" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cro-modal-title"
      >
        <div className="cro-modal-header">
          <h2 id="cro-modal-title">{title}</h2>
          <button
            type="button"
            className="cro-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        <div className="cro-modal-body">
          {isFormMode ? children : <p>{message}</p>}
        </div>

        {(footer || !isFormMode) && (
          <div className="cro-modal-footer">
            {footer || (
              <button
                type="button"
                className="cro-modal-btn-primary"
                onClick={handleConfirm}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CROAlertModal({ isOpen, open, title, message, onClose, confirmLabel = "OK" }: any) {
  return (
    <CROModal
      open={open ?? isOpen}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      onClose={onClose}
    />
  );
}

export default CROModal;
