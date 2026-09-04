import { useMemo } from "react";
import DashboardLayout from "../../shared/components/dashboard/shared/DashboardLayout";
import ReferralCard from "../../shared/components/referral/ReferralCard";
import ReferralProgramSettings from "../components/ReferralProgramSettings";
import { getCurrentUser, isAdmin } from "../../shared/services/roleService";
import "../../shared/styles/AdminPage.css";
import "../styles/Settings.css";

function Referral() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const adminMode = isAdmin();

  return (
    <DashboardLayout>
      <div className="admin-page unified-settings-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Referral Program</h1>
          <p>
            {adminMode
              ? "Your referral code, free license bonus, and program-wide controls"
              : "Share your referral code and track your free license bonus"}
          </p>
        </div>

        <section
          id="settings-referral"
          className="settings-page-section settings-page-section-active"
        >
          <div className="settings-section-heading">
            <h2>Referral Program</h2>
            <p>
              {adminMode
                ? "Your referral code, free license bonus, and program-wide controls"
                : "Share your referral code and track your free license bonus"}
            </p>
          </div>

          <ReferralCard
            userId={currentUser?.id}
            displayName={currentUser?.username || currentUser?.name}
          />

          {adminMode && <ReferralProgramSettings />}
        </section>
      </div>
    </DashboardLayout>
  );
}

export default Referral;
