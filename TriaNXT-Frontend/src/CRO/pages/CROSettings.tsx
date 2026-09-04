import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CROModal from "./CROModal";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import { CRO_STORAGE_KEYS, loadFromStorage } from "./croStorage";
import "../../shared/styles/AdminPage.css";
import "../styles/CROSettings.css";
import { getCurrentUser, getAssignedSite } from "../../shared/services/roleService";
const getDefaultSettings = () => {
  const currentUser = getCurrentUser();

  return {
    organization:
      currentUser?.orgType ||
      getAssignedSite(currentUser) ||
      "Clinical Research Org",
    email: currentUser?.email || "cro@trialnxt.com",
    phone: currentUser?.phone || "+91 9876543210",
    timezone: "Asia/Kolkata",
    notifications: true,
    emailAlerts: true,
    smsAlerts: false,
    twoFactorEnabled: false,
  };
};

const SECTIONS = [
  { id: "profile", label: "Profile Settings" },
  { id: "account", label: "Account Settings" },
  { id: "security", label: "Security Settings" },
  { id: "notifications", label: "Notification Preferences" },
];

function CROSettings() {
  const { showModal } = useCROData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState("account");
  const [settings, setSettings] = useState(() =>
    loadFromStorage(CRO_STORAGE_KEYS.settings, getDefaultSettings()),
  );
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileImage, setProfileImage] = useState(
    localStorage.getItem("croProfileImage") || "",
  );

  useEffect(() => {
    const section = searchParams.get("section");
    if (section && SECTIONS.some((item) => item.id === section)) {
      setActiveSection(section);
    }
  }, [searchParams]);

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    setSearchParams({ section: sectionId });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === "checkbox" ? checked : value,
    });
  };
  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setProfileImage(reader.result as string);
      localStorage.setItem("croProfileImage", reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    localStorage.setItem(CRO_STORAGE_KEYS.settings, JSON.stringify(settings));
    localStorage.setItem("croProfileImage", profileImage);
    showModal({
      title: "Settings Saved",
      message: "Your settings have been saved successfully.",
    });
  };

  return (
    <CROLayout>
      <h1 style={{ marginBottom: "1.5625rem" }}>Settings</h1>

      <div
        className="cro-settings-tabs"
        role="tablist"
        aria-label="Settings sections"
      >
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={activeSection === section.id}
            className={`cro-settings-tab${
              activeSection === section.id ? " cro-settings-tab--active" : ""
            }`}
            onClick={() => handleSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="cro-panel cro-settings-panel">
        {activeSection === "profile" && (
          <div role="tabpanel">
            <h2 className="cro-settings-section-title">Profile Settings</h2>

            <button
              type="button"
              className="cro-btn-primary"
              style={{ marginBottom: "1.25rem" }}
              onClick={() => setShowProfileModal(true)}
            >
              Edit Profile
            </button>
          </div>
        )}
        {activeSection === "account" && (
          <div role="tabpanel" id="cro-settings-account">
            <h2 className="cro-settings-section-title">Account Settings</h2>
            <div style={{ marginBottom: "0.9375rem" }}>
              <label>Organization Name</label>
              <input
                type="text"
                name="organization"
                value={settings.organization}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  marginTop: "0.3125rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
            <div style={{ marginBottom: "0.9375rem" }}>
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  marginTop: "0.3125rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
            <div style={{ marginBottom: "0.9375rem" }}>
              <label>Phone</label>
              <input
                type="text"
                name="phone"
                value={settings.phone}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  marginTop: "0.3125rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
            <div style={{ marginBottom: "0.9375rem" }}>
              <label>Timezone</label>
              <select
                name="timezone"
                value={settings.timezone}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  marginTop: "0.3125rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                }}
              >
                <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
                <option value="America/New_York">USA (New York)</option>
                <option value="Europe/London">UK (London)</option>
                <option value="Asia/Singapore">Singapore</option>
                <option value="Australia/Sydney">Australia (Sydney)</option>
              </select>  
            </div>
          </div>
        )}

        {activeSection === "security" && (
          <div role="tabpanel" id="cro-settings-security">
            <h2 className="cro-settings-section-title">Security Settings</h2>
            <div className="cro-settings-info">
              Manage password policies, session security, and two-factor
              authentication for your CRO account.
            </div>
            <div style={{ marginBottom: "0.9375rem" }}>
              <label>Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  marginTop: "0.3125rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
            <div style={{ marginBottom: "0.9375rem" }}>
              <label>New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  marginTop: "0.3125rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "1.25rem",
              }}
            >
              <input
                type="checkbox"
                name="twoFactorEnabled"
                checked={settings.twoFactorEnabled}
                onChange={handleChange}
              />
              <label>Enable Two-Factor Authentication (2FA)</label>
            </div>
          </div>
        )}

        {activeSection === "notifications" && (
          <div role="tabpanel" id="cro-settings-notifications">
            <h2 className="cro-settings-section-title">
              Notification Preferences
            </h2>
            <div className="cro-settings-info">
              Choose how you receive alerts for monitoring visits, regulatory
              updates, and study milestones.
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "1rem",
              }}
            >
              <input
                type="checkbox"
                name="notifications"
                checked={settings.notifications}
                onChange={handleChange}
              />
              <label>Enable In-App Notifications</label>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "1rem",
              }}
            >
              <input
                type="checkbox"
                name="emailAlerts"
                checked={settings.emailAlerts}
                onChange={handleChange}
              />
              <label>Email Alerts</label>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "1.25rem",
              }}
            >
              <input
                type="checkbox"
                name="smsAlerts"
                checked={settings.smsAlerts}
                onChange={handleChange}
              />
              <label>SMS Alerts</label>
            </div>
          </div>
        )}

        <button type="button" className="cro-btn-primary" onClick={handleSave}>
          Save Settings
        </button>
      </div>
      <CROModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Profile Settings"
        footer={
          <>
            <button
              type="button"
              className="cro-btn-secondary"
              onClick={() => setShowProfileModal(false)}
            >
              Cancel
            </button>

            <button
              type="button"
              className="cro-btn-primary"
              onClick={() => setShowProfileModal(false)}
            >
              Save Changes
            </button>
          </>
        }
      >
        <div className="cro-profile-form">
          <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "1.5625rem",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "7.5rem",
                  height: "7.5rem",
                }}
              >
                <img
                src={
                  profileImage ||
                  "https://ui-avatars.com/api/?name=CRO&background=0F3550&color=fff&size=200"
                }
                alt="Profile"
                style={{
                  width: "7.5rem",
                  height: "7.5rem",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "4px solid #fff",
                  boxShadow: "0 4px 14px rgba(0,0,0,.15)",
                }}
              />

              <label
                htmlFor="cro-profile-upload"
                style={{
                  position: "absolute",
                  bottom: "0.3125rem",
                  right: "0.3125rem",
                  width: "2.125rem",
                  height: "2.125rem",
                  borderRadius: "50%",
                  background: "#2563eb",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                📷
              </label>

              <input
                id="cro-profile-upload"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleProfileImageChange}
              />
            </div>

            <p
              style={{
                marginTop: "0.75rem",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Change Profile Photo
            </p>
          </div>

          <label>First Name</label>
          <input className="cro-input" defaultValue="Clinical" />

          <label>Last Name</label>
          <input className="cro-input" defaultValue="Research Associate" />

          <label>Email</label>
          <input className="cro-input" defaultValue="cro@trialnxt.com" />

          <label>Job Title</label>
          <input
            className="cro-input"
            defaultValue="Clinical Research Associate"
          />

          <label>Organization</label>
          <input
            className="cro-input"
            defaultValue="Clinical Research Organization"
          />

          <label>Phone</label>
          <input className="cro-input" defaultValue="+91 9876543210" />

          <label>Department</label>
          <input className="cro-input" defaultValue="Clinical Operations" />
        </div>
      </CROModal>
    </CROLayout>
  );
}

export default CROSettings;