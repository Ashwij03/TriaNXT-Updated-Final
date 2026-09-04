// NEW FILE — Dynamic Subscription & Plan Catalog System.
// Single source of truth for subscription ENFORCEMENT. Every business rule
// that blocks an action based on the license lives here and nowhere else —
// mirrors the project principle (see referralService.js's header comment on
// canonical service modules) that business rules must not be duplicated
// across files.
//
// This file has NO localStorage access of its own. It only reads through
// subscriptionService (getSubscriptionStatus / isSubscriptionUsable /
// getSubscriptionUsage / getEffectiveLimits), so there is exactly one
// storage-backed source of truth for the subscription state.
//
// Guards implemented:
//   - canCreateStudy / assertCanCreateStudy — used by
//     studyService.createStudy() to block study creation when the
//     subscription isn't Active or the study limit is already reached.
//   - canApproveUser / assertCanApproveUser — used by
//     adminService.approveSignupRequest() to block approvals when the
//     subscription isn't Active or the user limit is already reached.

import {
  getSubscriptionStatus,
  isSubscriptionUsable,
  getSubscriptionUsage,
  getEffectiveLimits,
} from "./subscriptionService";

/**
 * Can a new study be created right now? Never throws — returns a verdict
 * object so callers can render a message without try/catch.
 *
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canCreateStudy() {
  const status = getSubscriptionStatus();

  if (!isSubscriptionUsable()) {
    return {
      allowed: false,
      reason: `Your subscription is ${status}. Contact your Admin.`
    };
  }

  const { studiesUsed } = getSubscriptionUsage();
  const { maxStudies } = getEffectiveLimits();

  if (studiesUsed >= maxStudies) {
    return {
      allowed: false,
      reason: `Study limit reached (${studiesUsed}/${maxStudies} used). Contact your Admin to upgrade.`
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Throws new Error(reason) when canCreateStudy() is not allowed. Called as
 * the first line of studyService.createStudy(), so every code path that
 * creates a study — UI forms and direct service calls alike — is blocked
 * the same way, reusing the existing duplicate-study Error.display pattern.
 */
export function assertCanCreateStudy() {
  const verdict = canCreateStudy();

  if (!verdict.allowed) {
    throw new Error(verdict.reason);
  }
}

/**
 * Can a pending signup request be approved right now? Never throws.
 *
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canApproveUser() {
  const status = getSubscriptionStatus();

  if (!isSubscriptionUsable()) {
    return {
      allowed: false,
      reason: `Your subscription is ${status}. Contact your Admin.`
    };
  }

  const { usersUsed } = getSubscriptionUsage();
  const { maxUsers } = getEffectiveLimits();

  if (usersUsed >= maxUsers) {
    return {
      allowed: false,
      reason: `User limit reached (${usersUsed}/${maxUsers} used). Contact your Admin to upgrade.`
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Throws new Error(reason) when canApproveUser() is not allowed. Called
 * inside adminService.approveSignupRequest() before any user is activated,
 * so the limit/status check can never be bypassed by calling the service
 * directly.
 */
export function assertCanApproveUser() {
  const verdict = canApproveUser();

  if (!verdict.allowed) {
    throw new Error(verdict.reason);
  }
}

/**
 * Collects every guard verdict reason currently blocking work in the app,
 * de-duplicated (the non-active-status failure produces the identical
 * reason string from both guards). Returns [] when nothing is blocked.
 *
 * Used by MyLicense.js to tell a non-Admin user exactly what is being
 * blocked and why — reusing the same reason strings the guards produce
 * elsewhere in the app, never duplicating the guard logic itself.
 *
 * @returns {string[]}
 */
export function getSubscriptionGuardReasons() {
  const reasons = [];

  const studyVerdict = canCreateStudy();
  if (!studyVerdict.allowed) {
    reasons.push(studyVerdict.reason);
  }

  const userVerdict = canApproveUser();
  if (!userVerdict.allowed) {
    reasons.push(userVerdict.reason);
  }

  return reasons.filter(
    (reason, index) => reasons.indexOf(reason) === index
  );
}