import { useState, useEffect } from "react";
import ReferralCard from "../../shared/components/referral/ReferralCard";
import { getCurrentUser } from "../../shared/services/roleService";
import { getSettingsData } from "./piDashboardService";

function PIReferral() {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const data = getSettingsData();
    setDisplayName(data.profile?.name || "");
  }, []);

  const currentUser = getCurrentUser();

  return (
    <div className="pi-page-content">
      <div className="dashboard-header page-section-highlight">
        <div>
          <h2>Referral Program</h2>
          <p className="pi-subtitle">
            Your referral code &amp; free license bonus
          </p>
        </div>
      </div>

      <ReferralCard
        userId={currentUser?.id}
        displayName={displayName}
      />
    </div>
  );
}

export default PIReferral;
