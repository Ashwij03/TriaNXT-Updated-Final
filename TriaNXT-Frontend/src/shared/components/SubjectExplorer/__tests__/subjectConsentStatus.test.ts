/**
 * subjectConsentStatus - pure derivation tests.
 *
 * Seeds the icfConsentService store (`trianxtConsentIcf`) directly and
 * asserts the derived badge state per scenario - no components involved.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getSubjectConsentStatus } from "../subjectConsentStatus";

const CONSENT_KEY = "trianxtConsentIcf";

function seedStore({ versions = [], events = [], campaigns = [] } = {}) {
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ versions, events, campaigns }),
  );
}

const ACTIVE_V1 = {
  id: "ICFV-1",
  studyCode: "TNX-001",
  siteCode: "Site A",
  version: "1.0",
  status: "Active",
};

const SUPERSEDED_V1 = { ...ACTIVE_V1, status: "Superseded" };
const ACTIVE_V2 = {
  id: "ICFV-2",
  studyCode: "TNX-001",
  siteCode: "Site A",
  version: "2.0",
  status: "Active",
};

function consentEvent({ id, icfVersionId, icfVersion, date }) {
  return {
    id,
    studyCode: "TNX-001",
    siteCode: "Site A",
    subjectId: "S-1",
    icfVersionId,
    icfVersion,
    date,
    createdAt: `${date}T10:00:00.000Z`,
    createdBy: "PI",
  };
}

describe("getSubjectConsentStatus", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns not-started when there is no context", () => {
    expect(getSubjectConsentStatus("", "S-1")).toMatchObject({
      key: "not-started",
      label: "Not started",
    });
  });

  it("returns not-started when no ACTIVE ICF version exists", () => {
    seedStore({ versions: [SUPERSEDED_V1] });
    expect(getSubjectConsentStatus("TNX-001", "S-1", "Site A")).toMatchObject({
      key: "not-started",
      label: "Not started",
      tone: "muted",
    });
  });

  it("returns signed when the subject consented on the ACTIVE version", () => {
    seedStore({
      versions: [ACTIVE_V1],
      events: [
        consentEvent({
          id: "CNS-1",
          icfVersionId: ACTIVE_V1.id,
          icfVersion: ACTIVE_V1.version,
          date: "2026-01-05",
        }),
      ],
    });
    const status = getSubjectConsentStatus("TNX-001", "S-1", "Site A");
    expect(status.key).toBe("signed");
    expect(status.tone).toBe("ok");
    expect(status.detail).toContain("v1.0");
    expect(status.detail).toContain("2026-01-05");
  });

  it("returns pending when an ACTIVE version exists but no consent event", () => {
    seedStore({ versions: [ACTIVE_V1], events: [] });
    const status = getSubjectConsentStatus("TNX-001", "S-1", "Site A");
    expect(status.key).toBe("pending");
    expect(status.tone).toBe("warn");
    expect(status.detail).toContain("v1.0");
  });

  it("returns re-consent when only an older (superseded) version was signed", () => {
    seedStore({
      versions: [SUPERSEDED_V1, ACTIVE_V2],
      events: [
        consentEvent({
          id: "CNS-1",
          icfVersionId: SUPERSEDED_V1.id,
          icfVersion: SUPERSEDED_V1.version,
          date: "2026-01-05",
        }),
      ],
    });
    const status = getSubjectConsentStatus("TNX-001", "S-1", "Site A");
    expect(status.key).toBe("re-consent");
    expect(status.tone).toBe("danger");
  });

  it("returns re-consent when an open re-consent campaign targets the subject", () => {
    seedStore({
      versions: [ACTIVE_V1],
      events: [
        consentEvent({
          id: "CNS-1",
          icfVersionId: ACTIVE_V1.id,
          icfVersion: ACTIVE_V1.version,
          date: "2026-01-05",
        }),
      ],
      campaigns: [
        {
          id: "RC-1",
          studyCode: "TNX-001",
          siteCode: "Site A",
          status: "Open",
          subjects: [{ subjectId: "S-1", completedAt: null }],
        },
      ],
    });
    expect(getSubjectConsentStatus("TNX-001", "S-1", "Site A").key).toBe(
      "re-consent",
    );
  });
});
