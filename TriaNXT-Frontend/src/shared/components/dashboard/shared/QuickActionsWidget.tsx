// QuickActionsWidget — study-scoped quick actions used by StudyDashboard.
// Reuses the shared "dashboard-widget" styling and delegates to react-router
// navigation for its links (Add Subject is handled by an injected callback so
// the parent can also toggle its active tab).

import { useNavigate } from "react-router-dom";
import {
  FiUserPlus,
  FiCalendar,
  FiFileText,
  FiMessageSquare,
} from "react-icons/fi";
import "./dashboard.css";

function QuickActionsWidget({
  study,
  studyCode,
  onAddSubject,
}: any) {
  const navigate = useNavigate();

  const resolvedStudyCode =
    studyCode ||
    study?.code ||
    study?.id ||
    study?.studyId ||
    "";

  const goToTab = (tab) => {
    if (!resolvedStudyCode) {
      return;
    }

    navigate(
      `/study-dashboard/${encodeURIComponent(resolvedStudyCode)}?tab=${encodeURIComponent(tab)}`,
    );
  };

  const actions = [
    {
      key: "add-subject",
      label: "Add Subject",
      icon: <FiUserPlus />,
      onClick: () => {
        if (typeof onAddSubject === "function") {
          onAddSubject();
        } else {
          goToTab("Subjects");
        }
      },
    },
    {
      key: "visit-plan",
      label: "Visit Plan",
      icon: <FiCalendar />,
      onClick: () => goToTab("Visit Plan"),
    },
    {
      key: "study-files",
      label: "Study Files",
      icon: <FiFileText />,
      onClick: () => goToTab("Study Files"),
    },
    {
      key: "comments",
      label: "Comments",
      icon: <FiMessageSquare />,
      onClick: () => goToTab("Comments"),
    },
  ];

  return (
    <div className="dashboard-widget quick-actions-widget">
      <h3>Quick Actions</h3>

      <div className="quick-actions-widget-grid">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className="quick-actions-widget-item"
            onClick={action.onClick}
          >
            <span className="quick-actions-widget-icon">{action.icon}</span>
            <span className="quick-actions-widget-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActionsWidget;
