import React, { useState, useEffect } from "react";
import AppLayout from "./AppLayout";
import "../styles/StudyOversight.css";
import "../styles/SponsorShared.css";
import KpiCard from "./KpiCard";
import EnterpriseModal from "./EnterpriseModal";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  getOversightStudies,
  getOversightKPIs,
} from "../data/sponsorDataStore";

const StudyOversight = () => {
  const [studies, setStudies] = useState(getOversightStudies());
  const [kpis, setKpis] = useState<ReturnType<typeof getOversightKPIs> & { highRisk?: number }>(getOversightKPIs());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewStudy, setViewStudy] = useState(null);

  useEffect(() => {
    const refresh = () => {
      setStudies(getOversightStudies());
      setKpis(getOversightKPIs());
    };

    window.addEventListener("sponsor-data-updated", refresh);

    return () => {
      window.removeEventListener("sponsor-data-updated", refresh);
    };
  }, []);

  const filteredStudies = studies.filter((study) => {
    const matchesSearch =
      study.studyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      study.studyId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || study.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const progressData = studies.map((study) => ({
    study: study.studyId,
    progress: study.progress,
  }));

  return (
    <AppLayout>
      <div className="page-container tnxt-compact">
        <div className="sponsor-page-header">
          <h1>Study Oversight</h1>
          <p>Monitor study progress, milestones, and enrollment targets.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard
            title="Total Studies"
            value={kpis.total}
            subtitle="Under oversight"
            icon={<FiActivity size={24} />}
            iconBg="#eff6ff"
            iconColor="#2563eb"
            onClick={() => setStatusFilter("All")}
          />

          <KpiCard
            title="On Track"
            value={kpis.onTrack}
            subtitle="Meeting targets"
            icon={<FiCheckCircle size={24} />}
            iconBg="#ecfdf5"
            iconColor="#16a34a"
            onClick={() => setStatusFilter("On Track")}
          />

          <KpiCard
            title="Delayed"
            value={kpis.delayed}
            subtitle="Needs attention"
            icon={<FiAlertTriangle size={24} />}
            iconBg="#fee2e2"
            iconColor="#dc2626"
            onClick={() => setStatusFilter("Delayed")}
          />

          <KpiCard
            title="High Risk"
            value={kpis.highRisk ?? 0}
            subtitle="Needs immediate attention"
            icon={<FiAlertTriangle size={24} />}
            iconBg="#fee2e2"
            iconColor="#dc2626"
          />
        </div>

        <div className="sponsor-chart-grid">
          <div className="sponsor-chart-card">
            <h3>Study Progress</h3>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="study" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar
                  dataKey="progress"
                  fill="#082b3d"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="oversight-actions sponsor-toolbar">
          <input
            type="text"
            placeholder="Search Study..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All</option>
            <option>On Track</option>
            <option>Delayed</option>
            <option>Completed</option>
          </select>
        </div>

        <div className="sponsor-table-wrap">
          <table className="sponsor-table oversight-table ctms-standard-table">
            <thead>
              <tr>
                <th>Study ID</th>
                <th>Study Name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Enrollment</th>
                <th>Milestone</th>
                <th>Next Review</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudies.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    No studies found
                  </td>
                </tr>
              ) : (
                filteredStudies.map((study) => (
                  <tr key={study.studyId}>
                    <td>{study.studyId}</td>
                    <td>{study.studyName}</td>

                    <td>
                      <span
                        className={`status-badge ${
                          study.status === "Delayed" ? "open" : "active"
                        }`}
                      >
                        {study.status}
                      </span>
                    </td>

                    <td>{study.progress}%</td>
                    <td>{study.enrollment}</td>
                    <td>{study.milestone}</td>
                    <td>{study.nextReview}</td>

                    <td>
                      <button
                        type="button"
                        className="view-btn"
                        onClick={() => setViewStudy(study)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewStudy && (
        <EnterpriseModal
          title="Study Oversight Details"
          onClose={() => setViewStudy(null)}
        >
          <div className="study-oversight-details">
            <h2 className="study-modal-title">{viewStudy.studyName}</h2>

            <p className="study-modal-subtitle">
              Comprehensive monitoring information for this study.
            </p>

            <div className="oversight-section">
              <h3>Study Information</h3>

              <div className="oversight-grid">
                <div className="oversight-item">
                  <label>Study ID</label>
                  <p>{viewStudy.studyId}</p>
                </div>

                <div className="oversight-item">
                  <label>Status</label>
                  <p>{viewStudy.status}</p>
                </div>

                <div className="oversight-item">
                  <label>Progress</label>
                  <p>{viewStudy.progress}%</p>
                </div>

                <div className="oversight-item">
                  <label>Enrollment</label>
                  <p>{viewStudy.enrollment}</p>
                </div>
              </div>
            </div>

            <div className="oversight-section">
              <h3>Operational Metrics</h3>

              <div className="oversight-grid">
                <div className="oversight-item">
                  <label>Current Milestone</label>
                  <p>{viewStudy.milestone}</p>
                </div>

                <div className="oversight-item">
                  <label>Next Review</label>
                  <p>{viewStudy.nextReview}</p>
                </div>

                <div className="oversight-item">
                  <label>Recruitment</label>
                  <p className="metric-success">On Track</p>
                </div>

                <div className="oversight-item">
                  <label>Site Productivity</label>
                  <p>32 / 35 Active Sites</p>
                </div>
              </div>
            </div>

            <div className="oversight-section">
              <h3>Oversight Metrics</h3>

              <div className="oversight-grid">
                <div className="oversight-item">
                  <label>Open Risks</label>
                  <p className="metric-warning">4</p>
                </div>

                <div className="oversight-item">
                  <label>Open Queries</label>
                  <p className="metric-warning">18</p>
                </div>

                <div className="oversight-item">
                  <label>Protocol Deviations</label>
                  <p className="metric-danger">2</p>
                </div>

                <div className="oversight-item">
                  <label>Regulatory Status</label>
                  <p className="metric-success">Compliant</p>
                </div>
              </div>
            </div>

            <div className="oversight-footer">
              <button type="button" className="site-btn">
                View Site Performance
              </button>

              <button type="button" className="cro-btn">
                View CRO Performance
              </button>

              <button type="button" className="report-btn">
                Generate Report
              </button>

              <button
                type="button"
                className="close-btn"
                onClick={() => setViewStudy(null)}
              >
                Close
              </button>
            </div>
          </div>
        </EnterpriseModal>
      )}
    </AppLayout>
  );
};

export default StudyOversight;