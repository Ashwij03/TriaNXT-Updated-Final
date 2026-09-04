import React, { useMemo } from "react";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import CROStatusBadge from "./CROStatusBadge";
import EmptyState from "./EmptyState";
import { useNavigate } from "react-router-dom";
import { FaTimes } from "react-icons/fa";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { isInScreeningSubjectStatus } from "../../shared/utils/normalizeStatus";

function CROScreening() {
  const { subjects } = useCROData();
  const navigate = useNavigate();

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  // Pre-enrollment funnel under the shared contract: any subject whose
  // canonical status is Screened (covers raw "Screening" and "Screened"
  // tokens) is "in screening" here — same bucket the Site Staff/Admin
  // analytics call "Screened".
  const screeningSubjects = subjects.filter(
    (s) =>
      isInScreeningSubjectStatus(s.status) ||
      isInScreeningSubjectStatus(s.visit)
  );

  return (
    <CROLayout>
      <h1 style={{ marginBottom: "1.5625rem" }}>Screening</h1>

      <div className="cro-summary-cards">
        <div className="dashboard-card">
          <h3>In Screening</h3>
          <h1>{screeningSubjects.length}</h1>
        </div>
        <div className="dashboard-card">
          <h3>Total Subjects</h3>
          <h1>{subjects.length}</h1>
        </div>
      </div>

      <div className="cro-panel">
        <h2>Screening Subjects</h2>
        {screeningSubjects.length === 0 ? (
          <EmptyState title="No Subjects in Screening" />
        ) : (
          <div className="cro-table-wrap tnxt-compact">
            <table className="cro-data-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Study</th>
                  <th>Site</th>
                  <th>Current Visit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {screeningSubjects.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.study}</td>
                    <td>{displaySite(s.site)}</td>
                    <td>{s.visit}</td>
                    <td>
                      <CROStatusBadge status={s.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cro-btn-sm"
                        onClick={() => navigate(`/cro-subject/${s.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CROLayout>
  );
}

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

export default CROScreening;
