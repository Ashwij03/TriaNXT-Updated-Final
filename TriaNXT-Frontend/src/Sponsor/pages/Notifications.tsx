import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from './AppLayout';
import '../styles/Notifications.css';
import '../styles/SponsorShared.css';
import KpiCard from './KpiCard';
import EnterpriseModal from './EnterpriseModal';
import { FiBell, FiAlertTriangle, FiEye, FiCheckCircle } from 'react-icons/fi';
import { getNotifications, saveNotifications, getNotificationKPIs, SEVERITY_COLORS } from '../data/sponsorDataStore';

const Notifications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState(getNotifications());
  const [kpis, setKpis] = useState(getNotificationKPIs());
  const [filter, setFilter] = useState('All');
  const [viewAll, setViewAll] = useState(location.state?.viewAll ?? false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (location.state?.viewAll) {
      setViewAll(true);
    }
  }, [location.state]);

  useEffect(() => {
    const refresh = () => { setNotifications(getNotifications()); setKpis(getNotificationKPIs()); };
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const filtered = notifications.filter(n => {
    if (filter === 'Unread') return !n.read;
    if (filter === 'Read') return n.read;
    if (filter === 'Critical') return n.severity === 'Critical';
    if (filter === 'High') return n.severity === 'High';
    return true;
  });

  const markRead = (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
    setNotifications(updated);
    setKpis(getNotificationKPIs());
  };

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
    setNotifications(updated);
    setKpis(getNotificationKPIs());
  };

  return (
    <AppLayout>
      <div className="notifications-page tnxt-compact">
        <div className="sponsor-page-header">
          <h1>Notifications</h1>
          <p>Central notification center for all sponsor alerts and updates.</p>
        </div>

        <div className="sponsor-kpi-grid">
          <KpiCard title="Total Alerts" value={kpis.total} subtitle="All notifications" icon={<FiBell size={24} />} iconBg="#eff6ff" iconColor="#2563eb" onClick={() => { setFilter('All'); setViewAll(true); }} />
          <KpiCard title="Critical" value={kpis.critical} subtitle="Immediate action" icon={<FiAlertTriangle size={24} />} iconBg="#fee2e2" iconColor="#dc2626" onClick={() => setFilter('Critical')} />
          <KpiCard title="Unread" value={kpis.unread} subtitle="Pending review" icon={<FiEye size={24} />} iconBg="#fef3c7" iconColor="#d97706" onClick={() => setFilter('Unread')} />
          <KpiCard title="Resolved" value={kpis.resolved} subtitle="Read/acknowledged" icon={<FiCheckCircle size={24} />} iconBg="#ecfdf5" iconColor="#16a34a" onClick={() => setFilter('Read')} />
        </div>

        <div className="sponsor-toolbar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All</option>
            <option>Unread</option>
            <option>Read</option>
            <option>Critical</option>
            <option>High</option>
          </select>
          <button type="button" className="sponsor-btn-secondary" onClick={markAllRead}>Mark All Read</button>
        </div>

        <div className="sponsor-table-wrap">
          <h2>Notification Center</h2>
          <table className="sponsor-table notification-table ctms-standard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Message</th>
                <th>Severity</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(viewAll ? filtered : filtered.slice(0, 10)).map((n) => (
                <tr key={n.id} className={!n.read ? 'unread-row' : ''} onClick={() => setSelected(n)}>
                  <td>{n.id}</td>
                  <td>{n.type}</td>
                  <td>{n.message}</td>
                  <td><span className="severity-badge" style={{ backgroundColor: SEVERITY_COLORS[n.severity] }}>{n.severity}</span></td>
                  <td>{n.date}</td>
                  <td>{n.read ? 'Read' : 'Unread'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="view-btn" onClick={() => { setSelected(n); markRead(n.id); navigate('/notification-details', { state: n }); }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 10 && (
            <div className="view-all-link" style={{ padding: '1rem 1.25rem' }}>
              <button type="button" className="sponsor-btn-secondary" onClick={() => setViewAll(!viewAll)}>
                {viewAll ? 'Show Less' : `View All (${filtered.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <EnterpriseModal title={selected.type} onClose={() => setSelected(null)} onSave={() => { markRead(selected.id); setSelected(null); }} saveLabel="Mark Read">
          <p>{selected.message}</p>
          <p><strong>Severity:</strong> {selected.severity}</p>
          <p><strong>Date:</strong> {selected.date}</p>
        </EnterpriseModal>
      )}
    </AppLayout>
  );
};

export default Notifications;
