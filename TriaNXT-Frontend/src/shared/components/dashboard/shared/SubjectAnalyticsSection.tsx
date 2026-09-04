import DashboardCard from "./DashboardCard";
import DashboardPieChart from "./DashboardPieChart";
import DashboardBarChart from "./DashboardBarChart";
import { getSubjectStatusAnalytics } from "../../../utils/contentAccess";
import { getEnrollmentStatusAnalytics } from "../../../utils/enrollmentStatusAnalytics";
import "./SubjectAnalyticsSection.css";

function SubjectAnalyticsSection({
  subjects = [],
  studies = [],
  studyCode = null,
  compactKpis = false,
  // Task 6 (Study Details Subject Analytics): when a specific study's
  // planned vs. current subject counts are supplied, show a small
  // summary panel beside the Subject Status Analytics pie chart. Left
  // undefined/null on the Dashboard (multi-study) usage, so that view
  // is unaffected.
  plannedSubjects = null,
  currentSubjects = null,
}: any) {
  const subjectStatusData = getSubjectStatusAnalytics(subjects);
  const enrollmentStatusData = getEnrollmentStatusAnalytics(subjects, {
    studyCode,
    studies
  });

  const compactClass = compactKpis
    ? " subject-analytics-section--compact"
    : "";

  const showEnrollmentSummary =
    plannedSubjects !== null &&
    plannedSubjects !== undefined &&
    currentSubjects !== null &&
    currentSubjects !== undefined;

  return (
    <div className={`subject-analytics-section${compactClass}`}>
      <div className="subject-analytics-pair-grid">
        <DashboardCard title="Subject Status Analytics">
          <div className="subject-status-kpi-grid">
            {subjectStatusData.map((item) => (
              <div key={item.name} className="subject-status-kpi">
                <strong>{item.value}</strong>
                <span>{item.name}</span>
              </div>
            ))}
          </div>

          <div className="subject-status-chart-row">
            <div className="subject-status-chart-row-chart">
              <DashboardPieChart data={subjectStatusData} />
            </div>

            {showEnrollmentSummary && (
              <div className="subject-analytics-enrollment-summary">
                <div className="subject-analytics-enrollment-stat">
                  <span className="subject-analytics-enrollment-label">
                    Planned Subjects
                  </span>
                  <strong className="subject-analytics-enrollment-value">
                    {plannedSubjects}
                  </strong>
                </div>

                <div
                  className="subject-analytics-enrollment-divider"
                  aria-hidden="true"
                />

                <div className="subject-analytics-enrollment-stat">
                  <span className="subject-analytics-enrollment-label">
                    Current Subjects
                  </span>
                  <strong className="subject-analytics-enrollment-value">
                    {currentSubjects}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </DashboardCard>

        <DashboardCard title="Enrollment Status">
          <DashboardBarChart
            data={enrollmentStatusData}
            dataKey="value"
            fill="#2563eb"
          />
        </DashboardCard>
      </div>
    </div>
  );
}

export default SubjectAnalyticsSection;