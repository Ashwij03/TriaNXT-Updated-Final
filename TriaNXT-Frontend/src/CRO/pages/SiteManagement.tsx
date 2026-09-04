import React from "react";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

function SiteManagement() {
  const studies = getStudies();

  const siteData = studies.map((study, index) => ({
    siteNumber:
      study.siteNumber ||
      study.siteNo ||
      `SITE-${String(index + 1).padStart(3, "0")}`,
    siteName: study.site || study.location || "",
    pi: study.principalInvestigator || "—",
    location: study.location || study.country || "—",
    status: study.status || "Active",
    lastVisit: study.startDate || "—",
  }));

  return (
    <div style={{ padding: "1.875rem" }} className="site-management-page tnxt-compact">
      <h1>Site Management</h1>

      {siteData.length === 0 ? (
        <p>No data available yet</p>
      ) : (
        <table className="ctms-standard-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Principal Investigator</th>
              <th>Location</th>
              <th>Status</th>
              <th>Last Monitoring Visit</th>
            </tr>
          </thead>
          <tbody>
            {siteData.map((site, index) => (
              <tr key={index}>
                <td>{resolveSiteDisplay(site)}</td>
                <td>{site.pi}</td>
                <td>{site.location}</td>
                <td>{site.status}</td>
                <td>{site.lastVisit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default SiteManagement;
