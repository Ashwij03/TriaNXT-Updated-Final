/// newly added

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

function DashboardBarChart({
  dataKey = "value",
  fill = "#2563eb",
  data = [
    {
      name: "Jan",
      value: 12
    },
    {
      name: "Feb",
      value: 18
    },
    {
      name: "Mar",
      value: 25
    },
    {
      name: "Apr",
      value: 32
    },
    {
      name: "May",
      value: 41
    },
    {
      name: "Jun",
      value: 55
    }
  ]
}: any) {

  return (

    <ResponsiveContainer
      width="100%"
      height={250}
    >
      <BarChart data={data}>

        <CartesianGrid
          strokeDasharray="3 3"
        />

        <XAxis
          dataKey="name"
        />

        <YAxis allowDecimals={false} />

        <Tooltip />

        <Bar
          dataKey={dataKey}
          fill={fill}
          radius={[6, 6, 0, 0]}
        />

      </BarChart>

    </ResponsiveContainer>

  );
}

export default DashboardBarChart;