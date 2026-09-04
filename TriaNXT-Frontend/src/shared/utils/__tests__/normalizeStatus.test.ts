import { describe, expect, it } from "vitest";
import {
  normalizeStatus,
  SUBJECT_ENROLLED_STAGES,
  isEnrolledSubjectStatus,
  isInScreeningSubjectStatus,
  isTerminalSubjectStatus,
} from "../normalizeStatus";

describe("normalizeStatus — canonical subject-stage token mapping", () => {
  it("maps every legacy token to its canonical stage", () => {
    expect(normalizeStatus("Active")).toBe("Ongoing");
    expect(normalizeStatus("Ongoing")).toBe("Ongoing");
    expect(normalizeStatus("In Progress")).toBe("Ongoing");
    expect(normalizeStatus("Randomized")).toBe("Enrolled");
    expect(normalizeStatus("Randomised")).toBe("Enrolled");
    expect(normalizeStatus("Enrolled")).toBe("Enrolled");
    expect(normalizeStatus("Screening")).toBe("Screened");
    expect(normalizeStatus("Screened")).toBe("Screened");
    expect(normalizeStatus("Completed")).toBe("Completed");
    expect(normalizeStatus("Withdrawn")).toBe("Withdrawn");
    expect(normalizeStatus("Dropout")).toBe("Dropout");
  });

  it("returns null for unmatched or empty tokens", () => {
    expect(normalizeStatus("")).toBeNull();
    expect(normalizeStatus(null)).toBeNull();
    expect(normalizeStatus(undefined)).toBeNull();
    expect(normalizeStatus("Not A Status")).toBeNull();
  });
});

describe("single subject-status contract", () => {
  it("defines enrolled stages as Enrolled/Ongoing/Completed", () => {
    expect(SUBJECT_ENROLLED_STAGES).toEqual([
      "Enrolled",
      "Ongoing",
      "Completed",
    ]);
  });

  it("counts on-study statuses as enrolled regardless of stored token", () => {
    for (const token of ["Enrolled", "Ongoing", "Completed", "Active", "Randomized"]) {
      expect(isEnrolledSubjectStatus(token)).toBe(true);
    }
  });

  it("never counts pre-enrollment or terminal statuses as enrolled", () => {
    for (const token of ["Screening", "Screened", "Withdrawn", "Dropout", "", null, undefined]) {
      expect(isEnrolledSubjectStatus(token)).toBe(false);
    }
  });

  it("treats both Screening and Screened as the pre-enrollment bucket", () => {
    expect(isInScreeningSubjectStatus("Screening")).toBe(true);
    expect(isInScreeningSubjectStatus("Screened")).toBe(true);
    expect(isInScreeningSubjectStatus("Enrolled")).toBe(false);
    expect(isInScreeningSubjectStatus("Active")).toBe(false);
  });

  it("treats Withdrawn and Dropout as terminal", () => {
    expect(isTerminalSubjectStatus("Withdrawn")).toBe(true);
    expect(isTerminalSubjectStatus("Dropout")).toBe(true);
    expect(isTerminalSubjectStatus("Enrolled")).toBe(false);
    expect(isTerminalSubjectStatus("Completed")).toBe(false);
  });
});
