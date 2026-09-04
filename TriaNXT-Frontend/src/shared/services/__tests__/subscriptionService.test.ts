/**
 * Unit tests for subscriptionService
 * ===================================
 *
 * Covers both modes of the API / fallback split:
 *   - Fallback (localStorage) mode: default-subscription seeding, plan
 *     assignment (free tier resets the license window, overrides cleared),
 *     updateSubscription / saveSubscription alias, effective-limits
 *     resolution, computed status (Active/Suspended/Expired), usage
 *     snapshots (server-usage preferred, client fallback), and the
 *     SUBSCRIPTION_UPDATED_EVENT wiring on every write.
 *   - API mode (isApiEnabled() === true): the exact /billing/... endpoint
 *     + payload each write maps to, { subscription, usage } response
 *     normalization, no-token pre-fetch skipping, cache refresh after
 *     writes, and server error propagation.
 *
 * The services hold module-level caches, so every test starts from a fresh
 * module registry (jest.resetModules) + cleared localStorage and requires
 * the services inside the test.
 */

jest.mock("../api/client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  isApiEnabled: jest.fn(() => false),
  getAuthToken: jest.fn(() => "test-token"),
}));

jest.mock("../studyService", () => ({ getStudies: jest.fn(() => []) }));
jest.mock("../adminService", () => ({ getUsers: jest.fn(() => []) }));

const SUBSCRIPTION_STORAGE_KEY = "trianxtSubscription";

function load() {
  const client = require("../api/client");
  const study = require("../studyService");
  const admin = require("../adminService");
  const svc = require("../subscriptionService");
  return { client, study, admin, svc };
}

beforeEach(() => {
  jest.resetModules();
  window.localStorage.clear();
});

describe("fresh-install seeding (fallback mode)", () => {
  test("first read seeds an Active subscription with a ~30-day license window", () => {
    const { svc } = load();

    const subscription = svc.getSubscription();

    expect(subscription.status).toBe("Active");
    expect(subscription.autoRenewal).toBe(true);
    // plan/planId/limits intentionally absent — resolved against the catalog
    expect(subscription.planId).toBeUndefined();

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilEnd = (new Date(subscription.endDate) - new Date()) / msPerDay;
    expect(daysUntilEnd).toBeGreaterThan(29);
    expect(daysUntilEnd).toBeLessThan(32);
  });

  test("the seed is persisted so a second read returns the stored record", () => {
    const { svc } = load();
    const first = svc.getSubscription();

    const stored = JSON.parse(
      window.localStorage.getItem(SUBSCRIPTION_STORAGE_KEY)
    );
    expect(stored).toEqual(first);
  });

  test("a previously stored subscription wins over the default seed", () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({
        status: "Suspended",
        planId: "plan_professional",
        endDate: "2099-01-01",
        notes: "comped by sales",
      })
    );

    const { svc } = load();
    expect(svc.getSubscription().status).toBe("Suspended");
    expect(svc.getSubscription().planId).toBe("plan_professional");
    expect(svc.getSubscription().notes).toBe("comped by sales");
  });

  test("corrupt stored JSON falls back to a fresh seed", () => {
    window.localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, "{not json");

    const { svc } = load();
    expect(svc.getSubscription().status).toBe("Active");
  });
});

describe("assignPlanWithoutPayment (fallback mode)", () => {
  test("assigning a paid tier records planId/plan and keeps the end date", async () => {
    const { svc } = load();
    const before = svc.getSubscription();

    const updated = await svc.assignPlanWithoutPayment("plan_professional");

    expect(updated.planId).toBe("plan_professional");
    expect(updated.plan).toBe("Professional");
    expect(updated.endDate).toBe(before.endDate); // paid tier: window untouched
  });

  test("assigning the free default tier restarts the 30-day free window", async () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ status: "Active", endDate: "2099-01-01" })
    );

    const { svc } = load();
    const updated = await svc.assignPlanWithoutPayment("plan_basic");

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilEnd = (new Date(updated.endDate) - new Date()) / msPerDay;
    expect(daysUntilEnd).toBeGreaterThan(29);
    expect(daysUntilEnd).toBeLessThan(32);
  });

  test("assigning a tier clears numeric overrides so limits fall back to the tier", async () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({
        status: "Active",
        planId: "plan_enterprise",
        maxStudies: 500,
        maxUsers: 100,
        storageLimitGb: 250,
      })
    );

    const { svc } = load();
    const updated = await svc.assignPlanWithoutPayment("plan_professional");

    expect(updated.maxStudies).toBeUndefined();
    expect(updated.maxUsers).toBeUndefined();
    expect(updated.storageLimitGb).toBeUndefined();
    expect(svc.getEffectiveLimits()).toEqual({
      maxStudies: 10,
      maxUsers: 25,
      storageLimitGb: 100,
    });
  });

  test("dispatches SUBSCRIPTION_UPDATED_EVENT on every successful assign", async () => {
    const { svc } = load();
    svc.getSubscription();

    const handler = jest.fn();
    window.addEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);

    await svc.assignPlanWithoutPayment("plan_professional");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      key: SUBSCRIPTION_STORAGE_KEY,
    });
    window.removeEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);
  });

  test("re-assigning the current plan still succeeds (idempotent)", async () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ status: "Active", planId: "plan_basic" })
    );

    const { svc } = load();
    const updated = await svc.assignPlanWithoutPayment("plan_basic");
    expect(updated.planId).toBe("plan_basic");
  });
});

describe("updateSubscription / saveSubscription alias (fallback mode)", () => {
  test("updateSubscription merges status/dates/notes/auto-renewal edits", async () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({
        status: "Active",
        planId: "plan_professional",
        endDate: "2099-01-01",
        autoRenewal: true,
      })
    );

    const { svc } = load();
    const updated = await svc.updateSubscription({
      status: "Suspended",
      autoRenewal: false,
      notes: "payment failed",
    });

    expect(updated.status).toBe("Suspended");
    expect(updated.autoRenewal).toBe(false);
    expect(updated.notes).toBe("payment failed");
    expect(updated.planId).toBe("plan_professional"); // untouched fields kept
  });

  test("saveSubscription is a thin alias of updateSubscription", async () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ status: "Active" })
    );

    const { svc } = load();
    const result = await svc.saveSubscription({ status: "Expired" });
    expect(result.status).toBe("Expired");
  });
});

describe("getEffectiveLimits / getActivePlan", () => {
  test("limits are inherited from the tier when no overrides are set", () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ status: "Active", planId: "plan_enterprise" })
    );

    const { svc } = load();
    expect(svc.getEffectiveLimits()).toEqual({
      maxStudies: 999999,
      maxUsers: 999999,
      storageLimitGb: 1000,
    });
  });

  test("explicit overrides win; blank overrides fall back to the tier", () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({
        status: "Active",
        planId: "plan_professional",
        maxStudies: 4,
        maxUsers: "",
      })
    );

    const { svc } = load();
    expect(svc.getEffectiveLimits()).toEqual({
      maxStudies: 4, // explicit override wins
      maxUsers: 25, // blank override -> tier default
      storageLimitGb: 100,
    });
  });

  test("a missing/unknown planId falls back to the catalog default tier", () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ status: "Active", planId: "plan_gone" })
    );

    const { svc } = load();
    const plan = svc.getActivePlan();
    expect(plan.id).toBe("plan_basic");
    expect(plan.isDefault).toBe(true);
  });

  test("getActivePlan resolves a legacy subscription with no planId", () => {
    const { svc } = load();
    svc.getSubscription(); // seed: no planId

    expect(svc.getActivePlan().id).toBe("plan_basic");
  });
});

describe("getSubscriptionStatus / isSubscriptionUsable", () => {
  const withSubscription = (extra) =>
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ status: "Active", endDate: "2099-01-01", ...extra })
    );

  test("Active + future end date is usable", () => {
    withSubscription({});
    const { svc } = load();
    expect(svc.getSubscriptionStatus()).toBe("Active");
    expect(svc.isSubscriptionUsable()).toBe(true);
  });

  test("Suspended always reports Suspended even with a future end date", () => {
    withSubscription({ status: "Suspended" });
    const { svc } = load();
    expect(svc.getSubscriptionStatus()).toBe("Suspended");
    expect(svc.isSubscriptionUsable()).toBe(false);
  });

  test("a past end date computes as Expired regardless of stored status", () => {
    withSubscription({ endDate: "2020-01-01" });
    const { svc } = load();
    expect(svc.getSubscriptionStatus()).toBe("Expired");
    expect(svc.isSubscriptionUsable()).toBe(false);
  });

  test("a missing stored status defaults to Active", () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ endDate: "2099-01-01" })
    );
    const { svc } = load();
    expect(svc.getSubscriptionStatus()).toBe("Active");
  });
});

describe("getSubscriptionUsage", () => {
  test("prefers the server-computed usage object when present", () => {
    window.localStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({
        status: "Active",
        planId: "plan_professional",
        usage: { studiesUsed: 7, studiesLimit: 10, usersUsed: 25, usersLimit: 25 },
      })
    );

    const { svc, study } = load();
    // Even if local counts disagree, the server numbers are authoritative.
    study.getStudies.mockReturnValue([{ id: "s1" }, { id: "s2" }]);

    expect(svc.getSubscriptionUsage()).toEqual({
      studiesUsed: 7,
      usersUsed: 25,
      studiesLimit: 10,
      usersLimit: 25,
      storageLimitGb: 0,
      studiesPercent: 70,
      usersPercent: 100,
    });
  });

  test("computes usage client-side from study/user services otherwise", () => {
    const { svc, study, admin } = load();
    svc.getSubscription();

    study.getStudies.mockReturnValue([
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
    ]);
    admin.getUsers.mockReturnValue([
      { id: "u1", accountStatus: "Active" },
      { id: "u2", accountStatus: "Active" },
      { id: "u3", accountStatus: "Pending" },
    ]);

    // Seed subscription on the default Basic tier (3 studies / 5 users).
    expect(svc.getSubscriptionUsage()).toEqual({
      studiesUsed: 3,
      usersUsed: 2,
      studiesLimit: 3,
      usersLimit: 5,
      storageLimitGb: 10,
      studiesPercent: 100, // clamped at 100
      usersPercent: 40,
    });
  });
});

describe("API mode (isApiEnabled === true)", () => {
  test("refreshSubscriptionFromApi pulls /billing/subscription/me/ and normalizes the wrapper", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.get.mockResolvedValue({
      subscription: {
        status: "Active",
        planId: "plan_enterprise",
        endDate: "2099-01-01",
      },
      usage: { studiesUsed: 2, studiesLimit: 999999, usersUsed: 5, usersLimit: 999999 },
    });

    const handler = jest.fn();
    window.addEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);

    const next = await svc.refreshSubscriptionFromApi();

    expect(client.api.get).toHaveBeenCalledWith("/billing/subscription/me/");
    expect(next.planId).toBe("plan_enterprise");
    expect(handler).toHaveBeenCalledTimes(1);

    // Server usage is stashed and preferred by the usage snapshot.
    expect(svc.getSubscriptionUsage().studiesUsed).toBe(2);

    // The cache + localStorage mirror were refreshed.
    expect(svc.getSubscription().planId).toBe("plan_enterprise");
    expect(
      JSON.parse(window.localStorage.getItem(SUBSCRIPTION_STORAGE_KEY)).planId
    ).toBe("plan_enterprise");
    window.removeEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);
  });

  test("refreshSubscriptionFromApi skips the fetch when no auth token exists", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.getAuthToken.mockReturnValue(null);

    const local = svc.getSubscription();
    const result = await svc.refreshSubscriptionFromApi();

    expect(client.api.get).not.toHaveBeenCalled();
    expect(result).toEqual(local);
  });

  test("refreshSubscriptionFromApi is a no-op in fallback mode", async () => {
    const { client, svc } = load();
    const local = svc.getSubscription();

    const result = await svc.refreshSubscriptionFromApi();

    expect(client.api.get).not.toHaveBeenCalled();
    expect(result).toEqual(local);
  });

  test("a failed pre-fetch rejects with the server error (error surfacing)", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.get.mockRejectedValue(new Error("Billing service unavailable"));

    await expect(svc.refreshSubscriptionFromApi()).rejects.toThrow(
      "Billing service unavailable"
    );
  });

  test("assignPlanWithoutPayment POSTs /billing/subscription/assign/ with planId", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.post.mockResolvedValue({
      subscription: { status: "Active", planId: "plan_enterprise" },
    });

    await svc.assignPlanWithoutPayment("plan_enterprise");

    expect(client.api.post).toHaveBeenCalledWith(
      "/billing/subscription/assign/",
      { planId: "plan_enterprise" }
    );
    expect(svc.getSubscription().planId).toBe("plan_enterprise");
  });

  test("assignPlanWithoutPayment surfaces server rejections and leaves state untouched", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    svc.getSubscription(); // seed local state first

    client.api.post.mockRejectedValue(
      new Error("Cannot assign a deactivated plan.")
    );

    await expect(
      svc.assignPlanWithoutPayment("plan_deactivated")
    ).rejects.toThrow("Cannot assign a deactivated plan.");

    // No local change happened (cache still the seeded record).
    expect(svc.getSubscription().planId).toBeUndefined();
  });

  test("updateSubscription PATCHes /billing/subscription/me/ with the field edits", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.patch.mockResolvedValue({
      subscription: { status: "Suspended", notes: "late payment" },
    });

    const updated = await svc.updateSubscription({
      status: "Suspended",
      notes: "late payment",
    });

    expect(client.api.patch).toHaveBeenCalledWith(
      "/billing/subscription/me/",
      { status: "Suspended", notes: "late payment" }
    );
    expect(updated.status).toBe("Suspended");
  });

  test("initiateCheckout POSTs /billing/subscription/checkout/ with planId", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.post.mockResolvedValue({
      gatewayOrderId: "order_1",
      amount: 49900,
      currency: "INR",
      gatewayKey: "key_1",
      paymentTransactionId: "txn_1",
    });

    const checkout = await svc.initiateCheckout("plan_professional");

    expect(client.api.post).toHaveBeenCalledWith(
      "/billing/subscription/checkout/",
      { planId: "plan_professional" }
    );
    expect(checkout.gatewayOrderId).toBe("order_1");
  });

  test("confirmPayment POSTs the gateway payload then refreshes from the server", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.post.mockResolvedValue({ ok: true });
    client.api.get.mockResolvedValue({
      subscription: { status: "Active", planId: "plan_enterprise" },
    });

    const handler = jest.fn();
    window.addEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);

    const payload = {
      paymentTransactionId: "txn_1",
      gatewayPaymentId: "pay_abc",
      gatewaySignature: "sig_xyz",
    };
    const next = await svc.confirmPayment(payload);

    expect(client.api.post).toHaveBeenCalledWith(
      "/billing/subscription/confirm/",
      payload
    );
    // Post-confirm wiring: subscription re-pulled + event fired so open
    // MyLicense pages live-refresh without extra work.
    expect(client.api.get).toHaveBeenCalledWith("/billing/subscription/me/");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(next.planId).toBe("plan_enterprise");
    window.removeEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);
  });
});

describe("demo checkout path (fallback mode)", () => {
  test("initiateCheckout returns a clearly-marked simulated payload", async () => {
    const { svc } = load();

    const checkout = await svc.initiateCheckout("plan_professional");

    expect(checkout.demo).toBe(true);
    expect(checkout.amount).toBe(49900);
    expect(checkout.currency).toBe("INR");
    expect(checkout.gatewayOrderId).toMatch(/^demo_order_/);
    expect(checkout.paymentTransactionId).toMatch(/^demo_txn_/);
  });

  test("confirmPayment applies the remembered demo plan locally", async () => {
    const { svc } = load();
    svc.rememberCheckoutPlan("plan_enterprise");

    const handler = jest.fn();
    window.addEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);

    const updated = await svc.confirmPayment({
      paymentTransactionId: "demo_txn_1",
      gatewayPaymentId: "demo_payment_success",
      gatewaySignature: "demo_signature",
    });

    expect(updated.planId).toBe("plan_enterprise");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(svc.SUBSCRIPTION_UPDATED_EVENT, handler);
  });
});
