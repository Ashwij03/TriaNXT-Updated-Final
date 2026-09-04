import useVisitSchedules from "../../hooks/useVisitSchedules";
import { formatScheduleDisplayDate } from "../../utils/formatScheduleDisplayDate";
import "./StudyVisits.css";

function StudyVisits({ setActiveTab }: any) {
  const { schedules } = useVisitSchedules();

  return (
    <div className="visits-page tnxt-compact">
      <button className="back-btn" onClick={() => setActiveTab("Overview")}>
        ← Back
      </button>

      <h2>Visits Management</h2>

      <div className="visit-table-wrapper">
        <table className="visit-table ctms-standard-table">
          <thead>
            <tr>
              <th>Visit ID</th>
              <th>Subject</th>
              <th>Visit</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={5}>No visits scheduled.</td>
              </tr>
            ) : (
              schedules.map((visit) => (
                <tr key={visit.id}>
                  <td>{visit.id}</td>
                  <td>{visit.subjectId || "—"}</td>
                  <td>{visit.visit || "—"}</td>
                  <td>{formatScheduleDisplayDate(visit.date)}</td>
                  <td>
                    <span
                      className={`status-badge ${String(
                        visit.status || "Scheduled"
                      ).toLowerCase()}`}>

                      {visit.status || "Scheduled"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StudyVisits;
