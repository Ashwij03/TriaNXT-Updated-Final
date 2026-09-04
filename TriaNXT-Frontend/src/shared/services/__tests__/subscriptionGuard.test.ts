/**
 * Unit tests for subscriptionGuard
 * =================================
 *
 * Verifies the enforcement verdicts + human-readable reason strings the
 * rest of the app renders (Study-blocked / User-approval-blocked banners,
 * and the MyLicense "Currently blocking:" panel), plus the throwing
 * asserts studyService/adminService call, and getSubscriptionGuardReasons()
 * de-duplication.
 *
 * Determinism: every seed includes a server-style `usage` object so
 * getSubscriptionUsage() takes the server-usage path and never counts real
 * study/user records. Effective limits come from the seeded tier
 * (plan_professional = 10 studies / 25 users).
 */

const SUBSCRIPTION_STORAGE_KEY = "trianxtSubscription";

function seedSubscription(extra) {
  window.localStorage.setItem(
    SUBSCRIPTION_STORAGE_KEY,
    JSON.stringify({
      status: "Active",
      planId: "plan_professional",
      endDate: "2099-01-01",
      usage: { studiesUsed: 1, usersUsed: 1, studiesLimit: 10, usersLimit: 25 },
      ...extra,
    })
  );
}

function load() {
  const guard = require("../subscriptionGuard");
  const svc = require("../subscriptionService");
  return { guard, svc };
}

beforeEach(() => {
  jest.resetModules();
  window.localStorage.clear();
});

describe("canCreateStudy", () => {
  test("allows study creation while the subscription is Active and under the limit", () => {
    seedSubscription({});
    const { guard } = load();

    expect(guard.canCreateStudy()).toEqual({ allowed: true, reason: null });
  });

  test("blocks with a status reason when the subscription is Suspended", () => {
    seedSubscription({ status: "Suspended" });
    const { guard } = load();

    const verdict = guard.canCreateStudy();
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe(
      "Your subscription is Suspended. Contact your Admin."
    );
  });

  test("blocks with an Expired reason when the end date has passed", () => {
    seedSubscription({ endDate: "2020-01-01" });
    const { guard } = load();

    const verdict = guard.canCreateStudy();
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe(
      "Your subscription is Expired. Contact your Admin."
    );
  });

  test("blocks with the study-limit reason at exactly the tier limit", () => {
    seedSubscription({
      usage: { studiesUsed: 10, usersUsed: 1, studiesLimit: 10, usersLimit: 25 },
    });
    const { guard } = load();

    const verdict = guard.canCreateStudy();
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe(
      "Study limit reached (10/10 used). Contact your Admin to upgrade."
    );
  });

  test("assertCanCreateStudy throws the same reason string", () => {
    seedSubscription({ status: "Suspended" });
    const { guard } = load();

    expect(() => guard.assertCanCreateStudy()).toThrow(
      "Your subscription is Suspended. Contact your Admin."
    );
  });

  test("assertCanCreateStudy does not throw when allowed", () => {
    seedSubscription({});
    const { guard } = load();

    expect(() => guard.assertCanCreateStudy()).not.toThrow();
  });
});

describe("canApproveUser", () => {
  test("allows user approval while the subscription is Active and under the limit", () => {
    seedSubscription({});
    const { guard } = load();

    expect(guard.canApproveUser()).toEqual({ allowed: true, reason: null });
  });

  test("blocks with a status reason when the subscription is not usable", () => {
    seedSubscription({ status: "Suspended" });
    const { guard } = load();

    const verdict = guard.canApproveUser();
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe(
      "Your subscription is Suspended. Contact your Admin."
    );
  });

  test("blocks with the user-limit reason at exactly the tier limit", () => {
    seedSubscription({
      usage: { studiesUsed: 1, usersUsed: 25, studiesLimit: 10, usersLimit: 25 },
    });
    const { guard } = load();

    const verdict = guard.canApproveUser();
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe(
      "User limit reached (25/25 used). Contact your Admin to upgrade."
    );
  });

  test("assertCanApproveUser throws the same reason string", () => {
    seedSubscription({
      usage: { studiesUsed: 1, usersUsed: 25, studiesLimit: 10, usersLimit: 25 },
    });
    const { guard } = load();

    expect(() => guard.assertCanApproveUser()).toThrow(
      "User limit reached (25/25 used). Contact your Admin to upgrade."
    );
  });
});

describe("getSubscriptionGuardReasons", () => {
  test("returns [] when nothing is blocked", () => {
    seedSubscription({});
    const { guard } = load();

    expect(guard.getSubscriptionGuardReasons()).toEqual([]);
  });

  test("de-duplicates the shared status reason from both guards", () => {
    seedSubscription({ status: "Suspended" });
    const { guard } = load();

    // Both guards fail on the same non-Active status with identical text.
    expect(guard.canCreateStudy().reason).toBe(
      guard.canApproveUser().reason
    );
    expect(guard.getSubscriptionGuardReasons()).toEqual([
      "Your subscription is Suspended. Contact your Admin.",
    ]);
  });

  test("lists both distinct reasons when each guard hits its own limit", () => {
    seedSubscription({
      usage: { studiesUsed: 10, usersUsed: 25, studiesLimit: 10, usersLimit: 25 },
    });
    const { guard } = load();

    expect(guard.getSubscriptionGuardReasons()).toEqual([
      "Study limit reached (10/10 used). Contact your Admin to upgrade.",
      "User limit reached (25/25 used). Contact your Admin to upgrade.",
    ]);
  });
});
