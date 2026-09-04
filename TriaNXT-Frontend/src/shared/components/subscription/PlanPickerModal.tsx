// NEW FILE — Dynamic Subscription & Plan Catalog System.
// PlanPickerModal — the shared plan-tier picker used by BOTH MyLicense.js
// (every role sees the Subscribe/Upgrade button; Admins can also comp an
// assignment) and SubscriptionManagement.js (Admin "Upgrade with Payment").
//
// Renders the catalog as a grid of tier cards with the current plan marked.
// Flow rules (from the spec):
//   - Free tier (price === 0) -> lightweight confirm -> assignWithoutPayment
//   - Paid tier (price > 0)   -> "Select & Pay" opens the PaymentModal via
//     onPay(plan)
//   - Admin sees a secondary "Assign without payment" on paid cards ->
//     confirm step -> assignWithoutPayment (comped upgrade / downgrade)
//
// Reuses the .subscription-modal-* chrome from SubscriptionEditModal.css so
// the whole subscribe flow is visually consistent with the edit modal — no
// new modal chrome invented. Escape / overlay click close, Tab focus trap.

import { useEffect, useRef, useState } from "react";
import { getPlanCatalog } from "../../services/planCatalogService";
import {
  formatPrice,
  formatLimit,
} from "../../utils/subscriptionFormat";
import { UNLIMITED_LIMIT } from "../../services/planCatalogService";

function focusableSelector() {
  return 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
}

function PlanPickerModal({
  currentPlanId,
  adminMode = false,
  onPay,
  onAssignWithoutPayment,
  onClose,
}: any) {
  const catalog = getPlanCatalog();

  const [confirmingPlan, setConfirmingPlan] = useState(null);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [error, setError] = useState("");

  const overlayRef = useRef(null);

  // Focus the modal on open so keyboard users start inside the dialog.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      const firstFocusable = overlay.querySelector(focusableSelector());
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  }, []);

  // Escape closes, matching the .subscription-modal-overlay pattern.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Minimal Tab focus trap: keep focus cycling inside the dialog while open.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return undefined;
    }

    const handleTab = (event) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusables = Array.from(
        overlay.querySelectorAll(focusableSelector()) as unknown as HTMLElement[]
      ).filter((el: any) => !el.disabled && el.offsetParent !== null);

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    overlay.addEventListener("keydown", handleTab);
    return () => overlay.removeEventListener("keydown", handleTab);
  }, [confirmingPlan]);

  const handleOverlayClick = () => {
    if (!busyPlanId) {
      onClose();
    }
  };

  const isCurrentPlan = (planId) =>
    String(planId) === String(currentPlanId);

  const handleSelectAndPay = (plan) => {
    setError("");
    onPay(plan);
  };

  const handleConfirmAssign = async () => {
    if (!confirmingPlan) {
      return;
    }

    setBusyPlanId(confirmingPlan.id);
    setError("");

    try {
      await onAssignWithoutPayment(confirmingPlan);
      // Parent closes the modal on success — nothing to do here.
    } catch (err) {
      setError(
        (err && err.message) ||
          "The plan could not be assigned. Please try again."
      );
      setBusyPlanId(null);
    }
  };

  const isBusy = (planId) => String(planId) === String(busyPlanId);

  return (
    <div
      className="subscription-modal-overlay plan-picker-overlay"
      onClick={handleOverlayClick}
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a plan"
    >
      <div
        className="subscription-modal plan-picker-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="subscription-modal-header plan-picker-header">
          <h3>Choose a Plan</h3>
          <button
            type="button"
            className="plan-picker-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="subscription-modal-body">
          <p className="plan-picker-intro">
            Pick the tier that fits your organization. Paid tiers go through
            the secure payment flow; the free tier is applied immediately.
          </p>

          {error && <div className="plan-picker-error">{error}</div>}

          {catalog.length === 0 ? (
            <div className="plan-picker-empty">
              No plans are available yet. Contact your Admin.
            </div>
          ) : (
            <div className="plan-picker-grid">
              {catalog.map((plan) => {
                const current = isCurrentPlan(plan.id);
                const free = Number(plan.price) === 0;

                return (
                  <div
                    key={plan.id}
                    className={`plan-picker-card${
                      current ? " plan-picker-card--current" : ""
                    }`}
                  >
                    <div className="plan-picker-card-head">
                      <h4>{plan.name}</h4>
                      {plan.isDefault && (
                        <span className="subscription-plan-default-badge">
                          Default
                        </span>
                      )}
                      {current && (
                        <span className="plan-picker-current-badge">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <p className="plan-picker-price">
                      {formatPrice(plan.price)}
                    </p>

                    <ul className="plan-picker-features">
                      {Array.isArray(plan.features) && plan.features.length > 0
                        ? plan.features.map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))
                        : [
                            `Up to ${formatLimit(plan.maxStudies, UNLIMITED_LIMIT)} studies`,
                            `Up to ${formatLimit(plan.maxUsers, UNLIMITED_LIMIT)} users`,
                            `${formatLimit(plan.storageLimitGb, UNLIMITED_LIMIT)} GB storage`,
                          ].map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))}
                    </ul>

                    <div className="plan-picker-actions">
                      {free ? (
                        <button
                          type="button"
                          className="plan-picker-btn plan-picker-btn--primary"
                          disabled={Boolean(busyPlanId) || current}
                          onClick={() => setConfirmingPlan(plan)}
                        >
                          {current ? "Current Plan" : "Select"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="plan-picker-btn plan-picker-btn--primary"
                          disabled={Boolean(busyPlanId) || current}
                          onClick={() => handleSelectAndPay(plan)}
                        >
                          Select &amp; Pay
                        </button>
                      )}

                      {adminMode && !free && !current && (
                        <button
                          type="button"
                          className="plan-picker-btn plan-picker-btn--secondary"
                          disabled={Boolean(busyPlanId)}
                          onClick={() => setConfirmingPlan(plan)}
                        >
                          Assign without payment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="subscription-modal-footer plan-picker-footer">
          <button
            type="button"
            className="subscription-btn-cancel"
            onClick={onClose}
            disabled={Boolean(busyPlanId)}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Lightweight confirm step for free / comped assignments — reuses the
          same .subscription-modal-* chrome instead of the payment modal. */}
      {confirmingPlan && (
        <div
          className="subscription-modal-overlay"
          onClick={() => !busyPlanId && setConfirmingPlan(null)}
        >
          <div
            className="subscription-modal plan-picker-confirm"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm plan assignment"
          >
            <div className="subscription-modal-header">
              <h3>Assign {confirmingPlan.name}?</h3>
            </div>

            <div className="subscription-modal-body">
              {error && <div className="plan-picker-error">{error}</div>}
              <p className="plan-picker-confirm-text">
                {Number(confirmingPlan.price) === 0
                  ? "This plan is free — it will be applied to your organization immediately."
                  : "This plan will be applied to your organization immediately without a payment. No charge will be made."}
              </p>
            </div>

            <div className="subscription-modal-footer">
              <button
                type="button"
                className="subscription-btn-cancel"
                onClick={() => setConfirmingPlan(null)}
                disabled={Boolean(busyPlanId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="subscription-btn-save"
                onClick={handleConfirmAssign}
                disabled={Boolean(busyPlanId)}
              >
                {isBusy(confirmingPlan.id)
                  ? "Assigning..."
                  : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlanPickerModal;