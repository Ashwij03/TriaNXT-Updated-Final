import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "./AppLayout";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

function EnrollmentDetails() {

  const { id } = useParams();

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const studies = {

    "TRIA-001": {
      studyName: "Diabetes Study",
      site: "Hyderabad",
      pi: "Dr Rao",
      cro: "ABC CRO",
      target: 150,
      enrolled: 120,
      screened: 180,
      eligible: 140,
      status: "On Track"
    },

    "TRIA-002": {
      studyName: "Oncology Trial",
      site: "Bangalore",
      pi: "Dr Kumar",
      cro: "XYZ CRO",
      target: 120,
      enrolled: 95,
      screened: 150,
      eligible: 110,
      status: "On Track"
    }

  };

  const study = studies[id];

  if (!study) {
    return <h2>Study Not Found</h2>;
  }

  return (
    <AppLayout>

      <div style={{ padding: "1.25rem" }}>

        <h1>Enrollment Details</h1>

        <h2>{study.studyName}</h2>

        <hr />

        <h3>Study Information</h3>

        <p><strong>Study ID:</strong> {id}</p>
        <p><strong>Site:</strong> {displaySite(study.site)}</p>
        <p><strong>PI:</strong> {study.pi}</p>
        <p><strong>CRO:</strong> {study.cro}</p>

        <hr />

        <h3>Enrollment Metrics</h3>

        <p><strong>Target:</strong> {study.target}</p>
        <p><strong>Enrolled:</strong> {study.enrolled}</p>
        <p>
          <strong>Remaining:</strong>{" "}
          {study.target - study.enrolled}
        </p>

        <hr />

        <h3>Recruitment Overview</h3>

        <p><strong>Screened:</strong> {study.screened}</p>
        <p><strong>Eligible:</strong> {study.eligible}</p>
        <p><strong>Enrolled:</strong> {study.enrolled}</p>

        <hr />

        <h3>Status</h3>

        <p>{study.status}</p>

      </div>

    </AppLayout>
  );
}

export default EnrollmentDetails;