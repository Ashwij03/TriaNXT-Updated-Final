// NEW FILE — Dynamic Subscription & Plan Catalog System.
// Single source of truth for subscription/plan display formatting.
// Previously duplicated in MyLicense.js and SubscriptionManagement.js —
// both pages (plus PlanPickerModal / PaymentModal) now import from here.

/**
 * Formats a tier price. Zero renders as "Free" (the free/default tier);
 * anything else renders as "$<amount> / month".
 *
 * @param {number|string} price
 * @returns {string}
 */
export function formatPrice(price) {
  const numeric = Number(price) || 0;
  if (numeric === 0) {
    return "Free";
  }
  return `$${numeric.toLocaleString()} / month`;
}

/**
 * CTA label rules for the My License Subscribe / Upgrade Plan / Change Plan
 * button. "Subscribe" when the computed status is not "Active" (first-time
 * / lapsed); "Upgrade Plan" when Active and a higher-priced tier exists in
 * the catalog; "Change Plan" otherwise.
 *
 * @param {string} status computed subscription status (getSubscriptionStatus)
 * @param {object|null} currentPlan the active tier record
 * @param {Array<object>} catalog every tier in the plan catalog
 * @returns {"Subscribe"|"Upgrade Plan"|"Change Plan"}
 */
export function getPlanCtaLabel(status, currentPlan, catalog) {
  if (status !== "Active") {
    return "Subscribe";
  }

  const hasHigherTier = Array.isArray(catalog) &&
    catalog.some(
      (tier) =>
        String(tier?.id) !== String(currentPlan?.id) &&
        Number(tier?.price) > Number(currentPlan?.price)
    );

  return hasHigherTier ? "Upgrade Plan" : "Change Plan";
}

/**
 * Formats a tier limit value. Values at or above the UNLIMITED sentinel
 * render as "Unlimited"; everything else renders as its plain number.
 * The UNLIMITED sentinel lives in planCatalogService (UNLIMITED_LIMIT) —
 * callers that know it pass it in; callers that only need "unlimited or
 * not" can import UNLIMITED_LIMIT themselves.
 *
 * @param {number|string} value
 * @param {number} [unlimitedLimit=999999]
 * @returns {number|string}
 */
export function formatLimit(value, unlimitedLimit = 999999) {
  return Number(value) >= unlimitedLimit
    ? "Unlimited"
    : Number(value) || 0;
}