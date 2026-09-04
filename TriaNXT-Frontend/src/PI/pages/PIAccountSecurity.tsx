import React, { useEffect, useState } from "react";
import {
  FaLock,
  FaShieldAlt,
  FaHistory,
  FaKey,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";
import {
  getSecurityData,
  saveSecurityData,
} from "./piDashboardService";

function PIAccountSecurity() {
  const [data, setData] = useState(getSecurityData);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    const refresh = () => setData(getSecurityData());
    window.addEventListener("pi-security-updated", refresh);
    return () => window.removeEventListener("pi-security-updated", refresh);
  }, []);

  const persist = (updated) => {
    const saved = saveSecurityData(updated);
    setData(saved);
    window.dispatchEvent(new CustomEvent("pi-security-updated"));
  };

  const toggleSetting = (key) => {
    persist({
      ...data,
      settings: {
        ...data.settings,
        [key]: !data.settings[key],
      },
    });
  };

  const handleSavePassword = () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordMessage("All password fields are required.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage("New passwords do not match.");
      return;
    }
    if (passwordForm.next.length < 8) {
      setPasswordMessage("Password must be at least 8 characters.");
      return;
    }

    persist({
      ...data,
      password: {
        ...data.password,
        lastChanged: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        daysUntilExpiry: 90,
        status: "Strong",
        strength: "High",
      },
      securityScore: Math.min(100, data.securityScore + 5),
    });

    setPasswordMessage("Password updated successfully.");
    setPasswordForm({ current: "", next: "", confirm: "" });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordMessage("");
    }, 1200);
  };

  const passwordStatus = data.password.daysUntilExpiry <= 14 ? "warning" : "good";
  const activeSessions = data.sessions.filter((s) => s.active).length;

  return (
    <div className="pi-security-page tnxt-compact">
      <div className="pi-kpi-cards-grid">
        <div className="pi-enterprise-kpi blue pi-kpi-clickable">
          <span className="pi-enterprise-kpi-label">Password Status</span>
          <span className="pi-enterprise-kpi-value">{data.password.status}</span>
          <span className="pi-enterprise-kpi-desc">
            Last changed {data.password.lastChanged} · Expires in {data.password.daysUntilExpiry} days
          </span>
        </div>
        <div className="pi-enterprise-kpi green pi-kpi-clickable">
          <span className="pi-enterprise-kpi-label">Last Login</span>
          <span className="pi-enterprise-kpi-value">{data.lastLogin.time}</span>
          <span className="pi-enterprise-kpi-desc">
            {data.lastLogin.date} · {data.lastLogin.location}
          </span>
        </div>
        <div className="pi-enterprise-kpi purple pi-kpi-clickable">
          <span className="pi-enterprise-kpi-label">Active Sessions</span>
          <span className="pi-enterprise-kpi-value">{activeSessions}</span>
          <span className="pi-enterprise-kpi-desc">
            {data.sessions.length} device(s) registered
          </span>
        </div>
        <div className="pi-enterprise-kpi teal pi-kpi-clickable">
          <span className="pi-enterprise-kpi-label">Security Score</span>
          <span className="pi-enterprise-kpi-value">{data.securityScore}%</span>
          <span className="pi-enterprise-kpi-desc">
            Based on password, MFA, and session hygiene
          </span>
        </div>
      </div>

      <div className="pi-security-grid">
        <div className="table-container pi-security-card">
          <h3>
            <FaLock /> Password &amp; Access
          </h3>
          <div className={`pi-security-status-banner ${passwordStatus}`}>
            {passwordStatus === "good" ? <FaCheckCircle /> : <FaExclamationCircle />}
            <div>
              <strong>{data.password.status}</strong>
              <p>
                Password strength: {data.password.strength}. Consider updating
                before expiry on {data.password.expiryDate}.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="export-btn pi-security-btn"
            onClick={() => setShowPasswordModal(true)}
          >
            <FaKey /> Update Password
          </button>
        </div>

        <div className="table-container pi-security-card">
          <h3>
            <FaShieldAlt /> Security Settings
          </h3>
          <div className="pi-security-settings-list">
            {[
              { key: "twoFactor", label: "Two-Factor Authentication (2FA)", desc: "Require verification code at sign-in" },
              { key: "sessionAlerts", label: "New Device Alerts", desc: "Email when login from unrecognized device" },
              { key: "autoLock", label: "Auto-Lock Session", desc: "Lock after 15 minutes of inactivity" },
              { key: "auditLog", label: "Audit Logging", desc: "Track all account access events" },
            ].map((item) => (
              <div
                key={item.key}
                className="pi-security-setting-row"
                onClick={() => toggleSetting(item.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && toggleSetting(item.key)}
              >
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.desc}</p>
                </div>
                <span className={`pi-toggle ${data.settings[item.key] ? "on" : "off"}`}>
                  {data.settings[item.key] ? "ON" : "OFF"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="table-container pi-security-card pi-security-full">
          <h3>
            <FaHistory /> Login Activity
          </h3>
          <div className="pi-table-responsive">
            <table className="pi-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Event</th>
                  <th>Location</th>
                  <th>Device</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.loginActivity.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.datetime}</td>
                    <td>{entry.event}</td>
                    <td>{entry.location}</td>
                    <td>{entry.device}</td>
                    <td>
                      <span className={entry.status === "Success" ? "status-success" : "status-danger"}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="study-modal-overlay">
          <div className="study-modal">
            <h3>Update Password</h3>
            <input
              type="password"
              placeholder="Current Password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            />
            <input
              type="password"
              placeholder="New Password"
              value={passwordForm.next}
              onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            />
            {passwordMessage && (
              <p className={passwordMessage.includes("success") ? "pi-toast-info" : "status-danger"} style={{ padding: "0.5rem", borderRadius: "0.5rem" }}>
                {passwordMessage}
              </p>
            )}
            <div className="modal-buttons">
              <button type="button" onClick={() => { setShowPasswordModal(false); setPasswordMessage(""); }}>Cancel</button>
              <button type="button" onClick={handleSavePassword}>Save Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PIAccountSecurity;
