/**
 * Regression tests for the Studies-count fix: `getStudiesDashboard()` must
 * derive subject/enrollment numbers from the live subject store (canonical
 * statuses) instead of the static `study.enrolled` record field, which is
 * never bumped on subject registration and therefore reads 0/stale.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getStudiesDashboard } from "../dashboardService";
import { writeSubjectsByStudy } from "../subjectService";

const ADMIN_USER = {
  role: "Admin",
  email: "admin@test.local",
  username: "admin",
  isSuperuser: true,
  isStaff: true,
};

function seedUser() {
  localStorage.setItem("currentUser", JSON.stringify(ADMIN_USER));
}

function seedStudies() {
  localStorage.setItem(
    "trianxtStudies",
    JSON.stringify([
      {
        code: "STUDY-A",
        name: "Study Alpha",
        enrolled: 0, // stale cached count — must NOT be trusted
        targetSubjects: 10,
      },
      {
        code: "STUDY-B",
        name: "Study Beta",
        enrolled: 0, // stale cached count — must NOT be trusted
        targetSubjects: 5,
      },
    ]),
  );
}

function seedSubjects() {
  writeSubjectsByStudy({
    "STUDY-A": [
      { id: "S-1", subjectId: "S-1", status: "Enrolled" },
      { id: "S-2", subjectId: "S-2", status: "Ongoing" },
      { id: "S-3", subjectId: "S-3", status: "Screened" },
      { id: "S-4", subjectId: "S-4", status: "Withdrawn" },
    ],
    "STUDY-B": [
      { id: "S-5", subjectId: "S-5", status: "Enrolled" },
    ],
  });
}

describe("getStudiesDashboard enrollment counts", () => {
  beforeEach(() => {
    localStorage.clear();
    seedUser();
    seedStudies();
    seedSubjects();
  });

  it("counts subjects live (canonical enrolled) instead of stale study.enrolled", () => {
    const data = getStudiesDashboard();

    // STUDY-A has Enrolled + Ongoing (2 enrolled), STUDY-B has 1.
    expect(data.kpis.subjects).toBe(3);

    const studyA = data.studies.find((s) => s.studyId === "STUDY-A");
    const studyB = data.studies.find((s) => s.studyId === "STUDY-B");
    expect(studyA.subjects).toBe(2);
    expect(studyA.totalSubjects).toBe(4); // all subjects incl. Screened/Withdrawn
    expect(studyB.subjects).toBe(1);
  });

  it("feeds the trend and distribution from live counts (no index+4 filler)", () => {
    const data = getStudiesDashboard();

    expect(data.studyDistribution.find((s) => s.name === "Study Alpha").value).toBe(2);
    expect(data.studyDistribution.find((s) => s.name === "Study Beta").value).toBe(1);

    const trend = data.enrollmentTrend;
    expect(trend[0].value).toBe(2); // would have been 4 under the old index+4 filler
    expect(trend[1].value).toBe(1);
  });

  it("does not count screened/withdrawn subjects as enrolled", () => {
    const data = getStudiesDashboard();
    const studyA = data.studies.find((s) => s.studyId === "STUDY-A");
    expect(studyA.subjects).toBe(2); // S-1 (Enrolled) + S-2 (Ongoing) only
  });
});
