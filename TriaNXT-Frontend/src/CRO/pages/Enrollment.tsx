import React, { useEffect, useMemo, useState } from "react";
import CROSidebar from "./CROSidebar";
import CRONavbar from "./CRONavbar";
import RequestPermissionButton from "../../shared/components/RequestPermissionButton";
import { getAccessibleStudies, getCurrentUser } from "../../shared/services/roleService";
import { getAllSubjects } from "../../shared/services/subjectService";

function readEnrollmentRecords() {
  try {
    return getAllSubjects()
      .filter((subject) =>
        ["Active", "Completed", "Enrolled", "Randomized"].includes(subject.status),
      )
      .map((subject, index) => ({
        id: subject.id || subject.subjectId || `${subject.studyId}-${index}`,
        subjectId: subject.subjectId || subject.id || `${subject.studyId}-${index}`,
        subjectName: subject.name || subject.subjectId || subject.id,
        study: subject.studyId,
        enrollmentDate: subject.enrollment || subject.createdAt || "—",
        status: subject.status || "Enrolled",
      }));
  } catch {
    return [];
  }
}

function Enrollment() {
  const [search, setSearch] = useState("");
  const [enrollments, setEnrollments] = useState(readEnrollmentRecords);
  const [studies, setStudies] = useState(() =>
    getAccessibleStudies(getCurrentUser()),
  );
  const [studyCode, setStudyCode] = useState("");

  useEffect(() => {
    const refresh = () => {
      setEnrollments(readEnrollmentRecords());
      setStudies(getAccessibleStudies(getCurrentUser()));
    };
    window.addEventListener("subjects-updated", refresh);
    window.addEventListener("studies-updated", refresh);
    return () => {
      window.removeEventListener("subjects-updated", refresh);
      window.removeEventListener("studies-updated", refresh);
    };
  }, []);

  const filteredEnrollments = useMemo(
    () =>
      enrollments.filter(
        (item) =>
          String(item.subjectId).toLowerCase().includes(search.toLowerCase()) ||
          String(item.subjectName).toLowerCase().includes(search.toLowerCase()),
      ),
    [enrollments, search],
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
            <h1>Enrollment</h1>
            <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
              <select
                value={studyCode}
                onChange={(event) => setStudyCode(event.target.value)}
                aria-label="Select study for new enrollment"
                style={{ padding: "0.5rem" }}
              >
                <option value="">Select study…</option>
                {studies.map((study) => (
                  <option key={study.code} value={study.code}>
                    {study.name || study.code}
                  </option>
                ))}
              </select>
              {studyCode && (
                <RequestPermissionButton
                  action="Add Enrollment"
                  module="Enrollment"
                  studyCode={studyCode}
                  label="+ Add Enrollment"
                />
              )}
            </div>
          </div>

          <input
            type="text"
            placeholder="Search by Subject ID or Name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ marginBottom: "1.25rem", padding: "0.625rem", width: "100%" }}
          />

          {filteredEnrollments.length === 0 ? (
            <p>No data available yet</p>
          ) : (
            <table className="ctms-standard-table" width="100%" cellPadding={10}>
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Name</th>
                  <th>Study</th>
                  <th>Enrollment Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.subjectId}</td>
                    <td>{item.subjectName}</td>
                    <td>{item.study}</td>
                    <td>{item.enrollmentDate}</td>
                    <td>{item.status}</td>
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

export default Enrollment;