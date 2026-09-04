import { FiFileText } from "react-icons/fi";

function EssentialDocumentsWidget({ stats, onNavigateToEisf }: any) {
  const completedModules = stats?.completedModules ?? stats?.uploaded ?? 0;
  const totalModules = stats?.totalModules ?? stats?.expected ?? 22;
  const percent = stats?.percent ?? 0;

  return (
    <button
      type="button"
      className="study-widget-card study-widget-clickable"
      onClick={onNavigateToEisf}
    >
      <div className="study-widget-header">
        <FiFileText />
        <h3>Essential Documents</h3>
      </div>
      <div className="study-widget-progress">
        <div
          className="study-widget-progress-bar"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="study-widget-stat">
        {completedModules} of {totalModules} eISF modules complete ({percent}%)
      </p>
    </button>
  );
}

export default EssentialDocumentsWidget;
