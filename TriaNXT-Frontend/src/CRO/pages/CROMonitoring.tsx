import React, { useMemo } from "react";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import StatusBadge from "./StatusBadge";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import { formatScheduleDisplayDate } from "../../shared/utils/formatScheduleDisplayDate";
import { isPastCalendarDate } from "../../shared/services/visitScheduleService";

// Full, top-level "Upcoming Monitoring Visits" business table (reached via the
// dashboard widget's "View All" and the sidebar's "Monitoring" link). This is
// distinct from the small dashboard preview widget (UpcomingMonitoringVisits.js,
// which stays fixed-size and out of pagination scope). This table now goes
// through the shared DataTable (search → filter → pagination) instead of a
// bespoke, unpaginated table, per the Upcoming Visits Pagination requirement.
function CROMonitoring() {
  const { visits } = useCROData();

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const completedCount = visits.filter((v) => v.status === "Completed").length;
  const pendingCount = visits.filter((v) => v.status === "Pending").length;
  const overdueCount = visits.filter((v) => {
    if (v.status === "Completed") return false;
    return isPastCalendarDate(v.date);
  }).length;

  const columns = useMemo(
    () => [
      { key: "id", label: "Visit ID" },
      {
        key: "site",
        label: "Site",
        render: (value) => displaySite(value)
      },
      { key: "cra", label: "CRA" },
      { key: "visitType", label: "Visit Type" },
      {
        key: "date",
        label: "Date",
        render: (value) => formatScheduleDisplayDate(value)
      },
      {
        key: "status",
        label: "Status",
        render: (value) => <StatusBadge status={value} />
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [siteSources]
  );

  return (
    <CROLayout>
      <div className="cro-monitoring-page tnxt-compact">
        <h1>Monitoring</h1>

        <div className="cro-stats-grid">
          <div className="cro-card">
            <h3>Total Visits</h3>
            <h2>{visits.length}</h2>
          </div>

          <div className="cro-card">
            <h3>Completed</h3>
            <h2>{completedCount}</h2>
          </div>

          <div className="cro-card">
            <h3>Pending</h3>
            <h2>{pendingCount}</h2>
          </div>

          <div className="cro-card">
            <h3>Overdue</h3>
            <h2>{overdueCount}</h2>
          </div>
        </div>

        <DataTable
          title="Upcoming Monitoring Visits"
          columns={columns}
          data={visits}
          emptyMessage="No Visits Found"
          searchable
          searchPlaceholder="Search Visit ID..."
          searchFields={["id"]}
          filters={[{ key: "status", label: "Status" }]}
          pagination
          initialPageSize={10}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>
    </CROLayout>
  );
}

export default CROMonitoring;