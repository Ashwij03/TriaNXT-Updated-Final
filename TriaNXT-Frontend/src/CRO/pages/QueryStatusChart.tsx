import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useCROData } from "./CRODATAContext";
import { isOpenComment } from "../../shared/services/commentService";

const COLORS = ["#ef4444", "#10b981", "#3b82f6", "#94a3b8"];

function QueryStatusChart() {
  const { comments } = useCROData();

  const open = comments.filter(isOpenComment).length;
  const resolved = comments.filter(
    (comment) => String(comment?.status || "").toLowerCase() === "resolved"
  ).length;

  const data = [
    { name: "Open", value: open },
    { name: "Resolved", value: resolved },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <>
        <h3>Comments Status</h3>
        <p style={{ textAlign: "center", color: "#94a3b8", padding: "2.5rem 0" }}>
          No comments data available
        </p>
      </>
    );
  }

  return (
    <>
      <h3>Comments Status</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={75}
            label={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{ paddingTop: "0.9375rem", fontSize: "0.875rem" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </>
  );
}

export default QueryStatusChart;
