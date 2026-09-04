import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {  MdWorkspaces,
  MdWarning,
  MdAssessment,
  MdGroups,
  MdBusiness,
} from 'react-icons/md';
import { syncQuickActionValues, getQuickActions, saveQuickActions } from '../data/sponsorDataStore';
import EnterpriseModal from './EnterpriseModal';
import '../styles/SponsorQuickActions.css';

const iconMap = {
  study: MdWorkspaces,
  risk: MdWarning,
  report: MdAssessment,
  recruitment: MdGroups,
  cro: MdBusiness,
};

const SponsorQuickActions = () => {
  const navigate = useNavigate();
  const [actions, setActions] = useState(syncQuickActionValues());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [form, setForm] = useState({
    label: '',
    value: '',
    subtitle: '',
    icon: 'study',
    color: '#2563eb',
    bg: '#eff6ff',
    route: '',
  });

  useEffect(() => {
    const refresh = () => setActions(syncQuickActionValues());
    refresh();
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const openCreate = () => {
    setEditingAction(null);
    setForm({
      label: '',
      value: '',
      subtitle: '',
      icon: 'study',
      color: '#2563eb',
      bg: '#eff6ff',
      route: '/portfolio',
    });
    setModalOpen(true);
  };

  const openEdit = (action, e) => {
    e.stopPropagation();
    setEditingAction(action);
    setForm({
      label: action.label,
      value: action.value || '',
      subtitle: action.subtitle || '',
      icon: action.icon,
      color: action.color,
      bg: action.bg,
      route: action.route || '',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) return;
    const stored = getQuickActions();
    let updated;
    if (editingAction) {
      updated = stored.map((a) => (a.id === editingAction.id ? { ...a, ...form } : a));
    } else {
      updated = [...stored, { id: `QA-${Date.now()}`, ...form }];
    }
    saveQuickActions(updated);
    setActions(syncQuickActionValues());
    setModalOpen(false);
  };

  const handleCardClick = (action) => {
    if (action.route) {
      navigate(action.route);
    }
  };

  return (
    <div className="quick-actions-card tnxt-sponsor-quick-actions">
      <div className="quick-actions-header">
        <h3>Quick Actions</h3>
      </div>

      <div className="quick-actions-grid">
        {actions.map((action) => {
          const Icon = iconMap[action.icon] || MdWorkspaces;
          return (
            <div
              key={action.id}
              className="quick-action-kpi"
              onClick={() => handleCardClick(action)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleCardClick(action)}
            >
              <div className="qa-icon" style={{ backgroundColor: action.bg, color: action.color }}>
                <Icon size={24} />
              </div>
              <div className="qa-text">
                <span className="qa-value">{action.value}</span>
                <span className="qa-label">{action.label}</span>
                {action.subtitle && <span className="qa-subtitle">{action.subtitle}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <EnterpriseModal
          title={editingAction ? 'Edit Quick Action' : 'Create Quick Action'}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          saveLabel={editingAction ? 'Update' : 'Create'}
        >
          <input
            placeholder="Action Label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <input
            placeholder="Display Value (e.g. 6 or 73%)"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <input
            placeholder="Subtitle"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          />
          <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
            <option value="study">Study</option>
            <option value="risk">Risk</option>
            <option value="report">Report</option>
            <option value="recruitment">Recruitment</option>
            <option value="cro">CRO</option>
          </select>
          <input
            placeholder="Route (e.g. /portfolio)"
            value={form.route}
            onChange={(e) => setForm({ ...form, route: e.target.value })}
          />
        </EnterpriseModal>
      )}
    </div>
  );
};

export default SponsorQuickActions;
