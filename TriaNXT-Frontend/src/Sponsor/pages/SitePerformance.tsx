import React, { useState, useEffect } from 'react';
import AppLayout from './AppLayout';
import { useNavigate } from 'react-router-dom';
import '../styles/SitePerformance.css';
import '../styles/SponsorShared.css';
import KpiCard from './KpiCard';
import EnterpriseModal from './EnterpriseModal';
import { FiHome, FiUsers, FiTrendingUp, FiBarChart2 } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getSites, getSiteKPIs } from '../data/sponsorDataStore';
import { resolveSiteDisplay, formatSiteOption, MISSING_SITE_DISPLAY } from '../../shared/utils/siteDisplay';

const SitePerformance = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState(getSites());
  const [kpis, setKpis] = useState(getSiteKPIs());
  const [viewSite, setViewSite] = useState(null);

  useEffect(() => {
    const refresh = () => { setSites(getSites()); setKpis(getSiteKPIs()); };
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const chartData = sites.map(s => ({ name: s.name.split(' ')[0], performance: s.performance }));

  const exportData = () => {
    const csv = 'Site,Study,Enrolled,Target,Performance\n' + sites.map(s => `${s.name},${s.study},${s.enrolled},${s.target},${s.performance}%`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SitePerformance.csv';
    a.click();
  };

  return (
    <AppLayout>
      <div className="site-performance-page tnxt-compact">
        <div className="sponsor-page-header">
          <h1>Site Performance</h1>
          <p>Track enrollment and performance metrics across clinical sites.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard title="Total Sites" value={kpis.total} subtitle="Active sites" icon={<FiHome size={24} />} iconBg="#eff6ff" iconColor="#2563eb" />
          <KpiCard title="Total Enrolled" value={kpis.totalEnrolled.toLocaleString()} subtitle="Subjects enrolled" icon={<FiUsers size={24} />} iconBg="#ecfdf5" iconColor="#16a34a" />
          <KpiCard title="Avg Performance" value={`${kpis.avgPerformance}%`} subtitle="Enrollment rate" icon={<FiTrendingUp size={24} />} iconBg="#fef3c7" iconColor="#d97706" />
          <KpiCard title="Regions" value={new Set<any>(sites.map(s => s.region)).size} subtitle="Geographic coverage" icon={<FiBarChart2 size={24} />} iconBg="#ede9fe" iconColor="#7c3aed" />
        </div>

        <div className="sponsor-chart-grid">
          <div className="sponsor-chart-card">
            <h3>Site Performance Comparison</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="performance" fill="#082b3d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sponsor-toolbar">
          <button type="button" className="sponsor-btn-secondary" onClick={exportData}>Export CSV</button>
        </div>

        <div className="sponsor-table-wrap">
          <h2>Site Performance Overview</h2>
          <table className="sponsor-table site-table">
            <thead>
              <tr>
                <th>Site ID</th>
                <th>Site</th>
                <th>Study</th>
                <th>Enrolled</th>
                <th>Target</th>
                <th>Performance</th>
                <th>Region</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.id} onClick={() => setViewSite(site)}>
                  <td>{site.siteNumber || site.id}</td>
                  <td>{resolveSiteDisplay(site)}</td>
                  <td>{site.study}</td>
                  <td>{site.enrolled}</td>
                  <td>{site.target}</td>
                  <td>{site.performance}%</td>
                  <td>{site.region}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="view-btn" onClick={() => navigate('/site-details', { state: site })}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewSite && (
        <EnterpriseModal title={formatSiteOption(viewSite) || MISSING_SITE_DISPLAY} onClose={() => setViewSite(null)}>
          <p><strong>Site ID:</strong> {viewSite.id}</p>
          <p><strong>Study:</strong> {viewSite.study}</p>
          <p><strong>Enrollment:</strong> {viewSite.enrolled} / {viewSite.target}</p>
          <p><strong>Performance:</strong> {viewSite.performance}%</p>
          <p><strong>Region:</strong> {viewSite.region}</p>
        </EnterpriseModal>
      )}
    </AppLayout>
  );
};

export default SitePerformance;
