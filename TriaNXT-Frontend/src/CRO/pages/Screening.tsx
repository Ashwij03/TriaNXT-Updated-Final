import React, { useEffect, useMemo, useState } from "react";
import CROSidebar from "./CROSidebar";
import CRONavbar from "./CRONavbar";
import RequestPermissionButton from "../../shared/components/RequestPermissionButton";
import { getAllSubjects } from "../../shared/services/subjectService";

function readScreeningRecords() {
  try {
    return getAllSubjects()
      .filter((subject) =>
        ["Screening", "Pending"].includes(subject.status) ||
        String(subject.visit || "").toLowerCase().includes("screening"),
      )
      .map((subject, index) => ({
        id: subject.id || subject.subjectId || `${subject.studyId}-${index}`,
        subjectId: subject.subjectId || subject.id || `${subject.studyId}-${index}`,
        name: subject.name || subject.subjectId || subject.id,
        study: subject.studyId,
        screeningDate: subject.enrollment || subject.createdAt || "—",
        status: subject.status || "Pending",
      }));
  } catch {
    return [];
  }
}

function Screening() {
  const [search, setSearch] = useState("");
  const [screenings, setScreenings] = useState(readScreeningRecords);

  useEffect(() => {
    const refresh = () => setScreenings(readScreeningRecords());
    window.addEventListener("subjects-updated", refresh);
    window.addEventListener("studies-updated", refresh);
    return () => {
      window.removeEventListener("subjects-updated", refresh);
      window.removeEventListener("studies-updated", refresh);
    };
  }, []);

  const filteredScreenings = useMemo(
    () =>
      screenings.filter(
        (item) =>
          String(item.subjectId).toLowerCase().includes(search.toLowerCase()) ||
          String(item.name).toLowerCase().includes(search.toLowerCase()),
      ),
    [screenings, search],
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
            <h1>Screening</h1>
            <RequestPermissionButton
              action="Add Screening"
              module="Screening"
              label="+ Add Screening"
            />
          </div>

          <input
            type="text"
            placeholder="Search by Subject ID or Name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ marginBottom: "1.25rem", padding: "0.625rem", width: "100%" }}
          />

          {filteredScreenings.length === 0 ? (
            <p>No data available yet</p>
          ) : (
            <table className="ctms-standard-table" width="100%" cellPadding={10}>
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Name</th>
                  <th>Study</th>
                  <th>Screening Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredScreenings.map((item) => (
                  <tr key={item.id}>
                    <td>{item.subjectId}</td>
                    <td>{item.name}</td>
                    <td>{item.study}</td>
                    <td>{item.screeningDate}</td>
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

export default Screening;
