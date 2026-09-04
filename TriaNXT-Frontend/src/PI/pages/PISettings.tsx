import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { FaUser, FaBell, FaLock, FaCog } from "react-icons/fa";
import PIKpiCard from "./PIKpiCard";
import PIAccountSecurity from "./PIAccountSecurity";
import ProfilePhotoCard from "../../shared/pages/profile/ProfilePhotoCard";
import { getUserProfile } from "../../shared/services/roleService";
import {
  getSettingsData,
  saveSettingsData,
  getDashboardData,
  collectAllStudies,
} from "./piDashboardService";
import "../../shared/styles/AdminPage.css";

function PISettings({ activeView = "security" }: any) {
  const [data, setData] = useState(getSettingsData);
  const [view, setView] = useState(activeView);
  const [profileForm, setProfileForm] = useState(data.profile);
  const [notifPrefs, setNotifPrefs] = useState(data.notificationPreferences);
  const [studyPrefs, setStudyPrefs] = useState(data.studyPreferences);
  const [profilePhoto, setProfilePhoto] = useState(
    () => getUserProfile().profilePhoto || ""
  );
  const location = useLocation();

  useEffect(() => {
    const fresh = getSettingsData();
    setData(fresh);
    setProfileForm(fresh.profile);
    setNotifPrefs(fresh.notificationPreferences);
    setStudyPrefs(fresh.studyPreferences);
  }, []);

  useEffect(() => {
    setView(activeView);
  }, [activeView]);

  useEffect(() => {
  if (location.state?.openModal === "profile") {
    setView("profile");
  }
}, [location]);

  const persist = (updated) => {
    const saved = saveSettingsData(updated);
    setData(saved);
    setProfileForm(saved.profile);
    setNotifPrefs(saved.notificationPreferences);
    setStudyPrefs(saved.studyPreferences);
    window.dispatchEvent(new CustomEvent("pi-settings-updated"));
  };

  const handleSaveProfile = () => {
    persist({ ...data, profile: profileForm });
  };

  const handleSaveNotifications = () => {
    persist({ ...data, notificationPreferences: notifPrefs });
  };

  const handleSavePreferences = () => {
    persist({ ...data, studyPreferences: studyPrefs });
  };

  const toggleNotifPref = (key) => {
    setNotifPrefs({ ...notifPrefs, [key]: !notifPrefs[key] });
  };

  const CARD_ICONS = {
    profile: FaUser,
    notifications: FaBell,
    security: FaLock,
    preferences: FaCog,
  };

  const CARD_COLORS = ["blue", "green", "orange", "purple"];

  const viewTitles = {
    profile: "Profile Settings",
    security: "Account Security",
    notifications: "Notification Settings",
    preferences: "Study Preferences",
  };

  const allStudies = collectAllStudies().filter((s) => s !== "All Studies");
  const dashboardStudies = getDashboardData().studies || [];

  const renderProfileView = () => (
    <div className="table-container tnxt-compact">
      <h2>PI Profile Information</h2>
      <ProfilePhotoCard
        photo={profilePhoto}
        onPhotoChange={setProfilePhoto}
      />
      <div className="pi-settings-form">
        <label>
          PI Name
          <input type="text" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
        </label>
        <label>
          Site Name
          <input type="text" value={profileForm.siteName || profileForm.institute} onChange={(e) => setProfileForm({ ...profileForm, siteName: e.target.value, institute: e.target.value })} />
        </label>
        <label>
          Email
          <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
        </label>
        <label>
          Phone
          <input type="text" value={profileForm.phone || ""} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
        </label>
        <label>
          Office Contact
          <input type="text" value={profileForm.contactInfo?.office || ""} onChange={(e) => setProfileForm({ ...profileForm, contactInfo: { ...profileForm.contactInfo, office: e.target.value } })} />
        </label>
        <label>
          Role
          <input type="text" value={profileForm.role} readOnly className="pi-input-readonly" />
        </label>
      </div>
      <button type="button" className="export-btn" onClick={handleSaveProfile}>Save Profile</button>

      <h3 style={{ marginTop: "2rem" }}>Study Assignments</h3>
      <div className="pi-table-responsive">
        <table className="pi-table ctms-standard-table">
          <thead>
            <tr>
              <th>Study ID</th>
              <th>Target</th>
              <th>Enrolled</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dashboardStudies.map((s, i) => (
              <tr key={i}>
                <td>{s.study}</td>
                <td>{s.target}</td>
                <td>{s.enrolled}</td>
                <td><span className={s.status === "On Track" ? "status-success" : "status-danger"}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderNotificationView = () => (
    <div className="table-container">
      <h2>Notification Preferences</h2>
      <div className="pi-security-settings-list">
        {[
          { key: "emailNotifications", label: "Email Notifications", desc: "Receive alerts via email" },
          { key: "smsNotifications", label: "SMS Notifications", desc: "Receive critical alerts via SMS" },
          { key: "visitAlerts", label: "Visit Alerts", desc: "Upcoming visit reminders" },
          { key: "regulatoryAlerts", label: "Regulatory Alerts", desc: "IRB deadlines and document expiry" },
          { key: "safetyAlerts", label: "Safety Alerts", desc: "SAE and safety event notifications" },
          { key: "recruitmentUpdates", label: "Recruitment Updates", desc: "Enrollment milestone alerts" },
          { key: "studyUpdates", label: "Study Updates", desc: "Protocol amendments and study changes" },
        ].map((item) => (
          <div
            key={item.key}
            className="pi-security-setting-row"
            onClick={() => toggleNotifPref(item.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && toggleNotifPref(item.key)}
          >
            <div>
              <strong>{item.label}</strong>
              <p>{item.desc}</p>
            </div>
            <span className={`pi-toggle ${notifPrefs[item.key] ? "on" : "off"}`}>
              {notifPrefs[item.key] ? "ON" : "OFF"}
            </span>
          </div>
        ))}
      </div>
      <label className="pi-settings-inline-label">
        Digest Frequency
        <select value={notifPrefs.digestFrequency} onChange={(e) => setNotifPrefs({ ...notifPrefs, digestFrequency: e.target.value })}>
          <option>Real-time</option>
          <option>Daily</option>
          <option>Weekly</option>
        </select>
      </label>
      <button type="button" className="export-btn" style={{ marginTop: "1rem" }} onClick={handleSaveNotifications}>
        Save Notification Settings
      </button>
    </div>
  );

  const renderPreferencesView = () => (
    <div className="table-container">
      <h2>Study & Dashboard Preferences</h2>
      <div className="pi-settings-form">
        <label>
          Default Study View
          <select value={studyPrefs.defaultStudyView} onChange={(e) => setStudyPrefs({ ...studyPrefs, defaultStudyView: e.target.value })}>
            {collectAllStudies().map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Dashboard Layout
          <select value={studyPrefs.dashboardLayout} onChange={(e) => setStudyPrefs({ ...studyPrefs, dashboardLayout: e.target.value })}>
            <option>Standard</option>
            <option>Compact</option>
            <option>Detailed</option>
          </select>
        </label>
        <label>
          Default Report Format
          <select value={studyPrefs.defaultReportFormat} onChange={(e) => setStudyPrefs({ ...studyPrefs, defaultReportFormat: e.target.value })}>
            <option>PDF</option>
            <option>XLSX</option>
            <option>CSV</option>
          </select>
        </label>
        <label>
          Preferred Studies
          <select
            multiple
            value={studyPrefs.preferredStudies}
            onChange={(e) =>
              setStudyPrefs({
                ...studyPrefs,
                preferredStudies: Array.from(e.target.selectedOptions, (o) => o.value),
              })
            }
            className="pi-multi-select"
          >
            {allStudies.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="pi-security-settings-list">
        <div className="pi-security-setting-row" onClick={() => setStudyPrefs({ ...studyPrefs, showKpiTrends: !studyPrefs.showKpiTrends })} role="button" tabIndex={0}>
          <div><strong>Show KPI Trends</strong><p>Display trend indicators on dashboard KPIs</p></div>
          <span className={`pi-toggle ${studyPrefs.showKpiTrends ? "on" : "off"}`}>{studyPrefs.showKpiTrends ? "ON" : "OFF"}</span>
        </div>
        <div className="pi-security-setting-row" onClick={() => setStudyPrefs({ ...studyPrefs, compactTables: !studyPrefs.compactTables })} role="button" tabIndex={0}>
          <div><strong>Compact Tables</strong><p>Use condensed table layout across modules</p></div>
          <span className={`pi-toggle ${studyPrefs.compactTables ? "on" : "off"}`}>{studyPrefs.compactTables ? "ON" : "OFF"}</span>
        </div>
      </div>
      <button type="button" className="export-btn" style={{ marginTop: "1rem" }} onClick={handleSavePreferences}>
        Save Study Preferences
      </button>
    </div>
  );

  return (
    <div className="pi-page-content">
      <div className="dashboard-header">
        <div>
          <h2>{viewTitles[view] || "Settings"}</h2>
          <p className="pi-subtitle">
            {view === "security"
              ? "Manage password, sessions, and access controls"
              : "Manage account, notifications, and preferences"}
          </p>
        </div>
      </div>

      <div className="pi-kpi-grid pi-kpi-grid-4 settings-cards-grid">
        {data.cards.map((card, i) => {
          const Icon = CARD_ICONS[card.id] || FaCog;
          return (
            <div
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => setView(card.id)}
              onKeyDown={(e) => e.key === "Enter" && setView(card.id)}
              className={view === card.id ? "pi-settings-card-active" : ""}
            >
              <PIKpiCard
                title={card.title}
                value={view === card.id ? "Active" : "—"}
                subtitle={card.description}
                icon={Icon}
                color={CARD_COLORS[i % CARD_COLORS.length]}
                clickable
              />
            </div>
          );
        })}

      </div>

      {view === "security" && <PIAccountSecurity />}
      {view === "profile" && renderProfileView()}
      {view === "notifications" && renderNotificationView()}
      {view === "preferences" && renderPreferencesView()}
    </div>
  );
}

export default PISettings;
