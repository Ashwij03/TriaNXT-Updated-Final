import React, { useState } from "react";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import CROStatusBadge from "./CROStatusBadge";
import EmptyState from "./EmptyState";
import CROModal from "./CROModal";
import { resolveSiteDisplay, formatSiteOption } from "../../shared/utils/siteDisplay";

function CROSitePerformance() {
  const { sitePerformanceData } = useCROData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedSite, setSelectedSite] = useState(null);

  const filteredSites = sitePerformanceData.filter((site) => {
    const matchesSearch = site.site
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || site.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const excellentCount = sitePerformanceData.filter(
    (site) => site.status === "Excellent"
  ).length;

  const atRiskCount = sitePerformanceData.filter(
    (site) => site.status === "At Risk"
  ).length;

  const avgEnrollment =
    sitePerformanceData.length > 0
      ? Math.round(
          sitePerformanceData.reduce(
            (sum, site) => sum + parseInt(site.enrollment, 10),
            0
          ) / sitePerformanceData.length
        )
      : 0;

  return (
    <CROLayout>
      <h1 style={{ marginBottom: "1.5625rem" }}>Site Performance</h1>

      <div className="cro-stats-grid">
        <div className="dashboard-card">
          <h3>Total Sites</h3>
          <h1>{sitePerformanceData.length}</h1>
        </div>

        <div className="dashboard-card">
          <h3>Top Performing</h3>
          <h1>{excellentCount}</h1>
        </div>

        <div className="dashboard-card">
          <h3>Average Enrollment</h3>
          <h1>{avgEnrollment}%</h1>
        </div>

        <div className="dashboard-card">
          <h3>At Risk Sites</h3>
          <h1>{atRiskCount}</h1>
        </div>
      </div>

      <div className="cro-panel">
        <div className="cro-panel-header">
          <div className="cro-panel-filters">
            <input
              type="text"
              placeholder="Search Site..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="cro-input"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="cro-input"
            >
              <option value="All">All</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="At Risk">At Risk</option>
            </select>
          </div>

          <h2 className="sr-only">Site Performance Filters</h2>
        </div>

        {filteredSites.length === 0 ? (
          <EmptyState title="No Sites Found" />
        ) : (
          <div className="cro-table-wrap tnxt-compact">
            <table className="cro-data-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Study</th>
                  <th>Enrollment %</th>
                  <th>Screen Failure %</th>
                  <th>Visit Compliance %</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      {resolveSiteDisplay({
                        siteNumber: site.siteNumber || site.siteNo || "",
                        siteName: site.site || site.siteName || "",
                      })}
                    </td>
                    <td>{site.study}</td>
                    <td>{site.enrollment}</td>
                    <td>{site.screenFailure}</td>
                    <td>{site.compliance}</td>

                    <td>
                      <CROStatusBadge status={site.status} />
                    </td>

                    <td>
                      <button
                        type="button"
                        className="cro-btn-sm"
                        onClick={() => setSelectedSite(site)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CROModal
        isOpen={Boolean(selectedSite)}
        onClose={() => setSelectedSite(null)}
        title={
          selectedSite
            ? `${formatSiteOption({
                siteNumber: selectedSite.siteNumber || selectedSite.siteNo || "",
                siteName: selectedSite.site || selectedSite.siteName || "",
              }) || selectedSite.site || "Site"} Performance`
            : "Site Details"
        }
        footer={
          <button
            type="button"
            className="cro-btn cro-btn-primary"
            onClick={() => setSelectedSite(null)}
          >
            Close
          </button>
        }
      >
        {selectedSite && (
          <div>
            <p>
              <strong>Site ID:</strong> {selectedSite.id}
            </p>

            <p>
              <strong>Study:</strong> {selectedSite.study}
            </p>

            <p>
              <strong>Enrollment:</strong> {selectedSite.enrollment}
            </p>

            <p>
              <strong>Screen Failure:</strong> {selectedSite.screenFailure}
            </p>

            <p>
              <strong>Visit Compliance:</strong> {selectedSite.compliance}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              <CROStatusBadge status={selectedSite.status} />
            </p>
          </div>
        )}
      </CROModal>
    </CROLayout>
  );
}

export default CROSitePerformance;