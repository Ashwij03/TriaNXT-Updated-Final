import "./ProgressNotes.css";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";

export default function ProgressNotes() {
  return (
    <DashboardLayout>
    <div className="pn-box tnxt-compact">

      <h3>Progress Notes</h3>

      <div className="pn-top">
        <span>Showing 1 to 1 of 1 entries</span>

        <div>
          <button>Copy</button>
          <button>Excel</button>
          <button>CSV</button>
          <button>PDF</button>
        </div>
      </div>

      <div className="pn-filter">
        <div>
          Show 
          <select><option>5</option></select> entries
        </div>

        <div>
          Search: <input />
        </div>
      </div>

      <table className="pn-table ctms-standard-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Visit/Procedure</th>
            <th>Progress Note</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              ⚡<br />E-SIGNED
            </td>

            <td>
              <div className="link">Visit 6 - Month 6</div>
              <small>Genetic and Future Analysis Testing Consent</small>
            </td>

            <td>
              <div className="row">
                <span>21-SEP-2021 7:08AM</span>
                <span>Carol TestThree, DO</span>
              </div>
              <div>note</div>
              <div className="link">View more</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="pagination">
        Previous <span className="active">1</span> Next
      </div>

    </div>
    </DashboardLayout>
  );
}