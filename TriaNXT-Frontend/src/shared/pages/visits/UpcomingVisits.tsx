// FULL UPCOMING VISITS PAGE (Phase-8, IMP-1 / IMP-2)
//
// A dedicated, top-level Upcoming Visits page, separate from the small
// Dashboard preview widget (UpcomingVisitsWidget.js), which stays
// unpaginated by design.
//
// Data pipeline (matches the required architecture):
//   canonical visit schedules -> role/site authorization -> upcoming filter
//   -> search/filter/pagination (shared DataTable)
//
// Authorization + site scoping happen inside useVisitSchedules /
// getFilteredSchedules before this component ever sees the rows, so
// search/filter/pagination below operate only on already-authorized data.

import { useMemo } from "react";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import DataTable from "../../components/dashboard/shared/DataTable";
import KPICard from "../../components/dashboard/shared/KPICard";
import useVisitSchedules from "../../hooks/useVisitSchedules";
import {
  isUpcomingVisitSchedule,
  mapScheduleToTableRow,
} from "../../services/visitScheduleService";
import { formatScheduleDisplayDate } from "../../utils/formatScheduleDisplayDate";
import "../../styles/AdminPage.css";
import "./StudyVisits.css";

function UpcomingVisits() {
  const { schedules } = useVisitSchedules();

  const upcomingVisits = useMemo(
    () =>
      schedules
        .filter((item) => isUpcomingVisitSchedule(item))
        .map(mapScheduleToTableRow),
    [schedules],
  );

  const next7DaysCount = useMemo(() => {
    const now = Date.now();
    const weekOut = now + 7 * 24 * 60 * 60 * 1000;
    return upcomingVisits.filter((visit) => {
      const time = new Date(visit.date).getTime();
      return Number.isFinite(time) && time >= now && time <= weekOut;
    }).length;
  }, [upcomingVisits]);

  return (
    <DashboardLayout>
      <div className="admin-page upcoming-visits-page">
        <div className="admin-page-title">
          <h1>Upcoming Visits</h1>
          <p>Full schedule of upcoming subject visits across your accessible studies and sites</p>
        </div>

        <div className="admin-kpi-grid">
          <KPICard
            title="Total Upcoming"
            value={upcomingVisits.length}
            subtitle="Scheduled Visits"
            icon="📅"
          />
          <KPICard
            title="Next 7 Days"
            value={next7DaysCount}
            subtitle="Visits Due Soon"
            icon="⏱️"
          />
        </div>

        <div className="admin-table-section">
          <DataTable
            title="Upcoming Visits"
            columns={[
              { key: "subjectId", label: "Subject", width: "140px" },
              { key: "visit", label: "Visit" },
              {
                key: "date",
                label: "Date",
                width: "150px",
                render: (value) => formatScheduleDisplayDate(value),
              },
              { key: "status", label: "Status", width: "130px" },
              { key: "study", label: "Study", width: "140px" },
              { key: "site", label: "Site", width: "160px" },
            ]}
            data={upcomingVisits}
            searchable
            searchPlaceholder="Search upcoming visits..."
            searchFields={["subjectId", "visit", "status", "study", "site"]}
            filters={[
              { key: "study", label: "Study" },
              { key: "site", label: "Site" },
              { key: "status", label: "Status" },
            ]}
            pagination
            initialPageSize={10}
            emptyMessage="No upcoming visits scheduled."
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default UpcomingVisits;
