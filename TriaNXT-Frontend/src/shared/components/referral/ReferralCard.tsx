// NEW FILE — Task 6 (Ashwij): Referral & Limited Free License Model.
// Self-contained card for the Profile page. Shows the signed-in user's
// static referral code (with a Copy button), how many of their 3 allowed
// redemptions have been used, their own current license status, and an
// inline form to redeem someone else's code.
//
// Reuses the existing DashboardCard shell (same widget chrome used across
// the app) rather than inventing new card chrome from scratch.

import { useEffect, useState } from "react";
import { FaGift, FaCopy, FaCheckCircle, FaRegClock } from "react-icons/fa";
import DashboardCard from "../dashboard/shared/DashboardCard";
import { getCurrentUser } from "../../services/roleService";
import {
  getReferralStatsForUser,
  redeemReferralCode,
  getRedemptionErrorMessage,
  REFERRAL_DATA_UPDATED_EVENT
} from "../../services/referralService";
import "./ReferralCard.css";

function ReferralCard({ userId, displayName }: any) {
  const currentUser = getCurrentUser();
  const effectiveUserId = userId ?? currentUser?.id;
  const effectiveDisplayName =
    displayName || currentUser?.username || currentUser?.name || "";

  const [stats, setStats] = useState(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemStatus, setRedeemStatus] = useState({ type: "", message: "" });

  const refreshStats = () => {
    if (effectiveUserId === undefined || effectiveUserId === null) {
      setStats(null);
      return;
    }
    setStats(getReferralStatsForUser(effectiveUserId, effectiveDisplayName));
  };

  useEffect(() => {
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  useEffect(() => {
    const handleUpdate = () => refreshStats();
    window.addEventListener(REFERRAL_DATA_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(REFERRAL_DATA_UPDATED_EVENT, handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  if (!effectiveUserId) {
    return null;
  }

  const handleCopy = async () => {
    if (!stats?.code) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(stats.code);
      }
      setCopyLabel("Copied!");
    } catch {
      setCopyLabel("Copy failed");
    } finally {
      setTimeout(() => setCopyLabel("Copy"), 2000);
    }
  };

  const handleRedeem = (event) => {
    event.preventDefault();

    if (!redeemInput.trim()) {
      setRedeemStatus({ type: "error", message: "Enter a referral code first." });
      return;
    }

    const result = redeemReferralCode(effectiveUserId, redeemInput.trim());

    if (result.ok) {
      setRedeemStatus({
        type: "success",
        message: `Success! ${result.daysGranted} free days added to your license.`
      });
      setRedeemInput("");
      refreshStats();
    } else {
      setRedeemStatus({
        type: "error",
        message: result.message || getRedemptionErrorMessage(result.reason)
      });
    }
  };

  const capReached = stats && stats.remainingRedemptions <= 0;

  return (
    <DashboardCard title="Referral & Free License" className="referral-card">
      <div className="referral-card-body">
        <div className="referral-code-block">
          <span className="referral-code-label">
            <FaGift aria-hidden="true" /> Your referral code
          </span>

          <div className="referral-code-value-row">
            <code className="referral-code-value">{stats?.code || "—"}</code>
            <button
              type="button"
              className="referral-copy-btn"
              onClick={handleCopy}
              disabled={!stats?.code}
            >
              <FaCopy aria-hidden="true" /> {copyLabel}
            </button>
          </div>

          <p className="referral-usage-line">
            {stats
              ? `${stats.redemptionCount}/${stats.maxRedemptions} redemptions used`
              : "Loading…"}
            {capReached && (
              <span className="referral-cap-reached"> — limit reached</span>
            )}
          </p>
        </div>

        <div className="referral-status-block">
          {stats?.isReferralLicenseActive ? (
            <p className="referral-status-active">
              <FaCheckCircle aria-hidden="true" /> Active referral license ·{" "}
              {stats.daysRemaining} day{stats.daysRemaining === 1 ? "" : "s"} left
            </p>
          ) : (
            <p className="referral-status-inactive">
              <FaRegClock aria-hidden="true" /> No active referral bonus
            </p>
          )}
        </div>

        {!stats?.hasRedeemedACode && (
          <form className="referral-redeem-form" onSubmit={handleRedeem}>
            <label htmlFor="referral-redeem-input">
              Have a referral code? Redeem it for 15 free days
            </label>
            <div className="referral-redeem-row">
              <input
                id="referral-redeem-input"
                type="text"
                value={redeemInput}
                placeholder="Enter referral code"
                onChange={(event) => setRedeemInput(event.target.value)}
              />
              <button type="submit" className="referral-redeem-btn">
                Redeem
              </button>
            </div>
            {redeemStatus.message && (
              <p
                className={
                  redeemStatus.type === "success"
                    ? "referral-redeem-message success"
                    : "referral-redeem-message error"
                }
              >
                {redeemStatus.message}
              </p>
            )}
          </form>
        )}

        {stats?.hasRedeemedACode && (
          <p className="referral-already-redeemed-note">
            You've already redeemed a referral code on this account.
          </p>
        )}
      </div>
    </DashboardCard>
  );
}

export default ReferralCard;
