import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getEnrollmentByStudy } from '../data/sponsorDataStore';

const EnrollmentChart = ({ data: propData }: any) => {
  const [data, setData] = useState(propData || getEnrollmentByStudy());

  useEffect(() => {
    const refresh = () => setData(propData ?? getEnrollmentByStudy());
    refresh();
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, [propData]);

  return (
    <div className="chart-card">
      <h3>Enrollment by Study</h3>
      {data.length === 0 ? (
        <p className="chart-empty-state">No data available yet</p>
      ) : (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="study" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="enrolled" fill="#082b3d" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      )}
    </div>
  );
};

export default EnrollmentChart;
