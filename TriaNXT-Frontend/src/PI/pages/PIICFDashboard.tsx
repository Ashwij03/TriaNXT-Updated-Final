import React, { useEffect, useState } from "react";
import { getAllSubjects } from "../../shared/services/subjectService";

/**
 * Read ICF/consent data dynamically from subjectsByStudy.
 * Each subject's consent status is derived from their metadata:
 * - "Active" or "Enrolled" => Signed consent
 * - "Screened" => Pending consent
 * - "Screen Failed" or "Withdrawn" => Expired/Not applicable
 */
function readIcfRecords() {
  try {
    const allSubjects = getAllSubjects();
    return allSubjects.map((subject) => {
      const id = subject.id || subject.subjectId || "";
      return {
        id,
        study: subject.studyId,
        status: subject.status || "Screened",
        consentDate: subject.enrollmentDate || "-",
        consentStatus:
          subject.status === "Active" || subject.status === "Enrolled"
            ? "Signed"
            : subject.status === "Screen Failed" || subject.status === "Withdrawn"
            ? "Expired"
            : "Pending",
      };
    }).filter((r) => r.id);
  } catch {
    return [];
  }
}

function PIICFDashboard() {
  const [records, setRecords] = useState(readIcfRecords);

  useEffect(() => {
    const refresh = () => setRecords(readIcfRecords());
    window.addEventListener("subjects-updated", refresh);
    return () => window.removeEventListener("subjects-updated", refresh);
  }, []);

  const totalCount = records.length;
  const signedCount = records.filter((r) => r.consentStatus === "Signed").length;
  const pendingCount = records.filter((r) => r.consentStatus === "Pending").length;
  const expiredCount = records.filter((r) => r.consentStatus === "Expired").length;

  return (
    <div className="pi-page-content tnxt-compact">

      <h1>ICF Dashboard</h1>

      <div className="cards-container">

        <div className="dashboard-card">
          <h3>Total Subjects</h3>
          <h2>{totalCount}</h2>
        </div>

        <div className="dashboard-card">
          <h3>Signed Consents</h3>
          <h2>{signedCount}</h2>
        </div>

        <div className="dashboard-card">
          <h3>Pending Consents</h3>
          <h2>{pendingCount}</h2>
        </div>

        <div className="dashboard-card">
          <h3>Expired Consents</h3>
          <h2>{expiredCount}</h2>
        </div>

      </div>

      <div className="table-container">

        <h2>Consent Status</h2>

        {records.length === 0 ? (
          <p>No subject records found. Subjects must be created before consent status can be displayed.</p>
        ) : (
          <table className="ctms-standard-table">
            <thead>
              <tr>
                <th>Subject ID</th>
                <th>Study</th>
                <th>Consent Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={`${record.study}-${record.id}`}>
                  <td>{record.id}</td>
                  <td>{record.study}</td>
                  <td>{record.consentDate}</td>
                  <td>{record.consentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>

    </div>
  );
}

export default PIICFDashboard;