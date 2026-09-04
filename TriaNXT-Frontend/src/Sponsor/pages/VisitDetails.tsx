import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import useVisitSchedules from "../../shared/hooks/useVisitSchedules";
import { isCompletedVisitSchedule } from "../../shared/services/visitScheduleService";
import { formatScheduleDisplayDate } from "../../shared/utils/formatScheduleDisplayDate";
import "../styles/VisitDetails.css";

function VisitDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schedules } = useVisitSchedules({ daysAhead: 365 });

  const decodedId = decodeURIComponent(id || "");
  const visit = useMemo(
    () => schedules.find((schedule) => String(schedule.id) === decodedId),
    [decodedId, schedules]
  );

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  if (!visit) {
    return (
      <AppLayout>
        <div className="visit-details-page">
          <h2>Visit Not Found</h2>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="visit-details-page">
        <button className="back-btn" onClick={() => navigate("/visits")}>
          Back to Visits
        </button>

        <h1>Visit Details</h1>

        <div className="details-card">
          <p><strong>Visit ID:</strong> {visit.id}</p>
          <p><strong>Study ID:</strong> {visit.study || visit.studyKey || "—"}</p>
          <p><strong>Subject ID:</strong> {visit.subjectId || "—"}</p>
          <p><strong>Site:</strong> {displaySite(visit.site)}</p>
          <p><strong>Visit Type:</strong> {visit.visit || "—"}</p>
          <p>
            <strong>Scheduled Date:</strong>{" "}
            {formatScheduleDisplayDate(visit.date)}
          </p>
          <p>
            <strong>Actual Date:</strong>{" "}
            {isCompletedVisitSchedule(visit)
              ? formatScheduleDisplayDate(visit.actualDate || visit.date)
              : "-"}
          </p>
          <p><strong>Status:</strong> {visit.status || "Scheduled"}</p>
          <p><strong>Protocol Deviation:</strong> {visit.deviation || "—"}</p>
          <p><strong>Notes:</strong> {visit.notes || "—"}</p>
        </div>
      </div>
    </AppLayout>
  );
}

export default VisitDetails;
