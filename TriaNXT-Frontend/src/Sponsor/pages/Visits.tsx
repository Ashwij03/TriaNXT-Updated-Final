import React, { useMemo } from "react";
import AppLayout from "./AppLayout";
import "../styles/Visits.css";
import { useNavigate } from "react-router-dom";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import useVisitSchedules from "../../shared/hooks/useVisitSchedules";
import {
  isCompletedVisitSchedule,
  isPastCalendarDate
} from "../../shared/services/visitScheduleService";
import { formatScheduleDisplayDate } from "../../shared/utils/formatScheduleDisplayDate";

// Full, top-level "Visit Tracking" business table for the Sponsor role
// (route /visits). Same shape of gap as CROMonitoring.js had: a full,
// unbounded business table that was rendering every row with no pagination.
// This now goes through the shared DataTable (search -> filter -> pagination)
// per the Upcoming Visits Pagination requirement, matching the CRO page.
function Visits() {
  const navigate = useNavigate();
  const { schedules, upcomingWindow } = useVisitSchedules({ daysAhead: 365 });
  const siteSources = useMemo(() => getStudies(), []);

  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const visits = useMemo(
    () =>
      schedules.map((schedule) => ({
        visitId: schedule.id,
        studyId: schedule.study || schedule.studyKey || "—",
        subject: schedule.subjectId || "—",
        site: schedule.site || "—",
        visit: schedule.visit || "—",
        scheduledDate: schedule.date,
        actualDate: isCompletedVisitSchedule(schedule) ? schedule.date : "",
        status: schedule.status || "Scheduled",
        deviation: schedule.deviation || "—"
      })),
    [schedules]
  );

  const completedCount = schedules.filter(isCompletedVisitSchedule).length;
  const missedCount = schedules.filter(
    (schedule) =>
      !isCompletedVisitSchedule(schedule) &&
      (String(schedule.status || "").toLowerCase() === "missed" ||
        isPastCalendarDate(schedule.date))
  ).length;
  const deviationCount = schedules.filter((schedule) =>
    Boolean(schedule.deviation)
  ).length;

  const columns = useMemo(
    () => [
      { key: "visitId", label: "Visit ID" },
      { key: "studyId", label: "Study" },
      { key: "subject", label: "Subject" },
      {
        key: "site",
        label: "Site",
        render: (value) => displaySite(value)
      },
      { key: "visit", label: "Visit Type" },
      {
        key: "scheduledDate",
        label: "Scheduled Date",
        render: (value) => formatScheduleDisplayDate(value)
      },
      {
        key: "actualDate",
        label: "Actual Date",
        render: (value) => (value ? formatScheduleDisplayDate(value) : "-")
      },
      {
        key: "status",
        label: "Status",
        render: (value) => (
          <span className={`status-badge ${value}`}>{value}</span>
        )
      },
      { key: "deviation", label: "Deviation" },
      {
        key: "action",
        label: "Action",
        render: (_value, row) => (
          <button
            className="view-btn"
            onClick={() =>
              navigate(`/visit-details/${encodeURIComponent(row.visitId)}`)
            }
          >
            View
          </button>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [siteSources]
  );

  return (
    <AppLayout>
      <div className="visits-page tnxt-compact">
        <h1>Visit Tracking</h1>

        <div className="visit-summary">
          <div className="summary-card">
            <h3>Completed Visits</h3>
            <p>{completedCount}</p>
          </div>

          <div className="summary-card">
            <h3>Upcoming Visits</h3>
            <p>{upcomingWindow.length}</p>
          </div>

          <div className="summary-card">
            <h3>Missed Visits</h3>
            <p>{missedCount}</p>
          </div>

          <div className="summary-card">
            <h3>Protocol Deviations</h3>
            <p>{deviationCount}</p>
          </div>
        </div>

        <DataTable
          title="Visit Tracking"
          columns={columns}
          data={visits}
          emptyMessage="No visits found."
          searchable
          searchPlaceholder="Search Visit ID..."
          searchFields={["visitId"]}
          pagination
          initialPageSize={10}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>
    </AppLayout>
  );
}

export default Visits;