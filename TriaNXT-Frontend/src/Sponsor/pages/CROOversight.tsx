import React, { useState, useEffect } from 'react';
import AppLayout from './AppLayout';
import { useNavigate } from 'react-router-dom';
import '../styles/CROOversight.css';
import '../styles/SponsorShared.css';
import KpiCard from './KpiCard';
import RequestPermissionButton from '../../shared/components/RequestPermissionButton';
import { FiLayers, FiActivity, FiTrendingUp, FiBarChart2 } from 'react-icons/fi';
import { getCROs, getCROKPIs } from '../data/sponsorDataStore';

const CROOversight = () => {
  const navigate = useNavigate();
  const [cros, setCros] = useState(getCROs());
  const [kpis, setKpis] = useState(getCROKPIs());
  const [viewCro, setViewCro] = useState(null);

  useEffect(() => {
    const refresh = () => { setCros(getCROs()); setKpis(getCROKPIs()); };
    window.addEventListener('sponsor-data-updated', refresh);
    window.addEventListener('studies-updated', refresh);
    return () => {
      window.removeEventListener('sponsor-data-updated', refresh);
      window.removeEventListener('studies-updated', refresh);
    };
  }, []);

  const exportData = () => {
    if (!cros.length) return;
    const csv = 'CRO,Studies,Sites,Performance\n' + cros.map(c => `${c.name},${c.studies},${c.sites},${c.performance}%`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'CRO_Data.csv';
    a.click();
  };

  return (
    <AppLayout>
      <div className="cro-page tnxt-compact">
        <div className="sponsor-page-header">
          <h1>CRO Oversight</h1>
          <p>Monitor CRO partner performance and study delivery metrics.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard title="Total CROs" value={kpis.total} subtitle="Partners" icon={<FiLayers size={24} />} iconBg="#eff6ff" iconColor="#2563eb" />
          <KpiCard title="Active CROs" value={kpis.active} subtitle="Currently engaged" icon={<FiActivity size={24} />} iconBg="#ecfdf5" iconColor="#16a34a" />
          <KpiCard title="Total Studies" value={kpis.totalStudies} subtitle="Managed by CROs" icon={<FiBarChart2 size={24} />} iconBg="#fef3c7" iconColor="#d97706" />
          <KpiCard title="Avg Performance" value={`${kpis.avgPerformance}%`} subtitle="Across partners" icon={<FiTrendingUp size={24} />} iconBg="#ede9fe" iconColor="#7c3aed" />
        </div>

       

        <div className="sponsor-toolbar">
          <RequestPermissionButton action="Add CRO Partner" module="CRO Oversight" label="+ Add CRO" className="sponsor-btn-primary" />
          <button type="button" className="sponsor-btn-secondary" onClick={exportData}>Export Data</button>
          <button type="button" className="sponsor-btn-secondary" onClick={() => navigate('/cro-report')}>Performance Report</button>
        </div>

        <div className="sponsor-table-wrap">
          <h2>CRO Performance Overview</h2>
          <table className="sponsor-table cro-table ctms-standard-table">
            <thead>
              <tr>
                <th>CRO Name</th>
                <th>Studies</th>
                <th>Sites</th>
                <th>Performance</th>
                <th>Contact</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cros.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center' }}>No data available yet</td>
                </tr>
              ) : cros.map((cro) => (
                <tr key={cro.id} onClick={() => setViewCro(cro)}>
                  <td>{cro.name}</td>
                  <td>{cro.studies}</td>
                  <td>{cro.sites}</td>
                  <td>{cro.performance}%</td>
                  <td>{cro.contact}</td>
                  <td onClick={(e) => e.stopPropagation()}>
  <div className="action-btn-group">

    <button
      type="button"
      className="view-btn"
      onClick={() =>
        navigate('/cro-details', { state: cro })
      }
    >
      View
    </button>

  </div>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewCro && (
        <div className="sponsor-modal-backdrop" onClick={() => setViewCro(null)} role="presentation">
          <div className="sponsor-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{viewCro.name}</h3>
            <p><strong>Studies:</strong> {viewCro.studies}</p>
            <p><strong>Sites:</strong> {viewCro.sites}</p>
            <p><strong>Performance:</strong> {viewCro.performance}%</p>
            <p><strong>Contact:</strong> {viewCro.contact}</p>
            <button type="button" onClick={() => setViewCro(null)}>Close</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default CROOversight;
