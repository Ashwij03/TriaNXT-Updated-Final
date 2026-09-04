import "./MissingDocumentsWidget.css";
import { getMissingDocuments } from "../services/dashboardService";

export default function MissingDocumentsWidget({
  documents = [],
  missingDocuments = null,
  title = "Missing Documents",
  maxItems = 5,
}: any) {
  const missing =
    missingDocuments || getMissingDocuments(documents);

  return (
    <div className="missing-documents-widget">
      <div className="widget-header">
        <h3>{title}</h3>
      </div>

      <div className="widget-body">
        <div className="missing-count">
          {missing.length}
        </div>

        {missing.length === 0 ? (
          <div className="empty-message">
            No missing documents.
          </div>
        ) : (
          <ul className="missing-list">
            {missing.slice(0, maxItems).map((document) => (
              <li
                key={document.id || document.name}
                className="missing-item">

                {document.name || "Unnamed Document"}
              </li>
            ))}

            {missing.length > maxItems && (
              <li className="more-items">
                +{missing.length - maxItems} more...
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}