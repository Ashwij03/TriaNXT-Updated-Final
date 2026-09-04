import React from "react";
import AppLayout from "./AppLayout";
import { useNavigate } from "react-router-dom";
import "../styles/SponsorShared.css";
import KpiCard from "./KpiCard";

import {
  FiUsers,
  FiActivity,
  FiTrendingUp,
  FiBarChart2,
  FiDownload,
  FiPrinter,
  FiMail
} from "react-icons/fi";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

const CROReport = () => {
  
   const navigate = useNavigate();
   const trendData = [
  { month: "Jan", performance: 85 },
  { month: "Feb", performance: 87 },
  { month: "Mar", performance: 89 },
  { month: "Apr", performance: 91 },
  { month: "May", performance: 90 },
  { month: "Jun", performance: 92 }
];

const enrollmentData = [
  { cro: "IQVIA", enrollment: 92 },
  { cro: "Parexel", enrollment: 88 },
  { cro: "ICON", enrollment: 84 }
];

const complianceData = [
  {
    cro: "IQVIA",
    compliance: "97%",
    risk: "Low",
    audit: "Passed",
    date: "2026-05-01"
  },
  {
    cro: "Parexel",
    compliance: "94%",
    risk: "Medium",
    audit: "Passed",
    date: "2026-04-15"
  },
  {
    cro: "ICON",
    compliance: "91%",
    risk: "Medium",
    audit: "Passed",
    date: "2026-04-22"
  }
];

  return (
    <AppLayout>
  <div style={{ padding: "1.5rem" }} className="cro-report-page tnxt-compact">

    <button
      onClick={() => navigate(-1)}
      style={{
        background: "#2563eb",
        color: "white",
        border: "none",
        padding: "10px 18px",
        borderRadius: "0.5rem",
        cursor: "pointer",
        marginBottom: "1.25rem"
      }}
    >
       Back
    </button>

    <h1>CRO Performance Report</h1>
        <div className="sponsor-chart-grid">

  <div className="sponsor-chart-card">
    <h3>CRO Performance Trend</h3>

    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={trendData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="performance"
          stroke="#082b3d"
          strokeWidth={3}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>

  

</div>

        <table className="cro-table ctms-standard-table">

          <thead>
            <tr>
              <th>CRO</th>
              <th>Studies</th>
              <th>Sites</th>
              <th>Performance</th>
            </tr>
          </thead>

          <tbody>

            <tr>
              <td>IQVIA</td>
              <td>12</td>
              <td>45</td>
              <td>95%</td>
            </tr>

            <tr>
              <td>Parexel</td>
              <td>8</td>
              <td>32</td>
              <td>90%</td>
            </tr>

          </tbody>

        </table>
        <div className="sponsor-table-wrap" style={{ marginTop: "1.5rem" }}>
  <h3>Compliance & Risk Matrix</h3>

  <table className="sponsor-table ctms-standard-table">
    <thead>
      <tr>
        <th>CRO</th>
        <th>Compliance</th>
        <th>Risk</th>
        <th>Audit Status</th>
        <th>Last Audit</th>
      </tr>
    </thead>

    <tbody>
      {complianceData.map((item, index) => (
        <tr key={index}>
          <td>{item.cro}</td>
          <td>{item.compliance}</td>
          <td>{item.risk}</td>
          <td>{item.audit}</td>
          <td>{item.date}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
<div className="sponsor-kpi-grid" style={{ marginTop: "1.5rem" }}>

  <KpiCard
    title="Top Performer"
    value="IQVIA"
    subtitle="95% Performance"
    icon={<FiTrendingUp size={24} />}
  />

  <KpiCard
    title="Lowest Performer"
    value="ICON"
    subtitle="88% Performance"
    icon={<FiActivity size={24} />}
  />

  <KpiCard
    title="Avg Compliance"
    value="94%"
    subtitle="Across CROs"
    icon={<FiBarChart2 size={24} />}
  />

  <KpiCard
    title="Managed Sites"
    value="105"
    subtitle="Active Sites"
    icon={<FiUsers size={24} />}
  />

</div>
<div
  className="sponsor-chart-card"
  style={{ marginTop: "1.5rem" }}
>
  <h3>Enrollment Performance by CRO</h3>

  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={enrollmentData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="cro" />
      <YAxis />
      <Tooltip />
      <Bar
        dataKey="enrollment"
        fill="#082b3d"
      />
    </BarChart>
  </ResponsiveContainer>
</div>

<div
  className="action-btn-group"
  style={{ marginTop: "1.25rem" }}
>
  <button className="view-btn">
    <FiDownload /> Export PDF
  </button>

  <button className="edit-btn">
    <FiPrinter /> Print
  </button>

  <button className="view-btn">
    <FiMail /> Email
  </button>
</div>

      </div>
    </AppLayout>
  );
};

export default CROReport;