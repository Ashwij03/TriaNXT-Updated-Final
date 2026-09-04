// NEW FILE — Dynamic Subscription & Plan Catalog System.
// Universal "My License" page available to every role
// (Admin, SiteStaff, PI, CRO, Sponsor). Shows the org-wide plan, its
// computed status, live usage against the effective limits, end date and
// auto-renewal flag.
//
// Admin gets the Subscribe / Upgrade Plan / Change Plan button: opening the
// shared PlanPickerModal, where paid tiers route through the PaymentModal
// (hosted gateway checkout) and free/default tiers (or Admin comped
// assignments) apply immediately through assignPlanWithoutPayment.
// Every other role keeps the "Contact your Admin" note — enhanced with the
// concrete guard reason (study/user limit reached, non-active status) when
// subscriptionGuard is currently blocking them somewhere in the app.
//
// Re-renders live (no page reload) on the same CustomEvents the services
// dispatch: "subscription-updated" (every subscription write, including
// payment confirmation) and "plan-catalog-updated" (planCatalogService
// writes). Loading / error states come from SubscriptionContext (the
// API pre-fetch provider) so a fresh backend that is slow or down renders
// a spinner + retry instead of silently blank cards.

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/shared/DashboardLayout";
import DashboardCard from "../components/dashboard/shared/DashboardCard";
import SubscriptionUsagePanel from "../components/subscription/SubscriptionUsagePanel";
import PlanPickerModal from "../components/subscription/PlanPickerModal";
import PaymentModal from "../components/subscription/PaymentModal";
import { useSubscription } from "../context/SubscriptionContext";
import {
  getSubscription,
  getActivePlan,
  getSubscriptionStatus,
  assignPlanWithoutPayment,
  SUBSCRIPTION_UPDATED_EVENT,
} from "../services/subscriptionService";
import {
  getPlanCatalog,
  PLAN_CATALOG_UPDATED_EVENT,
} from "../services/planCatalogService";
import { getSubscriptionGuardReasons } from "../services/subscriptionGuard";
import { getCurrentUser, isAdmin } from "../services/roleService";
import { formatPrice, getPlanCtaLabel } from "../utils/subscriptionFormat";
import "../styles/AdminPage.css";
import "../styles/SubscriptionManagement.css";

function statusBadgeClass(status) {
  return `subscription-status-badge subscription-status-badge--${String(
    status || "active"
  ).toLowerCase()}`;
}

function MyLicense() {
  const { loading, error, refresh } = useSubscription();

  const [subscription, setSubscription] = useState(() => getSubscription());
  const [status, setStatus] = useState(() => getSubscriptionStatus());
  const [plan, setPlan] = useState(() => getActivePlan());
  const [catalog, setCatalog] = useState(() => getPlanCatalog());

  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [banner, setBanner] = useState(null); // { type, message }

  useEffect(() => {
    const refreshState = () => {
      setSubscription(getSubscription());
      setStatus(getSubscriptionStatus());
      setPlan(getActivePlan());
      setCatalog(getPlanCatalog());
    };

    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, refreshState);
    window.addEventListener(PLAN_CATALOG_UPDATED_EVENT, refreshState);

    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, refreshState);
      window.removeEventListener(PLAN_CATALOG_UPDATED_EVENT, refreshState);
    };
  }, []);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const adminMode = isAdmin(currentUser);

  // CTA label rules (§2) live in getPlanCtaLabel (shared util, unit-tested):
  // "Subscribe" when not active (first-time/lapsed), "Upgrade Plan" when
  // active and a higher-priced tier exists in the catalog, "Change Plan"
  // otherwise.
  const ctaLabel = getPlanCtaLabel(status, plan, catalog);

  // Non-Admin: surface exactly what the guards are blocking, using the same
  // reason strings the guards already produce elsewhere in the app — additive
  // to the contact-your-Admin note. getSubscriptionGuardReasons() (in
  // subscriptionGuard, unit-tested) runs both guards and de-duplicates the
  // shared status failure.
  const guardReasons = useMemo(() => {
    if (adminMode) {
      return [];
    }

    return getSubscriptionGuardReasons();
    // Recompute whenever the underlying subscription/catalog state changes
    // (the services re-render this page via their CustomEvents).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminMode, subscription, status, plan, catalog]);

  const showBanner = (type, message) => {
    setBanner({ type, message });
    window.setTimeout(() => setBanner(null), 6000);
  };

  const handlePickerPay = (selectedPlan) => {
    // Paid tier — close the picker and open the hosted-gateway payment.
    setPickerOpen(false);
    setPaymentPlan(selectedPlan);
  };

  const handleAssignWithoutPayment = async (selectedPlan) => {
    await assignPlanWithoutPayment(selectedPlan.id);
    // Success: the service fired SUBSCRIPTION_UPDATED_EVENT so the card
    // refreshed itself; close the picker and confirm to the user.
    setPickerOpen(false);
    showBanner("success", `Active subscription switched to ${selectedPlan.name}.`);
  };

  const handlePaymentClose = (outcome) => {
    setPaymentPlan(null);

    if (!outcome) {
      return;
    }

    if (outcome.outcome === "success") {
      showBanner("success", "Payment successful — your plan is now active.");
    } else if (outcome.outcome === "cancelled") {
      showBanner("info", "Payment was not completed — no charge was made.");
    } else if (outcome.outcome === "confirm_failed") {
      showBanner(
        "error",
        outcome.message ||
          "Payment could not be verified. No plan changes were made."
      );
    }
  };

  const planName = plan?.name || subscription.plan || "—";
  const endDate = subscription.endDate || "—";
  const autoRenewal =
    typeof subscription.autoRenewal === "boolean"
      ? subscription.autoRenewal
        ? "On"
        : "Off"
      : "—";

  return (
    <DashboardLayout>
      <div className="admin-page subscription-license-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>My License</h1>
          <p>Your organization&apos;s current plan, status, and usage</p>
        </div>

        {banner && (
          <div
            className={`subscription-management-banner subscription-management-banner--${banner.type}`}
          >
            {banner.message}
          </div>
        )}

        {error && (
          <div className="subscription-management-banner subscription-management-banner--error license-load-error">
            {error}{" "}
            <button type="button" onClick={() => refresh()}>
              Retry
            </button>
          </div>
        )}

        <DashboardCard title="Your Plan" className="license-plan-card">
          {loading ? (
            <div className="subscription-loading-state" role="status">
              <span className="subscription-loading-spinner" aria-hidden="true" />
              <p>Loading your license…</p>
            </div>
          ) : (
            <>
              <div className="license-plan-header">
                <div>
                  <h2 className="license-plan-name">{planName}</h2>
                  <p className="license-plan-price">{formatPrice(plan?.price)}</p>
                </div>

                <div className="license-plan-header-actions">
                  <span className={statusBadgeClass(status)}>{status}</span>
                  {adminMode && (
                    <button
                      type="button"
                      className="license-cta-btn"
                      onClick={() => setPickerOpen(true)}
                    >
                      {ctaLabel}
                    </button>
                  )}
                </div>
              </div>

              {plan?.features?.length > 0 && (
                <ul className="license-plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              )}

              <div className="license-plan-meta">
                <div className="license-plan-meta-item">
                  <span>Status</span>
                  <strong>{status}</strong>
                </div>
                <div className="license-plan-meta-item">
                  <span>End Date</span>
                  <strong>{endDate}</strong>
                </div>
                <div className="license-plan-meta-item">
                  <span>Auto Renewal</span>
                  <strong>{autoRenewal}</strong>
                </div>
              </div>

              {!adminMode && (
                <div className="license-contact-admin-note">
                  <p>Contact your Admin to change your plan.</p>
                  {guardReasons.length > 0 && (
                    <div className="license-guard-reasons">
                      <span className="license-guard-reasons-title">
                        Currently blocking:
                      </span>
                      <ul>
                        {guardReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DashboardCard>

        <SubscriptionUsagePanel />
      </div>

      {pickerOpen && (
        <PlanPickerModal
          currentPlanId={subscription.planId || plan?.id}
          adminMode={adminMode}
          onPay={handlePickerPay}
          onAssignWithoutPayment={handleAssignWithoutPayment}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {paymentPlan && (
        <PaymentModal
          plan={paymentPlan}
          onClose={handlePaymentClose}
        />
      )}
    </DashboardLayout>
  );
}

export default MyLicense;