// roleService.saveUserScope — Admin site/study scope assignment contract:
//   * trims + dedupes codes, never stores garbage/empty tokens
//   * patches the directory "users" row with scope_data
//   * mirrors onto the signed-in currentUser when the Admin edits their own
//     row (immediate effect in the frontend data layer)
//   * empty input clears the restriction (plain org scope)
//   * offline (no VITE_API_URL): local-only, no fetch attempted

import { saveUserScope } from "../roleService";

function seedUsers(records) {
  localStorage.setItem("users", JSON.stringify(records));
}

beforeEach(() => {
  localStorage.clear();
});

test("saveUserScope trims, dedupes and stores normalized codes", () => {
  seedUsers([
    {
      email: "staff@demo.com",
      role: "SiteStaff",
      name: "Site Staff",
      assignedSite: "City Hospital",
    },
  ]);

  saveUserScope(
    { email: "staff@demo.com" },
    { studies: ["TNX-001", " tnx-001 ", ""], sites: ["SITE-01", "SITE-02", "SITE-01"] }
  );

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  expect(users[0].scope_data).toEqual({
    studies: ["TNX-001", "tnx-001"],
    sites: ["SITE-01", "SITE-02"],
  });
});

test("saveUserScope mirrors onto currentUser when editing the signed-in row", () => {
  const admin = {
    email: "admin@demo.com",
    role: "Admin",
    name: "Alex Admin",
  };
  seedUsers([admin]);
  localStorage.setItem("currentUser", JSON.stringify(admin));

  saveUserScope(admin, { studies: [], sites: ["SITE-01"] });

  const current = JSON.parse(localStorage.getItem("currentUser") || "null");
  expect(current.scope_data).toEqual({ studies: [], sites: ["SITE-01"] });
});

test("saveUserScope clears the restriction with empty input", () => {
  seedUsers([
    {
      email: "pi@demo.com",
      role: "PI",
      name: "Dr. Chen",
      scope_data: { studies: ["TNX-001"], sites: ["SITE-01"] },
    },
  ]);

  saveUserScope({ email: "pi@demo.com" }, { studies: [], sites: [] });

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  expect(users[0].scope_data).toEqual({ studies: [], sites: [] });
});

test("saveUserScope is a no-op for unknown emails (never fabricates rows)", () => {
  seedUsers([{ email: "other@demo.com", role: "Sponsor", name: "Other" }]);

  const result = saveUserScope({ email: "ghost@demo.com" }, { studies: ["X"] });

  expect(result.studies).toEqual(["X"]);
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  expect(users).toHaveLength(1);
  expect(users[0].email).toBe("other@demo.com");
});
