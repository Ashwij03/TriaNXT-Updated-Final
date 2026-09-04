import React, { useState, useEffect } from 'react';
import AppLayout from './AppLayout';
import { useNavigate } from 'react-router-dom';
import '../styles/Regulatory.css';
import '../styles/SponsorShared.css';
import KpiCard from './KpiCard';
import RequestPermissionButton from '../../shared/components/RequestPermissionButton';
import { FiCheckSquare, FiCheckCircle, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getRegulatory, getRegulatoryKPIs, getPortfolioStudies } from '../data/sponsorDataStore';

const STATUS_COLORS = { Approved: '#22c55e', 'In Review': '#3b82f6', Submitted: '#f59e0b', Overdue: '#ef4444' };

const Regulatory = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState(getRegulatory());
  const [kpis, setKpis] = useState(getRegulatoryKPIs());
  const [statusFilter, setStatusFilter] = useState('All');
  const [studies, setStudies] = useState(getPortfolioStudies());
  const [studyCode, setStudyCode] = useState('');

  useEffect(() => {
    const refresh = () => {
      setDocuments(getRegulatory());
      setKpis(getRegulatoryKPIs());
      setStudies(getPortfolioStudies());
    };
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const filteredDocuments = documents.filter((doc) =>
    statusFilter === 'All' || doc.status === statusFilter
  );

  const pieData = [
    { name: 'Approved', value: kpis.approved },
    { name: 'In Review', value: kpis.inReview },
    { name: 'Submitted', value: kpis.submitted },
    { name: 'Overdue', value: kpis.overdue },
  ].filter(d => d.value > 0);

  return (
    <AppLayout>
      <div className="regulatory-page tnxt-compact">
        <div className="sponsor-page-header">
          <h1>Regulatory</h1>
          <p>Track regulatory submissions, approvals, and compliance documents.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard title="Total Documents" value={kpis.total} subtitle="Tracked submissions" icon={<FiCheckSquare size={24} />} iconBg="#eff6ff" iconColor="#2563eb" onClick={() => setStatusFilter('All')} />
          <KpiCard title="Approved" value={kpis.approved} subtitle="Fully approved" icon={<FiCheckCircle size={24} />} iconBg="#ecfdf5" iconColor="#16a34a" onClick={() => setStatusFilter('Approved')} />
          <KpiCard title="In Review" value={kpis.inReview} subtitle="Pending approval" icon={<FiClock size={24} />} iconBg="#fef3c7" iconColor="#d97706" onClick={() => setStatusFilter('In Review')} />
          <KpiCard title="Overdue" value={kpis.overdue} subtitle="Requires action" icon={<FiAlertTriangle size={24} />} iconBg="#fee2e2" iconColor="#dc2626" onClick={() => setStatusFilter('Overdue')} />
        </div>

        <div className="sponsor-chart-grid">
          <div className="sponsor-chart-card">
            <h3>Document Status Distribution</h3>
            {pieData.length === 0 ? (
              <p className="chart-empty-state">No data available yet</p>
            ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" outerRadius={90} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="sponsor-toolbar">
          <select
            value={studyCode}
            onChange={(e) => setStudyCode(e.target.value)}
            aria-label="Select study for new document"
          >
            <option value="">Select study…</option>
            {studies.map((study) => (
              <option key={study.studyId} value={study.studyId}>
                {study.studyName || study.studyId}
              </option>
            ))}
          </select>
          {studyCode && (
            <RequestPermissionButton
              action="Add Document"
              module="Regulatory"
              studyCode={studyCode}
              label="+ Add Document"
              className="sponsor-btn-primary"
            />
          )}
        </div>

        <div className="sponsor-table-wrap">
          <table className="sponsor-table regulatory-table ctms-standard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Study</th>
                <th>Document</th>
                <th>Status</th>
                <th>Authority</th>
                <th>Due Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' }}>No data available yet</td></tr>
              ) : filteredDocuments.map((doc) => (
                <tr key={doc.id} onClick={() => navigate('/regulatory-details', { state: doc })}>
                  <td>{doc.id}</td>
                  <td>{doc.study}</td>
                  <td>{doc.document}</td>
                  <td><span className={`status-badge ${doc.status === 'Overdue' ? 'open' : 'active'}`}>{doc.status}</span></td>
                  <td>{doc.authority}</td>
                  <td>{doc.dueDate}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="view-btn" onClick={() => navigate('/regulatory-details', { state: doc })}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default Regulatory;