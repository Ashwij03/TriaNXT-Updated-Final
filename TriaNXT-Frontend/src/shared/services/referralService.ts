// NEW FILE — Task 6 (Ashwij): Referral & Limited Free License Model.
// localStorage-backed service, following the exact pattern already used by
// subscriptionService.js / studyService.js (own readJson/writeJson helpers,
// no external persistence layer). Pure data module — no React imports.
//
// Business rules implemented here (see Task6_Referral_License_Development_Plan.md
// for the full spec):
//   R1 — Referee always receives exactly 15 free days per successful redemption.
//   R2 — The 15-day window auto-expires on read; no manual cleanup needed.
//   R3 — If the referee already has active access (paid subscription and/or a
//        prior referral extension), the 15 days are appended AFTER that
//        access ends, not from today.
//        NOTE on data source: this codebase has no per-user subscription
//        record — subscriptionService.js's "trianxtSubscription" is a single
//        ORG-WIDE plan object (one localStorage key, no userId field). That
//        is the only "subscription" concept that exists anywhere in this
//        app, so it is what R3 stacks against (see getOrgSubscriptionEndDate
//        below). If/when a real per-user subscription is introduced, swap
//        that one function's body for a per-user lookup — nothing else in
//        this file needs to change.
//   R4 — Every user has exactly one static referral code, generated once and
//        never regenerated.
//   R5 — A single referral code can be successfully redeemed by at most 3
//        distinct referees.
//   R6 — Admin-controlled toggle: when ON, both referrer and referee receive
//        15 days on a successful redemption; when OFF, only the referee does.

import { readJson } from "../utils/storageHelpers";
import { getSettings, saveSettings, getUsers } from "./adminService";
import { getSubscription } from "./subscriptionService";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const REFERRAL_CODES_KEY = "referralCodes";
const REFERRAL_USAGES_KEY = "referralUsages";
const LICENSE_ENTITLEMENTS_KEY = "licenseEntitlements";

// The admin ON/OFF flag (R6) rides on the existing "adminSettings" storage
// key/object, read and written through adminService's own
// getSettings()/saveSettings() (imported above) rather than this file
// touching localStorage directly — reuses adminService's existing
// "admin-data-updated" event dispatch and keeps a single write path for
// that shared key.

const REFERRAL_DAYS_GRANTED = 15;
const MAX_REDEMPTIONS_PER_CODE = 3;

// Fired whenever this service writes referral/license data, so any open
// ReferralCard / ReferralProgramSettings component can live-refresh without
// a page reload — mirrors adminService's "admin-data-updated" CustomEvent.
export const REFERRAL_DATA_UPDATED_EVENT = "referral-data-updated";

// ---------------------------------------------------------------------------
// Low-level storage helpers (fail-soft: never throw, matches the existing
// try/catch convention used throughout subscriptionService.js / roleService.js)
// ---------------------------------------------------------------------------

function readArray(key) {
  const value = readJson(key, []);
  return Array.isArray(value) ? value : [];
}

function writeJson(key, value) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent(REFERRAL_DATA_UPDATED_EVENT, { detail: { key } })
    );
    return true;
  } catch {
    // Swallow quota/availability errors — callers must fail soft, never throw.
    return false;
  }
}

function readReferralCodes() {
  return readArray(REFERRAL_CODES_KEY);
}

function writeReferralCodes(codes) {
  return writeJson(REFERRAL_CODES_KEY, codes);
}

function readReferralUsages() {
  return readArray(REFERRAL_USAGES_KEY);
}

function writeReferralUsages(usages) {
  return writeJson(REFERRAL_USAGES_KEY, usages);
}

function readLicenseEntitlements() {
  return readArray(LICENSE_ENTITLEMENTS_KEY);
}

function writeLicenseEntitlements(entitlements) {
  return writeJson(LICENSE_ENTITLEMENTS_KEY, entitlements);
}

// ---------------------------------------------------------------------------
// §4 — Referral code generation (R4: static per user, never regenerated)
// ---------------------------------------------------------------------------

function randomBase36Chars(length) {
  let result = "";
  while (result.length < length) {
    result += Math.random().toString(36).slice(2);
  }
  return result.slice(0, length).toUpperCase();
}

function derivePrefix(userNameOrUsername) {
  const cleaned = String(userNameOrUsername || "USR")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  const prefix = cleaned.slice(0, 3);
  return prefix.length === 3 ? prefix : (prefix + "XXX").slice(0, 3);
}

function generateUniqueCode(userNameOrUsername, existingCodes) {
  const existingSet = new Set<any>(existingCodes.map((record) => record.code));
  const prefix = derivePrefix(userNameOrUsername);

  // Extremely low collision odds (36^5 ≈ 60M combinations), but guard it
  // explicitly rather than trusting probability alone.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${randomBase36Chars(5)}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
  }

  // Fallback: timestamp-suffixed, guaranteed unique within this session.
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Returns the user's existing referral code, or creates one (lazily, once,
 * never rotated) if they don't have one yet. Idempotent — safe to call on
 * every ReferralCard mount.
 *
 * @param {number|string} userId
 * @param {string} [displayNameForPrefix] username/name used to derive the
 *   human-readable 3-letter prefix. Optional — falls back to a generic prefix.
 * @returns {{ userId, code, createdAt, redemptionCount, active }|null}
 */
export function getOrCreateReferralCode(userId, displayNameForPrefix = "") {
  if (userId === undefined || userId === null || userId === "") {
    return null;
  }

  const codes = readReferralCodes();
  const existing = codes.find(
    (record) => String(record.userId) === String(userId)
  );

  if (existing) {
    return existing;
  }

  const newRecord = {
    userId,
    code: generateUniqueCode(displayNameForPrefix, codes),
    createdAt: new Date().toISOString(),
    redemptionCount: 0,
    active: true
  };

  writeReferralCodes([...codes, newRecord]);
  return newRecord;
}

/** Read-only lookup — does NOT create a code if one doesn't exist. */
export function getReferralCodeForUser(userId) {
  if (userId === undefined || userId === null || userId === "") {
    return null;
  }

  return (
    readReferralCodes().find(
      (record) => String(record.userId) === String(userId)
    ) || null
  );
}

/** Returns the referrerUserId that owns a given code, or null if not found/inactive. */
export function findReferralCodeOwner(codeString) {
  const record = findCodeRecord(codeString);
  return record && record.active ? record.userId : null;
}

function normalizeCode(codeString) {
  return String(codeString || "").trim().toUpperCase();
}

function findCodeRecord(codeString) {
  const normalized = normalizeCode(codeString);
  if (!normalized) {
    return null;
  }
  return (
    readReferralCodes().find((record) => record.code === normalized) || null
  );
}

// ---------------------------------------------------------------------------
// §2.3 / §6 — License entitlement read + auto-expiry (R2)
// ---------------------------------------------------------------------------

function getRawEntitlement(userId) {
  return (
    readLicenseEntitlements().find(
      (record) => String(record.userId) === String(userId)
    ) || null
  );
}

function upsertEntitlement(userId, updates) {
  const entitlements = readLicenseEntitlements();
  const index = entitlements.findIndex(
    (record) => String(record.userId) === String(userId)
  );

  const base =
    index >= 0
      ? entitlements[index]
      : {
          userId,
          subscriptionEndDate: null,
          referralExtensionEndDate: null,
          referralExtensionDaysTotal: 0,
          referralExtensionSource: null
        };

  const merged = {
    ...base,
    ...updates,
    isReferralLicenseActive: computeIsActive(
      updates.referralExtensionEndDate !== undefined
        ? updates.referralExtensionEndDate
        : base.referralExtensionEndDate
    ),
    lastCheckedAt: new Date().toISOString()
  };

  const next =
    index >= 0
      ? entitlements.map((record, i) => (i === index ? merged : record))
      : [...entitlements, merged];

  writeLicenseEntitlements(next);
  return merged;
}

function computeIsActive(endDateISO) {
  if (!endDateISO) {
    return false;
  }
  return new Date(endDateISO).getTime() > Date.now();
}

/**
 * Returns the user's current entitlement record, recomputing the active
 * flag against "now" on every call (R2 — auto-expiry is computed on read,
 * there is no cron/scheduler in a localStorage-only app).
 */
export function getLicenseEntitlement(userId) {
  const raw = getRawEntitlement(userId);

  if (!raw) {
    return {
      userId,
      subscriptionEndDate: null,
      referralExtensionEndDate: null,
      referralExtensionDaysTotal: 0,
      referralExtensionSource: null,
      isReferralLicenseActive: false,
      lastCheckedAt: new Date().toISOString()
    };
  }

  return {
    ...raw,
    isReferralLicenseActive: computeIsActive(raw.referralExtensionEndDate)
  };
}

/** Boolean gate — always recomputed against `new Date()`, never trusts a stale stored flag. */
export function isReferralLicenseActive(userId) {
  return getLicenseEntitlement(userId).isReferralLicenseActive;
}

/** Whole days remaining on the referral extension window, 0 if expired/none. */
export function getDaysRemaining(userId) {
  const entitlement = getLicenseEntitlement(userId);

  if (!entitlement.referralExtensionEndDate || !entitlement.isReferralLicenseActive) {
    return 0;
  }

  const diffMs =
    new Date(entitlement.referralExtensionEndDate).getTime() - Date.now();

  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// §5.2 — Stacking date math (R3)
// ---------------------------------------------------------------------------

/**
 * "Active end date" = the later of subscriptionEndDate and any existing
 * referralExtensionEndDate — whichever is furthest in the future counts as
 * "where the user's access currently runs out". Only FUTURE dates count as
 * still active; a stale/past end date is treated the same as having none.
 */
export function computeStackedEndDate(
  currentEntitlement,
  daysToAdd = REFERRAL_DAYS_GRANTED,
  now = new Date()
) {
  const candidates = [
    currentEntitlement?.subscriptionEndDate,
    currentEntitlement?.referralExtensionEndDate
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > now.getTime());

  const base = candidates.length
    ? new Date(Math.max(...candidates.map((date) => date.getTime())))
    : new Date(now.getTime());

  const end = new Date(base.getTime());
  end.setDate(end.getDate() + daysToAdd);
  return end.toISOString();
}

/**
 * Resolves "the user's existing subscription end date" for R3 stacking
 * purposes. This app only has one subscription record in total — the
 * org-wide plan in subscriptionService.js ("trianxtSubscription") — so that
 * is treated as every user's active subscription end date, but only when
 * that subscription is actually Active. Fails soft (returns null) if
 * subscriptionService is unavailable for any reason, so a referral grant
 * can never throw because of this lookup.
 */
function getOrgSubscriptionEndDate() {
  try {
    const subscription = getSubscription();
    if (subscription && subscription.status === "Active" && subscription.endDate) {
      return subscription.endDate;
    }
  } catch {
    // Fail soft — treat as "no active subscription" rather than block the grant.
  }
  return null;
}

function grantDaysToUser(userId, daysToAdd, sourceUsageId) {
  const current = getRawEntitlement(userId) || {};

  // R3: pull in the current subscription end date as a stacking candidate
  // (see getOrgSubscriptionEndDate's note on why this reads the org-wide
  // subscription) alongside any prior referral extension already on file.
  const subscriptionEndDate = getOrgSubscriptionEndDate();
  const newEndDate = computeStackedEndDate(
    { ...current, subscriptionEndDate },
    daysToAdd
  );

  return upsertEntitlement(userId, {
    subscriptionEndDate,
    referralExtensionEndDate: newEndDate,
    referralExtensionDaysTotal: (current.referralExtensionDaysTotal || 0) + daysToAdd,
    referralExtensionSource: sourceUsageId
  });
}

// ---------------------------------------------------------------------------
// §8 — Admin toggle (R6) — rides on adminService's "adminSettings" key
// ---------------------------------------------------------------------------

/** Default OFF (R6): only the referee benefits unless an Admin turns this on. */
export function isReferrerBonusEnabled() {
  const settings = getSettings();
  return Boolean(settings?.referralProgram?.referrerBonusEnabled);
}

/** Admin-only action — the calling UI must gate this behind isAdmin(). */
export function setReferrerBonusEnabled(enabled) {
  const settings = getSettings() || {};
  const next = {
    ...settings,
    referralProgram: {
      ...(settings.referralProgram || {}),
      referrerBonusEnabled: Boolean(enabled)
    }
  };

  saveSettings(next);

  // adminService.saveSettings() dispatches its own "admin-data-updated"
  // event; ReferralCard / ReferralProgramSettings / Settings.js's sync
  // effect listen for this file's REFERRAL_DATA_UPDATED_EVENT specifically,
  // so fire that too rather than making three components listen to two
  // different event names.
  if (typeof window !== "undefined" && window.dispatchEvent) {
    try {
      window.dispatchEvent(
        new CustomEvent(REFERRAL_DATA_UPDATED_EVENT, {
          detail: { key: "adminSettings" }
        })
      );
    } catch {
      // Non-fatal — UI will simply pick up the change on next natural refresh.
    }
  }

  return next.referralProgram;
}

// ---------------------------------------------------------------------------
// §5 — Redemption flow (R1, R3, R5, R6)
// ---------------------------------------------------------------------------

const REJECTION_MESSAGES = {
  invalid_code: "That referral code isn't valid.",
  self_referral: "You can't redeem your own referral code.",
  already_redeemed: "You've already redeemed a referral code before.",
  referral_limit_reached: "This referral code has reached its redemption limit (3/3 used).",
  same_organization_referral: "Referral codes can't be redeemed by another user from the same organization and location.",
  missing_referee: "A signed-in user is required to redeem a referral code."
};

export function getRedemptionErrorMessage(reason) {
  return REJECTION_MESSAGES[reason] || "This referral code could not be redeemed.";
}

/**
 * Redeems `codeString` on behalf of `refereeUserId`. Fully synchronous (no
 * await gaps) so two redemption clicks in the same tab can't race each other
 * against localStorage. See §5 of the development plan for the exact
 * step-by-step contract this function implements.
 *
 * @returns {{ ok: true, daysGranted: number, newEndDate: string, referrerBonusGranted: boolean }
 *          | { ok: false, reason: string, message: string }}
 */
export function redeemReferralCode(refereeUserId, codeString) {
  if (refereeUserId === undefined || refereeUserId === null || refereeUserId === "") {
    return { ok: false, reason: "missing_referee", message: getRedemptionErrorMessage("missing_referee") };
  }

  // Step 1 — normalize.
  const normalizedCode = normalizeCode(codeString);

  // Step 2 — look up the code.
  const codeRecord = findCodeRecord(normalizedCode);
  if (!codeRecord || codeRecord.active === false) {
    return { ok: false, reason: "invalid_code", message: getRedemptionErrorMessage("invalid_code") };
  }

  // Step 3 — self-referral guard.
  if (String(codeRecord.userId) === String(refereeUserId)) {
    return { ok: false, reason: "self_referral", message: getRedemptionErrorMessage("self_referral") };
  }

  // Step 3b — same-organization + same-pincode guard, fail-closed on
  // missing data. Blocks when the organizations match AND we cannot
  // prove the two users are at different locations: either the
  // pincodes match, or either side's pincode is missing/blank. A
  // different organization is always allowed. The same organization
  // with two known, differing pincodes (a different site of the same
  // org) is allowed.
  const allUsers = getUsers();
  const referrerRecord = allUsers.find(
    (u) => String(u.id) === String(codeRecord.userId)
  );
  const refereeRecord = allUsers.find(
    (u) => String(u.id) === String(refereeUserId)
  );

  const referrerOrg = (referrerRecord?.organizationName || referrerRecord?.orgType || "").trim();
  const refereeOrg = (refereeRecord?.organizationName || refereeRecord?.orgType || "").trim();
  const referrerPincode = (referrerRecord?.pincode || "").trim();
  const refereePincode = (refereeRecord?.pincode || "").trim();

  const sameOrganization = Boolean(referrerOrg) && referrerOrg === refereeOrg;
  const pincodeKnownOnBothSides = Boolean(referrerPincode) && Boolean(refereePincode);
  const blockedByPincode = pincodeKnownOnBothSides
    ? referrerPincode === refereePincode
    : true; // fail-closed: can't verify distinct locations, so treat as a match

  if (sameOrganization && blockedByPincode) {
    return {
      ok: false,
      reason: "same_organization_referral",
      message: getRedemptionErrorMessage("same_organization_referral")
    };
  }

  // Step 4 — duplicate-redemption guard: a referee may redeem any code only once, ever.
  const usages = readReferralUsages();
  const alreadyRedeemed = usages.some(
    (usage) => String(usage.refereeUserId) === String(refereeUserId)
  );
  if (alreadyRedeemed) {
    return { ok: false, reason: "already_redeemed", message: getRedemptionErrorMessage("already_redeemed") };
  }

  // Step 5 — cap guard (R5): max 3 redemptions per code.
  if ((codeRecord.redemptionCount || 0) >= MAX_REDEMPTIONS_PER_CODE) {
    return { ok: false, reason: "referral_limit_reached", message: getRedemptionErrorMessage("referral_limit_reached") };
  }

  // Step 6/7 — compute referee's new window; read the admin toggle (R6).
  const nowIso = new Date().toISOString();
  const usageId = `ru_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const bonusOn = isReferrerBonusEnabled();

  // Step 8a — grant the referee's days (always happens).
  const refereeEntitlement = grantDaysToUser(refereeUserId, REFERRAL_DAYS_GRANTED, usageId);

  // Step 8b — grant the referrer's days too, only if the toggle is ON. This
  // stacks independently against the REFERRER's own existing entitlement,
  // not the referee's.
  let referrerBonusGranted = false;
  if (bonusOn) {
    grantDaysToUser(codeRecord.userId, REFERRAL_DAYS_GRANTED, usageId);
    referrerBonusGranted = true;
  }

  // Step 8c — append the audit-trail / duplicate-guard record.
  const usageRecord = {
    id: usageId,
    refereeUserId,
    referrerUserId: codeRecord.userId,
    code: codeRecord.code,
    redeemedAt: nowIso,
    refereeDaysGranted: REFERRAL_DAYS_GRANTED,
    referrerDaysGranted: referrerBonusGranted ? REFERRAL_DAYS_GRANTED : 0,
    refereeLicenseStartDate: nowIso,
    refereeLicenseEndDate: refereeEntitlement.referralExtensionEndDate
  };
  writeReferralUsages([...usages, usageRecord]);

  // Step 8d — increment the code's redemption count.
  const updatedCodes = readReferralCodes().map((record) =>
    record.code === codeRecord.code
      ? { ...record, redemptionCount: (record.redemptionCount || 0) + 1 }
      : record
  );
  writeReferralCodes(updatedCodes);

  // Step 9 — return success.
  return {
    ok: true,
    daysGranted: REFERRAL_DAYS_GRANTED,
    newEndDate: refereeEntitlement.referralExtensionEndDate,
    referrerBonusGranted
  };
}

// ---------------------------------------------------------------------------
// §11 row 14 — non-blocking "settle expiry" hook for Login.js (R2 §6.2)
// ---------------------------------------------------------------------------

/**
 * Reads (and therefore settles/recomputes) a user's entitlement so any
 * expired referral bonus is reflected immediately once a session starts.
 * Deliberately synchronous and side-effect-free beyond the normal read path
 * — safe to call right after login without blocking navigation.
 */
export function settleLicenseEntitlementOnLogin(userId) {
  if (userId === undefined || userId === null || userId === "") {
    return null;
  }

  try {
    return getLicenseEntitlement(userId);
  } catch {
    // Fail soft — never let this block login.
    return null;
  }
}

// ---------------------------------------------------------------------------
// §3.2 / Admin stats — read helpers for ReferralCard / ReferralProgramSettings
// ---------------------------------------------------------------------------

/**
 * Everything ReferralCard needs for one user in a single call: their code
 * (creating it if needed), redemption usage against that code, and their
 * own current license status (as a referee, if they redeemed someone else's
 * code).
 */
export function getReferralStatsForUser(userId, displayNameForPrefix = "") {
  const codeRecord = getOrCreateReferralCode(userId, displayNameForPrefix);
  const entitlement = getLicenseEntitlement(userId);
  const usagesOfMyCode = readReferralUsages().filter(
    (usage) => String(usage.referrerUserId) === String(userId)
  );
  const myOwnRedemption = readReferralUsages().find(
    (usage) => String(usage.refereeUserId) === String(userId)
  );

  return {
    code: codeRecord?.code || "",
    redemptionCount: codeRecord?.redemptionCount || 0,
    maxRedemptions: MAX_REDEMPTIONS_PER_CODE,
    remainingRedemptions: Math.max(
      0,
      MAX_REDEMPTIONS_PER_CODE - (codeRecord?.redemptionCount || 0)
    ),
    isReferralLicenseActive: entitlement.isReferralLicenseActive,
    daysRemaining: getDaysRemaining(userId),
    referralExtensionEndDate: entitlement.referralExtensionEndDate,
    hasRedeemedACode: Boolean(myOwnRedemption),
    usagesOfMyCode
  };
}

/** Admin-wide audit view — every successful redemption, most recent first. */
export function getAllReferralUsages() {
  return [...readReferralUsages()].sort(
    (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime()
  );
}

/** Admin-wide summary numbers for the Referral Program settings screen. */
export function getReferralProgramSummary() {
  const codes = readReferralCodes();
  const usages = readReferralUsages();

  const totalDaysGranted = usages.reduce(
    (sum, usage) =>
      // sum + (usage.refereeDaysGranted || 0) + (usage.referrerDaysGranted || 0), 0
      sum + (usage.refereeDaysGranted || 0), 0
  );

  const topReferrers = [...codes]
    .filter((record) => (record.redemptionCount || 0) > 0)
    .sort((a, b) => (b.redemptionCount || 0) - (a.redemptionCount || 0))
    .slice(0, 5)
    .map((record) => ({
      userId: record.userId,
      code: record.code,
      redemptionCount: record.redemptionCount || 0
    }));

  return {
    totalCodesIssued: codes.length,
    totalRedemptions: usages.length,
    totalDaysGranted,
    topReferrers
  };
}