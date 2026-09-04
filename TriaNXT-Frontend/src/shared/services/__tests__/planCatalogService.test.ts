/**
 * Unit tests for planCatalogService
 * ==================================
 *
 * Covers:
 *   - Fallback (localStorage) mode: lazy default-tier seeding, plan reads
 *     (byId / default), create/update/delete business rules (duplicate
 *     names, single-default promotion, deleting the in-use / default /
 *     last plan), normalized shapes, and the PLAN_CATALOG_UPDATED_EVENT
 *     wiring on every write.
 *   - API mode (isApiEnabled() === true): the exact /billing/plans/*
 *     endpoint each CRUD op maps to, cache refresh after writes, and
 *     server rejection surfacing (e.g. a 409 duplicate name) with the
 *     local cache left untouched.
 *
 * The services hold module-level caches, so every test starts from a fresh
 * module registry (jest.resetModules) + cleared localStorage.
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

const PLAN_CATALOG_STORAGE_KEY = "planCatalog";

function load() {
  const client = require("../api/client");
  const svc = require("../planCatalogService");
  return { client, svc };
}

beforeEach(() => {
  jest.resetModules();
  window.localStorage.clear();
});

describe("default catalog seeding (fallback mode)", () => {
  test("first read seeds Basic / Professional / Enterprise", () => {
    const { svc } = load();
    const catalog = svc.getPlanCatalog();

    expect(catalog.map((plan) => plan.name)).toEqual([
      "Basic",
      "Professional",
      "Enterprise",
    ]);
    expect(catalog.map((plan) => plan.id)).toEqual([
      "plan_basic",
      "plan_professional",
      "plan_enterprise",
    ]);
  });

  test("Basic is the single default tier", () => {
    const { svc } = load();
    expect(svc.getDefaultPlan().id).toBe("plan_basic");

    const defaults = svc.getPlanCatalog().filter((plan) => plan.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("plan_basic");
  });

  test("an existing stored catalog is never overwritten by the seed", () => {
    window.localStorage.setItem(
      PLAN_CATALOG_STORAGE_KEY,
      JSON.stringify([
        { id: "plan_custom", name: "Custom", price: 99, isDefault: true },
      ])
    );

    const { svc } = load();
    expect(svc.getPlanCatalog()).toHaveLength(1);
    expect(svc.getPlanCatalog()[0].name).toBe("Custom");
  });
});

describe("plan reads", () => {
  test("getPlanById resolves a tier by id and returns null for unknowns", () => {
    const { svc } = load();
    expect(svc.getPlanById("plan_enterprise").name).toBe("Enterprise");
    expect(svc.getPlanById("plan_does_not_exist")).toBeNull();
    expect(svc.getPlanById("")).toBeNull();
    expect(svc.getPlanById(null)).toBeNull();
  });

  test("getDefaultPlan falls back to the first tier if no default flag exists", () => {
    window.localStorage.setItem(
      PLAN_CATALOG_STORAGE_KEY,
      JSON.stringify([
        { id: "plan_a", name: "A", price: 0, isDefault: false },
        { id: "plan_b", name: "B", price: 10, isDefault: false },
      ])
    );

    const { svc } = load();
    expect(svc.getDefaultPlan().id).toBe("plan_a");
  });
});

describe("createPlan (fallback mode)", () => {
  test("creates a normalized tier with a stable slug id and dispatches the event", async () => {
    const { svc } = load();
    svc.getPlanCatalog(); // warm the cache so the seed write precedes the listener

    const handler = jest.fn();
    window.addEventListener(svc.PLAN_CATALOG_UPDATED_EVENT, handler);

    const created = await svc.createPlan({
      name: "Research Plus",
      price: "1299",
      maxStudies: "50",
      maxUsers: "100",
      storageLimitGb: "500",
      features: "Bigger studies, Priority support",
    });

    expect(created).toMatchObject({
      id: "plan_research-plus",
      name: "Research Plus",
      price: 1299,
      maxStudies: 50,
      maxUsers: 100,
      storageLimitGb: 500,
      features: ["Bigger studies", "Priority support"],
    });
    expect(svc.getPlanCatalog()).toHaveLength(4);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(svc.PLAN_CATALOG_UPDATED_EVENT, handler);
  });

  test("rejects a duplicate plan name (same message as the server 409)", async () => {
    const { svc } = load();

    await expect(
      svc.createPlan({ name: "Professional", price: 100 })
    ).rejects.toThrow("A plan with this name already exists.");
  });

  test("rejects a blank plan name", async () => {
    const { svc } = load();
    await expect(svc.createPlan({ name: "   " })).rejects.toThrow(
      "Plan name is required."
    );
  });

  test("marking a new tier as default demotes every other tier", async () => {
    const { svc } = load();
    await svc.createPlan({ name: "Enterprise Max", price: 5000, isDefault: true });

    const defaults = svc.getPlanCatalog().filter((plan) => plan.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe("Enterprise Max");
  });
});

describe("updatePlan (fallback mode)", () => {
  test("merges updates, keeps the id, and normalizes", async () => {
    const { svc } = load();
    const updated = await svc.updatePlan("plan_professional", {
      name: "Professional Plus",
      price: 599,
    });

    expect(updated.id).toBe("plan_professional"); // id immutable
    expect(updated.name).toBe("Professional Plus");
    expect(updated.price).toBe(599);
    // Untouched fields survive the merge.
    expect(updated.maxStudies).toBe(10);
  });

  test("ignores a caller-supplied id (the id is the stable reference)", async () => {
    const { svc } = load();
    const updated = await svc.updatePlan("plan_basic", {
      id: "plan_hacked",
      price: 25,
    });

    expect(updated.id).toBe("plan_basic");
    expect(svc.getPlanById("plan_hacked")).toBeNull();
  });

  test("rejects a rename that collides with another tier", async () => {
    const { svc } = load();
    await expect(
      svc.updatePlan("plan_basic", { name: "Enterprise" })
    ).rejects.toThrow("A plan with this name already exists.");
  });

  test("rejects an unknown plan id", async () => {
    const { svc } = load();
    await expect(
      svc.updatePlan("plan_ghost", { name: "Ghost" })
    ).rejects.toThrow("Plan not found.");
  });

  test("promoting a tier to default demotes the current default", async () => {
    const { svc } = load();
    await svc.updatePlan("plan_enterprise", { isDefault: true });

    const defaults = svc.getPlanCatalog().filter((plan) => plan.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("plan_enterprise");
  });
});

describe("deletePlan (fallback mode)", () => {
  test("deletes an unused tier and dispatches the event", async () => {
    const { svc } = load();
    svc.getPlanCatalog(); // warm the cache so the seed write precedes the listener

    const handler = jest.fn();
    window.addEventListener(svc.PLAN_CATALOG_UPDATED_EVENT, handler);

    await expect(svc.deletePlan("plan_enterprise")).resolves.toBe(true);

    expect(svc.getPlanCatalog()).toHaveLength(2);
    expect(svc.getPlanById("plan_enterprise")).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(svc.PLAN_CATALOG_UPDATED_EVENT, handler);
  });

  test("blocks deleting the last remaining plan", async () => {
    window.localStorage.setItem(
      PLAN_CATALOG_STORAGE_KEY,
      JSON.stringify([{ id: "plan_only", name: "Only", price: 0, isDefault: true }])
    );

    const { svc } = load();
    await expect(svc.deletePlan("plan_only")).rejects.toThrow(
      "At least one plan must remain in the catalog."
    );
    expect(svc.getPlanCatalog()).toHaveLength(1);
  });

  test("rejects an unknown plan id", async () => {
    const { svc } = load();
    await expect(svc.deletePlan("plan_ghost")).rejects.toThrow(
      "Plan not found."
    );
  });

  test("blocks deleting the plan the active subscription references", async () => {
    // Seed a subscription on Basic, then require the subscription service so
    // deletePlan's lazy require resolves the same registry instance.
    window.localStorage.setItem(
      "trianxtSubscription",
      JSON.stringify({ status: "Active", planId: "plan_basic" })
    );

    const { svc } = load();
    require("../subscriptionService");

    await expect(svc.deletePlan("plan_basic")).rejects.toThrow(
      "This plan is currently assigned to your active subscription and cannot be deleted."
    );
    // No silent deletion happened.
    expect(svc.getPlanById("plan_basic")).not.toBeNull();
  });
});

describe("API mode (isApiEnabled === true)", () => {
  test("refreshPlanCatalogFromApi pulls GET /billing/plans/ into the cache", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.get.mockResolvedValue({
      plans: [{ id: "plan_srv", name: "Server Tier", price: 99, isDefault: true }],
    });

    const handler = jest.fn();
    window.addEventListener(svc.PLAN_CATALOG_UPDATED_EVENT, handler);

    const catalog = await svc.refreshPlanCatalogFromApi();

    expect(client.api.get).toHaveBeenCalledWith("/billing/plans/");
    expect(catalog).toHaveLength(1);
    expect(svc.getPlanCatalog()).toHaveLength(1);
    expect(svc.getDefaultPlan().id).toBe("plan_srv");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(svc.PLAN_CATALOG_UPDATED_EVENT, handler);
  });

  test("refreshPlanCatalogFromApi skips the fetch without an auth token", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.getAuthToken.mockReturnValue(null);

    const local = svc.getPlanCatalog();
    const result = await svc.refreshPlanCatalogFromApi();

    expect(client.api.get).not.toHaveBeenCalled();
    expect(result).toEqual(local);
  });

  test("refreshPlanCatalogFromApi is a no-op in fallback mode", async () => {
    const { client, svc } = load();
    const local = svc.getPlanCatalog();

    const result = await svc.refreshPlanCatalogFromApi();

    expect(client.api.get).not.toHaveBeenCalled();
    expect(result).toEqual(local);
  });

  test("createPlan POSTs /billing/plans/ and appends the server record", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.post.mockResolvedValue({
      id: "plan_created",
      name: "Created",
      price: "250",
      maxStudies: 20,
      maxUsers: 50,
      storageLimitGb: 200,
      features: ["A", "B"],
      isDefault: false,
    });

    const created = await svc.createPlan({ name: "Created", price: 250 });

    expect(client.api.post).toHaveBeenCalledWith("/billing/plans/", {
      name: "Created",
      price: 250,
    });
    expect(created.price).toBe(250); // normalized to a number
    expect(svc.getPlanCatalog()).toHaveLength(4);
    expect(svc.getPlanById("plan_created")).not.toBeNull();
  });

  test("createPlan surfaces a server 409 (duplicate name) and keeps the cache intact", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    svc.getPlanCatalog(); // warm the cache (3 seeded tiers)

    client.api.post.mockRejectedValue(
      new Error("A plan with this name already exists.")
    );

    await expect(
      svc.createPlan({ name: "Professional", price: 100 })
    ).rejects.toThrow("A plan with this name already exists.");

    expect(svc.getPlanCatalog()).toHaveLength(3); // nothing appended locally
  });

  test("updatePlan PUTs /billing/plans/:id/ and replaces the cached record", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    client.api.put.mockResolvedValue({
      id: "plan_professional",
      name: "Professional",
      price: 599,
      maxStudies: 10,
      maxUsers: 25,
      storageLimitGb: 100,
      features: [],
      isDefault: false,
    });

    const updated = await svc.updatePlan("plan_professional", { price: 599 });

    expect(client.api.put).toHaveBeenCalledWith(
      "/billing/plans/plan_professional/",
      { price: 599 }
    );
    expect(updated.price).toBe(599);
    expect(svc.getPlanById("plan_professional").price).toBe(599);
  });

  test("deletePlan DELETEs /billing/plans/:id/ and removes the cached record", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    svc.getPlanCatalog();

    await svc.deletePlan("plan_enterprise");

    expect(client.api.delete).toHaveBeenCalledWith(
      "/billing/plans/plan_enterprise/"
    );
    expect(svc.getPlanById("plan_enterprise")).toBeNull();
  });

  test("deletePlan surfaces a server 409 (in-use plan) with no local mutation", async () => {
    const { client, svc } = load();
    client.isApiEnabled.mockReturnValue(true);
    svc.getPlanCatalog();

    client.api.delete.mockRejectedValue(
      new Error("This plan is currently assigned to an active subscription.")
    );

    await expect(svc.deletePlan("plan_basic")).rejects.toThrow(
      "This plan is currently assigned to an active subscription."
    );
    expect(svc.getPlanById("plan_basic")).not.toBeNull();
  });
});
