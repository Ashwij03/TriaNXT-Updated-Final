import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import { getAllSubjects } from "../../shared/services/subjectService";

/**
 * Look up a real screening record by its id from subjectsByStudy.
 * Returns null if the screening/subject is not found.
 */
function findScreeningRecord(screeningId) {
  try {
    const allSubjects = getAllSubjects();
    for (const subject of allSubjects) {
      const studyCode = subject.studyId;
      const sid = subject.id || subject.subjectId || "";
      if (sid === screeningId || (subject.screeningId || `SCR-${studyCode}-${sid}`) === screeningId) {
        return {
          id: subject.screeningId || `SCR-${studyCode}-${sid}`,
          subjectId: sid,
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
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function ScreeningDetails() {
	const navigate = useNavigate();

  const { id } = useParams();

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const screeningData = useMemo(() => findScreeningRecord(id), [id]);

  if (!screeningData) {
    return (
      <AppLayout>
        <div className="screening-details-page">
          <button className="back-btn" onClick={() => navigate("/screening")}>
            ← Back to Screening
          </button>
          <h1>Screening Details</h1>
          <div className="details-card">
            <p>No screening record found for <strong>{id}</strong>.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      <div className="screening-details-page">
	  
	  <button
	    className="back-btn"
	    onClick={() => navigate("/screening")}
	  >
	    ← Back to Screening
	  </button>

        <h1>Screening Details</h1>

        <div className="details-card">
		<div className="details-grid">

		  <div>
		    <p><strong>Screening ID:</strong> {screeningData.id}</p>
		    <p><strong>Subject ID:</strong> {screeningData.subjectId}</p>
		    <p><strong>Study:</strong> {screeningData.study}</p>
		    <p><strong>Site:</strong> {displaySite(screeningData.site)}</p>
		  </div>

		  <div>
		    <p><strong>PI:</strong> {screeningData.pi}</p>
		    <p><strong>Status:</strong> {screeningData.status}</p>
		    <p><strong>Date:</strong> {screeningData.screeningDate}</p>
		    <p><strong>Eligibility:</strong> {screeningData.eligibility}</p>
		  </div>

		</div>

          <h3>General Information</h3>

          <p><strong>Screening ID:</strong> {screeningData.id}</p>
          <p><strong>Subject ID:</strong> {screeningData.subjectId}</p>
          <p><strong>Study:</strong> {screeningData.study}</p>
          <p><strong>Site:</strong> {displaySite(screeningData.site)}</p>
          <p><strong>PI:</strong> {screeningData.pi}</p>
		  <p>
		    <strong>Status:</strong>

		    <span
		      className={`status-badge ${screeningData.status.toLowerCase()}`}
		    >
		      {screeningData.status}
		    </span>
		  </p>
          <p><strong>Screening Date:</strong> {screeningData.screeningDate}</p>
          <p><strong>Eligibility:</strong> {screeningData.eligibility}</p>

          <hr />

          <h3>Eligibility Review</h3>

          <p>No eligibility details available — records are derived from subject metadata.</p>

        </div>

      </div>

    </AppLayout>
  );
}

export default ScreeningDetails;