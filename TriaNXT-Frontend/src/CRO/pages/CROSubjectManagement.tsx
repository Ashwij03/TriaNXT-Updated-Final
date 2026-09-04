import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import CROModal from "./CROModal";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { normalizeStatus } from "../../shared/utils/normalizeStatus";

function CROSubjectManagement() {
  const location = useLocation();
  const {
    subjects,
  } = useCROData();

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  React.useEffect(() => {
    if (location.state?.selectedData && location.state?.selectedType === "Subject") {
      setSelectedSubject(location.state.selectedData);
      setShowDetailModal(true);
    } else if (location.state?.subjectId) {
      const subject = subjects.find((s) => s.id === location.state.subjectId);
      if (subject) {
        setSelectedSubject(subject);
        setShowDetailModal(true);
      }
    }
  }, [location.state, subjects]);

  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch = subject.id
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    // Filter by canonical stage: the CRO "Active"/"Screening" labels map to
    // canonical Ongoing/Screened, so a stored "Ongoing" subject matches the
    // Active filter and a stored "Screened" subject matches Screening.
    const matchesStatus =
      statusFilter === "All" ||
      normalizeStatus(subject.status) === normalizeStatus(statusFilter);
    return matchesSearch && matchesStatus;
  });

  const activeCount = subjects.filter(
    (s) => normalizeStatus(s.status) === "Ongoing",
  ).length;
  const completedCount = subjects.filter(
    (s) => normalizeStatus(s.status) === "Completed",
  ).length;
  const withdrawnCount = subjects.filter(
    (s) => normalizeStatus(s.status) === "Withdrawn",
  ).length;

  const openDetail = (subject) => {
    setSelectedSubject(subject);
    setShowDetailModal(true);
  };

  return (
    <CROLayout>
      <div className="cro-subject-page"></div>
      <h1>Subject Management</h1>

      <div className="cro-stats-grid">
        <div className="cro-card">
          <h3>Total Subjects</h3>
          <h2>{subjects.length}</h2>
        </div>
        <div className="cro-card">
          <h3>Active Subjects</h3>
          <h2>{activeCount}</h2>
        </div>
        <div className="cro-card">
          <h3>Completed</h3>
          <h2>{completedCount}</h2>
        </div>
        <div className="cro-card">
          <h3>Withdrawn</h3>
          <h2>{withdrawnCount}</h2>
        </div>
      </div>

      <div className="cro-panel">

  <h2 className="cro-section-title">Subjects List</h2>

  <div className="cro-panel-header">

    <div className="cro-panel-filters">

      <input
        type="text"
        placeholder="Search Subject ID..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="cro-input"
      />

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="cro-input"
      >
        <option value="All">All</option>
        <option value="Active">Active</option>
        <option value="Completed">Completed</option>
        <option value="Withdrawn">Withdrawn</option>
        <option value="Screening">Screening</option>
      </select>

    </div>

  </div>

        {filteredSubjects.length === 0 ? (
          <EmptyState title="No Subjects Found" message="No subjects available yet." />
        ) : (
          <div className="table-scroll-wrap tnxt-compact">
            <table className="cro-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Subject ID</th>
                  <th>Study</th>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Enrollment Date</th>
                  <th>Current Visit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.study}</td>
                    <td>{displaySite(item.site)}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>{item.enrollment}</td>
                    <td>{item.visit}</td>
                    <td>
                      <button
                        type="button"
                        className="cro-btn-primary-inline"
                        onClick={() => openDetail(item)}
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
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={selectedSubject ? `Subject ${selectedSubject.id}` : "Subject Details"}
        size="large"
        footer={
          <button type="button" className="cro-btn cro-btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
        }
      >
        {selectedSubject && (
          <div className="subject-detail">
            <p><strong>Subject ID:</strong> {selectedSubject.id}</p>
            <p><strong>Study:</strong> {selectedSubject.study}</p>
            <p><strong>Site:</strong> {displaySite(selectedSubject.site)}</p>
            <p><strong>Status:</strong> <StatusBadge status={selectedSubject.status} /></p>
            <p><strong>Enrollment:</strong> {selectedSubject.enrollment}</p>
            <p><strong>Current Visit:</strong> {selectedSubject.visit}</p>
          </div>
        )}
      </CROModal>
    </CROLayout>
  );
}

export default CROSubjectManagement;