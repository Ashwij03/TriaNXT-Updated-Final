// NEW FILE — Dynamic Subscription & Plan Catalog System.
// Plan catalog service — API-backed, with the original localStorage
// persistence kept as the dev/demo fallback. Same split as
// subscriptionService.js: when REACT_APP_API_URL is configured
// (isApiEnabled()) every mutation goes through the real /billing/plans/*
// endpoints; otherwise the service falls back to the localStorage
// behavior below (fail-soft try/catch writes, CustomEvent on every write
// so open pages can live-refresh). Pure data module — no React imports.
//
// Responsibilities:
//   - Owns the org-wide plan catalog (the subscription tiers an Admin can
//     define) under the localStorage key "planCatalog" (fallback mode) and
//     mirrors it from GET /billing/plans/ (API mode).
//   - Seeds the three default tiers (Basic / Professional / Enterprise)
//     lazily on first read if the key doesn't exist yet (fallback only —
//     API mode trusts the server).
//   - Provides CRUD: getPlanCatalog, getPlanById, getDefaultPlan,
//     createPlan, updatePlan, deletePlan. Writes are async (they may hit
//     the network) but reads stay synchronous through a module cache, so
//     existing useState(() => getPlanCatalog()) initializers and the
//     in-use check inside deletePlan keep working unchanged.
//   - Business rules: duplicate plan names, deleting an in-use/default/
//     last plan are rejected. Fallback mode throws local Errors; API mode
//     surfaces the server's rejection (ApiError) with the same message
//     shape, so callers keep rendering err.message through their banners.

import { readJson } from "../utils/storageHelpers";
import * as subscriptionService from "./subscriptionService";
import { api, isApiEnabled, getAuthToken } from "./api/client";

// ---------------------------------------------------------------------------
// Storage key + seed catalog
// ---------------------------------------------------------------------------

const PLAN_CATALOG_STORAGE_KEY = "planCatalog";

// Sentinel for "unlimited" limits. Tiers with a limit at or above this
// value render as "Unlimited" in the UI and are treated as never-full by
// the enforcement guards (percentages clamp to ~0).
export const UNLIMITED_LIMIT = 999999;

// Fired whenever this service writes the catalog, so any open MyLicense /
// SubscriptionManagement page can live-refresh without a page reload —
// mirrors the REFERRAL_DATA_UPDATED_EVENT pattern in referralService.js.
export const PLAN_CATALOG_UPDATED_EVENT = "plan-catalog-updated";

// The three tiers the app ships with. Seeded only when "planCatalog" is
// missing or not an array (fallback mode only) — existing data is never
// overwritten.
const defaultPlanCatalog = [
  {
    id: "plan_basic",
    name: "Basic",
    price: 0,
    maxStudies: 3,
    maxUsers: 5,
    storageLimitGb: 10,
    features: ["Up to 3 studies", "Up to 5 users", "10GB storage"],
    isDefault: true,
  },
  {
    id: "plan_professional",
    name: "Professional",
    price: 499,
    maxStudies: 10,
    maxUsers: 25,
    storageLimitGb: 100,
    features: [
      "Up to 10 studies",
      "Up to 25 users",
      "100GB storage",
      "Priority support",
    ],
    isDefault: false,
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    price: 1999,
    maxStudies: UNLIMITED_LIMIT,
    maxUsers: UNLIMITED_LIMIT,
    storageLimitGb: 1000,
    features: [
      "Unlimited studies",
      "Unlimited users",
      "1TB storage",
      "Dedicated support",
    ],
    isDefault: false,
  },
];

// Module-level cache. Populated lazily from localStorage on first read and
// refreshed from the API by SubscriptionProvider (or any write). Keeps the
// read helpers synchronous for existing useState initializers.
let cachedCatalog = null;

// ---------------------------------------------------------------------------
// Low-level storage helpers (fail-soft: never throw for storage reasons —
// only the explicit business-rule Errors below ever throw)
// ---------------------------------------------------------------------------

function writeJson(key, value) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent(PLAN_CATALOG_UPDATED_EVENT, { detail: { key } })
    );
    return true;
  } catch {
    // Swallow quota/availability errors — callers must fail soft, never throw.
    return false;
  }
}

function readPlanCatalogFromStorage() {
  const stored = readJson(PLAN_CATALOG_STORAGE_KEY, null);

  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }

  // Lazy seed on first read (same pattern as
  // subscriptionService.initializeSubscription seeding defaultSubscription).
  writeJson(PLAN_CATALOG_STORAGE_KEY, defaultPlanCatalog);
  return defaultPlanCatalog;
}

function readPlanCatalog() {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  cachedCatalog = readPlanCatalogFromStorage();
  return cachedCatalog;
}

// Persists + dispatches PLAN_CATALOG_UPDATED_EVENT in one step (writeJson
// fires the event), so every write above fires the event EXACTLY once.
function updateCachedCatalog(nextCatalog) {
  cachedCatalog = nextCatalog;
  writeJson(PLAN_CATALOG_STORAGE_KEY, nextCatalog);
}

/**
 * Syncs the module cache + localStorage mirror from the server and fires
 * PLAN_CATALOG_UPDATED_EVENT. Called by SubscriptionProvider on app start
 * and after every successful API write. In fallback mode this is a no-op
 * that returns the current local catalog.
 *
 * @returns {Promise<Array<object>>} the (possibly server-fresh) catalog.
 */
export async function refreshPlanCatalogFromApi() {
  if (!isApiEnabled()) {
    return readPlanCatalog();
  }

  if (!getAuthToken()) {
    return readPlanCatalog();
  }

  const payload = await api.get("/billing/plans/");
  const catalog = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.plans)
      ? payload.plans
      : [];

  updateCachedCatalog(catalog);

  return catalog;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Returns every tier in the plan catalog. Seeds the three default tiers on
 * the first call if nothing has been stored yet (fallback mode). Always
 * returns an array — an empty array is a legitimate "fresh backend, no
 * plans yet" state that pages must render as an empty state, not crash on.
 */
export function getPlanCatalog() {
  return readPlanCatalog();
}

/**
 * Returns the full tier record for a planId, or null when no tier matches.
 * Unknown/legacy planIds therefore resolve to null and callers fall back to
 * getDefaultPlan() — a missing tier must never break the app.
 */
export function getPlanById(planId) {
  if (planId === undefined || planId === null || planId === "") {
    return null;
  }

  return (
    readPlanCatalog().find((plan) => String(plan.id) === String(planId)) ||
    null
  );
}

/**
 * Returns the tier marked isDefault: true — the fallback plan when the
 * active subscription's planId is missing or no longer resolves. If the
 * default flag was somehow removed from every tier, falls back to the
 * first tier in the catalog so there is always a resolvable plan.
 */
export function getDefaultPlan() {
  const catalog = readPlanCatalog();
  return (
    catalog.find((plan) => plan.isDefault === true) ||
    catalog[0] ||
    null
  );
}

// ---------------------------------------------------------------------------
// Write helpers (business-rule Errors in fallback mode; server Errors in
// API mode — both expose .message for the existing banner pattern)
// ---------------------------------------------------------------------------

/** Slug-style stable id derived from the plan name, e.g. "My Plan" -> "plan_my-plan". */
function buildPlanId(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `plan_${slug || "plan"}`;
}

function normalizePlanFeatures(features) {
  if (Array.isArray(features)) {
    return features.map((feature) => String(feature).trim()).filter(Boolean);
  }

  return String(features || "")
    .split(/[\n,]/)
    .map((feature) => feature.trim())
    .filter(Boolean);
}

function normalizePlan(plan) {
  return {
    ...plan,
    id: String(plan.id || ""),
    name: String(plan.name || "").trim(),
    price: Number(plan.price) || 0,
    maxStudies: Number(plan.maxStudies) || 0,
    maxUsers: Number(plan.maxUsers) || 0,
    storageLimitGb: Number(plan.storageLimitGb) || 0,
    features: normalizePlanFeatures(plan.features),
    isDefault: Boolean(plan.isDefault),
  };
}

function hasDuplicateName(catalog, name, excludeId?) {
  const normalized = String(name || "").trim().toLowerCase();
  return catalog.some(
    (plan) =>
      String(plan.name || "").trim().toLowerCase() === normalized &&
      String(plan.id) !== String(excludeId)
  );
}

/**
 * Adds a new tier to the catalog. In API mode this is POST /billing/plans/;
 * the server enforces name uniqueness and returns a 409 the caller renders
 * through the existing banner. In fallback mode a stable slug-style id is
 * generated locally ("plan_" + kebab-case name) and a duplicate plan name
 * is rejected with a thrown Error, mirroring studyService.createStudy's
 * duplicate throw-and-display pattern.
 *
 * @returns {Promise<object>} the newly created, normalized tier record.
 */
export async function createPlan(planData) {
  const name = String(planData?.name || "").trim();

  if (!name) {
    throw new Error("Plan name is required.");
  }

  if (isApiEnabled()) {
    const created = await api.post("/billing/plans/", planData);
    const normalized = normalizePlan(created);

    updateCachedCatalog([...readPlanCatalog(), normalized]);

    return normalized;
  }

  const catalog = readPlanCatalog();

  if (hasDuplicateName(catalog, name)) {
    throw new Error("A plan with this name already exists.");
  }

  const newPlan = normalizePlan({
    ...planData,
    id: buildPlanId(name),
  });

  if (catalog.some((plan) => plan.id === newPlan.id)) {
    // Name was unique but kebab-cased to an existing id — treat it the same
    // as a duplicate name so plan ids stay unique and stable.
    throw new Error("A plan with this name already exists.");
  }

  let nextCatalog = [...catalog, newPlan];

  // Exactly one tier can be the default; marking a new one as default
  // clears the flag from every other tier (no hardcoded default plan).
  if (newPlan.isDefault) {
    nextCatalog = nextCatalog.map((plan) =>
      plan.id === newPlan.id ? plan : { ...plan, isDefault: false }
    );
  }

  updateCachedCatalog(nextCatalog);
  return newPlan;
}

/**
 * Updates an existing tier in place. The plan id is immutable (it is the
 * stable reference the active subscription points at), so `updates.id` is
 * ignored. In API mode this is PUT /billing/plans/:id/; the server
 * enforces name uniqueness and rejects unknown ids. In fallback mode
 * throws when the planId is unknown or the new name collides with another
 * tier's name.
 *
 * @returns {Promise<object>} the updated tier record.
 */
export async function updatePlan(planId, updates) {
  if (isApiEnabled()) {
    const updated = await api.put(
      `/billing/plans/${encodeURIComponent(planId)}/`,
      updates
    );
    const normalized = normalizePlan(updated);

    const nextCatalog = readPlanCatalog().map((plan) =>
      String(plan.id) === String(planId) ? normalized : plan
    );

    // Same single-default rule as createPlan (defensive — the server also
    // enforces it): promoting a tier to default demotes every other tier.
    const withDefault = normalized.isDefault
      ? nextCatalog.map((plan) =>
          String(plan.id) === String(normalized.id)
            ? plan
            : { ...plan, isDefault: false }
        )
      : nextCatalog;

    updateCachedCatalog(withDefault);

    return normalized;
  }

  const catalog = readPlanCatalog();
  const index = catalog.findIndex(
    (plan) => String(plan.id) === String(planId)
  );

  if (index === -1) {
    throw new Error("Plan not found.");
  }

  const current = catalog[index];
  // The plan id is immutable — it is the stable reference the active
  // subscription points at — so any caller-supplied id is ignored.
  const updatesWithoutId = { ...(updates || {}) };
  delete updatesWithoutId.id;

  if (hasDuplicateName(catalog, updatesWithoutId.name, current.id)) {
    throw new Error("A plan with this name already exists.");
  }

  const updatedPlan = normalizePlan({
    ...current,
    ...updatesWithoutId,
  });

  let nextCatalog = [...catalog];
  nextCatalog[index] = updatedPlan;

  // Same single-default rule as createPlan: promoting a tier to default
  // demotes every other tier.
  if (updatedPlan.isDefault) {
    nextCatalog = nextCatalog.map((plan) =>
      plan.id === updatedPlan.id ? plan : { ...plan, isDefault: false }
    );
  }

  updateCachedCatalog(nextCatalog);
  return updatedPlan;
}

/**
 * Deletes a tier from the catalog. In API mode this is DELETE
 * /billing/plans/:id/; the server rejects deleting an in-use / default /
 * last plan with a 409 the caller surfaces through the banner. In
 * fallback mode throws when the tier is currently assigned to the active
 * subscription (a plan in use cannot be deleted) or when it would leave
 * the catalog with zero tiers.
 */
export async function deletePlan(planId) {
  if (isApiEnabled()) {
    await api.delete(`/billing/plans/${encodeURIComponent(planId)}/`);

    const nextCatalog = readPlanCatalog().filter(
      (plan) => String(plan.id) !== String(planId)
    );

    updateCachedCatalog(nextCatalog);

    return true;
  }

  const catalog = readPlanCatalog();

  if (catalog.length <= 1) {
    throw new Error("At least one plan must remain in the catalog.");
  }

  const target = catalog.find((plan) => String(plan.id) === String(planId));

  if (!target) {
    throw new Error("Plan not found.");
  }

  // Block deleting a plan the active subscription currently references.
  // Reads the subscription lazily (and fail-soft) so a missing/unreadable
  // subscription can never turn this into a storage error — the in-use
  // guard below is the ONLY reason deletePlan can throw.
  let subscription = null;
  try {
    // subscriptionService imports planCatalogService statically, so the
    // module is only ever dereferenced at call time below (never during
    // module evaluation), which keeps the mutual import safe under ESM.
    subscription = subscriptionService.getSubscription();
  } catch {
    subscription = null;
  }

  if (subscription && String(subscription.planId) === String(planId)) {
    throw new Error(
      "This plan is currently assigned to your active subscription and cannot be deleted."
    );
  }

  const nextCatalog = catalog.filter(
    (plan) => String(plan.id) !== String(planId)
  );

  updateCachedCatalog(nextCatalog);
  return true;
}