import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardCard from "../../components/dashboard/shared/DashboardCard";
import {
  getAssignedSite,
  getCurrentUser,
  isAdmin,
  getUserSettings,
  saveUserSettings,
  updateUserPassword
} from "../../services/roleService";
import {
  formatSessionTimestamp,
  getCurrentSession,
  getSessionDurationMinutes,
  getSessionHistory,
  terminateCurrentSession
} from "../../services/sessionService";

function SecuritySettingsSection({ showTitle = false }: any) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const adminMode = isAdmin(currentUser);
  const assignedSite = getAssignedSite();
  const session = getCurrentSession(currentUser);
  const sessionHistory = getSessionHistory(currentUser);
  const storedSettings = getUserSettings(currentUser);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [securityPrefs, setSecurityPrefs] = useState({
    twoFactorEnabled: Boolean(storedSettings.twoFactorEnabled),
    loginAlerts: storedSettings.loginAlerts !== false,
    sessionTimeoutMinutes:
      storedSettings.sessionTimeoutMinutes || (adminMode ? 60 : 30)
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sessionDuration = useMemo(
    () => getSessionDurationMinutes(session),
    [session]
  );

  const handleSecurityPrefChange = (field, value) => {
    setSecurityPrefs((prev) => {
      const next = { ...prev, [field]: value };
      saveUserSettings({ ...getUserSettings(currentUser), ...next }, currentUser);
      return next;
    });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    const result = updateUserPassword(form.currentPassword, form.newPassword);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setMessage("Password updated successfully.");
  };

  const handleTerminateSession = () => {
    terminateCurrentSession();
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("adminPreviewRole");
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  return (
    <>
      {showTitle && (
        <div className="settings-section-heading">
          <h2>Security</h2>
          <p>
            {adminMode
              ? "Manage password, authentication, and active sessions"
              : `Protect your ${assignedSite || "site"} account credentials`}
          </p>
        </div>
      )}

      <DashboardCard title="Change Password">
        <form className="admin-settings-form" onSubmit={handleSubmit}>
          <label>
            Current Password
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) =>
                handleChange("currentPassword", event.target.value)
              }
              required
            />
          </label>

          <label>
            New Password
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) =>
                handleChange("newPassword", event.target.value)
              }
              required
            />
          </label>

          <label>
            Confirm New Password
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) =>
                handleChange("confirmPassword", event.target.value)
              }
              required
            />
          </label>

          <p className="security-help-text">
            Use at least 8 characters with a mix of letters and numbers.
          </p>

          <button type="submit">Update Password</button>

          {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
          {message && (
            <p style={{ color: "#059669", margin: 0 }}>{message}</p>
          )}
        </form>
      </DashboardCard>

      <DashboardCard
        title={
          adminMode ? "Account Security Preferences" : "Site Security Preferences"
        }>

        <div className="admin-settings-form">
          <label>
            <span>
              <input
                type="checkbox"
                checked={securityPrefs.twoFactorEnabled}
                onChange={(event) =>
                  handleSecurityPrefChange(
                    "twoFactorEnabled",
                    event.target.checked
                  )
                }
              />{" "}
              Enable two-factor authentication
            </span>
          </label>

          <label>
            <span>
              <input
                type="checkbox"
                checked={securityPrefs.loginAlerts}
                onChange={(event) =>
                  handleSecurityPrefChange("loginAlerts", event.target.checked)
                }
              />{" "}
              Email me when a new device signs in
            </span>
          </label>

          <label>
            Session Timeout (minutes)
            <select
              value={securityPrefs.sessionTimeoutMinutes}
              onChange={(event) =>
                handleSecurityPrefChange(
                  "sessionTimeoutMinutes",
                  Number(event.target.value)
                )
              }>

              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
            </select>
          </label>
        </div>
      </DashboardCard>

      <DashboardCard title="Current Session">
        <div className="profile-detail-grid">
          <div>
            <span>Session ID</span>
            <strong>{session?.sessionId || "—"}</strong>
          </div>
          <div>
            <span>Started</span>
            <strong>{formatSessionTimestamp(session?.startedAt)}</strong>
          </div>
          <div>
            <span>Last Activity</span>
            <strong>{formatSessionTimestamp(session?.lastActivityAt)}</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>{sessionDuration} min</strong>
          </div>
          <div>
            <span>Device</span>
            <strong>{session?.device || "—"}</strong>
          </div>
          <div>
            <span>IP Address</span>
            <strong>{session?.ipAddress || "—"}</strong>
          </div>
        </div>

        <div className="profile-form-actions" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleTerminateSession}>

            Sign Out All Sessions
          </button>
        </div>
      </DashboardCard>

      {adminMode && (
        <DashboardCard title="Recent Session History">
          <div className="session-history-list">
            {sessionHistory.slice(0, 5).map((entry) => (
              <div key={entry.sessionId} className="session-history-item">
                <div>
                  <strong>{entry.sessionId}</strong>
                  <p>
                    {formatSessionTimestamp(entry.startedAt)}
                    {entry.endedAt
                      ? ` → ${formatSessionTimestamp(entry.endedAt)}`
                      : " • Active"}
                  </p>
                </div>
                <span>{entry.device || entry.ipAddress || "Unknown device"}</span>
              </div>
            ))}
          </div>
        </DashboardCard>
      )}

      {!adminMode && assignedSite && (
        <p style={{ color: "#6b7280", margin: 0 }}>
          Security settings apply to site: <strong>{assignedSite}</strong>
        </p>
      )}
    </>
  );
}

export default SecuritySettingsSection;
