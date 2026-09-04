import { useState } from "react";
import { FiActivity } from "react-icons/fi";
import IncompleteEisfModulesModal from "./IncompleteEisfModulesModal";

function StudyHealthSummary({ health }: any) {
  const score = health?.score ?? 0;
  const status = health?.status ?? "Unknown";
  const factors = Array.isArray(health?.factors) ? health.factors : [];

  // Item 13 — Incomplete eISF module names are supplied by the shared
  // getStudyHealthSummary() service, which derives them dynamically from
  // the same 22-module completion breakdown used everywhere else. No
  // hardcoded module names, no separate static list.
  const incompleteModules = Array.isArray(health?.incompleteModules)
    ? health.incompleteModules
    : [];
  const previewLimit = 3;
  const preview = incompleteModules.slice(0, previewLimit);
  const hasMore = incompleteModules.length > previewLimit;
  const [showAllModal, setShowAllModal] = useState(false);

  return (
    <div
      className="study-widget-card study-health-card"
      aria-label="eISF Summary"
    >
      <div className="study-widget-header">
        <FiActivity />
        <h3>eISF Summary</h3>
      </div>
      <div className="study-health-score">
        <span className="study-health-value">{score}</span>
        <span className={`study-health-status status-${String(status).toLowerCase().replace(/\s+/g, "-")}`}>
          {status}
        </span>
      </div>
      {incompleteModules.length === 0 ? (
        factors.length === 0 ? (
          <p className="study-widget-empty">No contributing factors — study looks healthy</p>
        ) : (
          <ul className="study-health-factors">
            {factors.map((factor) => (
              <li key={factor.label}>
                <span>{factor.label}</span>
                <span className="impact-tag">{factor.impact}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="study-health-incomplete-modules">
          <p className="study-health-incomplete-label">
            Incomplete eISF Modules
          </p>
          <ul className="study-health-incomplete-list">
            {preview.map((moduleEntry) => (
              <li
                key={moduleEntry.id || moduleEntry.title}
                className="study-health-incomplete-item"
                title={moduleEntry.title}
              >
                {moduleEntry.title}
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              className="study-health-view-all"
              onClick={() => setShowAllModal(true)}>

              View All ({incompleteModules.length})
            </button>
          )}
        </div>
      )}
      {showAllModal && (
        <IncompleteEisfModulesModal
          modules={incompleteModules}
          onClose={() => setShowAllModal(false)}
        />
      )}
    </div>
  );
}

export default StudyHealthSummary;
