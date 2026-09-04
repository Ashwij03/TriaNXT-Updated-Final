import AppLayout from "./AppLayout";
import ReferralCard from "../../shared/components/referral/ReferralCard";
import { getCurrentUser } from "../../shared/services/roleService";

const Referral = () => {
  const user = getCurrentUser();

  return (
    <AppLayout>
      <div className="settings-page">
        <div className="sponsor-page-header">
          <h1>Referral Program</h1>
          <p>Your referral code &amp; free license bonus</p>
        </div>

        <ReferralCard
          userId={user?.id}
          displayName={user?.username || user?.name}
        />
      </div>
    </AppLayout>
  );
};

export default Referral;
