// UPDATED: Recruitment page with dynamic funnel data from adminService

import "../../shared/styles/AdminPage.css";
import DashboardBarChart from "../../shared/components/dashboard/shared/DashboardBarChart";
import DashboardCard from "../../shared/components/dashboard/shared/DashboardCard";
import DashboardLayout from "../../shared/components/dashboard/shared/DashboardLayout";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import KPICard from "../../shared/components/dashboard/shared/KPICard";
import { getRecruitment } from "../../shared/services/adminService";

function Recruitment() {
  const recruitment = getRecruitment();
  const totalScreened = recruitment.reduce((sum, item) => sum + item.screened, 0);
  const totalEnrolled = recruitment.reduce((sum, item) => sum + item.enrolled, 0);
  const avgConversion = recruitment.length
    ? Math.round(
        recruitment.reduce((sum, item) => sum + item.conversionRate, 0) /
          recruitment.length
      )
    : 0;

  const chartData = recruitment.map((item) => ({
    name: item.source,
    value: item.enrolled
  }));

  return (
    <DashboardLayout>
      <div className="admin-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Recruitment</h1>
          <p>Screening funnel and conversion metrics by source</p>
        </div>

        <div className="admin-kpi-grid">
          <KPICard
            title="Screened"
            value={totalScreened}
            subtitle="Total Screened"
            icon="🔍"
          />
          <KPICard
            title="Enrolled"
            value={totalEnrolled}
            subtitle="Total Enrolled"
            icon="➕"
          />
          <KPICard
            title="Conversion"
            value={`${avgConversion}%`}
            subtitle="Average Rate"
            icon="📈"
          />
        </div>

        <DashboardCard title="Enrollments by Source">
          <DashboardBarChart data={chartData} />
        </DashboardCard>

        <div className="admin-table-section">
          <DataTable
            className="ctms-standard-table"
            title="Recruitment Sources"
            columns={[
              { key: "source", label: "Source" },
              { key: "site", label: "Site" },
              { key: "screened", label: "Screened" },
              { key: "enrolled", label: "Enrolled" },
              { key: "conversionRate", label: "Conversion %" }
            ]}
            data={recruitment}
            pagination
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Recruitment;
