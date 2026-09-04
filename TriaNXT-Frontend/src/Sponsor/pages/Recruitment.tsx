import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import '../styles/SponsorShared.css';
import KpiCard from './KpiCard';
import EnterpriseModal from './EnterpriseModal';
import { FiUsers, FiTarget, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getRecruitment, getRecruitmentKPIs } from '../data/sponsorDataStore';

const Recruitment = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(getRecruitment());
  const [kpis, setKpis] = useState(getRecruitmentKPIs());
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewItem, setViewItem] = useState(null);

  useEffect(() => {
    const refresh = () => { setData(getRecruitment()); setKpis(getRecruitmentKPIs()); };
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const chartData = data.map(d => ({ study: d.study, rate: d.rate }));
  const filteredData = data.filter((item) =>
    statusFilter === 'All' || (statusFilter === 'Below Target' ? item.status === 'Below Target' : item.status === 'On Track')
  );

  return (
    <AppLayout>
      <div className="page-container tnxt-compact">
        <div className="sponsor-page-header">
          <h1>Recruitment</h1>
          <p>Monitor subject recruitment progress across all active studies.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard title="Target Subjects" value={kpis.target.toLocaleString()} subtitle="Total enrollment goal" icon={<FiTarget size={24} />} iconBg="#eff6ff" iconColor="#2563eb" onClick={() => setStatusFilter('All')} />
          <KpiCard title="Recruited" value={kpis.enrolled.toLocaleString()} subtitle="Currently enrolled" icon={<FiUsers size={24} />} iconBg="#ecfdf5" iconColor="#16a34a" onClick={() => setStatusFilter('All')} />
          <KpiCard title="Recruitment Rate" value={`${kpis.rate}%`} subtitle="Overall progress" icon={<FiTrendingUp size={24} />} iconBg="#fef3c7" iconColor="#d97706" onClick={() => setStatusFilter('On Track')} />
          <KpiCard title="Below Target" value={kpis.belowTarget} subtitle="Studies needing attention" icon={<FiAlertTriangle size={24} />} iconBg="#fee2e2" iconColor="#dc2626" onClick={() => setStatusFilter('Below Target')} />
        </div>

        <div className="sponsor-chart-grid">
          <div className="sponsor-chart-card">
            <h3>Recruitment Rate by Study</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="study" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="rate" fill="#082b3d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sponsor-table-wrap">
          <h2>Recruitment Performance</h2>
          <table className="sponsor-table data-table ctms-standard-table">
            <thead>
              <tr>
                <th>Study</th>
                <th>Screened</th>
                <th>Target</th>
                <th>Enrolled</th>
                <th>Remaining</th>
                <th>Rate</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id} onClick={() => setViewItem(item)}>
                  <td>{item.study}</td>
                  <td>{item.screened}</td>
                  <td>{item.target}</td>
                  <td>{item.enrolled}</td>
                  <td>{item.target - item.enrolled}</td>
                  <td>{item.rate}%</td>
                  <td><span className={`status-badge ${item.status === 'Below Target' ? 'open' : 'active'}`}>{item.status}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="view-btn" onClick={() => navigate('/recruitment-details', { state: item })}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewItem && (
        <EnterpriseModal title={`Recruitment: ${viewItem.study}`} onClose={() => setViewItem(null)}>
          <p><strong>Screened:</strong> {viewItem.screened}</p>
          <p><strong>Enrolled:</strong> {viewItem.enrolled} / {viewItem.target}</p>
          <p><strong>Rate:</strong> {viewItem.rate}%</p>
          <p><strong>Status:</strong> {viewItem.status}</p>
        </EnterpriseModal>
      )}
    </AppLayout>
  );
};

export default Recruitment;
