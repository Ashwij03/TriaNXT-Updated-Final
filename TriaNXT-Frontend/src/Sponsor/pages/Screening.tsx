import React, { useEffect, useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import "../styles/Screening.css";
import { useNavigate } from "react-router-dom";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import { getAllSubjects } from "../../shared/services/subjectService";

/**
 * Read screening records dynamically from the real subjectsByStudy store.
 * Subjects whose status indicates screening (or whose visit contains
 * "screening") are mapped to screening rows with real study/site/PI data.
 * Modeled after src/CRO/pages/Screening.js's readScreeningRecords.
 */
function readScreeningRecords() {
  try {
    return getAllSubjects().map((subject, index) => {
      const studyCode = subject.studyId;
      return {
        id: subject.screeningId || `SCR-${studyCode}-${subject.id || index}`,
        subjectId: subject.id || subject.subjectId || "",
        study: studyCode,
        site: subject.site || "",
        pi: subject.pi || "",
        status: subject.status || "Pending",
        screeningDate: subject.screeningDate || subject.createdAt || "—",
        eligibility:
          subject.status === "Screen Failed" || subject.status === "Withdrawn"
            ? "Not Eligible"
            : subject.status === "Active" || subject.status === "Enrolled"
            ? "Eligible"
            : "Under Review",
      };
    });
  } catch {
    return [];
  }
}

function Screening() {
	const navigate = useNavigate();
	const [inputValue, setInputValue] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedScreening, setSelectedScreening] = useState(null);
	const [selectedSite, setSelectedSite] = useState("All Sites");
	const [selectedStatus, setSelectedStatus] = useState("All Status");
	const [screenings, setScreenings] = useState(readScreeningRecords);

	useEffect(() => {
	  const refresh = () => setScreenings(readScreeningRecords());
	  window.addEventListener("subjects-updated", refresh);
	  window.addEventListener("studies-updated", refresh);
	  return () => {
	    window.removeEventListener("subjects-updated", refresh);
	    window.removeEventListener("studies-updated", refresh);
	  };
	}, []);

	const siteSources = useMemo(() => getStudies(), []);
	const displaySite = (value) =>
	  value
	    ? resolveSiteDisplay(value, {
	        sources: siteSources,
	        fallback: value
	      })
	    : "—";
	const filteredScreenings = screenings.filter((screening) => {

	  const matchesSearch =
	    screening.id.toLowerCase().includes(
	      searchTerm.toLowerCase()
	    );

	  const matchesSite =
	    selectedSite === "All Sites" ||
	    screening.site === selectedSite;

	  const matchesStatus =
	    selectedStatus === "All Status" ||
	    screening.status === selectedStatus;

	  return (
	    matchesSearch &&
	    matchesSite &&
	    matchesStatus
	  );
	});
  return (
    <AppLayout>

      <div className="screening-page tnxt-compact">

        <div className="page-header">
		
          <h1>Screening Management</h1>
        </div>
		<div className="search-container">
		<input
		  type="text"
		  placeholder="Search Screening ID..."
		  className="search-input"
		  value={inputValue}
		  onChange={(e) => setInputValue(e.target.value)}
		  onKeyDown={(e) => {
		    if (e.key === "Enter") {
		      setSearchTerm(inputValue);
		    }
		  }}
		/>
		</div>
		<select
		  value={selectedSite}
		  onChange={(e) => setSelectedSite(e.target.value)}
		>
		  <option>All Sites</option>
		  {[...new Set<any>(screenings.map((s) => s.site).filter(Boolean))].map((site) => (
		    <option key={site} value={site}>{displaySite(site)}</option>
		  ))}
		</select>

		<select
		  value={selectedStatus}
		  onChange={(e) => setSelectedStatus(e.target.value)}
		>
		  <option>All Status</option>
		  <option>Completed</option>
		  <option>Pending</option>
		  <option>Failed</option>
		</select>
		

        <div className="screening-card">
		<p>
		  Total Records: {filteredScreenings.length}
		</p>

          <table className="screening-table ctms-standard-table">

		  <thead>
		    <tr>
		      <th>Screening ID</th>
		      <th>Study</th>
		      <th>Site</th>
		      <th>PI</th>
		      <th>Status</th>
		      <th>Screening Date</th>
		      <th>Eligibility</th>
		      <th>Action</th>
		    </tr>
		  </thead>

            <tbody>

             {filteredScreenings.map((screening) => (

                <tr key={screening.id}>
				<td>{screening.id}</td>
				<td>{screening.study}</td>
				<td>{displaySite(screening.site)}</td>
				<td>{screening.pi}</td>
				<td>{screening.status}</td>
				<td>{screening.screeningDate}</td>
				<td>{screening.eligibility}</td>

				<td>
				<button
  className="view-btn"
  onClick={() => {
    navigate(`/study/${screening.id}`);
  }}
				>
  View
</button>
				</td>
                </tr>

              ))}

            </tbody>

          </table>

        </div>
		{selectedScreening && (
		  <div className="modal-overlay">

		    <div className="modal-content">

			<div className="details-card">

			  

			</div>

			<p>
			  Age Criteria: {selectedScreening.ageCriteria}
			</p>

			<p>
			  Consent Signed: {selectedScreening.consent}
			</p>

			<p>
			  Medical History: {selectedScreening.medicalHistory}
			</p>

			<p>
			  Lab Results: {selectedScreening.labResults}
			</p>
			{selectedScreening.failureReason && (
			  <>
			    <hr />

			    <h3>Failure Reason</h3>

			    <p>{selectedScreening.failureReason}</p>
			  </>
			)}
			<hr />

			<h3>Comments</h3>

			<p>{selectedScreening.comments}</p>

			<hr />

			<h3>Audit Information</h3>

			<p>
			  <strong>Reviewed By:</strong> {selectedScreening.reviewedBy}
			</p>

			<p>
			  <strong>Reviewed On:</strong> {selectedScreening.reviewedOn}
			</p>
		      <button
		        onClick={() => setSelectedScreening(null)}
		      >
		        Close
		      </button>

		    </div>

		  </div>
		)}

      </div>

    </AppLayout>
  );
}

export default Screening;