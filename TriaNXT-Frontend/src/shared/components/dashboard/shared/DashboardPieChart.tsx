// newly added

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function DashboardPieChart({
  data = [
    {
      name: "Active",
      value: 60
    },
    {
      name: "Screening",
      value: 25
    },
    {
      name: "Completed",
      value: 15
    }
  ]
}: any) {

  const COLORS = [
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ef4444",
    "#64748b"
  ];

  return (

    <ResponsiveContainer
      width="100%"
      height={220}
    >
      <PieChart>

        <Pie
          data={data}
          dataKey="value"
          outerRadius={80}
          label
        >
          {data.map(
            (entry, index) => (

              <Cell
                key={index}
                fill={
                  COLORS[
                    index %
                    COLORS.length
                  ]
                }
              />

            )
          )}

        </Pie>

        <Tooltip />

      </PieChart>

    </ResponsiveContainer>

  );
}

export default DashboardPieChart;