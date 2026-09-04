import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaUser, FaBell, FaLock, FaCog } from "react-icons/fa";
import DashboardCard from "../../shared/components/dashboard/shared/DashboardCard";
import DashboardLayout from "../../shared/components/dashboard/shared/DashboardLayout";
import ProfileSettingsSection from "../../shared/pages/profile/ProfileSettingsSection";
import ROLES from "../../shared/constants/roles";
import SecuritySettingsSection from "../../shared/pages/profile/SecuritySettingsSection";
import { getSettings, saveSettings } from "../../shared/services/adminService";
import {
  getAllRoles,
  getAssignedSite,
  getCurrentUser,
  getDashboardPath,
  getEffectiveRole,
  getUserProfile,
  getUserSettings,
  isAdmin,
  ROLE_LABELS,
  saveUserSettings,
  setAdminPreviewRole,
  SWITCHABLE_ROLE_DASHBOARDS,
} from "../../shared/services/roleService";
import {
  formatSessionTimestamp,
  getAllActiveSessions,
  getCurrentSession,
  getSessionDurationMinutes,
  SESSIONS_CHANGE_EVENT,
} from "../../shared/services/sessionService";
import { ADMIN_PREVIEW_ROLE_EVENT } from "../../shared/constants/headerFilters";
import "../../shared/styles/AdminPage.css";
import "../styles/Settings.css";

const SETTINGS_SECTIONS = [
  {
    id: "profile",
    label: "Profile Settings",
    description: "Name, contact & account details",
  },
  {
    id: "notifications",
    label: "Notification Settings",
    description: "Email, SMS & alert preferences",
  },
  {
    id: "security",
    label: "Account Security",
    description: "Password, MFA, sessions & activity",
  },
  {
    id: "account",
    label: "Account Preferences",
    description: "System, display & reporting preferences",
  },
];

const SECTION_ICONS = {
  profile: FaUser,
  notifications: FaBell,
  security: FaLock,
  account: FaCog,
};

const CARD_COLORS = ["blue", "green", "orange", "purple"];

const NOTIFICATION_ITEMS = [
  {
    key: "emailNotifications",
    label: "Email Notifications",
    desc: "Receive alerts via email",
  },
  {
    key: "smsNotifications",
    label: "SMS Notifications",
    desc: "Receive critical alerts via SMS",
  },
  {
    key: "commentAlerts",
    label: "Comment Alerts",
    desc: "Alert me when new comments are assigned",
  },
  {
    key: "visitReminders",
    label: "Visit Reminders",
    desc: "Send upcoming visit reminders",
  },
  {
    key: "regulatoryAlerts",
    label: "Regulatory Alerts",
    desc: "IRB deadlines and document expiry",
  },
  {
    key: "safetyAlerts",
    label: "Safety Alerts",
    desc: "SAE and safety event notifications",
  },
  {
    key: "recruitmentUpdates",
    label: "Recruitment Updates",
    desc: "Enrollment milestone alerts",
  },
  {
    key: "studyUpdates",
    label: "Study Updates",
    desc: "Protocol amendments and study changes",
  },
];

function Settings() {
  const navigate = useNavigate();
  const location = useLocation();

  // Stable reference for the lifetime of this mount — getCurrentUser() parses
  // localStorage and returns a NEW object every call, which previously caused
  // effects/useMemo hooks keyed on `currentUser` to think it "changed" on
  // every render, triggering an infinite update loop.
  const currentUser = useMemo(() => getCurrentUser(), []);
  const currentUserKey = currentUser?.email || currentUser?.id || null;

  const profile = getUserProfile();
  const assignedSite = getAssignedSite();
  const adminMode = isAdmin();

  const [activeSection, setActiveSection] = useState("profile");

  const [systemSettings, setSystemSettings] = useState(
    adminMode ? getSettings() : {}
  );

  const [userSettings, setUserSettings] = useState({
    ...getUserSettings(),
    commentAlerts: true,
    visitReminders: true,
    weeklyDigest: adminMode,
    compactDashboard: false,
    defaultLandingPage: "dashboard",
    regulatoryAlerts: true,
    safetyAlerts: true,
    recruitmentUpdates: true,
    studyUpdates: true,
    digestFrequency: "Daily",
  });

  const [savedMessage, setSavedMessage] = useState("");
  const [previewRole, setPreviewRoleState] = useState(
    () => getEffectiveRole(currentUser) || ROLES.ADMIN
  );
  const [sessionsVersion, setSessionsVersion] = useState(0);

  useEffect(() => {
    const requestedSection =
      location.state?.section ||
      location.state?.openModal ||
      location.hash.replace("#", "") ||
      "profile";

    const validSection = SETTINGS_SECTIONS.some(
      (section) => section.id === requestedSection
    )
      ? requestedSection
      : "profile";

    setActiveSection(validSection);
  }, [location.pathname, location.state, location.hash]);

  useEffect(() => {
    const refreshSessions = () => setSessionsVersion((value) => value + 1);

    window.addEventListener(SESSIONS_CHANGE_EVENT, refreshSessions);

    return () => {
      window.removeEventListener(SESSIONS_CHANGE_EVENT, refreshSessions);
    };
  }, []);

  useEffect(() => {
    if (adminMode) {
      getCurrentSession(currentUser);
      setSessionsVersion((value) => value + 1);
    }
    // Depend on a primitive identity (email/id) instead of the `currentUser`
    // object itself, and only run once per mount / actual user change —
    // this is what was causing "Maximum update depth exceeded".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminMode, currentUserKey]);

  useEffect(() => {
    const syncPreviewRole = () => {
      setPreviewRoleState(getEffectiveRole(currentUser) || ROLES.ADMIN);
    };

    window.addEventListener(ADMIN_PREVIEW_ROLE_EVENT, syncPreviewRole);

    return () => {
      window.removeEventListener(ADMIN_PREVIEW_ROLE_EVENT, syncPreviewRole);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserKey]);

  const activeSessions = useMemo(() => {
    void sessionsVersion;
    return adminMode ? getAllActiveSessions() : [];
  }, [adminMode, sessionsVersion]);

  const currentSession = useMemo(() => {
    void sessionsVersion;
    return getCurrentSession(currentUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserKey, sessionsVersion]);

  const roleOptions = useMemo(() => getAllRoles(), []);

  const visibleNotificationItems = useMemo(
    () =>
      adminMode
        ? [
            ...NOTIFICATION_ITEMS,
            {
              key: "weeklyDigest",
              label: "Weekly Portfolio Digest",
              desc: "Receive weekly portfolio digest",
            },
          ]
        : NOTIFICATION_ITEMS,
    [adminMode]
  );

  const handleSystemChange = (field, value) => {
    setSystemSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUserChange = (field, value) => {
    setUserSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleUserSetting = (field) => {
    setUserSettings((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    try {
      if (adminMode) {
        saveSettings(systemSettings);
      }

      saveUserSettings(userSettings);
      setSavedMessage("Settings saved successfully.");
    } catch (error) {
      setSavedMessage(
        error?.message || "Failed to save settings. Please try again."
      );
    }
  };

  const handlePreviewRoleChange = (nextRole) => {
    if (!nextRole || !adminMode) {
      return;
    }

    if (nextRole === ROLES.ADMIN) {
      setAdminPreviewRole(null);
      setPreviewRoleState(ROLES.ADMIN);
      navigate("/admin-dashboard");
      return;
    }

    if (SWITCHABLE_ROLE_DASHBOARDS.includes(nextRole)) {
      setAdminPreviewRole(nextRole);
      setPreviewRoleState(nextRole);
      navigate(getDashboardPath(nextRole));
    }
  };

  const handlePreviewSessionRole = (role) => {
    if (!role || role === ROLES.ADMIN) {
      handlePreviewRoleChange(ROLES.ADMIN);
      return;
    }

    if (SWITCHABLE_ROLE_DASHBOARDS.includes(role)) {
      handlePreviewRoleChange(role);
    }
  };

  const activeMeta =
    SETTINGS_SECTIONS.find((section) => section.id === activeSection) ||
    SETTINGS_SECTIONS[0];

  const sectionSubtitle = {
    profile: "Manage your name, photo, site, and contact details",
    notifications: "Manage how and when you receive alerts",
    security: "Manage password, sessions, and access controls",
    account: adminMode
      ? "Administrative preferences, notifications, and system defaults"
      : `Account preferences for ${assignedSite || "your site"}`,
  };

  return (
    <DashboardLayout>
      <div className="admin-page unified-settings-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Settings</h1>
          <p>
            {adminMode
              ? "Manage your profile, account preferences, and security in one place"
              : `Site settings for ${assignedSite || "your site"}`}
          </p>
        </div>

        <div className="dashboard-header settings-view-header">
          <div>
            <h2>{activeMeta.label}</h2>
            <p className="pi-subtitle">{sectionSubtitle[activeSection]}</p>
          </div>
        </div>

        <div className="settings-cards-grid">
          {SETTINGS_SECTIONS.map((section, i) => {
            const Icon = SECTION_ICONS[section.id];
            const isActive = activeSection === section.id;

            return (
              <div
                key={section.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveSection(section.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveSection(section.id);
                  }
                }}
                className={
                  isActive
                    ? "settings-nav-card is-active"
                    : "settings-nav-card"
                }
              >
                <div
                  className={`settings-nav-card-icon icon-${
                    CARD_COLORS[i % CARD_COLORS.length]
                  }`}
                >
                  <Icon />
                </div>
                <div className="settings-nav-card-title">{section.label}</div>
                <div className="settings-nav-card-value">
                  {isActive ? "Active" : "—"}
                </div>
                <div className="settings-nav-card-subtitle">
                  {section.description}
                </div>
              </div>
            );
          })}
        </div>

        {activeSection === "profile" && (
          <section
            id="settings-profile"
            className="settings-page-section settings-page-section-active"
          >
            <ProfileSettingsSection showTitle />
          </section>
        )}

        {activeSection === "notifications" && (
          <section
            id="settings-notifications"
            className="settings-page-section settings-page-section-active"
          >
            <div className="settings-section-heading">
              <h2>Notification Preferences</h2>
              <p>Choose which alerts you want to receive, and how often.</p>
            </div>

            <DashboardCard title="Notification Preferences">
              <div className="pi-security-settings-list">
                {visibleNotificationItems.map((item) => (
                  <div
                    key={item.key}
                    className="pi-security-setting-row"
                    onClick={() => toggleUserSetting(item.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleUserSetting(item.key);
                      }
                    }}
                  >
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.desc}</p>
                    </div>
                    <span
                      className={`pi-toggle ${
                        userSettings[item.key] ? "on" : "off"
                      }`}
                    >
                      {userSettings[item.key] ? "ON" : "OFF"}
                    </span>
                  </div>
                ))}
              </div>

              <label className="pi-settings-inline-label">
                Digest Frequency
                <select
                  value={userSettings.digestFrequency || "Daily"}
                  onChange={(event) =>
                    handleUserChange("digestFrequency", event.target.value)
                  }
                >
                  <option>Real-time</option>
                  <option>Daily</option>
                  <option>Weekly</option>
                </select>
              </label>

              <label className="pi-settings-inline-label">
                Dashboard Refresh
                <select
                  value={userSettings.dashboardRefresh || "daily"}
                  onChange={(event) =>
                    handleUserChange("dashboardRefresh", event.target.value)
                  }
                >
                  <option value="realtime">Real-time</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>

              <button
                type="button"
                className="export-btn"
                style={{ marginTop: "1rem" }}
                onClick={handleSave}
              >
                Save Notification Settings
              </button>

              {savedMessage && (
                <p style={{ color: "#059669", margin: "0.75rem 0 0" }}>
                  {savedMessage}
                </p>
              )}
            </DashboardCard>
          </section>
        )}

        {activeSection === "security" && (
          <section
            id="settings-security"
            className="settings-page-section settings-page-section-active"
          >
            <SecuritySettingsSection showTitle />
          </section>
        )}

        {activeSection === "account" && (
          <section
            id="settings-account"
            className="settings-page-section settings-page-section-active"
          >
            <div className="settings-section-heading">
              <h2>Account</h2>
              <p>
                {adminMode
                  ? "Administrative preferences, notifications, and system defaults"
                  : `Account preferences for ${assignedSite || "your site"}`}
              </p>
            </div>

            {adminMode && (
              <DashboardCard title="System Preferences">
                <form className="admin-settings-form" onSubmit={handleSave}>
                  <div className="admin-form-grid">
                    <label>
                      Organization Name
                      <input
                        type="text"
                        value={systemSettings.organizationName || ""}
                        onChange={(event) =>
                          handleSystemChange(
                            "organizationName",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Timezone
                      <select
                        value={systemSettings.timezone || "Asia/Kolkata"}
                        onChange={(event) =>
                          handleSystemChange("timezone", event.target.value)
                        }
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">
                          America/New_York
                        </option>
                      </select>
                    </label>

                    <label>
                      Date Format
                      <select
                        value={systemSettings.dateFormat || "DD-MMM-YYYY"}
                        onChange={(event) =>
                          handleSystemChange("dateFormat", event.target.value)
                        }
                      >
                        <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </label>

                    <label>
                      Default Study Status
                      <select
                        value={systemSettings.defaultStudyStatus || "Active"}
                        onChange={(event) =>
                          handleSystemChange(
                            "defaultStudyStatus",
                            event.target.value
                          )
                        }
                      >
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </label>

                    <label>
                      Audit Retention (days)
                      <input
                        type="number"
                        min="30"
                        value={systemSettings.auditRetentionDays || 365}
                        onChange={(event) =>
                          handleSystemChange(
                            "auditRetentionDays",
                            Number(event.target.value)
                          )
                        }
                      />
                    </label>
                  </div>
                </form>
              </DashboardCard>
            )}

            {adminMode && (
              <DashboardCard
                title="Active Sessions"
                className="settings-active-sessions-card"
              >
                <p className="settings-section-help">
                  Monitor active sessions across all roles and preview
                  dashboards as another role.
                </p>

                {currentSession && (
                  <div className="settings-current-session">
                    <h4 className="settings-current-session-title">
                      Active Session
                    </h4>
                    <div className="settings-current-session-grid">
                      <div>
                        <span>Session</span>
                        <strong>
                          {currentSession.sessionId?.slice(-8) || "—"}
                        </strong>
                      </div>
                      <div>
                        <span>Started</span>
                        <strong>
                          {formatSessionTimestamp(currentSession.startedAt)}
                        </strong>
                      </div>
                      <div>
                        <span>Duration</span>
                        <strong>
                          {getSessionDurationMinutes(currentSession)} min
                        </strong>
                      </div>
                      <div>
                        <span>Device</span>
                        <strong>{currentSession.device || "—"}</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="settings-role-preview">
                  <label>
                    Preview dashboard as
                    <select
                      value={previewRole}
                      onChange={(event) =>
                        handlePreviewRoleChange(event.target.value)
                      }
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="active-sessions-table-wrap">
                  <table className="active-sessions-table ctms-standard-table">
                    <thead>
                      <tr>
                        <th>Session ID</th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Started</th>
                        <th>Duration</th>
                        <th>Device</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSessions.length ? (
                        activeSessions.map((session) => (
                          <tr key={session.sessionId}>
                            <td>{session.sessionId}</td>
                            <td>
                              <strong>{session.userName || "—"}</strong>
                              <div className="session-table-subtext">
                                {session.userEmail || "—"}
                              </div>
                            </td>
                            <td>
                              {ROLE_LABELS[session.role] ||
                                session.role ||
                                "—"}
                            </td>
                            <td>
                              {formatSessionTimestamp(session.startedAt)}
                            </td>
                            <td>{getSessionDurationMinutes(session)} min</td>
                            <td>{session.device || "—"}</td>
                            <td>
                              {session.role &&
                              session.role !== ROLES.ADMIN &&
                              SWITCHABLE_ROLE_DASHBOARDS.includes(
                                session.role
                              ) ? (
                                <button
                                  type="button"
                                  className="secondary-btn session-preview-btn"
                                  onClick={() =>
                                    handlePreviewSessionRole(session.role)
                                  }
                                >
                                  View as{" "}
                                  {ROLE_LABELS[session.role] || session.role}
                                </button>
                              ) : (
                                <span className="session-table-muted">
                                  Current
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="session-table-empty">
                            No active sessions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </DashboardCard>
            )}

            <DashboardCard title="Profile & Display Preferences">
              <form className="admin-settings-form" onSubmit={handleSave}>
                <div className="admin-form-grid">
                  <label>
                    Preferred Language
                    <select
                      value={
                        userSettings.preferredLanguage ||
                        profile.preferredLanguage
                      }
                      onChange={(event) =>
                        handleUserChange("preferredLanguage", event.target.value)
                      }
                    >
                      <option>English</option>
                      <option>Hindi</option>
                      <option>Tamil</option>
                    </select>
                  </label>

                  <label>
                    Default Landing Page
                    <select
                      value={userSettings.defaultLandingPage || "dashboard"}
                      onChange={(event) =>
                        handleUserChange(
                          "defaultLandingPage",
                          event.target.value
                        )
                      }
                    >
                      <option value="dashboard">Dashboard</option>
                      <option value="studies">Studies</option>
                      <option value="subjects">Subjects</option>
                      <option value="comments">Comments</option>
                    </select>
                  </label>

                  <label className="full-width">
                    <span>
                      <input
                        type="checkbox"
                        checked={!!userSettings.compactDashboard}
                        onChange={(event) =>
                          handleUserChange(
                            "compactDashboard",
                            event.target.checked
                          )
                        }
                      />
                      Use compact dashboard layout
                    </span>
                  </label>

                  {!adminMode && assignedSite && (
                    <p
                      className="full-width"
                      style={{ color: "#6b7280", margin: 0 }}
                    >
                      Settings apply to site: <strong>{assignedSite}</strong>
                    </p>
                  )}

                  <div className="profile-form-actions full-width">
                    <button type="submit">Save Settings</button>
                  </div>

                  {savedMessage && (
                    <p
                      className="full-width"
                      style={{ color: "#059669", margin: 0 }}
                    >
                      {savedMessage}
                    </p>
                  )}
                </div>
              </form>
            </DashboardCard>

            <DashboardCard title="Account Summary">
              <div className="profile-detail-grid">
                <div>
                  <span>Name</span>
                  <strong>{currentUser?.name || "—"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{currentUser?.email || "—"}</strong>
                </div>
                <div>
                  <span>Role</span>
                  <strong>{currentUser?.role || "—"}</strong>
                </div>
                <div>
                  <span>Site</span>
                  <strong>{assignedSite || profile.assignedSite || "—"}</strong>
                </div>
              </div>
            </DashboardCard>
          </section>
        )}

      </div>
    </DashboardLayout>
  );
}

export default Settings;
