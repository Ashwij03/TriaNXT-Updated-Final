import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const data = [
  { name: "Active", value: 71 },
  { name: "Screening", value: 18 },
  { name: "Completed", value: 9 },
  { name: "Withdrawn", value: 2 }
];

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ef4444"
];

function SubjectStatusChart() {
  return (
    <>
      <h3>Subject Status</h3>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={45}
            outerRadius={80}
            label
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={COLORS[index]}
              />
            ))}
          </Pie>

          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </>
  );
}

export default SubjectStatusChart;