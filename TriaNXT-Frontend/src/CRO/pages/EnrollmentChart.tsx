import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const data = [
  { study: "101", value: 80 },
  { study: "102", value: 65 },
  { study: "103", value: 92 }
];

function EnrollmentChart() {
  return (
    <>
      <h3>Enrollment Progress</h3>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="study" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export default EnrollmentChart;