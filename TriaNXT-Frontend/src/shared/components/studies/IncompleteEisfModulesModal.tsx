import { useEffect } from "react";
import "../../pages/studies/Studies.js";
import "../../pages/studies/Studies.css";

// Item 13 — Dedicated dialog for displaying ALL currently incomplete eISF
// modules. The list is passed in from the same shared health summary that
// powers the eISF Summary KPI card, so this popup automatically reflects
// any upload/delete/approval/completion change without maintaining a
// separate static list.
function IncompleteEisfModulesModal({ modules, onClose }: any) {
  const list = Array.isArray(modules) ? modules : [];

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="study-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="study-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Incomplete eISF Modules"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="study-modal-header">
          <div>
            <h2>Incomplete eISF Modules</h2>
            <p>
              {list.length === 0
                ? "All eISF modules are complete."
                : `${list.length} module${list.length === 1 ? "" : "s"} still awaiting document uploads.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close incomplete eISF modules dialog"
          >
            ×
          </button>
        </div>
        {list.length > 0 && (
          <ul className="study-health-incomplete-list study-health-incomplete-list--all">
            {list.map((entry) => (
              <li
                key={entry.id || entry.title}
                className="study-health-incomplete-item">

                <span className="study-health-incomplete-title">
                  {entry.title}
                </span>
                {entry.id != null && (
                  <span className="study-health-incomplete-id">
                    {entry.id}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="study-modal-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}>

            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default IncompleteEisfModulesModal;
