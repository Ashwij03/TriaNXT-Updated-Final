/**
 * Unit tests for referralService's same-organization / same-pincode
 * redemption guard (fail-closed) — the anti-abuse rule that blocks a
 * user from redeeming a code owned by someone at the same organization
 * and location as them.
 *
 * Covers the exact matrix from the feature spec:
 *   - Same org + same pincode            -> blocked
 *   - Same org + differing known pincodes -> allowed (different site)
 *   - Different org                      -> always allowed, pincode irrelevant
 *   - Same org + missing pincode on either side -> blocked (fail-closed;
 *     only reachable via pre-pincode legacy accounts seeded directly)
 *
 * Determinism: seeds the "users" localStorage array directly (the same
 * key Register.js writes and adminService.getUsers() reads), exactly like
 * the manual in-browser test procedure.
 */

const USERS_KEY = "users";

function seedUsers(users) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function userRecord(id, organizationName, pincode) {
  return {
    id,
    email: `user${id}@example.com`,
    name: `User ${id}`,
    // Register.js keeps organizationName/orgType/assignedSite in sync.
    organizationName,
    orgType: organizationName,
    assignedSite: organizationName,
    pincode,
  };
}

function load() {
  // Fresh module graph per test so referralService re-reads storage keys.
  return require("../referralService");
}

function redeemBetween(referrerOrg, referrerPincode, refereeOrg, refereePincode) {
  const service = load();
  const referrer = userRecord(101, referrerOrg, referrerPincode);
  const referee = userRecord(202, refereeOrg, refereePincode);

  seedUsers([referrer, referee]);

  const { code } = service.getOrCreateReferralCode(referrer.id, referrer.name);
  return service.redeemReferralCode(referee.id, code);
}

beforeEach(() => {
  jest.resetModules();
  window.localStorage.clear();
});

describe("same-organization / same-pincode guard (Step 3b)", () => {
  test("blocks same organization with the same pincode", () => {
    const result = redeemBetween("Org A", "500001", "Org A", "500001");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("same_organization_referral");
  });

  test("allows same organization with two known, differing pincodes", () => {
    const result = redeemBetween("Org A", "500001", "Org A", "600002");

    expect(result.ok).toBe(true);
  });

  test("allows a different organization regardless of matching pincodes", () => {
    const result = redeemBetween("Org A", "500001", "Org B", "500001");

    expect(result.ok).toBe(true);
  });

  test("allows a different organization with differing pincodes", () => {
    const result = redeemBetween("Org A", "500001", "Org B", "600002");

    expect(result.ok).toBe(true);
  });

  test("fail-closed: blocks same organization when both pincodes are missing (legacy accounts)", () => {
    const result = redeemBetween("Org A", "", "Org A", "");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("same_organization_referral");
  });

  test("fail-closed: blocks same organization when the referrer's pincode is missing", () => {
    const result = redeemBetween("Org A", "", "Org A", "500001");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("same_organization_referral");
  });

  test("fail-closed: blocks same organization when the referee's pincode is missing", () => {
    const result = redeemBetween("Org A", "500001", "Org A", "");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("same_organization_referral");
  });

  test("missing pincodes never block a different-organization redemption", () => {
    const result = redeemBetween("Org A", "", "Org B", "");

    expect(result.ok).toBe(true);
  });

  test("a blocked redemption writes nothing (no usage record, no count increment, no grant)", () => {
    const service = load();
    const referrer = userRecord(101, "Org A", "500001");
    const referee = userRecord(202, "Org A", "500001");

    seedUsers([referrer, referee]);

    const { code } = service.getOrCreateReferralCode(referrer.id, referrer.name);
    const result = service.redeemReferralCode(referee.id, code);

    expect(result.ok).toBe(false);

    expect(JSON.parse(window.localStorage.getItem("referralUsages") || "[]")).toEqual([]);
    expect(
      JSON.parse(window.localStorage.getItem("licenseEntitlements") || "[]")
    ).toEqual([]);

    const [codeRecord] = JSON.parse(window.localStorage.getItem("referralCodes") || "[]");
    expect(codeRecord.redemptionCount).toBe(0);
  });
});
