/**
 * backendSession — best-effort FastAPI session bootstrap (API mode only)
 * ============================================================================
 * The SPA authenticates against the LOCAL user directory (localStorage
 * "users"), which never creates the FastAPI session cookie. Every API-mode
 * call (scope assignment, gap-module sync, boot hydration) therefore used
 * to run unauthenticated and silently fail. This module closes that gap:
 *
 *   * establishBackendSession(user)  POSTs /api/accounts/login/ with the
 *     signed-in user's email + the password stored in the local directory
 *     (the same credentials the demo backend is seeded with), so the
 *     browser holds a real session cookie for subsequent API calls.
 *   * clearBackendSession()          POSTs /api/accounts/logout/ so the
 *     cookie does not outlive the SPA session.
 *
 * Everything is fail-soft and additive: API mode off, an unknown user, a
 * missing stored password, or an unreachable backend all return an outcome
 * object instead of throwing, and the local-only behavior is unchanged.
 * A sessionStorage marker makes the bootstrap idempotent per tab so a page
 * reload does not log in again (no duplicate LOGIN audit rows).
 */

import { api, isApiEnabled } from "./api/client";

export interface BackendSessionResult {
  ok: boolean;
  reason?: string;
}

export const BACKEND_SESSION_MARKER = "trianxtBackendSessionFor";

export function readDirectoryUser(email: string | undefined | null) {
  if (!email) {
    return null;
  }
  try {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    return (
      (Array.isArray(users) &&
        users.find((entry: any) => entry?.email === email)) ||
      null
    );
  } catch {
    return null;
  }
}

function sessionMarkerMatches(email: string | undefined | null): boolean {
  try {
    return sessionStorage.getItem(BACKEND_SESSION_MARKER) === (email || "");
  } catch {
    return false;
  }
}

function markSessionEstablished(email: string | undefined | null) {
  try {
    if (email) {
      sessionStorage.setItem(BACKEND_SESSION_MARKER, email);
    } else {
      sessionStorage.removeItem(BACKEND_SESSION_MARKER);
    }
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * Ensure the browser holds a FastAPI session cookie for `user`.
 *
 * @param user    the signed-in frontend user ({ email, ... })
 * @param transport  injectable api-like client (tests pass a fake)
 * @param force   bypass the per-tab idempotence marker
 */
export async function establishBackendSession(
  user: any,
  transport: any = api,
  force = false
): Promise<BackendSessionResult> {
  if (!isApiEnabled()) {
    return { ok: false, reason: "api-disabled" };
  }

  const email = user?.email;
  if (!email) {
    return { ok: false, reason: "no-user" };
  }

  if (!force && sessionMarkerMatches(email)) {
    // This tab already established the session this page-load lifetime.
    return { ok: true, reason: "already-established" };
  }

  const directory = readDirectoryUser(email);
  const password = directory?.password;
  if (!password) {
    return { ok: false, reason: "no-local-password" };
  }

  try {
    await transport.post("/api/accounts/login/", { email, password });
    markSessionEstablished(email);
    return { ok: true, reason: "logged-in" };
  } catch (err: any) {
    return {
      ok: false,
      reason: err?.status === 401 ? "bad-credentials" : "unreachable",
    };
  }
}

/** Best-effort backend logout (API mode only). */
export async function clearBackendSession(
  transport: any = api
): Promise<void> {
  if (!isApiEnabled()) {
    return;
  }
  try {
    await transport.post("/api/accounts/logout/", {});
  } catch {
    // No session / backend unreachable — nothing to clear.
  } finally {
    try {
      sessionStorage.removeItem(BACKEND_SESSION_MARKER);
    } catch {
      /* ignore */
    }
  }
}
