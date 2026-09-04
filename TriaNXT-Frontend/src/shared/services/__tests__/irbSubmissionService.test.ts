import { describe, it, expect, beforeEach } from "vitest";
import {
  createSubmission,
  getSubmission,
  getSubmissions,
  submitSubmission,
  startReview,
  recordDecision,
  resolveCondition,
  addCorrespondence,
  hasOpenConditions,
  isContinuingReviewDue,
} from "../irbSubmissionService";

describe("irbSubmissionService (M20 / spec 6.27)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a Preparing submission", () => {
    const submission = createSubmission({
      studyCode: "STDY-001",
      siteCode: "SITE-01",
      type: "Initial",
      committee: "Western IRB",
    });
    expect(submission.status).toBe("Preparing");
    expect(getSubmissions("STDY-001")).toHaveLength(1);
  });

  it("validates type and reportable-event linkage", () => {
    expect(() => createSubmission({})).toThrow(/required/);
    expect(() =>
      createSubmission({ studyCode: "S", type: "Bogus" })
    ).toThrow(/type/);
    expect(() =>
      createSubmission({ studyCode: "S", type: "Reportable event" })
    ).toThrow(/link/);
  });

  it("walks Preparing -> Submitted -> Under Review -> Approved and schedules continuing review", () => {
    const submission = createSubmission({
      studyCode: "STDY-001",
      type: "Initial",
      reviewCycleMonths: 12,
    });
    expect(submitSubmission(submission.id).status).toBe("Submitted");
    expect(startReview(submission.id).status).toBe("Under Review");

    const approved = recordDecision(submission.id, "Approved", "No concerns.");
    expect(approved.status).toBe("Approved");
    expect(approved.approvedAt).toBeTruthy();

    const due = new Date(approved.nextDueDate);
    const approval = new Date(approved.approvedAt);
    const monthsApart =
      (due.getUTCFullYear() - approval.getUTCFullYear()) * 12 +
      (due.getUTCMonth() - approval.getUTCMonth());
    expect(monthsApart).toBe(12);
    expect(isContinuingReviewDue(approved)).toBe(false);
  });

  it("guards state transitions", () => {
    const submission = createSubmission({ studyCode: "S", type: "Initial" });
    expect(() => startReview(submission.id)).toThrow(/Submitted/);
    expect(() => recordDecision(submission.id, "Approved")).toThrow(
      /Under Review/
    );
    submitSubmission(submission.id);
    expect(() => submitSubmission(submission.id)).toThrow(/Preparing/);
  });

  it("records contingent approvals with resolvable conditions", () => {
    const submission = createSubmission({ studyCode: "S", type: "Initial" });
    submitSubmission(submission.id);
    startReview(submission.id);
    const contingent = recordDecision(
      submission.id,
      "Contingent",
      "Provide updated lab normal ranges.\nConfirm temperature logger calibration."
    );
    expect(contingent.status).toBe("Contingent");
    expect(contingent.conditions).toHaveLength(2);
    expect(hasOpenConditions(contingent)).toBe(true);

    resolveCondition(submission.id, 0);
    const fresh = getSubmission(submission.id);
    expect(hasOpenConditions(fresh)).toBe(true);
    resolveCondition(submission.id, 1);
    expect(hasOpenConditions(getSubmission(submission.id))).toBe(false);
  });

  it("keeps committee correspondence on the submission", () => {
    const submission = createSubmission({ studyCode: "S", type: "Amendment" });
    submitSubmission(submission.id);
    addCorrespondence(submission.id, "Clarification requested on Section 5.2.");
    const fresh = getSubmission(submission.id);
    expect(fresh.correspondence).toHaveLength(1);
    expect(fresh.correspondence[0].message).toContain("Section 5.2");
  });

  it("links reportable events to their originating reference", () => {
    const submission = createSubmission({
      studyCode: "STDY-001",
      siteCode: "SITE-02",
      type: "Reportable event",
      linkedRef: "SAE-2026-014",
      title: "Unexpected SAE",
    });
    expect(submission.linkedRef).toBe("SAE-2026-014");
  });

  it("rejects are final and closed to correspondence", () => {
    const submission = createSubmission({ studyCode: "S", type: "Initial" });
    submitSubmission(submission.id);
    startReview(submission.id);
    const rejected = recordDecision(submission.id, "Rejected", "Out of scope.");
    expect(rejected.status).toBe("Rejected");
    expect(() => addCorrespondence(submission.id, "Appeal")).toThrow(
      /Rejected/
    );
  });
});
