import React, { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getEnrollmentStatusPie } from '../data/sponsorDataStore';

const COLORS = ['#22c55e', '#ef4444', '#3b82f6'];

const StatusPieChart = () => {
  const [data, setData] = useState(getEnrollmentStatusPie());

  useEffect(() => {
    const refresh = () => setData(getEnrollmentStatusPie());
    refresh();
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  return (
    <div className="chart-card">
      <h3>Studies by Enrollment Status</h3>
      {data.length === 0 ? (
        <p className="chart-empty-state">No data available yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={data} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default StatusPieChart;
