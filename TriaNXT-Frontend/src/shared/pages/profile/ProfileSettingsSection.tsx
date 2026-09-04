import { useState } from "react";
import DashboardCard from "../../components/dashboard/shared/DashboardCard";
import ProfilePhotoCard from "./ProfilePhotoCard";
import {
  getAssignedSite,
  getCurrentUser,
  getUserProfile,
  isAdmin,
  saveUserProfile,
} from "../../services/roleService";

function ProfileSettingsSection({ showTitle = false }: any) {
  const currentUser = getCurrentUser();
  const [profile, setProfile] = useState(getUserProfile());
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const canEditSite = isAdmin(currentUser);

  const handleChange = (field, value) => {
    setProfile((previousProfile) => ({
      ...previousProfile,
      [field]: value,
    }));
  };

  const handlePhotoChange = (photo) => {
    handleChange("profilePhoto", photo);

    if (photo) {
      setSavedMessage("");
      setSaveError(false);
      return;
    }

    setSaveError(false);
    setSavedMessage("Profile photo removed.");
  };

  const handleSave = (event) => {
    event.preventDefault();

    // Pincode is mandatory (mirrors registration validation): it feeds the
    // referral same-organization/same-location anti-abuse rule, so it can
    // never be saved blank or as non-numeric junk.
    const trimmedPincode = String(profile.pincode || "").trim();
    const pincodeRegex = /^\d{4,10}$/;

    if (!trimmedPincode) {
      setSaveError(true);
      setSavedMessage("Pincode is required");
      return;
    }

    if (!pincodeRegex.test(trimmedPincode)) {
      setSaveError(true);
      setSavedMessage("Enter a valid pincode (numbers only)");
      return;
    }

    try {
      saveUserProfile(profile, currentUser);
      setSaveError(false);
      setSavedMessage("Profile updated successfully.");
    } catch (error) {
      setSaveError(true);
      setSavedMessage(
        error?.message || "Failed to save profile. Please try again."
      );
    }
  };

  return (
    <section id="settings-profile" className="settings-page-section">
      {showTitle && (
        <div className="settings-section-heading">
          <h2>Profile</h2>
          <p>Manage your personal details and profile photo</p>
        </div>
      )}

      <div className="profile-photo-section">
        <ProfilePhotoCard
          photo={profile.profilePhoto}
          onPhotoChange={handlePhotoChange}
          deferSync
        />
      </div>

      <DashboardCard title="Profile Details">
        <form className="admin-settings-form" onSubmit={handleSave}>
          <div className="admin-form-grid">
            <label>
              <span>First Name</span>
              <input
                type="text"
                value={profile.firstName || ""}
                onChange={(event) =>
                  handleChange("firstName", event.target.value)
                }
              />
            </label>

            <label>
              <span>Last Name</span>
              <input
                type="text"
                value={profile.lastName || ""}
                onChange={(event) =>
                  handleChange("lastName", event.target.value)
                }
              />
            </label>

            <label>
              <span>Middle Name</span>
              <input
                type="text"
                value={profile.middleName || ""}
                onChange={(event) =>
                  handleChange("middleName", event.target.value)
                }
              />
            </label>

            <label>
              <span>Credentials</span>
              <input
                type="text"
                value={profile.credentials || ""}
                onChange={(event) =>
                  handleChange("credentials", event.target.value)
                }
              />
            </label>

            <label>
              <span>Job Title</span>
              <input
                type="text"
                value={profile.jobTitle || ""}
                onChange={(event) =>
                  handleChange("jobTitle", event.target.value)
                }
              />
            </label>

            <label>
              <span>Department</span>
              <input
                type="text"
                value={profile.department || ""}
                onChange={(event) =>
                  handleChange("department", event.target.value)
                }
              />
            </label>

            <label>
              <span>Email Address</span>
              <input type="email" value={profile.email || ""} readOnly />
            </label>

            <label>
              <span>Role</span>
              <input type="text" value={profile.role || ""} readOnly />
            </label>

            <label>
              <span>Assigned Site</span>
              <input
                type="text"
                value={profile.assignedSite || ""}
                readOnly={!canEditSite}
                onChange={(event) =>
                  handleChange("assignedSite", event.target.value)
                }
              />
            </label>

            <label>
              <span>Pincode</span>
              <input
                type="text"
                value={profile.pincode || ""}
                onChange={(event) =>
                  handleChange("pincode", event.target.value)
                }
              />
            </label>

            <label>
              <span>Office Phone</span>
              <input
                type="text"
                value={profile.officePhone || ""}
                onChange={(event) =>
                  handleChange("officePhone", event.target.value)
                }
              />
            </label>

            <label>
              <span>Cell Phone</span>
              <input
                type="text"
                value={profile.cellPhone || ""}
                onChange={(event) =>
                  handleChange("cellPhone", event.target.value)
                }
              />
            </label>

            <label>
              <span>Fax</span>
              <input
                type="text"
                value={profile.fax || ""}
                onChange={(event) => handleChange("fax", event.target.value)}
              />
            </label>

            <label>
              <span>Professional Headline</span>
              <input
                type="text"
                value={profile.headline || ""}
                onChange={(event) =>
                  handleChange("headline", event.target.value)
                }
              />
            </label>

            <label>
              <span>Timezone</span>
              <select
                value={profile.timezone || "Asia/Kolkata"}
                onChange={(event) =>
                  handleChange("timezone", event.target.value)
                }>

                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            </label>

            <label>
              <span>Preferred Language</span>
              <select
                value={profile.preferredLanguage || "English"}
                onChange={(event) =>
                  handleChange("preferredLanguage", event.target.value)
                }>

                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Tamil">Tamil</option>
              </select>
            </label>

            <label className="full-width" data-span={2}>
              <span>Bio</span>
              <textarea
                rows={4}
                value={profile.bio || ""}
                onChange={(event) => handleChange("bio", event.target.value)}
                placeholder="Brief professional summary"
              />
            </label>

            <div className="profile-form-actions full-width" data-span={2}>
              <button type="submit">Save Profile</button>
            </div>

            {savedMessage && (
              <p
                className="profile-save-message full-width"
                data-span={2}
                role="status"
                style={{ color: saveError ? "#dc2626" : "#059669" }}>

                {savedMessage}
              </p>
            )}
          </div>
        </form>
      </DashboardCard>

      {!isAdmin(currentUser) && getAssignedSite() && (
        <p className="profile-site-note">
          Profile applies to site: <strong>{getAssignedSite()}</strong>
        </p>
      )}
    </section>
  );
}

export default ProfileSettingsSection;