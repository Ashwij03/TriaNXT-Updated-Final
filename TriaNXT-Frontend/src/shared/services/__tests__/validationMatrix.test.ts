/**
 * RBAC route-guard validation matrix (headless). Mirrors the sign-off
 * criteria in RBAC_Implementation_Prompt.md Section 5 / 6:
 *
 *   * every role can open its own dashboard and the pages its menus link to,
 *   * shared/data-scoped modules stay open to every role,
 *   * role-specific pages are blocked for everyone else (deny-by-default),
 *   * unknown/unregistered paths never render (redirect instead),
 *   * param-route prefixes used by detail pages stay reachable.
 *
 * The route-access map lives in roleService (single source of truth used by
 * ProtectedRoute); this suite exercises canAccessRoute exactly the way the
 * router does, per role.
 */
import { describe, it, expect } from "vitest";
import {
  canAccessRoute,
  getDashboardPath,
} from "../roleService";
import { getRoleExtraMenuItems } from "../../constants/roleMenus";
import ROLES from "../../constants/roles";

type Role = string;

const ALL_ROLES: Role[] = [
  ROLES.ADMIN,
  ROLES.SITE_STAFF,
  ROLES.PI,
  ROLES.CRO,
  ROLES.SPONSOR,
];

const FAKE_USER = (role: Role) => ({ role, id: 1, name: role });

// [route, roles allowed] — pages reachable from the app.
const EXPECTED_ALLOWED: [string, Role[]][] = [
  ["/site-staff-dashboard", [ROLES.SITE_STAFF, ROLES.PI]],
  ["/pi-dashboard", [ROLES.PI]],
  ["/cro-dashboard", [ROLES.CRO]],
  ["/sponsor-dashboard", [ROLES.SPONSOR]],
  ["/user-management", [ROLES.ADMIN, ROLES.SITE_STAFF]],
  ["/permission-approval", [ROLES.ADMIN, ROLES.SITE_STAFF]],
  ["/portfolio", [ROLES.SPONSOR]],
  ["/monitoring", [ROLES.CRO]],
  ["/pi-subjects-dashboard", [ROLES.PI]],
  ["/safety", [ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR]],
  ["/ai-review", [ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR]],
  ["/amendments", ALL_ROLES],
  ["/studies", ALL_ROLES],
  ["/subjects", ALL_ROLES],
  ["/irb-submissions", ALL_ROLES],
  ["/vendor-management", ALL_ROLES],
];

// [route, roles allowed] — every role NOT listed here must be blocked
// (deny-by-default; matches roleService.routeAccess verbatim).
const EXPECTED_BLOCKED: [string, Role[]][] = [
  ["/user-management", [ROLES.ADMIN, ROLES.SITE_STAFF]],
  ["/cro-dashboard", [ROLES.CRO]],
  ["/pi-dashboard", [ROLES.PI]],
  ["/portfolio", [ROLES.SPONSOR]],
  ["/pi-subjects-dashboard", [ROLES.PI]],
  ["/safety", [ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR]],
  ["/monitoring", [ROLES.CRO]],
];

describe("route-guard matrix (headless, all roles)", () => {
  it.each(EXPECTED_ALLOWED)("opens %s for its allowed roles", (route, roles) => {
    for (const role of roles) {
      expect(canAccessRoute(route, FAKE_USER(role))).toBe(true);
    }
  });

  it.each(EXPECTED_BLOCKED)("blocks %s for every role without access", (route, allowed) => {
    // Admin is the system-wide wildcard (validation A1) and is asserted
    // separately below — never part of a must-block set.
    const mustBlock = ALL_ROLES.filter(
      (r) => r !== ROLES.ADMIN && !allowed.includes(r),
    );
    expect(mustBlock.length).toBeGreaterThan(0);
    for (const role of mustBlock) {
      expect(canAccessRoute(route, FAKE_USER(role))).toBe(false);
    }
  });

  it("grants Admin wildcard access to every registered page (validation A1)", () => {
    const admin = FAKE_USER(ROLES.ADMIN);
    for (const [route] of EXPECTED_ALLOWED) {
      expect(canAccessRoute(route, admin)).toBe(true);
    }
    for (const [route] of EXPECTED_BLOCKED) {
      expect(canAccessRoute(route, admin)).toBe(true);
    }
  });

  it("gives every role its own dashboard path and grants access to it", () => {
    const expected = {
      [ROLES.ADMIN]: "/admin-dashboard",
      [ROLES.SITE_STAFF]: "/site-staff-dashboard",
      [ROLES.PI]: "/pi-dashboard",
      [ROLES.CRO]: "/cro-dashboard",
      [ROLES.SPONSOR]: "/sponsor-dashboard",
    };
    for (const role of ALL_ROLES) {
      const dash = getDashboardPath(role);
      expect(dash).toBe(expected[role]);
      expect(canAccessRoute(dash, FAKE_USER(role))).toBe(true);
    }
  });

  it("opens every extra menu item for its owning role", () => {
    for (const role of ALL_ROLES) {
      const extras = getRoleExtraMenuItems(role) || [];
      for (const item of extras) {
        expect(canAccessRoute(item.path, FAKE_USER(role))).toBe(true);
      }
    }
  });

  it("denies unknown/unregistered paths to every non-admin role (G2)", () => {
    for (const role of ALL_ROLES.filter((r) => r !== ROLES.ADMIN)) {
      expect(canAccessRoute("/definitely-not-a-page", FAKE_USER(role))).toBe(false);
    }
    // Admin keeps wildcard access (validation A1).
    expect(canAccessRoute("/definitely-not-a-page", FAKE_USER(ROLES.ADMIN))).toBe(true);
  });

  it("keeps dynamic detail-page prefixes reachable for every role", () => {
    for (const role of ALL_ROLES) {
      for (const path of [
        "/study/TNX-001",
        "/subject/TNX-001/S-1001",
        "/study-dashboard/TNX-001",
        "/visit-details/V-1",
      ]) {
        expect(canAccessRoute(path, FAKE_USER(role))).toBe(true);
      }
    }
  });

  it("treats an authenticated user without a role as denied", () => {
    expect(canAccessRoute("/studies", FAKE_USER(undefined as never))).toBe(false);
  });
});
