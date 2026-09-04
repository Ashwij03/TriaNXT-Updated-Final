/**
 * Per-user scope_data code filtering (backend parity) contract:
 *   * a record carrying an explicit study/site CODE outside the user's
 *     assigned scope codes is never surfaced (studies and subjects)
 *   * records with no explicit code stay visible (org-level, like the
 *     backend NULL study/site columns)
 *   * Admin / users without scope_data are unrestricted
 *   * getAllSubjects (subjectService) and getAccessibleStudies (roleService)
 *     apply the restriction to their presentation reads
 */
import { describe, expect, it, beforeEach } from "vitest";

import {
  getUserScopeRestrictions,
  restrictStudiesToUserScope,
  restrictSubjectsToUserScope,
  getAccessibleStudies,
} from "../roleService";
import { getAllSubjects } from "../subjectService";

const ADMIN = { id: 1, email: "admin@demo.com", role: "Admin" };
const SPONSOR = {
  id: 2,
  email: "sponsor@demo.com",
  role: "Sponsor",
  name: "Sam Sponsor",
  scope_data: { studies: ["TNX-001"], sites: [] },
};
const SITE_STAFF = {
  id: 3,
  email: "staff@demo.com",
  role: "SiteStaff",
  scope_data: { studies: [], sites: ["SITE-01"] },
};
const PI = {
  id: 4,
  email: "pi@demo.com",
  role: "PI",
  scope_data: { studies: ["TNX-002"], sites: ["SITE-02"] },
};
const NO_SCOPE = { id: 5, email: "plain@demo.com", role: "Sponsor", name: "Plain" };

const STUDIES = [
  { code: "TNX-001", name: "Alpha", sponsor: "" },
  { code: "TNX-002", name: "Beta", sponsor: "" },
  { code: "", name: "No code study", sponsor: "" },
];

const SUBJECTS = [
  { subjectId: "S-1", studyId: "TNX-001", status: "Enrolled" },
  { subjectId: "S-2", studyId: "TNX-002", status: "Enrolled" },
  { subjectId: "S-3", studyId: "TNX-001", siteCode: "SITE-01", status: "Screened" },
  { subjectId: "S-4", studyId: "TNX-001", siteCode: "SITE-99", status: "Enrolled" },
];

beforeEach(() => {
  localStorage.clear();
});

describe("getUserScopeRestrictions", () => {
  it("returns empty restrictions for Admin (wildcard)", () => {
    expect(getUserScopeRestrictions(ADMIN)).toEqual({ studies: [], sites: [] });
  });

  it("normalizes codes from scope_data for scoped users", () => {
    expect(getUserScopeRestrictions(SPONSOR)).toEqual({
      studies: ["TNX-001"],
      sites: [],
    });
    expect(getUserScopeRestrictions(PI)).toEqual({
      studies: ["TNX-002"],
      sites: ["SITE-02"],
    });
  });

  it("returns empty restrictions when scope_data is absent", () => {
    expect(getUserScopeRestrictions(NO_SCOPE)).toEqual({ studies: [], sites: [] });
  });
});

describe("restrictStudiesToUserScope", () => {
  it("returns the same list for Admin and unscoped users", () => {
    expect(restrictStudiesToUserScope(STUDIES, ADMIN)).toHaveLength(3);
    expect(restrictStudiesToUserScope(STUDIES, NO_SCOPE)).toHaveLength(3);
    expect(restrictStudiesToUserScope(STUDIES, undefined)).toHaveLength(3);
  });

  it("hides studies whose code is outside the assigned study scope", () => {
    const visible = restrictStudiesToUserScope(STUDIES, SPONSOR);
    expect(visible.map((s) => s.code).sort()).toEqual(["", "TNX-001"]);
  });

  it("hides studies whose explicit site code is outside the assigned site scope", () => {
    const withSites = [
      { code: "TNX-001", siteCode: "SITE-01" },
      { code: "TNX-002", siteCode: "SITE-02" },
      { code: "TNX-003" }, // no explicit site code — org-level, stays visible
    ];
    const visible = restrictStudiesToUserScope(withSites, SITE_STAFF);
    expect(visible.map((s) => s.code).sort()).toEqual(["TNX-001", "TNX-003"]);
  });

  it("applies study AND site scope together", () => {
    const withSites = [
      { code: "TNX-002", siteCode: "SITE-02" },
      { code: "TNX-002", siteCode: "SITE-01" },
      { code: "TNX-001", siteCode: "SITE-02" },
    ];
    const visible = restrictStudiesToUserScope(withSites, PI);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toEqual({ code: "TNX-002", siteCode: "SITE-02" });
  });
});

describe("restrictSubjectsToUserScope", () => {
  it("returns the same list for Admin and unscoped users", () => {
    expect(restrictSubjectsToUserScope(SUBJECTS, ADMIN)).toHaveLength(4);
    expect(restrictSubjectsToUserScope(SUBJECTS, NO_SCOPE)).toHaveLength(4);
  });

  it("hides subject rows whose study is outside the study scope", () => {
    const visible = restrictSubjectsToUserScope(SUBJECTS, SPONSOR);
    expect(visible.map((s) => s.subjectId).sort()).toEqual(["S-1", "S-3", "S-4"]);
  });

  it("hides subject rows with an explicit out-of-scope site code", () => {
    const visible = restrictSubjectsToUserScope(SUBJECTS, SITE_STAFF);
    // S-4 has siteCode SITE-99 (not SITE-01); rows without a site code stay.
    expect(visible.map((s) => s.subjectId).sort()).toEqual(["S-1", "S-2", "S-3"]);
  });

  it("applies study AND site scope together", () => {
    const visible = restrictSubjectsToUserScope(SUBJECTS, PI);
    expect(visible.map((s) => s.subjectId)).toEqual(["S-2"]);
  });
});

describe("integration with the presentation readers", () => {
  function seedStore() {
    localStorage.setItem(
      "users",
      JSON.stringify([ADMIN, SPONSOR, SITE_STAFF, PI, NO_SCOPE])
    );
    localStorage.setItem(
      "trianxtStudies",
      JSON.stringify([
        { code: "TNX-001", name: "Alpha", status: "Recruitment Phase" },
        { code: "TNX-002", name: "Beta", status: "Recruitment Phase" },
      ])
    );
    localStorage.setItem(
      "subjectsByStudy",
      JSON.stringify({
        "TNX-001": [
          { id: "S-1", subjectId: "S-1", studyId: "TNX-001", status: "Enrolled" },
        ],
        "TNX-002": [
          { id: "S-2", subjectId: "S-2", studyId: "TNX-002", status: "Enrolled" },
        ],
      })
    );
  }

  it("getAllSubjects excludes out-of-scope studies for a scoped Sponsor", () => {
    seedStore();
    localStorage.setItem("currentUser", JSON.stringify(SPONSOR));

    const rows = getAllSubjects();
    expect(rows.map((r) => r.studyId)).toEqual(["TNX-001"]);
  });

  it("getAllSubjects stays unscoped for an unscoped Sponsor", () => {
    seedStore();
    localStorage.setItem("currentUser", JSON.stringify(NO_SCOPE));

    const rows = getAllSubjects();
    expect(rows.map((r) => r.studyId).sort()).toEqual(["TNX-001", "TNX-002"]);
  });

  it("getAccessibleStudies excludes out-of-scope studies for a scoped Sponsor", () => {
    seedStore();
    localStorage.setItem("currentUser", JSON.stringify(SPONSOR));

    const studies = getAccessibleStudies();
    expect(studies.map((s) => s.code)).toEqual(["TNX-001"]);
  });

  it("getAccessibleStudies stays unscoped for an Admin", () => {
    seedStore();
    localStorage.setItem("currentUser", JSON.stringify(ADMIN));

    const studies = getAccessibleStudies();
    expect(studies.map((s) => s.code).sort()).toEqual(["TNX-001", "TNX-002"]);
  });
});
