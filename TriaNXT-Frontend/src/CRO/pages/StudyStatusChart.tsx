import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const data = [
  { name: "Active", value: 42 },
  { name: "Recruiting", value: 33 },
  { name: "Completed", value: 25 }
];

const COLORS = ["#4CAF50", "#2196F3", "#FF9800"];

function StudyStatusChart() {
  return (
    <>
      <h3>Study Status</h3>
	  
	  <ResponsiveContainer width="100%" height={260}>
        <PieChart>
		<Pie
		  data={data}
		  dataKey="value"
		  cx="50%"
		  cy="50%"          outerRadius={75}
            label={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index]}
              />
            ))}
          </Pie>

          <Tooltip />

          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{
              paddingTop: "0.9375rem",
              fontSize: "0.875rem"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </>
  );
}

export default StudyStatusChart;