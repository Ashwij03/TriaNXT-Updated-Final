// NEW FILE — Dynamic Subscription & Plan Catalog System (Admin-only page).
// Two sections:
//   1. Plan Catalog — DataTable of every tier (Name / Price / Max Studies /
//      Max Users / Storage / Actions) with Add / Edit / Delete. The plan
//      form modal reuses SubscriptionEditModal's field-validation style and
//      the .subscription-modal-* classes from SubscriptionEditModal.css.
//   2. Active Subscription — the shared SubscriptionUsagePanel KPI row, a
//      dropdown to assign which catalog tier the org-wide subscription
//      references (Admin-initiated, no payment), an "Upgrade with Payment"
//      action that opens the shared PlanPickerModal + PaymentModal for paid
//      tiers, and the existing SubscriptionEditModal (unchanged) for
//      status / dates / notes / auto-renewal overrides.
//
// Business rules enforced by the service layer (planCatalogService throws
// on duplicate names, deleting an in-use plan, or deleting the last plan;
// subscriptionGuard blocks study creation / user approval) are surfaced
// here via the banner below the header. With the billing backend configured
// these writes are real API calls and the server's own validation errors
// (e.g. 409 "plan is in use", "cannot assign a deactivated plan") arrive as
// ApiError.message and render through the same banner. In the no-backend
// demo build the same functions fall back to the original localStorage
// behavior, so this page works in both modes.

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../shared/components/dashboard/shared/DashboardLayout";
import DashboardCard from "../../shared/components/dashboard/shared/DashboardCard";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import SubscriptionUsagePanel from "../../shared/components/subscription/SubscriptionUsagePanel";
import SubscriptionEditModal from "../../Sponsor/pages/SubscriptionEditModal";
import PlanPickerModal from "../../shared/components/subscription/PlanPickerModal";
import PaymentModal from "../../shared/components/subscription/PaymentModal";
import { useSubscription } from "../../shared/context/SubscriptionContext";
import {
  getPlanCatalog,
  getPlanById,
  getDefaultPlan,
  createPlan,
  updatePlan,
  deletePlan,
  UNLIMITED_LIMIT,
  PLAN_CATALOG_UPDATED_EVENT,
} from "../../shared/services/planCatalogService";
import {
  getSubscription,
  updateSubscription,
  assignPlanWithoutPayment,
  getSubscriptionStatus,
  SUBSCRIPTION_UPDATED_EVENT,
} from "../../shared/services/subscriptionService";
import {
  formatPrice,
  formatLimit,
} from "../../shared/utils/subscriptionFormat";
import "../../shared/styles/AdminPage.css";
import "../../Sponsor/styles/SubscriptionEditModal.css";
import "../../shared/styles/SubscriptionManagement.css";

function statusBadgeClass(status) {
  return `subscription-status-badge subscription-status-badge--${String(
    status || "active"
  ).toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Plan form modal — mirrors SubscriptionEditModal's validation style and
// markup, adapted to tier fields instead of subscription fields.
// ---------------------------------------------------------------------------

function PlanFormModal({ mode, plan, onSave, onClose }: any) {
  const [formData, setFormData] = useState({
    name: plan?.name || "",
    price: plan?.price ?? "",
    maxStudies: plan?.maxStudies ?? "",
    maxUsers: plan?.maxUsers ?? "",
    storageLimitGb: plan?.storageLimitGb ?? "",
    features: Array.isArray(plan?.features) ? plan.features.join("\n") : "",
    isDefault: Boolean(plan?.isDefault),
  });
  const [errors, setErrors] = useState<Record<string, any>>({});

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, any> = {};;

    if (!formData.name.trim()) {
      newErrors.name = "Plan name is required";
    }

    const validatePositiveNumber = (field, label) => {
      const value = formData[field];
      if (value === "" || value === null || value === undefined) {
        newErrors[field] = `${label} is required`;
        return;
      }
      const numeric = Number(value);
      if (Number.isNaN(numeric) || numeric <= 0) {
        newErrors[field] = `${label} must be greater than 0`;
      }
    };

    if (formData.price === "" || formData.price === null || formData.price === undefined) {
      newErrors.price = "Price is required";
    } else if (Number.isNaN(Number(formData.price)) || Number(formData.price) < 0) {
      newErrors.price = "Price must be 0 or greater";
    }

    validatePositiveNumber("maxStudies", "Maximum studies");
    validatePositiveNumber("maxUsers", "Maximum users");
    validatePositiveNumber("storageLimitGb", "Storage limit");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    onSave({
      ...formData,
      price: Number(formData.price),
      maxStudies: Number(formData.maxStudies),
      maxUsers: Number(formData.maxUsers),
      storageLimitGb: Number(formData.storageLimitGb),
      isDefault: Boolean(formData.isDefault),
    });
  };

  return (
    <div className="subscription-modal-overlay" onClick={onClose}>
      <div
        className="subscription-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="subscription-modal-header">
          <h3>{mode === "edit" ? "Edit Plan" : "Add Plan"}</h3>
        </div>

        <div className="subscription-modal-body">
          <div className="subscription-form-grid">
            <div className="subscription-form-group">
              <label>Plan Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="e.g. Startup"
              />
              {errors.name && (
                <span className="subscription-field-error">{errors.name}</span>
              )}
            </div>

            <div className="subscription-form-group">
              <label>Price ($/month) *</label>
              <input
                type="number"
                min="0"
                value={formData.price}
                onChange={(event) => handleChange("price", event.target.value)}
                placeholder="0"
              />
              {errors.price && (
                <span className="subscription-field-error">{errors.price}</span>
              )}
            </div>

            <div className="subscription-form-group">
              <label>Maximum Studies *</label>
              <input
                type="number"
                min="1"
                value={formData.maxStudies}
                onChange={(event) =>
                  handleChange("maxStudies", event.target.value)
                }
              />
              {errors.maxStudies && (
                <span className="subscription-field-error">
                  {errors.maxStudies}
                </span>
              )}
            </div>

            <div className="subscription-form-group">
              <label>Maximum Users *</label>
              <input
                type="number"
                min="1"
                value={formData.maxUsers}
                onChange={(event) => handleChange("maxUsers", event.target.value)}
              />
              {errors.maxUsers && (
                <span className="subscription-field-error">
                  {errors.maxUsers}
                </span>
              )}
            </div>

            <div className="subscription-form-group">
              <label>Storage Limit (GB) *</label>
              <input
                type="number"
                min="1"
                value={formData.storageLimitGb}
                onChange={(event) =>
                  handleChange("storageLimitGb", event.target.value)
                }
              />
              {errors.storageLimitGb && (
                <span className="subscription-field-error">
                  {errors.storageLimitGb}
                </span>
              )}
            </div>

            <div className="subscription-form-group plan-form-features">
              <label>Features</label>
              <textarea
                rows={4}
                value={formData.features}
                onChange={(event) =>
                  handleChange("features", event.target.value)
                }
                placeholder="One feature per line, e.g.&#10;Up to 3 studies&#10;Priority support"
              />
            </div>

            <div className="subscription-form-group subscription-form-group-checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(event) =>
                    handleChange("isDefault", event.target.checked)
                  }
                />
                <span>Set as default plan</span>
              </label>
            </div>
          </div>
        </div>

        <div className="subscription-modal-footer">
          <button type="button" className="subscription-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="subscription-btn-save" onClick={handleSave}>
            {mode === "edit" ? "Save Changes" : "Add Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function SubscriptionManagement() {
  const { loading, error: loadError, refresh } = useSubscription();

  const [catalog, setCatalog] = useState(() => getPlanCatalog());
  const [subscription, setSubscription] = useState(() => getSubscription());
  const [status, setStatus] = useState(() => getSubscriptionStatus());
  const [selectedPlanId, setSelectedPlanId] = useState(
    () => getSubscription().planId || getDefaultPlan()?.id || ""
  );
  const [planModal, setPlanModal] = useState(null); // { mode: "add"|"edit", plan }
  const [showEditSubscriptionModal, setShowEditSubscriptionModal] =
    useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const refresh = () => {
      setCatalog(getPlanCatalog());
      setSubscription(getSubscription());
      setStatus(getSubscriptionStatus());
    };

    window.addEventListener(PLAN_CATALOG_UPDATED_EVENT, refresh);
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener(PLAN_CATALOG_UPDATED_EVENT, refresh);
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, refresh);
    };
  }, []);

  // Keep the assign dropdown in sync when the subscription's planId changes
  // (e.g. via the Edit Subscription modal or an Apply click).
  useEffect(() => {
    setSelectedPlanId(subscription.planId || getDefaultPlan()?.id || "");
  }, [subscription]);

  const activePlan = useMemo(
    () => getPlanById(subscription.planId) || getDefaultPlan(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscription, catalog]
  );

  const handlePlanModalSave = async (data) => {
    setError("");
    setSuccess("");

    try {
      if (planModal.mode === "edit") {
        await updatePlan(planModal.plan.id, data);
        setSuccess("Plan updated successfully.");
      } else {
        await createPlan(data);
        setSuccess("Plan added successfully.");
      }
      setPlanModal(null);
    } catch (err) {
      setError(err.message || "Unable to save plan.");
    }
  };

  const handleDeletePlan = async (planId) => {
    setError("");
    setSuccess("");

    try {
      await deletePlan(planId);
      setSuccess("Plan deleted successfully.");
    } catch (err) {
      setError(err.message || "Unable to delete plan.");
    }
  };

  const handleAssignPlan = async () => {
    setError("");
    setSuccess("");

    const plan = getPlanById(selectedPlanId);
    if (!plan) {
      setError("Selected plan could not be found.");
      return;
    }

    try {
      // Admin-initiated, no-payment plan switch (downgrade / comped
      // upgrade / free tier) — real API call when the backend is enabled.
      await assignPlanWithoutPayment(plan.id);
      setSuccess(`Active subscription switched to ${plan.name}.`);
    } catch (err) {
      setError(err.message || "Unable to assign the selected plan.");
    }
  };

  const handleSubscriptionModalSave = async (saved) => {
    setError("");
    setSuccess("");

    try {
      await updateSubscription({
        ...saved,
        // Existing modal uses the legacy `storageLimit` field name; the
        // service's canonical field is storageLimitGb.
        storageLimitGb: Number(saved.storageLimit),
      });
      setShowEditSubscriptionModal(false);
      setSuccess("Subscription updated successfully.");
    } catch (err) {
      setError(err.message || "Unable to update the subscription.");
    }
  };

  const handlePickerPay = (selectedPlan) => {
    setPickerOpen(false);
    setPaymentPlan(selectedPlan);
  };

  const handlePickerAssign = async (selectedPlan) => {
    try {
      await assignPlanWithoutPayment(selectedPlan.id);
      setPickerOpen(false);
      setSuccess(`Active subscription switched to ${selectedPlan.name}.`);
    } catch (err) {
      // PlanPickerModal shows its own inline error — nothing to do here.
      throw err;
    }
  };

  const handlePaymentClose = (outcome) => {
    setPaymentPlan(null);

    if (!outcome) {
      return;
    }

    if (outcome.outcome === "success") {
      setSuccess("Payment successful — your plan is now active.");
    } else if (outcome.outcome === "cancelled") {
      setSuccess("Payment was not completed — no charge was made.");
    } else if (outcome.outcome === "confirm_failed") {
      setError(
        outcome.message ||
          "Payment could not be verified. No plan changes were made."
      );
    }
  };

  const planColumns = [
    { key: "name", label: "Name" },
    { key: "price", label: "Price" },
    { key: "maxStudies", label: "Max Studies" },
    { key: "maxUsers", label: "Max Users" },
    { key: "storageLimitGb", label: "Storage" },
    { key: "actions", label: "Actions" },
  ];

  const planRows = catalog.map((plan) => ({
    id: plan.id,
    name: (
      <span>
        {plan.name}
        {plan.isDefault && (
          <span className="subscription-plan-default-badge">Default</span>
        )}
      </span>
    ),
    price: formatPrice(plan.price),
    maxStudies: formatLimit(plan.maxStudies, UNLIMITED_LIMIT),
    maxUsers: formatLimit(plan.maxUsers, UNLIMITED_LIMIT),
    storageLimitGb: `${formatLimit(plan.storageLimitGb, UNLIMITED_LIMIT)} GB`,
    actions: (
      <div className="table-actions">
        <button
          type="button"
          className="plan-edit-btn"
          onClick={() => setPlanModal({ mode: "edit", plan })}
        >
          Edit
        </button>
        <button
          type="button"
          className="plan-delete-btn"
          onClick={() => handleDeletePlan(plan.id)}
        >
          Delete
        </button>
      </div>
    ),
  }));

  return (
    <DashboardLayout>
      <div className="admin-page subscription-management-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Subscription Management</h1>
          <p>Manage plan tiers and the org-wide active subscription</p>
        </div>

        {loadError && (
          <div className="subscription-management-banner subscription-management-banner--error">
            {loadError}{" "}
            <button type="button" className="subscription-retry-btn" onClick={() => refresh()}>
              Retry
            </button>
          </div>
        )}

        {(error || success) && (
          <div
            className={`subscription-management-banner subscription-management-banner--${
              error ? "error" : "success"
            }`}
          >
            {error || success}
          </div>
        )}

        {loading ? (
          <div className="subscription-loading-state" role="status">
            <span className="subscription-loading-spinner" aria-hidden="true" />
            <p>Loading subscription data…</p>
          </div>
        ) : (
          <>
            <section className="settings-page-section settings-page-section-active">
              <div className="settings-section-heading">
                <h2>Plan Catalog</h2>
                <p>
                  Define the subscription tiers available to your organization
                  (the default plan is the fallback for the active subscription)
                </p>
              </div>

              <div className="subscription-management-toolbar">
                <button
                  type="button"
                  className="subscription-add-plan-btn"
                  onClick={() => setPlanModal({ mode: "add", plan: null })}
                >
                  + Add Plan
                </button>
              </div>

              <DataTable
                title="Subscription Plans"
                columns={planColumns}
                data={planRows}
                emptyMessage="No plans defined yet — add your first tier above, or the org will have no plans to subscribe to."
                pagination
              />
            </section>

            <section className="settings-page-section settings-page-section-active">
              <div className="settings-section-heading">
                <h2>Active Subscription</h2>
                <p>Which plan this organization is on, and its usage against it</p>
              </div>

              <DashboardCard
                title="Active Subscription"
                className="subscription-active-card"
              >
                <div className="subscription-active-header">
                  <div>
                    <strong className="subscription-active-plan-name">
                      {activePlan?.name || subscription.plan || "—"}
                    </strong>
                    <span className={statusBadgeClass(status)}>{status}</span>
                  </div>

                  <div className="subscription-active-header-actions">
                    <button
                      type="button"
                      className="subscription-edit-btn"
                      onClick={() => setShowEditSubscriptionModal(true)}
                    >
                      Edit Subscription
                    </button>
                    <button
                      type="button"
                      className="subscription-upgrade-btn"
                      onClick={() => setPickerOpen(true)}
                    >
                      Upgrade with Payment
                    </button>
                  </div>
                </div>

                <div className="subscription-assign-row">
                  <label htmlFor="subscription-plan-assign">Assigned Plan</label>
                  <select
                    id="subscription-plan-assign"
                    value={selectedPlanId}
                    onChange={(event) => setSelectedPlanId(event.target.value)}
                    disabled={catalog.length === 0}
                  >
                    {catalog.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {formatPrice(plan.price)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="subscription-assign-btn"
                    onClick={handleAssignPlan}
                    disabled={catalog.length === 0}
                  >
                    Apply
                  </button>
                </div>

                <p className="subscription-assign-hint">
                  Apply switches plans without payment (downgrades, comped
                  upgrades, free tiers). Use Upgrade with Payment when the new
                  tier must actually be paid for. Edit Subscription handles
                  status, dates, notes, and per-org limit overrides.
                </p>

                <SubscriptionUsagePanel />

                <div className="subscription-meta-grid">
                  <div className="subscription-meta-grid-item">
                    <span>Status</span>
                    <strong>{status}</strong>
                  </div>
                  <div className="subscription-meta-grid-item">
                    <span>Start Date</span>
                    <strong>{subscription.startDate || "—"}</strong>
                  </div>
                  <div className="subscription-meta-grid-item">
                    <span>End Date</span>
                    <strong>{subscription.endDate || "—"}</strong>
                  </div>
                  <div className="subscription-meta-grid-item">
                    <span>Auto Renewal</span>
                    <strong>
                      {typeof subscription.autoRenewal === "boolean"
                        ? subscription.autoRenewal
                          ? "On"
                          : "Off"
                        : "—"}
                    </strong>
                  </div>
                </div>
              </DashboardCard>
            </section>
          </>
        )}
      </div>

      {planModal && (
        <PlanFormModal
          mode={planModal.mode}
          plan={planModal.plan}
          onClose={() => setPlanModal(null)}
          onSave={handlePlanModalSave}
        />
      )}

      {showEditSubscriptionModal && (
        <SubscriptionEditModal
          subscription={{
            ...subscription,
            storageLimit: subscription.storageLimitGb,
          }}
          onClose={() => setShowEditSubscriptionModal(false)}
          onSave={handleSubscriptionModalSave}
        />
      )}

      {pickerOpen && (
        <PlanPickerModal
          currentPlanId={subscription.planId || activePlan?.id}
          adminMode
          onPay={handlePickerPay}
          onAssignWithoutPayment={handlePickerAssign}
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

export default SubscriptionManagement;