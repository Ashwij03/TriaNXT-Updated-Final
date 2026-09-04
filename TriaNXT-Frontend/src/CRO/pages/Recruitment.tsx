import React, { useMemo } from "react";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

function Recruitment() {

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const recruitmentData = [
    {
      site: "Apollo Hospital",
      target: 50,
      enrolled: 40,
      percentage: "80%",
      status: "On Track"
    },
    {
      site: "Yashoda Hospital",
      target: 50,
      enrolled: 32,
      percentage: "64%",
      status: "Needs Attention"
    },
    {
      site: "AIG Hospital",
      target: 40,
      enrolled: 28,
      percentage: "70%",
      status: "On Track"
    }
  ];

  return (
    <div style={{ padding: "1.875rem" }} className="recruitment-tracking-page tnxt-compact">

      <h1>Recruitment Tracking</h1>

      <table className="ctms-standard-table">
        <thead>
          <tr>
            <th>Site</th>
            <th>Target Enrollment</th>
            <th>Actual Enrollment</th>
            <th>Recruitment %</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {recruitmentData.map((item, index) => (
            <tr key={index}>
              <td>{displaySite(item.site)}</td>
              <td>{item.target}</td>
              <td>{item.enrolled}</td>
              <td>{item.percentage}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>

      </table>

    </div>
  );
}

export default Recruitment;