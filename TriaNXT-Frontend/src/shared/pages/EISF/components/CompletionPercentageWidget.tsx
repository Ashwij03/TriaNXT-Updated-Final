import "./CompletionPercentageWidget.css";
import { getDashboardSummary } from "../services/dashboardService";

export default function CompletionPercentageWidget({
  documents = [],
  summary = null,
  title = "Completion",
}: any) {
  const dashboardSummary =
    summary || getDashboardSummary(documents);

  const {
    completionPercentage = 0,
    approvedDocuments = 0,
    totalDocuments = 0,
  } = dashboardSummary;

  return (
    <div className="completion-widget">
      <div className="completion-widget-header">
        <h3>{title}</h3>
      </div>

      <div className="completion-widget-body">
        <div className="completion-percentage">
          {completionPercentage}%
        </div>

        <div className="completion-progress">
          <div
            className="completion-progress-fill"
            style={{
              width: `${completionPercentage}%`,
            }}
          />
        </div>

        <div className="completion-summary">
          {approvedDocuments} / {totalDocuments} Documents Complete
        </div>
      </div>
    </div>
  );
}