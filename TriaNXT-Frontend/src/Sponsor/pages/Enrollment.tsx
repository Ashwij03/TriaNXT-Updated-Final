import React, { useMemo } from 'react';
import AppLayout from './AppLayout';
import '../styles/Enrollment.css';
import { useNavigate } from "react-router-dom";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

const Enrollment = () => {

	const siteSources = useMemo(() => getStudies(), []);
	const displaySite = (value) =>
	  value
	    ? resolveSiteDisplay(value, {
	        sources: siteSources,
	        fallback: value
	      })
	    : "—";

	const enrollmentData = [
	  {
	    studyId: 'TRIA-001',
	    studyName: 'Diabetes Study',
	    site: 'Hyderabad',
	    target: 150,
	    enrolled: 120,
	    status: 'On Track'
	  },
	  {
	    studyId: 'TRIA-002',
	    studyName: 'Oncology Trial',
	    site: 'Bangalore',
	    target: 120,
	    enrolled: 95,
	    status: 'On Track'
	  },
	  {
	    studyId: 'TRIA-003',
	    studyName: 'Cardiology Study',
	    site: 'Chennai',
	    target: 100,
	    enrolled: 72,
	    status: 'At Risk'
	  },
	  {
	    studyId: 'TRIA-004',
	    studyName: 'Asthma Study',
	    site: 'Mumbai',
	    target: 180,
	    enrolled: 85,
	    status: 'Delayed'
	  },
	  {
	    studyId: 'TRIA-005',
	    studyName: 'Neurology Study',
	    site: 'Delhi',
	    target: 140,
	    enrolled: 110,
	    status: 'On Track'
	  }
	];
	const navigate = useNavigate();

  return (

    <AppLayout>

      <div className="enrollment-page tnxt-compact">

        <h1>Enrollment</h1>
		<div className="enrollment-summary">

		  <div className="summary-card">
		    <h3>Total Target</h3>
		    <p>690</p>
		  </div>

		  <div className="summary-card">
		    <h3>Total Enrolled</h3>
		    <p>482</p>
		  </div>

		  <div className="summary-card">
		    <h3>Remaining</h3>
		    <p>208</p>
		  </div>

		  <div className="summary-card">
		    <h3>Progress</h3>
		    <p>70%</p>
		  </div>

		</div>

        <table className="enrollment-table ctms-standard-table">

          <thead>

            <tr>

			<th>Study ID</th>
			<th>Study Name</th>
			<th>Site</th>
			<th>Target</th>
			<th>Enrolled</th>
			<th>Remaining</th>
			<th>Progress</th>
			<th>Status</th>
			<th>Action</th>

            </tr>

          </thead>

          <tbody>

            {
              enrollmentData.map((study) => {

                const remaining =
                  study.target - study.enrolled;

                const progress =
                  Math.round(
                    (study.enrolled / study.target) * 100
                  );

                return (

                  <tr key={study.studyId}>

				  <td>{study.studyId}</td>

				  <td>{study.studyName}</td>

				  <td>{displaySite(study.site)}</td>

				  <td>{study.target}</td>

				  <td>{study.enrolled}</td>

				  <td>{remaining}</td>

                    <td>

                      <div className="progress-wrapper">

                        <div
                          className="progress-bar"
                          style={{
                            width: `${progress}%`
                          }}
                        />

                      </div>

                      <span>
                        {progress}%
                      </span>

                    </td>
					<td>{study.status}</td>

					<td>
  <button
    className="view-btn"
    onClick={() => {
      navigate(`/study/${study.studyId}`);
    }}
  >
    View
  </button>
</td>
                  </tr>

                );

              })
            }

          </tbody>

        </table>

      </div>

    </AppLayout>

  );

};

export default Enrollment;