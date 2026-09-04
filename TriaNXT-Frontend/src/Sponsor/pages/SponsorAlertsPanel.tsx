import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdLocalHospital,
  MdWarningAmber,
  MdInfoOutline,
  MdNotificationsActive,
  MdHealthAndSafety,
} from 'react-icons/md';
import { getAlerts, getNotifications, SEVERITY_COLORS } from '../data/sponsorDataStore';
import EnterpriseModal from './EnterpriseModal';
import '../styles/SponsorAlertsPanel.css';
import './SponsorAlertsPanel.js';

const MODULE_ROUTES = {
  Regulatory: '/regulatory',
  Recruitment: '/recruitment',
  'CRO Oversight': '/cro-oversight',
  Notifications: '/notifications',
  'Risk Management': '/risk-management',
  Reports: '/reports',
  'Study Oversight': '/study-oversight',
  'Site Performance': '/site-performance',
};

const severityIcon = (severity) => {
  switch (severity) {
    case 'Critical':
      return <MdLocalHospital className="alert-icon critical" aria-hidden />;
    case 'High':
      return <MdWarningAmber className="alert-icon high" aria-hidden />;
    case 'Medium':
      return <MdHealthAndSafety className="alert-icon medium" aria-hidden />;
    default:
      return <MdInfoOutline className="alert-icon low" aria-hidden />;
  }
};

const SponsorAlertsPanel = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(getAlerts());
  const [notifications, setNotifications] = useState(getNotifications());
  const [showAllModal, setShowAllModal] = useState(false);
  const notificationCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const refresh = () => {
      setAlerts(getAlerts());
      setNotifications(getNotifications());
    };
    refresh();
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const severityCounts = alerts.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});

  const handleAlertClick = (alert) => {
    const route = MODULE_ROUTES[alert.module] || '/notifications';
    navigate(route);
  };

  const renderAlertRow = (alert) => (
    <div
      key={alert.id}
      className="alert-item-row"
      onClick={() => handleAlertClick(alert)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleAlertClick(alert)}
    >
      {severityIcon(alert.severity)}
      <div className="alert-content">
        <p>{alert.message}</p>
        <span className="alert-module">{alert.module}</span>
      </div>
      <span
        className="severity-badge"
        style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }}
      >
        {alert.severity}
      </span>
    </div>
  );

  return (
    <div className="alerts-card">
      <div className="alerts-header">
        <h3>
          <MdNotificationsActive className="alerts-title-icon" aria-hidden />
          Alerts &amp; Notifications
        </h3>
        <div className="alerts-badges">
          <span className="alerts-count-badge alerts-total">{alerts.length} alerts</span>
          <span className="alerts-count-badge">{notificationCount} unread</span>
        </div>
      </div>

      <div className="severity-summary">
        {['Critical', 'High', 'Medium', 'Low'].map((sev) => (
          <div key={sev} className="severity-chip" style={{ borderColor: SEVERITY_COLORS[sev] }}>
            <span className="severity-label" style={{ color: SEVERITY_COLORS[sev] }}>{sev}</span>
            <span className="severity-count">{severityCounts[sev] || 0}</span>
          </div>
        ))}
      </div>

      <div className="alerts-list">
        {alerts.slice(0, 4).map(renderAlertRow)}
      </div>

      <div className="view-all-link">
        <button type="button" className="view-all-btn" onClick={() => setShowAllModal(true)}>
          View All Alerts ({alerts.length}) &amp; Notifications ({notifications.length}) →
        </button>
      </div>

      {showAllModal && (
        <EnterpriseModal
          title="All Alerts & Notifications"
          onClose={() => setShowAllModal(false)}
          onSave={() => { setShowAllModal(false); navigate('/notifications', { state: { viewAll: true } }); }}
          saveLabel="Open Notification Center"
        >
          <div className="alerts-modal-section">
            <h4>Active Alerts ({alerts.length})</h4>
            <div className="alerts-list alerts-list-modal">
              {alerts.map(renderAlertRow)}
            </div>
          </div>
          <div className="alerts-modal-section">
            <h4>Recent Notifications ({notificationCount} unread)</h4>
            <div className="alerts-list alerts-list-modal">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="alert-item-row"
                  onClick={() => { setShowAllModal(false); navigate('/notifications'); }}
                  role="button"
                  tabIndex={0}
                >
                  {severityIcon(n.severity)}
                  <div className="alert-content">
                    <p>{n.message}</p>
                    <span className="alert-module">{n.type} · {n.read ? 'Read' : 'Unread'}</span>
                  </div>
                  <span
                    className="severity-badge"
                    style={{ backgroundColor: SEVERITY_COLORS[n.severity] }}
                  >
                    {n.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </EnterpriseModal>
      )}
    </div>
  );
};

export default SponsorAlertsPanel;
