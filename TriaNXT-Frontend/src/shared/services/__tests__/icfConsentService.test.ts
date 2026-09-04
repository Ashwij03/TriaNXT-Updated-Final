import { describe, it, expect, beforeEach } from "vitest";
import {
  createIcfVersion,
  approveIcfVersion,
  activateIcfVersion,
  getIcfVersions,
  getActiveIcfVersion,
  recordConsentEvent,
  canEnrollSubject,
  getConsentEvents,
  createReConsentCampaign,
  completeReConsent,
  isSubjectProceduresBlocked,
  getReConsentCampaigns,
} from "../icfConsentService";

describe("icfConsentService (M21 / spec 6.28)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function activeVersion(version = "1.0") {
    const draft = createIcfVersion({
      studyCode: "STDY-001",
      siteCode: "SITE-01",
      version,
      language: "English",
    });
    approveIcfVersion(draft.id);
    return activateIcfVersion(draft.id);
  }

  it("moves an ICF version Draft -> Approved -> Active", () => {
    const draft = createIcfVersion({
      studyCode: "STDY-001",
      siteCode: "SITE-01",
      version: "1.0",
    });
    expect(draft.status).toBe("Draft");
    expect(approveIcfVersion(draft.id).status).toBe("Approved");
    const active = activateIcfVersion(draft.id);
    expect(active.status).toBe("Active");
    expect(getActiveIcfVersion("STDY-001", "SITE-01").id).toBe(draft.id);
  });

  it("activating a new version auto-supersedes the previous active one", () => {
    activeVersion("1.0");
    const v2 = activeVersion("2.0");

    const versions = getIcfVersions("STDY-001");
    const v1 = versions.find((v) => v.version === "1.0");
    expect(v1.status).toBe("Superseded");
    expect(getActiveIcfVersion("STDY-001", "SITE-01").id).toBe(v2.id);
  });

  it("duplicate version numbers for the same site are rejected", () => {
    createIcfVersion({ studyCode: "S", siteCode: "X", version: "1.0" });
    expect(() =>
      createIcfVersion({ studyCode: "S", siteCode: "X", version: "1.0" })
    ).toThrow(/already exists/);
  });

  it("records consent only against the active version (ENR-01)", () => {
    const v1 = activeVersion("1.0");
    const event = recordConsentEvent({
      studyCode: "STDY-001",
      subjectId: "SUB-100",
      icfVersionId: v1.id,
    });
    expect(event.icfVersion).toBe("1.0");
    expect(getConsentEvents("STDY-001", "SUB-100")).toHaveLength(1);

    // Consent on a superseded version is invalid
    activeVersion("2.0");
    expect(() =>
      recordConsentEvent({
        studyCode: "STDY-001",
        subjectId: "SUB-200",
        icfVersionId: v1.id,
      })
    ).toThrow(/ACTIVE ICF version/);
  });

  it("enrollment check passes only with consent on the active version", () => {
    const v1 = activeVersion("1.0");
    const blocked = canEnrollSubject("STDY-001", "SITE-01", "SUB-100");
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain("No consent event");

    recordConsentEvent({
      studyCode: "STDY-001",
      subjectId: "SUB-100",
      icfVersionId: v1.id,
    });
    const allowed = canEnrollSubject("STDY-001", "SITE-01", "SUB-100");
    expect(allowed.ok).toBe(true);
  });

  it("requires a witness when the ICF version demands one", () => {
    const draft = createIcfVersion({
      studyCode: "STDY-001",
      siteCode: "SITE-01",
      version: "1.0",
      witnessRequired: true,
    });
    approveIcfVersion(draft.id);
    activateIcfVersion(draft.id);
    expect(() =>
      recordConsentEvent({
        studyCode: "STDY-001",
        subjectId: "SUB-1",
        icfVersionId: draft.id,
      })
    ).toThrow(/witness/);
  });

  it("creates amendment-driven re-consent campaigns and blocks procedures until complete", () => {
    const v2 = activeVersion("2.0");
    const campaign = createReConsentCampaign({
      studyCode: "STDY-001",
      amendmentId: "AMD-X",
      icfVersionId: v2.id,
      subjectIds: ["SUB-100", "SUB-200"],
    });
    expect(campaign.status).toBe("Open");
    expect(getReConsentCampaigns("STDY-001")).toHaveLength(1);
    expect(isSubjectProceduresBlocked("SUB-100", "STDY-001")).toBe(true);

    completeReConsent(campaign.id, "SUB-100");
    expect(isSubjectProceduresBlocked("SUB-100", "STDY-001")).toBe(false);
    expect(isSubjectProceduresBlocked("SUB-200", "STDY-001")).toBe(true);

    completeReConsent(campaign.id, "SUB-200");
    const fresh = getReConsentCampaigns("STDY-001")[0];
    expect(fresh.status).toBe("Completed");
    // Re-consent wrote a consent event against the new active version
    expect(getConsentEvents("STDY-001", "SUB-100")[0].icfVersion).toBe("2.0");
  });

  it("campaign creation requires an amendment and an active ICF version", () => {
    expect(() =>
      createReConsentCampaign({ studyCode: "S", subjectIds: ["SUB-1"] })
    ).toThrow(/amendmentId/);
    const draft = createIcfVersion({ studyCode: "S", siteCode: "X", version: "1.0" });
    expect(() =>
      createReConsentCampaign({
        studyCode: "S",
        amendmentId: "A1",
        icfVersionId: draft.id,
        subjectIds: ["SUB-1"],
      })
    ).toThrow(/ACTIVE ICF version/);
  });
});
