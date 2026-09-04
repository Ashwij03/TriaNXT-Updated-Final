/**
 * Unit tests for subscriptionFormat (shared subscription display helpers)
 * ======================================================================
 *
 * formatPrice / formatLimit are the single source of truth the plan cards,
 * picker, payment summary, and both license pages import. getPlanCtaLabel
 * encodes the My License Subscribe / Upgrade Plan / Change Plan button
 * rules (§2 of the subscription spec).
 */

const {
  formatPrice,
  formatLimit,
  getPlanCtaLabel,
} = require("../subscriptionFormat");

describe("formatPrice", () => {
  test("zero renders as Free", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice("0")).toBe("Free");
  });

  test("paid amounts render as '$<amount> / month'", () => {
    expect(formatPrice(499)).toBe("$499 / month");
    expect(formatPrice("1999")).toBe("$1,999 / month");
  });

  test("missing/garbage input degrades to Free", () => {
    expect(formatPrice(undefined)).toBe("Free");
    expect(formatPrice(null)).toBe("Free");
    expect(formatPrice("abc")).toBe("Free");
  });
});

describe("formatLimit", () => {
  test("values at or above the unlimited sentinel render as 'Unlimited'", () => {
    expect(formatLimit(999999)).toBe("Unlimited");
    expect(formatLimit(1000000)).toBe("Unlimited");
  });

  test("ordinary numbers render as their plain numeric value", () => {
    expect(formatLimit(3)).toBe(3);
    expect(formatLimit(0)).toBe(0);
    expect(formatLimit(100)).toBe(100);
  });

  test("a custom sentinel is honored", () => {
    expect(formatLimit(100, 50)).toBe("Unlimited");
    expect(formatLimit(49, 50)).toBe(49);
  });
});

describe("getPlanCtaLabel", () => {
  const basic = { id: "plan_basic", price: 0 };
  const professional = { id: "plan_professional", price: 499 };
  const enterprise = { id: "plan_enterprise", price: 1999 };
  const catalog = [basic, professional, enterprise];

  test("any non-Active status labels the button Subscribe", () => {
    expect(getPlanCtaLabel("Suspended", professional, catalog)).toBe("Subscribe");
    expect(getPlanCtaLabel("Expired", professional, catalog)).toBe("Subscribe");
    expect(getPlanCtaLabel("Pending", basic, catalog)).toBe("Subscribe");
  });

  test("Active with a higher-priced tier available labels it Upgrade Plan", () => {
    expect(getPlanCtaLabel("Active", basic, catalog)).toBe("Upgrade Plan");
    expect(getPlanCtaLabel("Active", professional, catalog)).toBe("Upgrade Plan");
  });

  test("Active on the top tier (or with no higher tier) labels it Change Plan", () => {
    expect(getPlanCtaLabel("Active", enterprise, catalog)).toBe("Change Plan");
  });

  test("an empty catalog never offers Upgrade Plan", () => {
    expect(getPlanCtaLabel("Active", professional, [])).toBe("Change Plan");
  });

  test("a missing current plan degrades to Change Plan, never Upgrade Plan", () => {
    expect(getPlanCtaLabel("Active", null, catalog)).toBe("Change Plan");
  });

  test("a higher-priced tier of the SAME price never counts as an upgrade", () => {
    const samePriceHigher = { id: "plan_other", price: 499 };
    expect(getPlanCtaLabel("Active", professional, [professional, samePriceHigher])).toBe("Change Plan");
  });
});
