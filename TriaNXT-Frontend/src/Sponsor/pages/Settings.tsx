import React, { useState, useEffect } from 'react';
import AppLayout from './AppLayout';
import EnterpriseModal from './EnterpriseModal';
import '../styles/Settings.css';
import '../styles/SponsorShared.css';
import { MdPerson, MdNotifications, MdSecurity, MdScience, MdChevronRight } from 'react-icons/md';
import { loadSettings, saveSettings } from '../data/sponsorDataStore';
import { useLocation } from "react-router-dom";
import { clearProfilePhoto, getCurrentUser, syncProfilePhoto } from "../../shared/services/roleService";

const SECTIONS = [
  {
    id: 'profile',
    title: 'Profile Settings',
    description: 'Manage your name, email, and contact details',
    icon: MdPerson,
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
  },
  {
    id: 'notifications',
    title: 'Notification Settings',
    description: 'Configure email, SMS, and alert preferences',
    icon: MdNotifications,
    iconBg: '#fef3c7',
    iconColor: '#d97706',
  },
  {
    id: 'security',
    title: 'Account Security',
    description: 'Password, two-factor authentication, and sessions',
    icon: MdSecurity,
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
  },
  {
    id: 'studyPreferences',
    title: 'Study Preferences',
    description: 'Default study view, refresh interval, and display options',
    icon: MdScience,
    iconBg: '#ecfdf5',
    iconColor: '#16a34a',
  },
];

const Settings = () => {
  const location = useLocation();
  const [settings, setSettings] = useState(loadSettings());
  const [activeSection, setActiveSection] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
  if (location.state?.section) {
    setActiveSection(location.state.section);
  }
}, [location]);
const [profilePhoto, setProfilePhoto] = useState(() => {
  const currentUser = getCurrentUser();
  return (
    currentUser?.profilePhoto ||
    localStorage.getItem("profilePhoto") ||
    ""
  );
});
const handlePhotoChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onloadend = () => {
    const image = reader.result;

    setProfilePhoto(image);
    syncProfilePhoto(image);
  };

  reader.readAsDataURL(file);
};

const handleRemovePhoto = () => {
  setProfilePhoto("");
  clearProfilePhoto();
};
  useEffect(() => {
    const refresh = () => setSettings(loadSettings());
    window.addEventListener('sponsor-data-updated', refresh);
    return () => window.removeEventListener('sponsor-data-updated', refresh);
  }, []);

  const update = (key, value) => setSettings({ ...settings, [key]: value });

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setActiveSection(null);
  };

  const renderSectionForm = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <>
          <div className="profile-photo-section">
  <div className="profile-photo-wrapper">
    <img
      src={profilePhoto || "https://ui-avatars.com/api/?name=User&background=0D6EFD&color=fff"}
      alt="Profile"
      className="profile-photo"
    />

    <label className="photo-upload-btn">
      📷
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={handlePhotoChange}
      />
    </label>
  </div>

  <p className="photo-text">Change Profile Photo</p>
  {profilePhoto && (
    <button
      type="button"
      className="photo-remove-btn"
      onClick={handleRemovePhoto}
    >
      Remove Photo
    </button>
  )}
</div>
            <div className="form-group">
  <label>First Name</label>
  <input
    type="text"
    value={settings.firstName}
    onChange={(e) => update("firstName", e.target.value)}
  />
</div>

<div className="form-group">
  <label>Last Name</label>
  <input
    type="text"
    value={settings.lastName}
    onChange={(e) => update("lastName", e.target.value)}
  />
</div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={settings.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Job Title</label>
              <input type="text" value={settings.jobTitle} onChange={(e) => update('jobTitle', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Organization</label>
              <input type="text" value={settings.organization} onChange={(e) => update('organization', e.target.value)} />
            </div>
            <div className="form-group">
  <label>Phone Number</label>
  <input
    type="tel"
    value={settings.phone}
    onChange={(e) => update("phone", e.target.value)}
  />
</div>

<div className="form-group">
  <label>Department</label>
  <input
    type="text"
    value={settings.department}
    onChange={(e) => update("department", e.target.value)}
  />
</div>

<div className="form-group">
  <label>Employee ID</label>
  <input
    type="text"
    value={settings.employeeId}
    onChange={(e) => update("employeeId", e.target.value)}
  />
</div>

<div className="form-group">
  <label>Office Location</label>
  <input
    type="text"
    value={settings.location}
    onChange={(e) => update("location", e.target.value)}
  />
</div>

<div className="form-group">
  <label>Language</label>
  <select
    value={settings.language}
    onChange={(e) => update("language", e.target.value)}
  >
    <option>English</option>
    <option>French</option>
    <option>German</option>
  </select>
</div>

<div className="form-group">
  <label>Time Zone</label>
  <select
    value={settings.timezone}
    onChange={(e) => update("timezone", e.target.value)}
  >
    <option>Asia/Kolkata</option>
    <option>UTC</option>
    <option>US/Eastern</option>
  </select>
</div>
          </>
        );
      case 'notifications':
        return (
          <>
            <div className="toggle-row">
              <label>Email Alerts</label>
              <input type="checkbox" checked={settings.emailAlerts} onChange={() => update('emailAlerts', !settings.emailAlerts)} />
            </div>
            <div className="toggle-row">
              <label>SMS Alerts</label>
              <input type="checkbox" checked={settings.smsAlerts} onChange={() => update('smsAlerts', !settings.smsAlerts)} />
            </div>
            <div className="toggle-row">
              <label>Critical Alerts Only</label>
              <input type="checkbox" checked={settings.criticalOnly} onChange={() => update('criticalOnly', !settings.criticalOnly)} />
            </div>
            <div className="toggle-row">
              <label>Enrollment Milestone Alerts</label>
              <input type="checkbox" checked={settings.enrollmentAlerts} onChange={() => update('enrollmentAlerts', !settings.enrollmentAlerts)} />
            </div>
            <div className="toggle-row">
              <label>Regulatory Deadline Reminders</label>
              <input type="checkbox" checked={settings.regulatoryAlerts} onChange={() => update('regulatoryAlerts', !settings.regulatoryAlerts)} />
            </div>
          </>
        );
      case 'security':
        return (
          <>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={settings.currentPassword} onChange={(e) => update('currentPassword', e.target.value)} placeholder="Enter current password" />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={settings.newPassword} onChange={(e) => update('newPassword', e.target.value)} placeholder="Enter new password" />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={settings.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} placeholder="Confirm new password" />
            </div>
            <div className="toggle-row">
              <label>Two-Factor Authentication</label>
              <input type="checkbox" checked={settings.twoFactorEnabled} onChange={() => update('twoFactorEnabled', !settings.twoFactorEnabled)} />
            </div>
            <div className="toggle-row">
              <label>Session Timeout (30 min idle)</label>
              <input type="checkbox" checked={settings.sessionTimeout} onChange={() => update('sessionTimeout', !settings.sessionTimeout)} />
            </div>
          </>
        );
      case 'studyPreferences':
        return (
          <>
            <div className="form-group">
              <label>Default Study View</label>
              <select value={settings.defaultStudyView} onChange={(e) => update('defaultStudyView', e.target.value)}>
                <option value="grid">Grid View</option>
                <option value="list">List View</option>
                <option value="table">Table View</option>
              </select>
            </div>
            <div className="form-group">
              <label>Auto-refresh Interval</label>
              <select value={settings.dashboardRefresh} onChange={(e) => update('dashboardRefresh', e.target.value)}>
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </div>
            <div className="form-group">
              <label>Preferred Therapeutic Area</label>
              <select value={settings.preferredTherapeuticArea} onChange={(e) => update('preferredTherapeuticArea', e.target.value)}>
                <option value="All">All Areas</option>
                <option value="Oncology">Oncology</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Neurology">Neurology</option>
                <option value="Infectious Disease">Infectious Disease</option>
              </select>
            </div>
            <div className="toggle-row">
              <label>Show Completed Studies</label>
              <input type="checkbox" checked={settings.showCompletedStudies} onChange={() => update('showCompletedStudies', !settings.showCompletedStudies)} />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const activeMeta = SECTIONS.find((s) => s.id === activeSection);

  return (
    <AppLayout>
      <div className="settings-page">
        <div className="sponsor-page-header">
          <h1>Settings</h1>
          <p>Configure your sponsor portal preferences, security, and study display options.</p>
        </div>

        <div className="settings-cards-grid">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.id}
                className="settings-nav-card"
                onClick={() => setActiveSection(section.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setActiveSection(section.id)}
              >
                <div className="settings-nav-icon" style={{ backgroundColor: section.iconBg, color: section.iconColor }}>
                  <Icon size={24} />
                </div>
                <div className="settings-nav-content">
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </div>
                <MdChevronRight className="settings-nav-arrow" size={20} />
              </div>
            );
          })}
        </div>

        <div className="settings-summary-card">
          <h3>Current Profile</h3>
          <div className="settings-summary-grid">
            <div><span>Name</span><strong>{settings.name}</strong></div>
            <div><span>Email</span><strong>{settings.email}</strong></div>
            <div><span>Organization</span><strong>{settings.organization}</strong></div>
            <div><span>2FA</span><strong>{settings.twoFactorEnabled ? 'Enabled' : 'Disabled'}</strong></div>
            <div><span>Refresh</span><strong>{settings.dashboardRefresh} min</strong></div>
            <div><span>Study View</span><strong>{settings.defaultStudyView}</strong></div>
          </div>
        </div>
      </div>

      {activeSection && activeMeta && (
        <EnterpriseModal
          title={activeMeta.title}
          onClose={() => setActiveSection(null)}
          onSave={handleSave}
          saveLabel={saved ? 'Saved!' : 'Save Changes'}
        >
          {renderSectionForm()}
        </EnterpriseModal>
      )}
    </AppLayout>
  );
};

export default Settings;
