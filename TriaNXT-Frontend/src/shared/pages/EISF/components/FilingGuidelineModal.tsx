import "./FilingGuidelineModal.css";

function buildGuidelines(moduleConfig: any = {},section: any = {}) {
  const sectionTitle = section.title || "this section";
  const moduleTitle = moduleConfig.title || "eISF";

  return [
    `File only documents that belong to ${sectionTitle} within the ${moduleTitle} module.`,
    "Use the latest approved version for active documents and keep superseded versions in the applicable superseded folder when available.",
    "Confirm document name, version, status, and last modified date before upload or metadata updates.",
    "Avoid duplicate files; use Version History for revised documents and Audit Trail for review evidence.",
  ];
}

export default function FilingGuidelineModal({
  open,
  moduleConfig,
  section,
  onClose,
}: any) {
  if (!open || !section) return null;

  const guidelines = buildGuidelines(moduleConfig, section);

  return (
    <div className="filing-guideline-backdrop" role="presentation">
      <div
        className="filing-guideline-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filing-guideline-title">

        <div className="filing-guideline-header">
          <div>
            <span>{moduleConfig?.id} {moduleConfig?.title}</span>
            <h3 id="filing-guideline-title">Filing Guidelines</h3>
          </div>

          <button
            type="button"
            className="filing-guideline-close"
            onClick={onClose}
            aria-label="Close filing guidelines">

            ×
          </button>
        </div>

        <div className="filing-guideline-body">
          <h4>{section.id} {section.title}</h4>
          <p>{section.description}</p>

          <ul>
            {guidelines.map((guideline) => (
              <li key={guideline}>{guideline}</li>
            ))}
          </ul>
        </div>

        <div className="filing-guideline-footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
