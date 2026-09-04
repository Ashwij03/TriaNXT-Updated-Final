// newly added

import { formatDateTimeUTC } from "../../utils/dateTime";
import "./SubjectAuditTrail.css";

function SubjectAuditTrail() {

  const subject =
    JSON.parse(
      localStorage.getItem(
        "selectedSubject"
      )
    );
  
  const logs = (
    JSON.parse(
      localStorage.getItem(
        "auditLogs"
      )
    ) || []
  ).filter(
    log =>
      String(log.subjectId) ===
      String(subject?.id)
  );

  return (

    <div className="subject-tab-card tnxt-compact">

      <div className="audit-header">
        <h2>Audit Trail</h2>
      </div>

      <table className="ctms-standard-table">

        <thead>

          <tr>

            <th>Action</th>
            <th>User</th>
            <th>Reason</th>
            <th>Timestamp</th>

          </tr>

        </thead>

        <tbody>

          {logs.length === 0 ? (

            <tr>

              <td
                colSpan={4}
                className="no-audit-data">

                No Audit Records Found
              </td>

            </tr>

          ) : (

            logs.map((log,index)=>(

              <tr key={index}>

                <td>
                  {log.action || "-"}
                </td>

                <td>
                  {
                    log.deletedBy ||
                    log.updatedBy ||
                    log.createdBy ||
                    log.performedBy ||
                    "-"
                  }
                </td>

                <td>
                  {log.reason || "-"}
                </td>

                <td>

                  {
                    log.updatedAt ||
                    log.deletedAt ||
                    log.createdAt
                      ? formatDateTimeUTC(
                          log.updatedAt ||
                          log.deletedAt ||
                          log.createdAt
                        )
                      : "-"
                  }

                </td>

              </tr>

            ))

          )}

        </tbody>

      </table>

    </div>

  );
}

export default SubjectAuditTrail;