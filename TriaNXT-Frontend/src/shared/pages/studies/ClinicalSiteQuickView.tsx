import React, { useEffect } from "react";
import "./ClinicalSiteQuickView.css";
import { resolveSiteDisplay } from "../../utils/siteDisplay";

function ClinicalSiteQuickView({ site, study, onClose }: any) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!site) {
    return null;
  }

  const enrolled = site.enrolled ?? site.subjectsEnrolled ?? 0;
  const target = site.target ?? site.targetSubjects ?? 0;

  const enrollmentProgress =
    target > 0 ? Math.min(Math.round((enrolled / target) * 100), 100) : 0;

  return (
    <div
      className="clinical-site-quick-view-overlay"
      onClick={onClose}>

      <div
        className="clinical-site-quick-view-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinical-site-quick-view-title"
        onClick={(event) => event.stopPropagation()}>

        <div className="clinical-site-quick-view-header">
          <div>
            <h2 id="clinical-site-quick-view-title">
              Clinical Site Quick View
            </h2>

            <p>{resolveSiteDisplay(site)}</p>
          </div>

          <button
            type="button"
            className="clinical-site-quick-view-close"
            onClick={onClose}
            aria-label="Close quick view">

            ×
          </button>
        </div>

        <div className="clinical-site-quick-view-grid">
          <div className="clinical-site-quick-view-item">
            <span>Site ID</span>
            <strong>{site.id || "—"}</strong>
          </div>

          <div className="clinical-site-quick-view-item">
            <span>Site</span>
            <strong>{resolveSiteDisplay(site)}</strong>
          </div>

          <div className="clinical-site-quick-view-item">
            <span>PI</span>
            <strong>{study?.principalInvestigator || "—"}</strong>
          </div>

          <div className="clinical-site-quick-view-item">
            <span>CRO</span>
            <strong>{study?.cro || "—"}</strong>
          </div>

          <div className="clinical-site-quick-view-item">
            <span>Site Status</span>
            <strong>{site.status || "—"}</strong>
          </div>

          <div className="clinical-site-quick-view-item">
            <span>Clinical Study</span>
            <strong>{study?.name || study?.protocol || "—"}</strong>
          </div>
        </div>

        <div className="clinical-site-enrollment-section">
          <div className="clinical-site-enrollment-header">
            <span>Enrollment Progress</span>

            <strong>
              {enrolled} / {target}
            </strong>
          </div>

          <div className="clinical-site-enrollment-track">
            <div
              className="clinical-site-enrollment-fill"
              style={{ width: `${enrollmentProgress}%` }}
            />
          </div>

          <p>{enrollmentProgress}% of target enrolled</p>
        </div>
      </div>
    </div>
  );
}

export default ClinicalSiteQuickView;