import React, { useState } from "react";
import {
  FaUsers,
  FaBullseye,
  FaShieldAlt,
  FaUserTimes,
  FaUserPlus,
  FaChartPie,
  FaStream,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PIKpiCard from "./PIKpiCard";
import {
  getRecruitmentData,
  saveRecruitmentData,
  getNavbarData,
  filterByStudy,
  getDashboardData,
  syncKpisFromData,
  recalculateRecruitmentKpis,
  collectAllStudies,
} from "./piDashboardService";

const EMPTY_PIPELINE = {
  subject: "",
  study: "",
  stage: "Screening",
  status: "Scheduled",
  date: "",
};

function PIRecruitment({ selectedStudy: studyProp }: any) {
  const [data, setData] = useState(() => getRecruitmentData() || { studies: [], pipeline: [], kpis: {} });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllStudies, setShowAllStudies] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState(null);
  const [newPipeline, setNewPipeline] = useState({ ...EMPTY_PIPELINE });
  const [viewPipeline, setViewPipeline] = useState(null);
  const selectedStudy = studyProp || getNavbarData().selectedStudy || "All Studies";
  const studyOptions = collectAllStudies().filter((s) => s !== "All Studies");

  const persist = (updated) => {
    const recalculated = recalculateRecruitmentKpis(updated, getDashboardData());
    const saved = saveRecruitmentData(recalculated);
    setData(saved);
    window.dispatchEvent(new CustomEvent("pi-study-data-updated"));
  };

  const filteredStudies = filterByStudy(data?.studies || [], selectedStudy);
  const filteredPipeline = filterByStudy(data?.pipeline || [], selectedStudy);
  const displayStudies = showAllStudies ? filteredStudies : filteredStudies;

  const handleRefresh = () => {
    const dashboard = syncKpisFromData(getDashboardData());
    persist({
      ...data,
      studies: dashboard.studies.map((s) => {
        const existing = data.studies.find((r) => r.study === s.study);
        return {
          ...s,
          screened: existing?.screened || s.enrolled + 10,
          screenFailures: existing?.screenFailures || 5,
          progress: Math.round((s.enrolled / Math.max(s.target, 1)) * 100),
        };
      }),
    });
  };

  const handleAddPipeline = () => {
    const payload = editingPipeline
      ? { ...editingPipeline, ...newPipeline }
      : { ...newPipeline, id: `P-${Date.now()}` };

    if (!payload.subject || !payload.study || !payload.date) {
      alert("Please fill all required fields");
      return;
    }

    if (editingPipeline) {
      persist({
        ...data,
        pipeline: data.pipeline.map((p) =>
          p.id === editingPipeline.id ? payload : p
        ),
      });
    } else {
      persist({
        ...data,
        pipeline: [...(data?.pipeline || []), payload],
      });
    }

    setShowAddModal(false);
    setEditingPipeline(null);
    setNewPipeline({ ...EMPTY_PIPELINE });
  };

  const handleEditPipeline = (item) => {
    setEditingPipeline(item);
    setNewPipeline({ ...item });
    setShowAddModal(true);
  };

  const handleDeletePipeline = (id) => {
    if (!window.confirm("Remove this patient from the pipeline?")) return;
    persist({
      ...data,
      pipeline: data.pipeline.filter((p) => p.id !== id),
    });
  };

  const progressChart = filteredStudies.map((s) => ({
    name: s.study,
    enrolled: s.enrolled,
    target: s.target,
    progress: s.progress || Math.round((s.enrolled / Math.max(s.target, 1)) * 100),
  }));

  return (
    <div className="pi-page-content tnxt-compact">
      <div className="dashboard-header">
        <div>
          <h2>Recruitment</h2>
          <p className="pi-subtitle">
            Track enrollment, screening, and patient pipeline
            {selectedStudy !== "All Studies" && ` — ${selectedStudy}`}
          </p>
        </div>
        <div className="dashboard-actions">
          <button
            type="button"
            className="add-study-btn"
            onClick={() => {
              setEditingPipeline(null);
              setNewPipeline({ ...EMPTY_PIPELINE, study: studyOptions[0] || "" });
              setShowAddModal(true);
            }}
          >
            + Add to Pipeline
          </button>
          <button type="button" className="export-btn" onClick={handleRefresh}>
            Refresh Metrics
          </button>
        </div>
      </div>

      <div className="pi-kpi-grid pi-kpi-grid-4">
        <PIKpiCard title="Active Recruitment" value={data?.kpis?.activeRecruitment ?? 0} icon={FaUsers} color="blue" clickable />
        <PIKpiCard title="Enrolled Patients" value={data.kpis.enrolledPatients} icon={FaUserPlus} color="green" clickable />
        <PIKpiCard title="Screening Failures" value={data.kpis.screeningFailures} icon={FaUserTimes} color="red" clickable />
        <PIKpiCard title="Recruitment Target" value={data.kpis.recruitmentTarget} icon={FaBullseye} color="purple" clickable />
        <PIKpiCard title="Recruitment Progress" value={`${data.kpis.recruitmentProgress}%`} icon={FaChartPie} color="teal" clickable />
        <PIKpiCard title="Patient Pipeline" value={filteredPipeline.length} icon={FaStream} color="orange" clickable />
        <PIKpiCard title="Consent Rate" value={`${syncKpisFromData(getDashboardData()).kpis.consentRate}%`} icon={FaShieldAlt} color="blue" clickable />
        <PIKpiCard
          title="At Risk Studies"
          value={filteredStudies.filter((s) => s.status === "At Risk").length}
          icon={FaUserTimes}
          color="red"
          clickable
        />
      </div>

      <div className="chart-card" style={{ marginBottom: "1.5rem" }}>
        <h3>Recruitment Progress by Study</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={progressChart}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="enrolled" name="Enrolled" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="target" name="Target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pi-dual-table-grid">
        <div className="table-container">
          <div className="section-header">
            <h2>Recruitment Summary</h2>
            <button
              type="button"
              className="view-all-btn"
              onClick={() => setShowAllStudies((v) => !v)}
            >
              {showAllStudies ? "Show Summary" : "View All"}
            </button>
          </div>
          <div className="pi-table-responsive">
            <table className="pi-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Study</th>
                  <th>Target</th>
                  <th>Enrolled</th>
                  <th>Screened</th>
                  <th>Failures</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayStudies.map((study, i) => (
                  <tr key={i} className="pi-table-clickable">
                    <td>{study.study}</td>
                    <td>{study.target}</td>
                    <td>{study.enrolled}</td>
                    <td>{study.screened || "—"}</td>
                    <td>{study.screenFailures || "—"}</td>
                    <td>{study.progress || Math.round((study.enrolled / Math.max(study.target, 1)) * 100)}%</td>
                    <td>
                      <span className={study.status === "On Track" ? "status-success" : "status-danger"}>
                        {study.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-container">
          <div className="section-header">
            <h2>Patient Pipeline</h2>
            <button
              type="button"
              className="add-study-btn"
              onClick={() => {
                setEditingPipeline(null);
                setNewPipeline({ ...EMPTY_PIPELINE, study: studyOptions[0] || "" });
                setShowAddModal(true);
              }}
            >
              + Add
            </button>
          </div>
          <div className="pi-table-responsive">
            <table className="pi-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Study</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPipeline.map((item) => (
                  <tr key={item.id} className="pi-table-clickable">
                    <td>{item.subject}</td>
                    <td>{item.study}</td>
                    <td>{item.stage}</td>
                    <td>{item.status}</td>
                    <td>{item.date}</td>
                    <td>
                      <button type="button" className="view-all-btn" onClick={() => setViewPipeline(item)}>View</button>
                      <button type="button" className="export-btn pi-btn-sm" style={{ marginLeft: "0.375rem" }} onClick={() => handleEditPipeline(item)}>Edit</button>
                      <button type="button" className="view-all-btn pi-btn-sm" style={{ marginLeft: "0.375rem", color: "#dc2626", borderColor: "#dc2626" }} onClick={() => handleDeletePipeline(item.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="study-modal-overlay">
          <div className="study-modal">
            <h3>{editingPipeline ? "Edit Pipeline Record" : "Add to Patient Pipeline"}</h3>
            <input type="text" placeholder="Subject ID" value={newPipeline.subject} onChange={(e) => setNewPipeline({ ...newPipeline, subject: e.target.value })} />
            <select value={newPipeline.study} onChange={(e) => setNewPipeline({ ...newPipeline, study: e.target.value })}>
              {studyOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={newPipeline.stage} onChange={(e) => setNewPipeline({ ...newPipeline, stage: e.target.value })}>
              <option>Pre-Screen</option>
              <option>Screening</option>
              <option>Consent</option>
              <option>Enrollment</option>
            </select>
            <select value={newPipeline.status} onChange={(e) => setNewPipeline({ ...newPipeline, status: e.target.value })}>
              <option>Scheduled</option>
              <option>In Progress</option>
              <option>Pending</option>
              <option>Ready</option>
            </select>
            <input type="date" value={newPipeline.date} onChange={(e) => setNewPipeline({ ...newPipeline, date: e.target.value })} />
            <div className="modal-buttons">
              <button type="button" onClick={() => { setShowAddModal(false); setEditingPipeline(null); }}>Cancel</button>
              <button type="button" onClick={handleAddPipeline}>Save</button>
            </div>
          </div>
        </div>
      )}

      {viewPipeline && (
        <div className="study-modal-overlay">
          <div className="study-modal">
            <h3>Pipeline Record</h3>
            <p><strong>Subject:</strong> {viewPipeline.subject}</p>
            <p><strong>Study:</strong> {viewPipeline.study}</p>
            <p><strong>Stage:</strong> {viewPipeline.stage}</p>
            <p><strong>Status:</strong> {viewPipeline.status}</p>
            <p><strong>Date:</strong> {viewPipeline.date}</p>
            <button type="button" className="close-alert-btn" onClick={() => setViewPipeline(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PIRecruitment;
