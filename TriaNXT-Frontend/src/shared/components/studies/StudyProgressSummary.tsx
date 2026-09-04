import { FiBarChart2 } from "react-icons/fi";

function StudyProgressSummary({ progress }: any) {
  const items = [
    { label: "Subjects Screened", value: progress?.screened ?? 0 },
    { label: "Subjects Enrolled", value: progress?.enrolled ?? 0 },
    { label: "Subjects Ongoing", value: progress?.ongoing ?? 0 },
    { label: "Subjects Completed", value: progress?.completed ?? 0 },
  ];

  const allZero = items.every((item) => item.value === 0);

  return (
    <div className="study-widget-card">
      <div className="study-widget-header">
        <FiBarChart2 />
        <h3>Study Progress Summary</h3>
      </div>
      {allZero ? (
        <p className="study-widget-empty">No study activity recorded yet</p>
      ) : (
        <div className="study-progress-grid">
          {items.map((item) => (
            <div key={item.label} className="study-progress-item">
              <span className="study-progress-value">{item.value}</span>
              <span className="study-progress-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudyProgressSummary;
