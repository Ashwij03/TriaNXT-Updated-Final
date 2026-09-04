import CROLayout from "./CROLayout";
import ReferralCard from "../../shared/components/referral/ReferralCard";
import { getCurrentUser } from "../../shared/services/roleService";
import "../styles/CROSettings.css";
import "../../shared/styles/AdminPage.css";

function CROReferral() {
  const user = getCurrentUser();

  return (
    <CROLayout>
      <div className="cro-panel cro-settings-panel">
        <div className="dashboard-header page-section-highlight">
          <h2 className="cro-settings-section-title ">Referral Program</h2>
          <p>
            Share your referral code with other sites or consultants and track
            your free license bonus.
          </p>
        </div>
      </div>
      
      <ReferralCard
        userId={user?.id}
        displayName={user?.username || user?.name}
      />
    </CROLayout>
  );
}

export default CROReferral;
