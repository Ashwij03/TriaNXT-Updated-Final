/**
 * eConsent / ICF Version & Re-consent Service (M21 / spec 6.28)
 * =============================================================
 * Tracks which ICF version is active per site, records subject-level
 * consent events, and manages re-consent campaigns triggered by protocol
 * amendments.
 *
 * ICF version states:
 *   Draft -> Approved -> Active -> Superseded | Archived
 *
 * Business rules:
 *   - A subject cannot be Enrolled without a recorded consent event
 *     against the ACTIVE ICF version at that site (ENR-01 / 6.28).
 *   - Re-consent triggered by an amendment blocks further subject
 *     procedures until resolved, per study policy.
 *   - ICF activation is site-specific (country/site translated variants);
 *     activating a new version auto-supersedes the previous active one.
 */

import { addAuditLog } from "./auditService";
import { getEffectiveRole, getCurrentUser } from "./roleService";
import { syncGapCollection } from "./gapSync";

const CONSENT_STORAGE_KEY = "trianxtConsentIcf";

export const ICF_VERSION_STATUSES = [
  "Draft",
  "Approved",
  "Active",
  "Superseded",
  "Archived",
];

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore() {
  const empty = { versions: [], events: [], campaigns: [] };
  if (!isBrowser()) return empty;
  try {
    const parsed = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    };
  } catch {
    return empty;
  }
}

function writeStore(store) {
  if (!isBrowser()) return;
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("consent-icf-updated"));
  // FastAPI integration: mirror each collection (API mode only).
  if (Array.isArray(store.versions) && store.versions.length) {
    syncGapCollection("/api/site/icf/versions/sync", store.versions);
  }
  if (Array.isArray(store.events) && store.events.length) {
    syncGapCollection("/api/site/icf/events/sync", store.events);
  }
  if (Array.isArray(store.campaigns) && store.campaigns.length) {
    syncGapCollection("/api/site/icf/campaigns/sync", store.campaigns);
  }
}

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function actingRole() {
  try {
    return getEffectiveRole(getCurrentUser()) || "";
  } catch {
    return "";
  }
}

function stamp(obj, action) {
  const history = Array.isArray(obj.history) ? obj.history : [];
  history.push({
    action,
    at: new Date().toISOString(),
    by: actingRole() || "Unknown",
  });
  return history;
}

function siteKey(studyCode, siteCode) {
  return normalizeValue(studyCode) + "::" + normalizeValue(siteCode);
}

function findIndex(list, id) {
  return list.findIndex((item) => String(item.id) === String(id));
}

/* ------------------------------------------------------------------
   ICF versions
------------------------------------------------------------------- */

export function createIcfVersion(payload: any = {}) {
  if (!payload.studyCode || !payload.siteCode || !payload.version) {
    throw new Error("studyCode, siteCode and version are required.");
  }
  const version = {
    id: "ICFV-" + Date.now().toString(36).toUpperCase(),
    studyCode: payload.studyCode,
    siteCode: payload.siteCode,
    language: payload.language || "English",
    version: payload.version,
    amendmentId: payload.amendmentId || "",
    witnessRequired: Boolean(payload.witnessRequired),
    status: "Draft",
    approvedAt: null,
    activatedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actingRole(),
    history: [],
  };
  version.history = stamp(version, "ICF_VERSION_CREATED:v" + version.version);

  const store = readStore();
  const existing = store.versions.find(
    (v) =>
      normalizeValue(v.studyCode) === normalizeValue(payload.studyCode) &&
      normalizeValue(v.siteCode) === normalizeValue(payload.siteCode) &&
      normalizeValue(v.version) === normalizeValue(payload.version)
  );
  if (existing) {
    throw new Error("That ICF version already exists for this site.");
  }
  store.versions.push(version);
  writeStore(store);

  addAuditLog("ICF_VERSION_CREATED", {
    versionId: version.id,
    studyCode: version.studyCode,
    siteCode: version.siteCode,
    version: version.version,
    timestamp: version.createdAt,
  });
  return version;
}

export function approveIcfVersion(versionId) {
  const store = readStore();
  const index = findIndex(store.versions, versionId);
  if (index === -1) throw new Error("ICF version not found.");
  const version = store.versions[index];
  if (version.status !== "Draft") {
    throw new Error("Only Draft ICF versions can be approved.");
  }
  version.status = "Approved";
  version.approvedAt = new Date().toISOString();
  version.updatedAt = version.approvedAt;
  version.updatedBy = actingRole();
  version.history = stamp(version, "ICF_VERSION_APPROVED");
  store.versions[index] = version;
  writeStore(store);
  return version;
}

/**
 * Activate an Approved version for its site; the previously active version
 * for the same study+site is auto-superseded (retained, never deleted).
 */
export function activateIcfVersion(versionId) {
  const store = readStore();
  const index = findIndex(store.versions, versionId);
  if (index === -1) throw new Error("ICF version not found.");
  const version = store.versions[index];
  if (version.status !== "Approved") {
    throw new Error("Only Approved ICF versions can be activated.");
  }

  const key = siteKey(version.studyCode, version.siteCode);
  store.versions.forEach((candidate, i) => {
    if (
      siteKey(candidate.studyCode, candidate.siteCode) === key &&
      candidate.status === "Active"
    ) {
      store.versions[i].status = "Superseded";
      store.versions[i].updatedAt = new Date().toISOString();
      store.versions[i].history = stamp(
        store.versions[i],
        "ICF_VERSION_SUPERSEDED"
      );
    }
  });

  version.status = "Active";
  version.activatedAt = new Date().toISOString();
  version.updatedAt = version.activatedAt;
  version.updatedBy = actingRole();
  version.history = stamp(version, "ICF_VERSION_ACTIVATED");
  store.versions[index] = version;
  writeStore(store);

  addAuditLog("ICF_VERSION_ACTIVATED", {
    versionId: version.id,
    studyCode: version.studyCode,
    siteCode: version.siteCode,
    version: version.version,
    timestamp: version.activatedAt,
  });
  return version;
}

export function getIcfVersions(studyCode) {
  const store = readStore();
  if (!studyCode) return store.versions.slice();
  const key = normalizeValue(studyCode);
  return store.versions
    .filter((v) => normalizeValue(v.studyCode) === key)
    .sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
}

export function getIcfVersion(versionId) {
  if (!versionId) return null;
  return (
    readStore().versions.find((v) => String(v.id) === String(versionId)) ||
    null
  );
}

export function getActiveIcfVersion(studyCode, siteCode) {
  const key = siteKey(studyCode, siteCode);
  return (
    readStore().versions.find(
      (v) => siteKey(v.studyCode, v.siteCode) === key && v.status === "Active"
    ) || null
  );
}

/* ------------------------------------------------------------------
   Subject consent events (ENR-01 style rule)
------------------------------------------------------------------- */

export function recordConsentEvent(payload: any = {}) {
  if (!payload.studyCode || !payload.subjectId || !payload.icfVersionId) {
    throw new Error("studyCode, subjectId and icfVersionId are required.");
  }
  const store = readStore();
  const version = store.versions.find(
    (v) => String(v.id) === String(payload.icfVersionId)
  );
  if (!version) throw new Error("ICF version not found.");
  if (version.status !== "Active") {
    throw new Error(
      "Consent can only be recorded against the ACTIVE ICF version for the site."
    );
  }
  if (version.witnessRequired && !String(payload.witness || "").trim()) {
    throw new Error("A witness is required for this ICF version.");
  }

  const event = {
    id: "CNS-" + Date.now().toString(36).toUpperCase(),
    studyCode: version.studyCode,
    siteCode: version.siteCode,
    subjectId: payload.subjectId,
    icfVersionId: version.id,
    icfVersion: version.version,
    date: payload.date || new Date().toISOString().split("T")[0],
    witness: payload.witness || "",
    createdAt: new Date().toISOString(),
    createdBy: actingRole(),
  };
  store.events.push(event);
  writeStore(store);

  addAuditLog("CONSENT_EVENT_RECORDED", {
    eventId: event.id,
    studyCode: event.studyCode,
    siteCode: event.siteCode,
    subjectId: event.subjectId,
    icfVersion: version.version,
    timestamp: event.createdAt,
  });
  return event;
}

/**
 * ENR-01 / 6.28: a subject may only be enrolled after consent on the
 * ACTIVE ICF version at their site. Returns { ok, reason } so the UI can
 * surface exactly why enrollment is blocked.
 */
export function canEnrollSubject(studyCode, siteCode, subjectId) {
  const active = getActiveIcfVersion(studyCode, siteCode);
  if (!active) {
    return {
      ok: false,
      reason: "No ACTIVE ICF version exists for this site yet.",
    };
  }
  const store = readStore();
  const matchingEvent = store.events.find(
    (event) =>
      normalizeValue(event.subjectId) === normalizeValue(subjectId) &&
      normalizeValue(event.studyCode) === normalizeValue(studyCode) &&
      normalizeValue(event.icfVersionId) === normalizeValue(active.id)
  );
  if (!matchingEvent) {
    return {
      ok: false,
      reason:
        "No consent event recorded against the active ICF version v" +
        active.version +
        " for this subject.",
    };
  }
  return {
    ok: true,
    reason: "Consent confirmed on ICF v" + active.version + ".",
    eventId: matchingEvent.id,
  };
}

export function getConsentEvents(studyCode, subjectId) {
  const store = readStore();
  return store.events
    .filter(
      (event) =>
        normalizeValue(event.studyCode) === normalizeValue(studyCode) &&
        (!subjectId ||
          normalizeValue(event.subjectId) === normalizeValue(subjectId))
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/* ------------------------------------------------------------------
   Re-consent campaigns (amendment driven)
------------------------------------------------------------------- */

export function createReConsentCampaign(payload: any = {}) {
  if (!payload.studyCode || !payload.amendmentId) {
    throw new Error("studyCode and amendmentId are required for a re-consent campaign.");
  }
  if (!payload.icfVersionId) {
    throw new Error("A new active ICF version is required for re-consent.");
  }
  const version = getIcfVersion(payload.icfVersionId);
  if (!version || version.status !== "Active") {
    throw new Error("Re-consent must target an ACTIVE ICF version.");
  }
  const subjectIds = Array.isArray(payload.subjectIds)
    ? payload.subjectIds.filter(Boolean)
    : [];
  if (subjectIds.length === 0) {
    throw new Error("Add at least one affected subject.");
  }

  const campaign = {
    id: "RC-" + Date.now().toString(36).toUpperCase(),
    studyCode: payload.studyCode,
    siteCode: version.siteCode,
    amendmentId: payload.amendmentId,
    icfVersionId: version.id,
    icfVersion: version.version,
    dueDate: payload.dueDate || "",
    status: "Open",
    subjects: subjectIds.map((subjectId) => ({
      subjectId,
      completedAt: null,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actingRole(),
    history: [],
  };
  campaign.history = stamp(campaign, "RE_CONSENT_CAMPAIGN_OPENED");

  const store = readStore();
  store.campaigns.push(campaign);
  writeStore(store);

  addAuditLog("RE_CONSENT_CAMPAIGN_CREATED", {
    campaignId: campaign.id,
    studyCode: campaign.studyCode,
    amendmentId: campaign.amendmentId,
    affectedSubjects: subjectIds.length,
    timestamp: campaign.createdAt,
  });
  return campaign;
}

/** Open (pending) re-consent blocks further subject procedures per study policy. */
export function isSubjectProceduresBlocked(subjectId, studyCode) {
  const store = readStore();
  return store.campaigns.some(
    (campaign) =>
      campaign.status === "Open" &&
      normalizeValue(campaign.studyCode) === normalizeValue(studyCode) &&
      campaign.subjects.some(
        (entry) =>
          normalizeValue(entry.subjectId) === normalizeValue(subjectId) &&
          !entry.completedAt
      )
  );
}

/** Complete re-consent for one subject: records the new consent event too. */
export function completeReConsent(campaignId, subjectId) {
  const store = readStore();
  const index = findIndex(store.campaigns, campaignId);
  if (index === -1) throw new Error("Re-consent campaign not found.");
  const campaign = store.campaigns[index];
  if (campaign.status !== "Open") {
    throw new Error("Campaign is not open.");
  }
  const entry = campaign.subjects.find(
    (s) => normalizeValue(s.subjectId) === normalizeValue(subjectId)
  );
  if (!entry) throw new Error("Subject is not part of this campaign.");
  if (entry.completedAt) {
    throw new Error("Re-consent already completed for this subject.");
  }

  entry.completedAt = new Date().toISOString();
  campaign.updatedAt = entry.completedAt;
  campaign.updatedBy = actingRole();

  // Record the consent event on the campaign's ICF version as the audit
  // evidence of the re-consent.
  const event = {
    id: "CNS-" + Date.now().toString(36).toUpperCase(),
    studyCode: campaign.studyCode,
    siteCode: campaign.siteCode,
    subjectId,
    icfVersionId: campaign.icfVersionId,
    icfVersion: campaign.icfVersion,
    date: entry.completedAt.split("T")[0],
    witness: "",
    campaignId: campaign.id,
    createdAt: entry.completedAt,
    createdBy: actingRole(),
  };
  store.events.push(event);

  const allDone = campaign.subjects.every((s) => s.completedAt);
  if (allDone) campaign.status = "Completed";
  campaign.history = stamp(campaign, "RE_CONSENT_COMPLETED:" + subjectId);
  store.campaigns[index] = campaign;
  writeStore(store);

  addAuditLog("RE_CONSENT_COMPLETED", {
    campaignId: campaign.id,
    subjectId,
    timestamp: event.createdAt,
  });
  return campaign;
}

export function getReConsentCampaigns(studyCode) {
  const store = readStore();
  if (!studyCode) return store.campaigns.slice();
  const key = normalizeValue(studyCode);
  return store.campaigns
    .filter((campaign) => normalizeValue(campaign.studyCode) === key)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getReConsentCampaign(campaignId) {
  if (!campaignId) return null;
  return (
    readStore().campaigns.find((c) => String(c.id) === String(campaignId)) ||
    null
  );
}

export function subscribeConsentIcf(handler) {
  if (isBrowser() && typeof handler === "function") {
    window.addEventListener("consent-icf-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("consent-icf-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }
  return () => {};
}

const IcfConsentService = {
  ICF_VERSION_STATUSES,
  createIcfVersion,
  approveIcfVersion,
  activateIcfVersion,
  getIcfVersions,
  getIcfVersion,
  getActiveIcfVersion,
  recordConsentEvent,
  canEnrollSubject,
  getConsentEvents,
  createReConsentCampaign,
  isSubjectProceduresBlocked,
  completeReConsent,
  getReConsentCampaigns,
  getReConsentCampaign,
  subscribeConsentIcf,
};

export default IcfConsentService;
