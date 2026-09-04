import "./DocumentsUnderApprovalWidget.css";
import { getDocumentsUnderApproval } from "../services/dashboardService";

export default function DocumentsUnderApprovalWidget({
  documents = [],
  approvalDocuments = null,
  title = "Documents Under Approval",
  maxItems = 5,
}: any) {
  const pendingDocuments =
    approvalDocuments || getDocumentsUnderApproval(documents);

  return (
    <div className="documents-under-approval-widget">
      <div className="widget-header">
        <h3>{title}</h3>
      </div>

      <div className="widget-body">
        <div className="approval-count">
          {pendingDocuments.length}
        </div>

        {pendingDocuments.length === 0 ? (
          <div className="empty-message">
            No documents awaiting approval.
          </div>
        ) : (
          <ul className="approval-list">
            {pendingDocuments
              .slice(0, maxItems)
              .map((document) => (
                <li
                  key={document.id || document.name}
                  className="approval-item">

                  {document.name || "Unnamed Document"}
                </li>
              ))}

            {pendingDocuments.length > maxItems && (
              <li className="more-items">
                +{pendingDocuments.length - maxItems} more...
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}