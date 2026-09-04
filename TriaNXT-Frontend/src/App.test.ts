import { formatUserDisplayName } from "./shared/services/roleService";

describe("formatUserDisplayName", () => {
  test("adds Dr. prefix for PI users without duplicating it", () => {
    expect(
      formatUserDisplayName({ role: "PI", firstName: "Ram", lastName: "K" }),
    ).toBe("Dr. Ram K");

    expect(formatUserDisplayName({ role: "PI", name: "Dr. Ram K" })).toBe(
      "Dr. Ram K",
    );
  });

  test("does not add a doctor prefix for non-PI users", () => {
    expect(
      formatUserDisplayName({
        role: "Admin",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).toBe("Ada Lovelace");
  });
});
