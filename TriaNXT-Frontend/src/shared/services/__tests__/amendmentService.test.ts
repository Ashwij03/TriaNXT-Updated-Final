import { describe, it, expect, beforeEach } from "vitest";
import {
  createAmendment,
  getAmendment,
  getAmendmentsByStudy,
  runImpactAssessment,
  publishAmendment,
  completeSiteTask,
  markSiteCompliant,
  closeAmendment,
  deleteAmendment,
  getAmendmentComplianceSummary,
} from "../amendmentService";

describe("amendmentService (M18 / spec 6.25)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const basePayload = {
    studyCode: "STDY-001",
    amendmentNumber: "AM-2026-01",
    version: "2.0",
    classification: "Substantial",
    effectiveDate: "2026-10-01",
    summary: "Primary endpoint visit window widened.",
    impactedSiteCodes: ["SITE-01", "SITE-02"],
    reConsentRequired: true,
    binderUpdateRequired: true,
    trainingRequired: true,
  };

  function publishedSubstantial(irbRef = "IRB-REF-9") {
    const amendment = createAmendment({ ...basePayload, irbSubmissionRef: irbRef });
    runImpactAssessment(amendment.id);
    publishAmendment(amendment.id);
    return amendment;
  }

  it("creates a Draft amendment with per-site records and consent/training/document task packs", () => {
    const amendment = createAmendment(basePayload);
    expect(amendment.status).toBe("Draft");
    expect(Object.keys(amendment.sites)).toEqual(["SITE-01", "SITE-02"]);

    const tasks = amendment.sites["SITE-01"].tasks;
    const kinds = tasks.map((task) => task.kind).sort();
    expect(kinds).toEqual(["consent", "document", "training"]);

    // AMD-03: re-training assignment references the specific amendment version
    const trainingTask = tasks.find((task) => task.kind === "training");
    expect(trainingTask.label).toContain("v2.0");
    expect(trainingTask.label).toContain("AM-2026-01");

    expect(getAmendmentsByStudy("STDY-001")).toHaveLength(1);
  });

  it("requires studyCode/amendmentNumber/version/classification/effectiveDate", () => {
    expect(() => createAmendment({})).toThrow(/required/);
    expect(() =>
      createAmendment({ ...basePayload, classification: "Major" })
    ).toThrow(/classification/);
    expect(() =>
      createAmendment({ ...basePayload, effectiveDate: "" })
    ).toThrow(/date/);
  });

  it("moves Draft -> Under Assessment -> Published and assigns site packs", () => {
    const amendment = createAmendment(basePayload);
    const assessed = runImpactAssessment(amendment.id);
    expect(assessed.status).toBe("Under Assessment");

    const published = publishAmendment(amendment.id);
    expect(published.status).toBe("Published");
    expect(published.sites["SITE-01"].status).toBe("Tasks Assigned");
    expect(published.sites["SITE-02"].status).toBe("Tasks Assigned");
  });

  it("blocks publishing without impacted sites", () => {
    const amendment = createAmendment({
      ...basePayload,
      impactedSiteCodes: [],
    });
    expect(() => publishAmendment(amendment.id)).toThrow(/impacted site/);
  });

  it("executes site tasks and rolls the amendment into Site Rollout", () => {
    const amendment = publishedSubstantial();
    const task = amendment.sites["SITE-01"].tasks[0];

    const after = completeSiteTask(amendment.id, "SITE-01", task.id);
    expect(after.sites["SITE-01"].status).toBe("In Progress");
    expect(after.status).toBe("Site Rollout");
  });

  it("blocks task completion before publication", () => {
    const amendment = createAmendment(basePayload);
    const task = amendment.sites["SITE-01"].tasks[0];
    expect(() =>
      completeSiteTask(amendment.id, "SITE-01", task.id)
    ).toThrow(/published/i);
  });

  it("blocks site compliance while any pack task is open", () => {
    const amendment = publishedSubstantial();
    expect(() => markSiteCompliant(amendment.id, "SITE-01")).toThrow(
      /All implementation tasks/
    );
  });

  it("AMD-02: substantial amendments need an IRB/IEC submission reference", () => {
    const amendment = publishedSubstantial("");
    amendment.sites["SITE-01"].tasks.forEach((task) =>
      completeSiteTask(amendment.id, "SITE-01", task.id)
    );
    expect(() => markSiteCompliant(amendment.id, "SITE-01")).toThrow(
      /IRB\/IEC submission reference/
    );
  });

  it("marks a site compliant once tasks are done and IRB ref is set", () => {
    const amendment = publishedSubstantial("IRB-REF-9");
    amendment.sites["SITE-01"].tasks.forEach((task) =>
      completeSiteTask(amendment.id, "SITE-01", task.id)
    );
    const compliant = markSiteCompliant(amendment.id, "SITE-01");
    expect(compliant.sites["SITE-01"].status).toBe("Compliant");
    expect(compliant.sites["SITE-01"].complianceDate).toBeTruthy();
  });

  it("AMD-01: cannot close while any impacted site remains non-compliant", () => {
    const amendment = publishedSubstantial();
    amendment.sites["SITE-01"].tasks.forEach((task) =>
      completeSiteTask(amendment.id, "SITE-01", task.id)
    );
    markSiteCompliant(amendment.id, "SITE-01");

    expect(() => closeAmendment(amendment.id)).toThrow(/remain non-compliant/);
    expect(getAmendmentComplianceSummary(getAmendment(amendment.id))).toEqual({
      total: 2,
      compliant: 1,
      remaining: 1,
      percent: 50,
    });
  });

  it("closes once every impacted site is compliant and rolls header state", () => {
    const amendment = publishedSubstantial();
    ["SITE-01", "SITE-02"].forEach((siteCode) => {
      amendment.sites[siteCode].tasks.forEach((task) =>
        completeSiteTask(amendment.id, siteCode, task.id)
      );
      markSiteCompliant(amendment.id, siteCode);
    });

    const closed = closeAmendment(amendment.id);
    expect(closed.status).toBe("Closed");
    expect(closed.closedAt).toBeTruthy();
  });

  it("only allows Draft amendments to be deleted", () => {
    const amendment = createAmendment(basePayload);
    expect(deleteAmendment(amendment.id)).toBe(true);
    expect(getAmendment(amendment.id)).toBeNull();

    const published = publishedSubstantial();
    expect(() => deleteAmendment(published.id)).toThrow(/Draft/);
  });

  it("keeps an auditable history of every transition", () => {
    const amendment = createAmendment(basePayload);
    runImpactAssessment(amendment.id);
    publishAmendment(amendment.id);
    const fresh = getAmendment(amendment.id);
    const actions = fresh.history.map((entry) => entry.action);
    expect(actions).toContain("AMENDMENT_CREATED");
    expect(actions).toContain("IMPACT_ASSESSMENT_RUN");
    expect(actions).toContain("AMENDMENT_PUBLISHED");
    expect(actions.every((entry) => typeof entry === "string")).toBe(true);
  });
});
