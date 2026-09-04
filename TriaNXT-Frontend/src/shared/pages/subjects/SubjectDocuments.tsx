import DocumentFolderManager from "../../components/DocumentFolderManager";
import "./SubjectDocuments.css";

function SubjectDocuments({ subject }: any) {
  const subjectId = subject?.subjectId || subject?.id || "unknown";

  return (
    <div className="subject-documents tnxt-compact">

      <DocumentFolderManager
  sectionId="subjects"
  contextKey={subjectId}
  title="Subject Documents"
  layout="explorer"
/>

      {/* Subject Timeline */}
      <div className="subject-extra-section">
        <h3>Subject Timeline</h3>

        <table className="table ctms-standard-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>2026-06-01</td>
              <td>Screened</td>
            </tr>

            <tr>
              <td>2026-06-05</td>
              <td>Enrolled</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Visit History */}
      <div className="subject-extra-section">
        <h3>Visit History</h3>

        <table className="table ctms-standard-table">
          <thead>
            <tr>
              <th>Visit</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Visit 1</td>
              <td>2026-06-10</td>
              <td>Completed</td>
            </tr>

            <tr>
              <td>Visit 2</td>
              <td>2026-06-20</td>
              <td>Scheduled</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Activity Log */}
      <div className="subject-extra-section">
        <h3>Activity Log</h3>

        <table className="table ctms-standard-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Activity</th>
              <th>User</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>2026-06-01</td>
              <td>Subject Created</td>
              <td>Admin</td>
            </tr>

            <tr>
              <td>2026-06-05</td>
              <td>Visit Updated</td>
              <td>Coordinator</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default SubjectDocuments;