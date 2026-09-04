// UPDATED: Site Performance page with dynamic metrics + search + filters

import { useMemo, useState } from "react";
import DashboardLayout from "../../shared/components/dashboard/shared/DashboardLayout";
import DashboardCard from "../../shared/components/dashboard/shared/DashboardCard";
import DashboardBarChart from "../../shared/components/dashboard/shared/DashboardBarChart";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import { getSitePerformance } from "../../shared/services/adminService";
import { formatSiteLabel } from "../../shared/utils/siteDisplay";
import "../../shared/styles/AdminPage.css";

function SitePerformance() {
  const performance = getSitePerformance();

  // ===== SEARCH + FILTER STATE =====
  const [searchTerm, setSearchTerm] = useState("");
  const [siteFilter, setSiteFilter] = useState("All");

  // ===== UNIQUE SITE OPTIONS =====
  const siteOptions = useMemo(
    () => [
      "All",
      ...new Set<any>(
        performance
          .map((site) => formatSiteLabel(site))
          .filter(Boolean),
      ),
    ],
    [performance],
  );

  // ===== FILTERED DATA =====
  const filteredPerformance = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return performance.filter((site) => {
      const siteLabel = formatSiteLabel(site) || "";

      const matchesSearch =
        !query ||
        [
          siteLabel,
          site.siteNumber,
          site.enrolled,
          site.enrollmentTarget,
          site.screeningRate,
          site.visitCompliance,
          site.commentResolutionDays,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesSite =
        siteFilter === "All" || siteLabel === siteFilter;

      return matchesSearch && matchesSite;
    });
  }, [performance, searchTerm, siteFilter]);

  // ===== CHART DATA =====
  const chartData = filteredPerformance.map((site) => ({
    name: formatSiteLabel(site),
    value: Number(site.enrolled || 0),
  }));

  return (
    <DashboardLayout>
      <div className="admin-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Site Performance</h1>
          <p>Enrollment, compliance, and operational metrics by site</p>
        </div>

        {/* ===== SEARCH + FILTERS ===== */}
        <div className="site-performance-filters">
          <input
            type="text"
            className="site-performance-search"
            placeholder="Search site, number, enrollment, compliance..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <select
            className="site-performance-select"
            value={siteFilter}
            onChange={(event) => setSiteFilter(event.target.value)}
          >
            {siteOptions.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </div>

        {/* ===== CHART ===== */}
        <DashboardCard title="Enrollment by Site">
          <DashboardBarChart data={chartData} />
        </DashboardCard>

        {/* ===== PERFORMANCE TABLE ===== */}
        <div className="admin-table-section">
          <DataTable
            className="ctms-standard-table"
            title="Performance Metrics"
            columns={[
              {
                key: "siteName",
                label: "Site",
                render: (_value, row) =>
                  formatSiteLabel(row) || "—",
              },
              {
                key: "siteNumber",
                label: "Site Number",
                render: (_value, row) => row.siteNumber || "—",
              },
              {
                key: "enrolled",
                label: "Enrolled",
                render: (value) => value ?? 0,
              },
              {
                key: "enrollmentTarget",
                label: "Target",
                render: (value) => value ?? 0,
              },
              {
                key: "screeningRate",
                label: "Screening %",
                render: (value) =>
                  value !== undefined && value !== null
                    ? `${value}%`
                    : "—",
              },
              {
                key: "visitCompliance",
                label: "Visit Compliance %",
                render: (value) =>
                  value !== undefined && value !== null
                    ? `${value}%`
                    : "—",
              },
              {
                key: "commentResolutionDays",
                label: "Avg Comment Days",
                render: (value) => value ?? "—",
              },
            ]}
            data={filteredPerformance}
            emptyMessage="No site performance records match the selected filters"
            pagination
            searchable={false}
            initialPageSize={5}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default SitePerformance;