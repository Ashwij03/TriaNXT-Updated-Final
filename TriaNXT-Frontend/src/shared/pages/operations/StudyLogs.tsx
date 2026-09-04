import "./StudyLogs.css";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";

export default function StudyLogs() {
  return (
    <DashboardLayout>
    <div className="logs-page tnxt-compact">

      <h2>Subject Logs</h2>

      <p className="sub-title">
        Screening Log
      </p>

      <div className="action-bar">

        <div className="left">

          <span>
            Showing 1 to 5 of 19 entries
          </span>

          <div className="entries">

            <span>Show</span>

            <select>
              <option>5</option>
              <option>10</option>
              <option>25</option>
            </select>

            <span>entries</span>

          </div>

        </div>

        <div className="right">

          <div className="buttons">
            <button>Copy</button>
            <button>Excel</button>
            <button>CSV</button>
            <button>PDF</button>
          </div>

          <div className="search-bar">
            <span>Search:</span>
            <input type="text" />
          </div>

        </div>

      </div>

      <table className="ctms-standard-table">

        <thead>
          <tr>
            <th>Subject ID</th>
            <th>Randomization ID</th>
            <th>Sex</th>
            <th>DOB</th>
            <th>Screening Date</th>
            <th>Status</th>
            <th>Status Changed As Of</th>
            <th>Reason</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>10</td>
            <td>-</td>
            <td>Female</td>
            <td>-</td>
            <td>28-FEB-2022</td>
            <td>In Screening</td>
            <td>26-OCT-2022</td>
            <td>--</td>
          </tr>
        </tbody>

      </table>

      <div className="pagination">

        <span>Previous</span>

        <span className="active">1</span>

        <span>2</span>

        <span>3</span>

        <span>4</span>

        <span>Next</span>

      </div>

    </div>
    </DashboardLayout>
  );
}