import React, { useMemo, useState } from "react";
import {
  FaChartLine,
  FaUserCheck,
  FaCalendarCheck,
  FaStar,
  FaClipboardCheck,
  FaDatabase,
  FaUserFriends,
  FaTasks,
  FaPlus,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import PIKpiCard from "./PIKpiCard";
import {
  getSitePerformanceData,
  saveSitePerformanceData,
  getNavbarData,
  filterByStudy,
  recalculateSitePerformanceKpis,
} from "./piDashboardService";

const EMPTY_METRIC = {
  metric: "",
  study: "747-303",
  target: "",
  actual: "",
  status: "On Track",
  value: 0,
};

function PISitePerformance({ selectedStudy: studyProp }: any) {
  const [data, setData] = useState(getSitePerformanceData);
  const [metricFilter, setMetricFilter] = useState("All");
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [editMetric, setEditMetric] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMetric, setNewMetric] = useState({ ...EMPTY_METRIC });
  const selectedStudy = studyProp || getNavbarData().selectedStudy || "All Studies";

  const persist = (updated) => {
    const recalculated = recalculateSitePerformanceKpis(updated);
    const saved = saveSitePerformanceData(recalculated);
    setData(saved);
    window.dispatchEvent(new CustomEvent("pi-study-data-updated"));
  };

  const handleRefresh = () => {
    persist({ ...getSitePerformanceData(), ...data });
  };

  const filteredMetrics = filterByStudy(data.metrics, selectedStudy);
  const displayMetrics =
    metricFilter === "All"
      ? filteredMetrics
      : filteredMetrics.filter((m) => m.metric.includes(metricFilter));

  const tableMetrics = showAllMetrics ? filteredMetrics : displayMetrics.slice(0, 6);

  const chartData = useMemo(
    () =>
      (data.chartData || []).map((item) => ({
        ...item,
        fullMark: 100,
      })),
    [data.chartData]
  );

  const handleSaveMetric = () => {
    if (!editMetric?.metric) return;
    const metrics = data.metrics.map((m) =>
      m.metric === selectedMetric.metric && m.study === selectedMetric.study
        ? { ...editMetric, value: Number(editMetric.value) || 0 }
        : m
    );
    persist({ ...data, metrics });
    setSelectedMetric(null);
    setEditMetric(null);
  };

  const handleDeleteMetric = (row) => {
    if (!window.confirm(`Delete metric "${row.metric}"?`)) return;
    persist({
      ...data,
      metrics: data.metrics.filter(
        (m) => !(m.metric === row.metric && m.study === row.study)
      ),
    });
    setSelectedMetric(null);
    setEditMetric(null);
  };

  const handleAddMetric = () => {
    if (!newMetric.metric || !newMetric.study) {
      alert("Please fill metric name and study");
      return;
    }
    persist({
      ...data,
      metrics: [
        ...data.metrics,
        { ...newMetric, value: Number(newMetric.value) || 0 },
      ],
    });
    setShowAddModal(false);
    setNewMetric({ ...EMPTY_METRIC });
  };

  const kpiCards = [
    { title: "Enrollment Performance", value: `${data.kpis.enrollmentPerformance}%`, icon: FaChartLine, color: "blue", filter: "Enrollment" },
    { title: "Screening Success Rate", value: `${data.kpis.screeningSuccessRate}%`, icon: FaUserCheck, color: "green", filter: "Screening" },
    { title: "Visit Completion Rate", value: `${data.kpis.visitCompletionRate}%`, icon: FaCalendarCheck, color: "purple", filter: "Visit" },
    { title: "Protocol Compliance", value: `${data.kpis.protocolCompliance}%`, icon: FaClipboardCheck, color: "teal", filter: "Protocol" },
    { title: "Query Resolution Rate", value: `${data.kpis.queryResolutionRate}%`, icon: FaTasks, color: "orange", filter: "Query" },
    { title: "Patient Retention Rate", value: `${data.kpis.patientRetentionRate}%`, icon: FaUserFriends, color: "green", filter: "Retention" },
    { title: "Data Entry Timeliness", value: `${data.kpis.dataEntryTimeliness}%`, icon: FaDatabase, color: "blue", filter: "Data" },
    { title: "Study Progress", value: `${data.kpis.studyProgress}%`, icon: FaStar, color: "purple", filter: "Study" },
  ];

  return (
    <div className="pi-page-content tnxt-compact">
      <div className="dashboard-header">
        <div>
          <h2>Site Performance</h2>
          <p className="pi-subtitle">
            Track site metrics and performance KPIs
            {selectedStudy !== "All Studies" && ` — ${selectedStudy}`}
          </p>
        </div>
        <div className="dashboard-actions">
          <select
            className="pi-filter-select"
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
          >
            <option value="All">All Metrics</option>
            <option value="Enrollment">Enrollment</option>
            <option value="Screening">Screening</option>
            <option value="Visit">Visit</option>
            <option value="Protocol">Protocol</option>
            <option value="Query">Query</option>
            <option value="Retention">Retention</option>
            <option value="Data">Data Entry</option>
            <option value="Study">Study Progress</option>
          </select>
          <button type="button" className="add-study-btn" onClick={() => setShowAddModal(true)}>
            <FaPlus /> Add Metric
          </button>
          <button type="button" className="export-btn" onClick={handleRefresh}>
            Refresh Data
          </button>
        </div>
      </div>

      <div className="pi-kpi-grid pi-kpi-grid-4">
        {kpiCards.map((kpi) => (
          <PIKpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            clickable
            onClick={() => setMetricFilter(kpi.filter)}
          />
        ))}
      </div>

      <div className="pi-dual-chart-grid">
        <div className="chart-card">
          <h3>Performance Overview</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" fontSize={12} />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, "Score"]} />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Site Performance Radar</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" fontSize={11} />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-container">
        <div className="section-header">
          <h2>Performance Summary</h2>
          <button
            type="button"
            className="view-all-btn"
            onClick={() => setShowAllMetrics((v) => !v)}
          >
            {showAllMetrics ? "Show Filtered" : "View All"}
          </button>
        </div>
        <div className="pi-table-responsive">
          <table className="pi-table ctms-standard-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Study</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableMetrics.map((row, i) => (
                <tr key={`${row.metric}-${row.study}-${i}`} className="pi-table-clickable">
                  <td>{row.metric}</td>
                  <td>{row.study || "—"}</td>
                  <td>{row.target}</td>
                  <td>{row.actual}</td>
                  <td>
                    <span
                      className={
                        row.status === "Good" || row.status === "On Track"
                          ? "status-success"
                          : "status-danger"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="view-all-btn"
                      onClick={() => {
                        setSelectedMetric(row);
                        setEditMetric({ ...row });
                      }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="export-btn pi-btn-sm"
                      style={{ marginLeft: "0.375rem" }}
                      onClick={() => {
                        setSelectedMetric(row);
                        setEditMetric({ ...row });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="view-all-btn pi-btn-sm"
                      style={{ marginLeft: "0.375rem", color: "#dc2626", borderColor: "#dc2626" }}
                      onClick={() => handleDeleteMetric(row)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMetric && editMetric && (
        <div className="study-modal-overlay">
          <div className="study-modal">
            <h3>Metric Details</h3>
            <input
              type="text"
              placeholder="Metric Name"
              value={editMetric.metric}
              onChange={(e) => setEditMetric({ ...editMetric, metric: e.target.value })}
            />
            <input
              type="text"
              placeholder="Study"
              value={editMetric.study}
              onChange={(e) => setEditMetric({ ...editMetric, study: e.target.value })}
            />
            <input
              type="text"
              placeholder="Target"
              value={editMetric.target}
              onChange={(e) => setEditMetric({ ...editMetric, target: e.target.value })}
            />
            <input
              type="text"
              placeholder="Actual"
              value={editMetric.actual}
              onChange={(e) => setEditMetric({ ...editMetric, actual: e.target.value })}
            />
            <input
              type="number"
              placeholder="Value (%)"
              value={editMetric.value}
              onChange={(e) => setEditMetric({ ...editMetric, value: e.target.value })}
            />
            <select
              value={editMetric.status}
              onChange={(e) => setEditMetric({ ...editMetric, status: e.target.value })}
            >
              <option>On Track</option>
              <option>Good</option>
              <option>At Risk</option>
            </select>
            <div className="modal-buttons">
              <button type="button" onClick={() => { setSelectedMetric(null); setEditMetric(null); }}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveMetric}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="study-modal-overlay">
          <div className="study-modal">
            <h3>Add Performance Metric</h3>
            <input
              type="text"
              placeholder="Metric Name"
              value={newMetric.metric}
              onChange={(e) => setNewMetric({ ...newMetric, metric: e.target.value })}
            />
            <input
              type="text"
              placeholder="Study"
              value={newMetric.study}
              onChange={(e) => setNewMetric({ ...newMetric, study: e.target.value })}
            />
            <input
              type="text"
              placeholder="Target"
              value={newMetric.target}
              onChange={(e) => setNewMetric({ ...newMetric, target: e.target.value })}
            />
            <input
              type="text"
              placeholder="Actual"
              value={newMetric.actual}
              onChange={(e) => setNewMetric({ ...newMetric, actual: e.target.value })}
            />
            <input
              type="number"
              placeholder="Value (%)"
              value={newMetric.value}
              onChange={(e) => setNewMetric({ ...newMetric, value: e.target.value as unknown as number })}
            />
            <div className="modal-buttons">
              <button type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="button" onClick={handleAddMetric}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PISitePerformance;
