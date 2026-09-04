import React, { useMemo } from "react";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import CROStatusBadge from "./CROStatusBadge";
import EmptyState from "./EmptyState";
import { useNavigate } from "react-router-dom";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import {
  isEnrolledSubjectStatus,
  normalizeStatus
} from "../../shared/utils/normalizeStatus";

function CROEnrollment() {
  const { subjects } = useCROData();
  const navigate = useNavigate();

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  // One shared contract: enrolled = canonical Enrolled/Ongoing/Completed
  // (raw Active/Randomized normalize in). This page previously counted only
  // raw "Active"/"Completed" tokens, so "Enrolled"-status subjects never
  // appeared here while the Sponsor/Site Staff dashboards counted them.
  const enrolledSubjects = subjects.filter((s) =>
    isEnrolledSubjectStatus(s.status)
  );

  return (
    <CROLayout>
      <h1 style={{ marginBottom: "1.5625rem" }}>Enrollment</h1>

      <div className="cro-summary-cards">
        <div className="dashboard-card">
          <h3>Total Enrolled</h3>
          <h1>{enrolledSubjects.length}</h1>
        </div>
        <div className="dashboard-card">
          <h3>Active</h3>
          <h1>
            {
              subjects.filter(
                (s) => normalizeStatus(s.status) === "Ongoing",
              ).length
            }
          </h1>
        </div>
        <div className="dashboard-card">
          <h3>Completed</h3>
          <h1>
            {
              subjects.filter(
                (s) => normalizeStatus(s.status) === "Completed",
              ).length
            }
          </h1>
        </div>
        <div className="dashboard-card">
          <h3>Enrollment Rate</h3>
          <h1>
            {subjects.length > 0
              ? `${Math.round((enrolledSubjects.length / subjects.length) * 100)}%`
              : "0%"}
          </h1>
        </div>
      </div>

      <div className="cro-panel">
        <h2>Enrolled Subjects</h2>
        {enrolledSubjects.length === 0 ? (
          <EmptyState title="No Enrolled Subjects Found" />
        ) : (
          <div className="cro-table-wrap tnxt-compact">
            <table className="cro-data-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Study</th>
                  <th>Site</th>
                  <th>Enrollment Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrolledSubjects.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.study}</td>
                    <td>{displaySite(s.site)}</td>
                    <td>{s.enrollment}</td>
                    <td>
                      <CROStatusBadge status={s.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cro-btn-sm"
                        onClick={() => navigate(`/cro-subject/${s.id}`)}
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
    </CROLayout>
  );
}

export default CROEnrollment;
