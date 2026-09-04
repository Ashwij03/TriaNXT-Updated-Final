import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import ProfileSettingsSection from "./ProfileSettingsSection";
import ReferralCard from "../../components/referral/ReferralCard";
import { getCurrentUser } from "../../services/roleService";
import "../../styles/AdminPage.css";

function ProfilePage() {
  const currentUser = getCurrentUser();

  return (
    <DashboardLayout>
      <div className="admin-page">
        <div className="admin-page-title">
          <h1>User Profile</h1>
          <p>Manage your personal details and profile photo</p>
        </div>
        <ProfileSettingsSection />
        {/* Task 6 (Ashwij): Referral & Limited Free License Model — shows
            the user's static referral code, redemption count, current
            license status, and the redeem-a-code form. */}
        <ReferralCard
          userId={currentUser?.id}
          displayName={currentUser?.username || currentUser?.name}
        />
      </div>
    </DashboardLayout>
  );
}

export default ProfilePage;
