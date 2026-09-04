import "./ExpiringSoonWidget.css";
import { getExpiringSoonDocuments } from "../utils/dashboardUtils";

export default function ExpiringSoonWidget({
  documents = [],
  expiringSoonDocuments = null,
  title = "Expiring Soon",
  days = 30,
  maxItems = 5,
}: any) {
  const expiring =
    expiringSoonDocuments ||
    getExpiringSoonDocuments(documents, days);

  return (
    <div className="expiring-soon-widget">
      <div className="widget-header">
        <h3>{title}</h3>
      </div>

      <div className="widget-body">
        <div className="expiring-count">
          {expiring.length}
        </div>

        {expiring.length === 0 ? (
          <div className="empty-message">
            No documents expiring soon.
          </div>
        ) : (
          <ul className="expiring-list">
            {expiring
              .slice(0, maxItems)
              .map((document) => (
                <li
                  key={document.id || document.name}
                  className="expiring-item">

                  <div className="document-name">
                    {document.name || "Unnamed Document"}
                  </div>

                  <div className="expiry-date">
                    {document.expiryDate || "-"}
                  </div>
                </li>
              ))}

            {expiring.length > maxItems && (
              <li className="more-items">
                +{expiring.length - maxItems} more...
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}