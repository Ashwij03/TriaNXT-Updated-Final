import React, { useState, useEffect } from "react";
import CROSidebar from "./CROSidebar";
import CRONavbar from "./CRONavbar";
import RequestPermissionButton from "../../shared/components/RequestPermissionButton";
import { getSitePerformance } from "../../shared/services/adminService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

function loadSites() {
  try {
    const fromAdmin = getSitePerformance();
    if (fromAdmin.length) return fromAdmin;
    const saved = localStorage.getItem("sitePerformance");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function SitePerformance() {
  const [search, setSearch] = useState("");
  const [sites, setSites] = useState(loadSites);

  useEffect(() => {
    const refresh = () => setSites(loadSites());
    window.addEventListener("sponsor-data-updated", refresh);
    window.addEventListener("studies-updated", refresh);
    return () => {
      window.removeEventListener("sponsor-data-updated", refresh);
      window.removeEventListener("studies-updated", refresh);
    };
  }, []);

  const filteredSites = sites.filter((site) =>
    String(site.siteName || site.site || site.name || "")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="dashboard-layout tnxt-compact">
      <CROSidebar />
      <div className="main-content">
        <CRONavbar />
        <div style={{ padding: "1.875rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
            }}
          >
            <h1>Site Performance</h1>
            <RequestPermissionButton
              action="Add Site"
              module="Site Performance"
              label="+ Add Site"
            />
          </div>

          <input
            type="text"
            placeholder="Search Site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "21.875rem",
              padding: "0.75rem",
              marginBottom: "1.25rem",
              border: "1px solid #ddd",
              borderRadius: "0.5rem",
            }}
          />

          {filteredSites.length === 0 ? (
            <p>No data available yet</p>
          ) : (
            <table className="ctms-standard-table" width="100%" border={1} cellPadding={10}>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Enrollment</th>
                  <th>Queries</th>
                  <th>Compliance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map((site) => (
                  <tr key={site.id || site.siteName || site.site}>
                    <td>{resolveSiteDisplay(site)}</td>
                    <td>{site.enrollment ?? "—"}</td>
                    <td>{site.queries ?? "—"}</td>
                    <td>{site.compliance ?? "—"}</td>
                    <td>{site.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default SitePerformance;
