import React, { useState, useEffect } from 'react';
import AppLayout from './AppLayout';
import '../styles/PortfolioManagement.css';
import '../styles/SponsorShared.css';
import { useNavigate } from 'react-router-dom';
import KpiCard from './KpiCard';
import EnterpriseModal from './EnterpriseModal';
import { FiBriefcase, FiActivity, FiCheckCircle, FiClock } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import {
  getPortfolioStudies,
  getPortfolioKPIs,
  getPhaseDistribution,
  getStudyStatusData,
  getEnrollmentByStudy,
} from '../data/sponsorDataStore';
import { createStudy, updateStudy } from '../../shared/services/studyService';

const STATUS_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#94a3b8'];

const PortfolioManagement = () => {
  const navigate = useNavigate();
  const [studies, setStudies] = useState(getPortfolioStudies());
  const [kpis, setKpis] = useState(getPortfolioKPIs());
  const [phaseData, setPhaseData] = useState(getPhaseDistribution());
  const [statusData, setStatusData] = useState(getStudyStatusData());
  const [enrollmentData, setEnrollmentData] = useState(getEnrollmentByStudy());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Studies');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editStudy, setEditStudy] = useState(null);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [form, setForm] = useState({ studyId: '', studyName: '', phase: 'Phase II', status: 'Planning', cro: '', sites: 0, startDate: '', therapeuticArea: '' });

  useEffect(() => {
    const refresh = () => {
      setStudies(getPortfolioStudies());
      setKpis(getPortfolioKPIs());
      setPhaseData(getPhaseDistribution());
      setStatusData(getStudyStatusData());
      setEnrollmentData(getEnrollmentByStudy());
    };
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const filteredStudies = studies.filter((study) => {
    const matchesSearch =
      study.studyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      study.studyId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All Studies' || study.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = () => {
    if (!form.studyId || !form.studyName) return;

    try {
      if (editStudy) {
        updateStudy(editStudy.studyId, {
          name: form.studyName,
          phase: form.phase,
          status: form.status,
          cro: form.cro,
          sites: Number(form.sites) || 0,
          indication: form.therapeuticArea,
          startDate: form.startDate,
        });
      } else {
        createStudy({
          code: form.studyId,
          name: form.studyName,
          phase: form.phase,
          status: form.status,
          cro: form.cro,
          sites: Number(form.sites) || 0,
          indication: form.therapeuticArea,
          startDate: form.startDate,
          enrolled: 0,
          targetSubjects: 0,
        });
      }
    } catch (err) {
      alert(err.message || 'Unable to save study.');
      return;
    }

    setStudies(getPortfolioStudies());
    setKpis(getPortfolioKPIs());
    setShowCreateModal(false);
    setEditStudy(null);
  };

  const openEdit = (study) => {
    setEditStudy(study);
    setForm({ ...study, sites: study.sites });
    setShowCreateModal(true);
  };

  return (
    <AppLayout>
      <div className="page-container tnxt-compact">
        <div className="sponsor-page-header">
          <h1>Portfolio Management</h1>
          <p>Overview of your clinical trial portfolio and study pipeline.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard title="Total Studies" value={kpis.total} subtitle="In portfolio" icon={<FiBriefcase size={24} />} iconBg="#eff6ff" iconColor="#2563eb" onClick={() => setStatusFilter('All Studies')} />
          <KpiCard title="Active Studies" value={kpis.active} subtitle="Currently running" icon={<FiActivity size={24} />} iconBg="#ecfdf5" iconColor="#16a34a" onClick={() => setStatusFilter('Active')} />
          <KpiCard title="Recruiting" value={kpis.recruiting} subtitle="Open for enrollment" icon={<FiClock size={24} />} iconBg="#fef3c7" iconColor="#d97706" onClick={() => setStatusFilter('Recruiting')} />
          <KpiCard title="Completed" value={kpis.completed} subtitle="Finished studies" icon={<FiCheckCircle size={24} />} iconBg="#e0e7ff" iconColor="#3730a3" onClick={() => setStatusFilter('Completed')} />
        </div>

        <div className="sponsor-chart-grid">
          <div className="sponsor-chart-card">
            <h3>Studies by Phase</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={phaseData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="studies" fill="#082b3d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="sponsor-chart-card">
            <h3>Study Status Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((entry, index) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="sponsor-chart-card">
            <h3>Enrollment by Study</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={enrollmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="study" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="enrolled" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="portfolio-actions sponsor-toolbar">
          <input type="text" placeholder="Search Study..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <select className="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>All Studies</option>
            <option>Active</option>
            <option>Recruiting</option>
            <option>Planning</option>
            <option>Completed</option>
          </select>
          <button type="button" className="sponsor-btn-primary create-study-btn" onClick={() => { setEditStudy(null); setForm({ studyId: '', studyName: '', phase: 'Phase II', status: 'Planning', cro: '', sites: 0, startDate: '', therapeuticArea: '' }); setShowCreateModal(true); }}>
            + Create Study
          </button>
        </div>

        <div className="sponsor-table-wrap">
          <table className="sponsor-table portfolio-table ctms-standard-table">
            <thead>
              <tr>
                <th>Study ID</th>
                <th>Study Name</th>
                <th>Phase</th>
                <th>Status</th>
                <th>CRO</th>
                <th>Sites</th>
                <th>Enrollment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudies.map((study) => (
                <tr key={study.studyId} onClick={() => navigate(`/portfolio/${study.studyId}`)}>
                  <td>{study.studyId}</td>
                  <td>{study.studyName}</td>
                  <td>{study.phase}</td>
                  <td><span className={`status-badge ${study.status.toLowerCase()}`}>{study.status}</span></td>
                  <td>{study.cro}</td>
                  <td>{study.sites}</td>
                  <td>{study.enrolled || 0} / {study.target || 0}</td>
                  <td className="action-btn-group" onClick={(e) => e.stopPropagation()}>
                  <button
  className="view-btn"
  onClick={() =>
  navigate(`/study-dashboard/${study.studyId}?tab=Subjects`)
}
                  >
  View
</button>
                    <button type="button" className="edit-btn" onClick={() => openEdit(study)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedStudy && (
  <div className="study-details-card">

    <div className="study-details-header">
      <h2>Study Details</h2>

      <button
        className="close-btn"
        onClick={() => setSelectedStudy(null)}
      >
        ✕
      </button>
    </div>

    <div className="study-details-grid">

      <div>
        <h4>Study ID</h4>
        <p>{selectedStudy.studyId}</p>
      </div>

      <div>
        <h4>Study Name</h4>
        <p>{selectedStudy.studyName}</p>
      </div>

      <div>
        <h4>Phase</h4>
        <p>{selectedStudy.phase}</p>
      </div>

      <div>
        <h4>Status</h4>
        <p>{selectedStudy.status}</p>
      </div>

      <div>
        <h4>CRO</h4>
        <p>{selectedStudy.cro}</p>
      </div>

      <div>
        <h4>Sites</h4>
        <p>{selectedStudy.sites}</p>
      </div>

      <div>
        <h4>Enrollment</h4>
        <p>
          {selectedStudy.enrolled} / {selectedStudy.target}
        </p>
      </div>

      <div>
        <h4>Start Date</h4>
        <p>{selectedStudy.startDate || "-"}</p>
      </div>

    </div>

    <div className="study-action-buttons">

      <button
        className="edit-btn"
        onClick={() => openEdit(selectedStudy)}
      >
        Edit Study
      </button>

    </div>

  </div>
)}

      {showCreateModal && (
        <EnterpriseModal title={editStudy ? 'Edit Study' : 'Create Study'} onClose={() => setShowCreateModal(false)} onSave={handleSave} saveLabel={editStudy ? 'Update' : 'Create'}>
          <input placeholder="Study ID" value={form.studyId} onChange={(e) => setForm({ ...form, studyId: e.target.value })} disabled={!!editStudy} />
          <input placeholder="Study Name" value={form.studyName} onChange={(e) => setForm({ ...form, studyName: e.target.value })} />
          <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
            <option>Phase I</option><option>Phase II</option><option>Phase III</option><option>Phase IV</option>
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Planning</option><option>Recruiting</option><option>Active</option><option>Completed</option>
          </select>
          <input placeholder="CRO" value={form.cro} onChange={(e) => setForm({ ...form, cro: e.target.value })} />
          <input type="number" placeholder="Sites" value={form.sites} onChange={(e) => setForm({ ...form, sites: e.target.value as unknown as number })} />
        </EnterpriseModal>
      )}
    </AppLayout>
  );
};

export default PortfolioManagement;