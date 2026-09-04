// NEW FILE (Requirement L1): Subscription data service — API-backed, with
// the existing localStorage persistence kept as the dev/demo fallback.
// Mirrors the exact pattern already used in studyService.js
// (defaultStudies -> STUDIES_STORAGE_KEY -> getStoredStudies/saveStoredStudies)
// and extends it with the real billing API from the Dynamic Subscription &
// Plan Catalog System backend spec.
//
// ===== API / fallback split =====
// When REACT_APP_API_URL is configured (isApiEnabled() === true) every
// mutation goes through the real /billing/... endpoints and the module
// cache is refreshed from the server response. When the backend is not
// configured (this demo build), the functions fall back to the original
// localStorage behavior so the app keeps working with zero code changes
// at the call sites. Read helpers (getSubscription / getActivePlan /
// getEffectiveLimits / getSubscriptionUsage / getSubscriptionStatus /
// isSubscriptionUsable) are SYNCHRONOUS in both modes — they read a
// module-level cache that SubscriptionProvider pre-fetches once on app
// start and that every write refreshes, so subscriptionGuard and the
// existing useState(() => getSubscription()) initializers keep working
// unchanged. Do not reintroduce an async-only read API.
//
// ===== Event wiring =====
// Every successful write dispatches the "subscription-updated" CustomEvent
// (SUBSCRIPTION_UPDATED_EVENT) so open MyLicense / SubscriptionManagement
// pages live-refresh, the same pattern referralService's writeJson() uses.
// Payment confirmation (confirmPayment) refreshes the subscription from the
// server and dispatches this same event, so the subscribe flow's final
// state is picked up by the existing listeners with no extra wiring.
//
// ===== Exports =====
// Keepers (unchanged shape): getSubscription, saveSubscription (thin
// alias), getActivePlan, getEffectiveLimits, getSubscriptionUsage,
// getSubscriptionStatus, isSubscriptionUsable, initializeSubscription.
// New: refreshSubscriptionFromApi, assignPlanWithoutPayment,
// updateSubscription, initiateCheckout, confirmPayment.

import { api, isApiEnabled, getAuthToken } from "./api/client";
import { getStudies } from "./studyService";
import { getUsers } from "./adminService";
import { getPlanById, getDefaultPlan } from "./planCatalogService";
import { loadFileStore } from "../components/SubjectExplorer/fileService";

const SUBSCRIPTION_STORAGE_KEY = "trianxtSubscription";

// Fired whenever the org-wide subscription is saved, so open MyLicense /
// SubscriptionManagement pages can live-refresh without a page reload —
// mirrors referralService's REFERRAL_DATA_UPDATED_EVENT / adminService's
// "admin-data-updated" CustomEvent pattern.
export const SUBSCRIPTION_UPDATED_EVENT = "subscription-updated";

// Free-tier trial length: the catalog's default tier (Basic) is a free
// plan, and a brand-new / freshly (re-)assigned free subscription gets a
// 30-day license window before it needs to be renewed or upgraded.
const FREE_PLAN_TRIAL_DAYS = 30;

/** Returns an ISO ("YYYY-MM-DD") date `days` from now, for endDate fields. */
function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// Seed for a brand-new install. Deliberately minimal and plan-agnostic:
// plan / planId / limits are intentionally ABSENT so a fresh install
// resolves everything dynamically against the plan catalog's default tier
// (getActivePlan / getEffectiveLimits) instead of duplicating hardcoded
// values that can drift from the catalog. Status is the only other real
// state a fresh subscription starts with. The one exception is endDate:
// since the catalog's default tier is the free Basic plan, a fresh install
// starts with a 30-day free license window (computed fresh on every call
// so it is always "30 days from install", not a stale hardcoded date).
function buildDefaultSubscription() {
  return {
    status: "Active",
    autoRenewal: true,
    notes: "",
    endDate: addDaysIso(FREE_PLAN_TRIAL_DAYS),
  };
}

// Module-level cache. Populated lazily from localStorage on first read and
// refreshed from the API by SubscriptionProvider (or any write). Keeps the
// read helpers synchronous for subscriptionGuard / useState initializers.
let cachedSubscription = null;

function getStoredSubscription() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem(SUBSCRIPTION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveStoredSubscription(subscription) {
  localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subscription));
}

function notifySubscriptionUpdated() {
  if (typeof window !== "undefined" && window.dispatchEvent) {
    try {
      window.dispatchEvent(
        new CustomEvent(SUBSCRIPTION_UPDATED_EVENT, {
          detail: { key: SUBSCRIPTION_STORAGE_KEY },
        })
      );
    } catch {
      // Non-fatal — UI will pick up the change on next natural refresh.
    }
  }
}

export function initializeSubscription() {
  if (typeof window === "undefined") {
    return buildDefaultSubscription();
  }

  const stored = getStoredSubscription();

  if (!stored) {
    const fresh = buildDefaultSubscription();
    saveStoredSubscription(fresh);
    return fresh;
  }

  return stored;
}

export function getSubscription() {
  if (cachedSubscription) {
    return cachedSubscription;
  }

  cachedSubscription = initializeSubscription();
  return cachedSubscription;
}

/**
 * Normalizes the backend /subscription/me/ payload into the local
 * subscription shape. Accepts either a flat subscription object or a
 * { subscription, usage } wrapper (per the backend spec), and stashes any
 * server-computed usage object onto the record so getSubscriptionUsage()
 * can prefer server-verified numbers over client-side recomputation.
 */
function normalizeApiSubscription(payload) {
  const subscription =
    payload && payload.subscription && typeof payload.subscription === "object"
      ? payload.subscription
      : payload;

  const usage =
    (payload && payload.usage) ||
    (payload && payload.subscription && payload.subscription.usage) ||
    null;

  const normalized = { ...(subscription || {}) };

  if (usage && typeof usage === "object") {
    normalized.usage = usage;
  }

  return normalized;
}

/**
 * Syncs the module cache + localStorage mirror from the server and fires
 * SUBSCRIPTION_UPDATED_EVENT. Called by SubscriptionProvider on app start
 * and after every successful API write. In fallback mode (API disabled)
 * this is a no-op that returns the current local subscription.
 *
 * @returns {Promise<object>} the (possibly server-fresh) subscription.
 */
export async function refreshSubscriptionFromApi() {
  if (!isApiEnabled()) {
    return getSubscription();
  }

  // The billing endpoints are authenticated — skip the pre-fetch (and any
  // write-through) when there is no token yet (e.g. on the login page).
  if (!getAuthToken()) {
    return getSubscription();
  }

  const payload = await api.get("/billing/subscription/me/");
  const next = normalizeApiSubscription(payload);

  cachedSubscription = next;
  saveStoredSubscription(next);
  notifySubscriptionUpdated();

  return next;
}

/**
 * Admin-only: assigns a catalog tier to the org-wide subscription WITHOUT
 * a payment (downgrades, comped upgrades, free/default tiers). Replaces the
 * old saveSubscription({ planId ... }) call sites.
 *
 * API mode:    POST /billing/subscription/assign/ { planId }
 * Fallback:    local merge — applies the tier's limits by clearing any
 *              numeric overrides so getEffectiveLimits() falls back to the
 *              tier defaults (same behavior the old Apply dropdown had).
 *
 * @param {string} planId
 * @returns {Promise<object>} the updated subscription.
 */
export async function assignPlanWithoutPayment(planId) {
  const current = getSubscription();

  if (isApiEnabled()) {
    const payload = await api.post("/billing/subscription/assign/", {
      planId,
    });
    const next = normalizeApiSubscription(payload);

    cachedSubscription = next;
    saveStoredSubscription(next);
    notifySubscriptionUpdated();

    return next;
  }

  const plan = getPlanById(planId);
  const isFreePlan = Number(plan?.price) === 0;

  const updatedSubscription = {
    ...current,
    planId: plan?.id || planId,
    plan: plan?.name || current.plan,
    // Assigning a tier applies that tier's limits: clear any numeric
    // overrides so getEffectiveLimits() falls back to the tier defaults.
    maxStudies: undefined,
    maxUsers: undefined,
    storageLimitGb: undefined,
    // Selecting/re-selecting the free tier (Basic) starts a fresh 30-day
    // free license window, same as a brand-new install.
    ...(isFreePlan ? { endDate: addDaysIso(FREE_PLAN_TRIAL_DAYS) } : {}),
  };

  cachedSubscription = updatedSubscription;
  saveStoredSubscription(updatedSubscription);
  notifySubscriptionUpdated();

  return updatedSubscription;
}

/**
 * Admin-only: edits the subscription's status / dates / notes /
 * auto-renewal (and per-org limit overrides) — the narrow PATCH the
 * SubscriptionEditModal feeds. No payment involvement.
 *
 * API mode:    PATCH /billing/subscription/me/ { updates }
 * Fallback:    local merge (the old saveSubscription behavior).
 *
 * @param {object} updates
 * @returns {Promise<object>} the updated subscription.
 */
export async function updateSubscription(updates) {
  const current = getSubscription();

  if (isApiEnabled()) {
    const payload = await api.patch("/billing/subscription/me/", updates);
    const next = normalizeApiSubscription(payload);

    cachedSubscription = next;
    saveStoredSubscription(next);
    notifySubscriptionUpdated();

    return next;
  }

  const updatedSubscription = { ...current, ...(updates || {}) };

  cachedSubscription = updatedSubscription;
  saveStoredSubscription(updatedSubscription);
  notifySubscriptionUpdated();

  return updatedSubscription;
}

/**
 * Thin backward-compatible alias for updateSubscription (the status/dates/
 * notes PATCH). Kept so any existing caller keeps working; new code should
 * prefer the specific functions (assignPlanWithoutPayment /
 * updateSubscription) so it is unambiguous which endpoint a write hits.
 *
 * @deprecated Prefer assignPlanWithoutPayment(planId) or updateSubscription(updates).
 */
export function saveSubscription(updates) {
  return updateSubscription(updates);
}

/**
 * Starts a paid checkout for a tier.
 *
 * API mode:    POST /billing/subscription/checkout/ { planId } returns
 *              { gatewayOrderId, amount, currency, gatewayKey,
 *                paymentTransactionId } — see PaymentModal.
 * Fallback:    resolves a clearly-marked simulated checkout so the demo
 *              build can exercise the flow end-to-end (no real gateway).
 *
 * @param {string} planId
 * @returns {Promise<object>} the checkout descriptor.
 */
export async function initiateCheckout(planId) {
  const plan = getPlanById(planId);

  if (isApiEnabled()) {
    return api.post("/billing/subscription/checkout/", { planId });
  }

  // MOCK PAYMENT PATH (demo build only — API disabled). Returns a fake
  // gateway payload so the modal can run its full lifecycle. When the
  // backend is configured this function is never reached.
  return {
    gatewayOrderId: `demo_order_${Date.now()}`,
    amount: Math.round((Number(plan?.price) || 0) * 100),
    currency: "INR",
    gatewayKey: "demo_key",
    paymentTransactionId: `demo_txn_${Date.now()}`,
    demo: true,
  };
}

/**
 * Confirms a completed gateway payment server-side. This is where the
 * backend verifies the gateway signature — it can fail even when the
 * gateway widget reported success (e.g. tampered client), so callers must
 * surface a confirm failure distinctly from a cancelled payment.
 *
 * API mode:    POST /billing/subscription/confirm/ { paymentTransactionId,
 *              gatewayPaymentId, gatewaySignature }. On success the
 *              subscription is refreshed from the server and
 *              SUBSCRIPTION_UPDATED_EVENT is dispatched (this is the wiring
 *              that lets MyLicense's existing listener pick up the new
 *              plan without a reload).
 * Fallback:    applies the plan via the local assign path (the demo
 *              "payment" is simulated, so no signature is involved).
 *
 * @param {{ paymentTransactionId: string, gatewayPaymentId: string,
 *           gatewaySignature: string }} payload
 * @returns {Promise<object>} the updated subscription.
 */
export async function confirmPayment(payload) {
  if (isApiEnabled()) {
    await api.post("/billing/subscription/confirm/", payload);
    // The backend has written the new subscription — pull it back into the
    // cache and let the event listeners live-refresh every open page.
    return refreshSubscriptionFromApi();
  }

  // Demo path: fall back to a local assign of the plan that was checked out.
  const planId = getCachedCheckoutPlanId();
  return assignPlanWithoutPayment(planId);
}

// Remembers which plan a demo checkout was started for so the demo confirm
// can apply it locally (the real backend keeps this server-side).
let cachedCheckoutPlanId = null;

export function rememberCheckoutPlan(planId) {
  cachedCheckoutPlanId = planId;
}

function getCachedCheckoutPlanId() {
  return cachedCheckoutPlanId;
}

// ---------------------------------------------------------------------------
// Dynamic Plan Catalog integration (additive — see contracts in the
// Dynamic Subscription & Plan Catalog System spec)
// ---------------------------------------------------------------------------

/**
 * Resolves the subscription's planId to its full tier record in the plan
 * catalog. Falls back to the catalog's default tier when planId is missing
 * or no longer resolves (e.g. legacy subscriptions stored before planId
 * existed, or a plan deleted from the catalog).
 *
 * @returns {object|null} the active tier record, or null if the catalog
 *   itself is somehow empty.
 */
export function getActivePlan() {
  const subscription = getSubscription();
  return getPlanById(subscription.planId) || getDefaultPlan();
}

/**
 * Effective limits for enforcement = the subscription object's own fields
 * if explicitly set, otherwise the referenced tier's fields (resolution
 * rule in the spec §2.3). This preserves the SubscriptionEditModal's
 * ability to override a tier's numbers for one org while most orgs simply
 * inherit the tier defaults.
 *
 * @returns {{ maxStudies: number, maxUsers: number, storageLimitGb: number }}
 */
export function getEffectiveLimits() {
  const subscription = getSubscription();
  const plan = getActivePlan() || {};

  const ownField = (value) =>
    value !== undefined && value !== null && value !== "";

  return {
    maxStudies: ownField(subscription.maxStudies)
      ? Number(subscription.maxStudies)
      : Number(plan.maxStudies) || 0,
    maxUsers: ownField(subscription.maxUsers)
      ? Number(subscription.maxUsers)
      : Number(plan.maxUsers) || 0,
    storageLimitGb: ownField(subscription.storageLimitGb)
      ? Number(subscription.storageLimitGb)
      : Number(plan.storageLimitGb) || 0,
  };
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

/**
 * Real byte sum of every subject file stored across every study.
 *
 * Mirrors folderStatsService.sumStorage but works org-wide instead of one
 * study's tree, since MyLicense reports the whole org's usage against the
 * plan limit. Each study keeps its own file store under the study-scoped
 * `trianxtSubjectFiles:<code>` key (see fileService.subjectFilesKey), so
 * this walks every study the org has and adds up its files' `size` field —
 * the same real byte values folderStatsService/FolderStatsBar already show
 * per-study, just aggregated here.
 *
 * Pure read, no caching: cheap enough (localStorage reads are sync/local)
 * to recompute on every call, so it always reflects the current data
 * without needing its own invalidation event.
 */
function getOrgStorageUsedBytes() {
  try {
    return getStudies().reduce((total, study) => {
      const studyKey = study.code || study.id || study.studyId;
      if (!studyKey) return total;

      const store = loadFileStore(studyKey);
      const storeBytes = Object.values(store || {}).reduce(
        (subtotal, files) =>
          subtotal +
          (Array.isArray(files)
            ? files.reduce((sum, file) => sum + (Number(file?.size) || 0), 0)
            : 0),
        0
      );

      return total + storeBytes;
    }, 0);
  } catch {
    return 0;
  }
}

/**
 * Live usage snapshot. When the backend response includes a server-computed
 * `usage` object (API mode — see normalizeApiSubscription), those numbers
 * are authoritative (they match the limits the server actually enforces)
 * and are used directly. Otherwise the snapshot is computed client-side
 * from studyService.getStudies() / adminService.getUsers(), as before.
 *
 * `storageUsedGb` is a real figure (not a placeholder): it is either the
 * server-computed value, when the backend provides one, or a live sum of
 * every subject file's byte size across every study (see
 * `getOrgStorageUsedBytes`), converted to GB. It updates automatically as
 * files are uploaded/deleted because it is recomputed on every call.
 *
 * @returns {{
 *   studiesUsed: number, usersUsed: number,
 *   studiesLimit: number, usersLimit: number,
 *   storageUsedGb: number, storageLimitGb: number,
 *   studiesPercent: number, usersPercent: number, storagePercent: number
 * }}
 */
export function getSubscriptionUsage() {
  const subscription = getSubscription();
  const serverUsage = subscription?.usage;

  if (
    serverUsage &&
    typeof serverUsage === "object" &&
    (typeof serverUsage.studiesUsed === "number" ||
      typeof serverUsage.studiesLimit === "number")
  ) {
    const percentOf = (used, limit) =>
      limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    // The server usage payload may not (yet) include a storage figure —
    // fall back to the real client-computed byte sum so the tile is never
    // stuck at 0 just because that field hasn't landed on the backend yet.
    const storageUsedGb =
      typeof serverUsage.storageUsedGb === "number"
        ? Number(serverUsage.storageUsedGb) || 0
        : getOrgStorageUsedBytes() / BYTES_PER_GB;
    const storageLimitGb = Number(serverUsage.storageLimitGb) || 0;

    return {
      studiesUsed: Number(serverUsage.studiesUsed) || 0,
      usersUsed: Number(serverUsage.usersUsed) || 0,
      studiesLimit: Number(serverUsage.studiesLimit) || 0,
      usersLimit: Number(serverUsage.usersLimit) || 0,
      storageUsedGb,
      storageLimitGb,
      studiesPercent: percentOf(serverUsage.studiesUsed, serverUsage.studiesLimit),
      usersPercent: percentOf(serverUsage.usersUsed, serverUsage.usersLimit),
      storagePercent: percentOf(storageUsedGb, storageLimitGb),
    };
  }

  const limits = getEffectiveLimits();

  const studiesUsed = getStudies().length;
  const usersUsed = getUsers().filter(
    (user) => user.accountStatus === "Active"
  ).length;
  const storageUsedGb = getOrgStorageUsedBytes() / BYTES_PER_GB;

  const percentOf = (used, limit) =>
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return {
    studiesUsed,
    usersUsed,
    studiesLimit: limits.maxStudies,
    usersLimit: limits.maxUsers,
    storageUsedGb,
    storageLimitGb: limits.storageLimitGb,
    studiesPercent: percentOf(studiesUsed, limits.maxStudies),
    usersPercent: percentOf(usersUsed, limits.maxUsers),
    storagePercent: percentOf(storageUsedGb, limits.storageLimitGb),
  };
}

/**
 * Computed subscription status: "Suspended" when the stored status is
 * Suspended; "Expired" when the end date has passed; otherwise the stored
 * status (should be "Active"). Recomputed against "now" on every call so an
 * expired license is reflected immediately with no manual cleanup.
 */
export function getSubscriptionStatus() {
  const subscription = getSubscription();

  if (subscription.status === "Suspended") {
    return "Suspended";
  }

  if (
    subscription.endDate &&
    new Date(subscription.endDate).getTime() < Date.now()
  ) {
    return "Expired";
  }

  return subscription.status || "Active";
}

/**
 * Boolean gate used by subscriptionGuard for enforcement. True only while
 * the computed status is exactly "Active" — an expired or suspended
 * subscription blocks the guarded actions.
 */
export function isSubscriptionUsable() {
  return getSubscriptionStatus() === "Active";
}