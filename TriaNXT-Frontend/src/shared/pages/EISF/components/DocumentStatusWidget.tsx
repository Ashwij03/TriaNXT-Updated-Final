import "./DocumentStatusWidget.css";
import { getDocumentStatusSummary } from "../services/dashboardService";

const DEFAULT_STATUS_COLORS = {
  draft: "#64748b",
  pending: "#d97706",
  underReview: "#f59e0b",
  approved: "#16a34a",
  expired: "#dc2626",
  archived: "#6b7280",
};

export default function DocumentStatusWidget({
  documents = [],
  summary = null,
  title = "Document Status",
  statusColors = DEFAULT_STATUS_COLORS,
}: any) {
  const statusSummary =
    summary || getDocumentStatusSummary(documents);

  const statuses = Object.entries(statusSummary) as [string, number][];

  return (
    <div className="document-status-widget">
      <div className="widget-header">
        <h3>{title}</h3>
      </div>

      <div className="widget-body">
        {statuses.length === 0 ? (
          <div className="widget-empty">
            No documents available.
          </div>
        ) : (
          statuses.map(([status, count]) => (
            <div
              className="status-row"
              key={status}>

              <div className="status-info">
                <span
                  className="status-dot"
                  style={{
                    backgroundColor:
                      statusColors[status] || "#2563eb",
                  }}
                />

                <span className="status-label">
                  {status}
                </span>
              </div>

              <span className="status-count">
                {count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}