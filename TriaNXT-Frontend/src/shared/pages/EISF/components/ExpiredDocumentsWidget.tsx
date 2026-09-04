import "./ExpiredDocumentsWidget.css";
import { getExpiredDocuments } from "../services/dashboardService";

export default function ExpiredDocumentsWidget({
  documents = [],
  expiredDocuments = null,
  title = "Expired Documents",
  maxItems = 5,
}: any) {
  const expired =
    expiredDocuments || getExpiredDocuments(documents);

  return (
    <div className="expired-documents-widget">
      <div className="widget-header">
        <h3>{title}</h3>
      </div>

      <div className="widget-body">
        <div className="expired-count">
          {expired.length}
        </div>

        {expired.length === 0 ? (
          <div className="empty-message">
            No expired documents.
          </div>
        ) : (
          <ul className="expired-list">
            {expired
              .slice(0, maxItems)
              .map((document) => (
                <li
                  key={document.id || document.name}
                  className="expired-item">

                  <div className="document-name">
                    {document.name || "Unnamed Document"}
                  </div>

                  <div className="expiry-date">
                    {document.expiryDate || "-"}
                  </div>
                </li>
              ))}

            {expired.length > maxItems && (
              <li className="more-items">
                +{expired.length - maxItems} more...
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}