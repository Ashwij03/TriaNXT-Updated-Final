import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCROData } from "./CRODATAContext";

function VisitCompletionChart() {
  const { visits } = useCROData();

  const statusCounts = visits.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(statusCounts).map(([visit, value]) => ({
    visit,
    value,
  }));

  if (data.length === 0) {
    return (
      <>
        <h3>Visit Completion</h3>
        <p style={{ textAlign: "center", color: "#94a3b8", padding: "2.5rem 0" }}>
          No visit data available
        </p>
      </>
    );
  }

  return (
    <>
      <h3>Visit Completion</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="visit" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#10b981" />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export default VisitCompletionChart;
