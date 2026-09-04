// UPDATED: Dynamic sites page wired to adminService localStorage data

import "../../shared/styles/AdminPage.css";
import DashboardLayout from "../../shared/components/dashboard/shared/DashboardLayout";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import KPICard from "../../shared/components/dashboard/shared/KPICard";
import { getSites } from "../../shared/services/adminService";

function Sites() {
  const sites = getSites();
  const activeSites = sites.filter((site) => site.status === "Active").length;
  const totalEnrolled = sites.reduce(
    (sum, site) => sum + Number(site.subjectsEnrolled || 0),
    0
  );

  return (
    <DashboardLayout>
      <div className="admin-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Sites</h1>
          <p>Operational site network overview</p>
        </div>

        <div className="admin-kpi-grid">
          <KPICard
            title="Total Sites"
            value={sites.length}
            subtitle="Configured Sites"
            icon="🏥"
          />
          <KPICard
            title="Active"
            value={activeSites}
            subtitle="Currently Active"
            icon="✅"
          />
          <KPICard
            title="Enrolled"
            value={totalEnrolled}
            subtitle="Subjects Across Sites"
            icon="👥"
          />
        </div>

        <div className="admin-table-section">
          <DataTable
            className="ctms-standard-table"
            title="Site Directory"
            columns={[
              { key: "id", label: "Site ID" },
              { key: "name", label: "Name" },
              { key: "location", label: "Location" },
              { key: "pi", label: "PI" },
              { key: "subjectsEnrolled", label: "Enrolled" },
              { key: "status", label: "Status" }
            ]}
            data={sites}
            pagination
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Sites;
