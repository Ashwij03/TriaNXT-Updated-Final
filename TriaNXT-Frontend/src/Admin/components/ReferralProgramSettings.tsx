// NEW FILE — Task 6 (Ashwij): Referral & Limited Free License Model.
// Admin-only panel: the R6 ON/OFF toggle for "does the referrer also get
// 15 free days", plus read-only visibility into total codes issued, total
// redemptions, and the top referrers. Rendering this component behind
// isAdmin() is the caller's responsibility (Admin/pages/Settings.js does
// this already for every other admin-only section on that page).

import { useEffect, useState } from "react";
import DashboardCard from "../../shared/components/dashboard/shared/DashboardCard";
import {
  isReferrerBonusEnabled,
  setReferrerBonusEnabled,
  getReferralProgramSummary,
  getAllReferralUsages,
  REFERRAL_DATA_UPDATED_EVENT
} from "../../shared/services/referralService";

function formatDate(iso) {
  if (!iso) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

function ReferralProgramSettings() {
  const [bonusEnabled, setBonusEnabled] = useState(() => isReferrerBonusEnabled());
  const [summary, setSummary] = useState(() => getReferralProgramSummary());
  const [recentUsages, setRecentUsages] = useState(() =>
    getAllReferralUsages().slice(0, 10)
  );

  const refresh = () => {
    setBonusEnabled(isReferrerBonusEnabled());
    setSummary(getReferralProgramSummary());
    setRecentUsages(getAllReferralUsages().slice(0, 10));
  };

  useEffect(() => {
    window.addEventListener(REFERRAL_DATA_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(REFERRAL_DATA_UPDATED_EVENT, refresh);
    };
  }, []);

  const handleToggle = () => {
    setReferrerBonusEnabled(!bonusEnabled);
    refresh();
  };

  return (
    <DashboardCard title="Referral Program" className="referral-admin-card">
      <div className="referral-admin-toggle-row">
        <div>
          <strong>Referrer also earns free days</strong>
          <p className="referral-admin-toggle-desc">
            When ON, both the referrer and the referee receive 15 free days
            on a successful redemption. When OFF, only the referee benefits.
            This does not change the 3-redemptions-per-code limit.
          </p>
        </div>

        <button
          type="button"
          className={`referral-admin-toggle ${bonusEnabled ? "on" : "off"}`}
          onClick={handleToggle}
          aria-pressed={bonusEnabled}
        >
          {bonusEnabled ? "ON" : "OFF"}
        </button>
      </div>

      <div className="referral-admin-stats-grid">
        <div className="referral-admin-stat">
          <span>Codes Issued</span>
          <strong>{summary.totalCodesIssued}</strong>
        </div>
        <div className="referral-admin-stat">
          <span>Total Redemptions</span>
          <strong>{summary.totalRedemptions}</strong>
        </div>
        <div className="referral-admin-stat">
          <span>Free Days Granted</span>
          <strong>{summary.totalDaysGranted}</strong>
        </div>
      </div>

      {summary.topReferrers.length > 0 && (
        <div className="referral-admin-table-wrap">
          <h4>Top Referrers</h4>
          <table className="ctms-standard-table">
            <thead>
              <tr>
                <th>Referral Code</th>
                <th>User ID</th>
                <th>Redemptions</th>
              </tr>
            </thead>
            <tbody>
              {summary.topReferrers.map((entry) => (
                <tr key={entry.code}>
                  <td>{entry.code}</td>
                  <td>{entry.userId}</td>
                  <td>{entry.redemptionCount} / 3</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="referral-admin-table-wrap">
        <h4>Recent Redemptions</h4>
        <table className="ctms-standard-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Referee</th>
              <th>Referrer</th>
              <th>Redeemed</th>
              <th>Referee Days</th>
              <th>Referrer Days</th>
            </tr>
          </thead>
          <tbody>
            {recentUsages.length ? (
              recentUsages.map((usage) => (
                <tr key={usage.id}>
                  <td>{usage.code}</td>
                  <td>{usage.refereeUserId}</td>
                  <td>{usage.referrerUserId}</td>
                  <td>{formatDate(usage.redeemedAt)}</td>
                  <td>{usage.refereeDaysGranted}</td>
                  <td>{usage.referrerDaysGranted}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="referral-admin-empty">
                  No redemptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

export default ReferralProgramSettings;
