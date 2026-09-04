import "./Files.css";
import { useNavigate } from "react-router-dom";

	export default function Files() {
	  const navigate = useNavigate(); // ✅ CORRECT PLACE

	  return (
	    <div className="files-box tnxt-compact">
      <h3>Files</h3>

      {/* TOP */}
      <div className="files-top">
        <span>Showing 1 to 7 of 7 entries</span>

        <div>
          Previous 		<span
		  className="link"
		  onClick={() => navigate("/file-details")}>

		  Lab Report
		</span>
        </div>
      </div>

      {/* FILTER */}
      <div className="files-filter">
        <div>
          Show 
          <select>
            <option>10</option>
          </select> 
          entries
        </div>

        <div>
          Search: <input />
        </div>
      </div>

      {/* TABLE */}
      <table className="files-table ctms-standard-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Subject / Patient</th>
            <th>Study</th>
            <th>Visit</th>
            <th>File Type</th>
            <th>e-Signed</th>
          </tr>
        </thead>

        <tbody>

          <tr>
            <td>
              📄 <span className="link">Lab Report</span><br />
              <small>(PDF 103.19KB)</small>
            </td>

            <td className="link">T-S 123-0001</td>

            <td>
              OBETICHOLIC ACID (OCA)<br />
              <small>747-303</small>
            </td>

            <td>
              Visit 1<br />
              <small>Screening 1</small>
            </td>

            <td>Lab Report</td>
            <td>08-FEB-2017</td>
          </tr>

          <tr>
            <td>
              📄 <span className="link">Other</span><br />
              <small>(PDF 14KB)</small>
            </td>

            <td className="link">T-S 123-0001</td>

            <td>
              OBETICHOLIC ACID (OCA)<br />
              <small>747-303</small>
            </td>

            <td>
              Visit 1<br />
              <small>Screening 1</small>
            </td>

            <td>Other</td>
            <td>24-OCT-2022</td>
          </tr>

          <tr>
            <td>
              📄 <span className="link">Informed Consent</span><br />
              <small>(PDF 1MB)</small>
            </td>

            <td className="link">T-S 123-0001</td>

            <td>
              OBETICHOLIC ACID (OCA)<br />
              <small>747-303</small>
            </td>

            <td>
              Visit<br />
              <small>Unscheduled</small>
            </td>

            <td>Informed Consent</td>
            <td>13-OCT-2022</td>
          </tr>

        </tbody>
      </table>

    </div>
  );
}