/**
 * Amendment Service — Protocol Amendment & Impact Management (M18 / spec 6.25)
 * ============================================================================
 * Single source of truth for protocol amendment records. Persisted under
 * `trianxtAmendments` (localStorage) as a flat list so both per-study views
 * and sponsor portfolio views can read it, mirroring the localStorage
 * pattern used by studyService / financialService.
 *
 * Implements the spec state machine:
 *   Draft -> Under Assessment -> Published -> Site Rollout -> Compliant -> Closed
 *
 * and the AMD validation rules:
 *   AMD-01  Amendment cannot close while any impacted site remains non-compliant.
 *   AMD-02  Substantial amendment requires a linked IRB/IEC submission before
 *           a site implementation can be marked complete.
 *   AMD-03  Re-training assignments reference the specific amendment version.
 *
 * Every mutation is stamped (actor role via roleService, timestamp) and
 * appended to the amendment's own history plus the global audit log.
 */

import { addAuditLog } from "./auditService";
import { getEffectiveRole, getCurrentUser } from "./roleService";
import { pullGapRecords, syncGapCollection } from "./gapSync";

const AMENDMENTS_STORAGE_KEY = "trianxtAmendments";

export const AMENDMENT_STATUSES = [
  "Draft",
  "Under Assessment",
  "Published",
  "Site Rollout",
  "Compliant",
  "Closed",
];

export const AMENDMENT_CLASSIFICATIONS = [
  "Substantial",
  "Non-substantial",
  "Administrative",
];

export const SITE_IMPLEMENTATION_STATUSES = [
  "Not Started",
  "Tasks Assigned",
  "In Progress",
  "Compliant",
];

const TASK_KIND_LABELS = {
  document: "Document replacement",
  training: "Re-training",
  consent: "Re-consent",
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readAll() {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(AMENDMENTS_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(amendments) {
  if (!isBrowser()) return;
  localStorage.setItem(AMENDMENTS_STORAGE_KEY, JSON.stringify(amendments));
  window.dispatchEvent(new Event("amendments-updated"));
  // FastAPI integration: mirror the collection to the backend (API mode
  // only; fail-soft offline).
  syncGapCollection("/api/site/amendments/sync", amendments);
}

let hydratedAmendmentsFromBackend = false;

/** Pull amendments from the backend into an empty local store (once). */
export async function hydrateAmendmentsFromBackend() {
  if (hydratedAmendmentsFromBackend) {
    return;
  }
  hydratedAmendmentsFromBackend = true;
  if (!isBrowser()) {
    return;
  }
  try {
    const remote = await pullGapRecords("/api/site/amendments/");
    if (!remote || remote.length === 0) {
      return;
    }
    if (readAll().length > 0) {
      return; // keep richer local data when present
    }
    localStorage.setItem(AMENDMENTS_STORAGE_KEY, JSON.stringify(remote));
    window.dispatchEvent(new Event("amendments-updated"));
  } catch {
    // Backend unreachable — local store stands.
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

function findIndex(list, amendmentId) {
  return list.findIndex((a) => String(a.id) === String(amendmentId));
}

function stampHistory(amendment, action) {
  const history = Array.isArray(amendment.history) ? amendment.history : [];
  history.push({
    action,
    at: new Date().toISOString(),
    by: actingRole() || "Unknown",
  });
  return history;
}

/* ------------------------------------------------------------------
   Task pack generation (spec workflow steps 3-4)
------------------------------------------------------------------- */
function buildSiteTaskPack(amendment, siteCode) {
  const version = amendment.version || "";
  const tasks = [];

  if (amendment.binderUpdateRequired) {
    tasks.push({
      id: `${amendment.id}-${siteCode}-doc`,
      kind: "document",
      label:
        "Replace impacted binder/folder documents (amendment v" +
        version +
        ")",
      done: false,
      doneAt: null,
    });
  }

  if (amendment.trainingRequired) {
    // AMD-03: the re-training assignment must reference the amendment version.
    tasks.push({
      id: `${amendment.id}-${siteCode}-trn`,
      kind: "training",
      label:
        "Assign re-training to site staff for amendment v" +
        version +
        " (ref " +
        amendment.amendmentNumber +
        ")",
      done: false,
      doneAt: null,
    });
  }

  if (amendment.reConsentRequired) {
    tasks.push({
      id: `${amendment.id}-${siteCode}-cns`,
      kind: "consent",
      label: "Re-consent affected subjects (amendment v" + version + ")",
      done: false,
      doneAt: null,
    });
  }

  return tasks;
}

function buildInitialSites(amendment) {
  const sites = {};
  (amendment.impactedSiteCodes || []).forEach((siteCode) => {
    sites[siteCode] = {
      siteCode,
      status: "Not Started",
      tasks: buildSiteTaskPack(amendment, siteCode),
      complianceDate: null,
    };
  });
  return sites;
}

/* ------------------------------------------------------------------
   Lifecycle transitions
------------------------------------------------------------------- */

/**
 * Create a Draft amendment. Payload (spec 6.25 fields):
 *   studyCode, amendmentNumber (sponsor-issued ref), version,
 *   classification, effectiveDate, summary, impactedSiteCodes[],
 *   reConsentRequired, binderUpdateRequired, trainingRequired,
 *   irbSubmissionRef (optional; required later for Substantial).
 */
export function createAmendment(payload: any = {}) {
  if (!payload.studyCode || !payload.amendmentNumber || !payload.version) {
    throw new Error(
      "studyCode, amendmentNumber and version are required to create an amendment."
    );
  }
  if (!AMENDMENT_CLASSIFICATIONS.includes(payload.classification)) {
    throw new Error("A valid amendment classification is required.");
  }
  if (!payload.effectiveDate) {
    throw new Error("Effective date is required.");
  }
  if (payload.classification === "Substantial" && !payload.summary) {
    throw new Error("A summary of change is required for substantial amendments.");
  }

  const amendment = {
    id: "AMD-" + Date.now().toString(36).toUpperCase(),
    studyCode: payload.studyCode,
    amendmentNumber: payload.amendmentNumber,
    version: payload.version,
    classification: payload.classification,
    effectiveDate: payload.effectiveDate,
    summary: payload.summary || "",
    status: "Draft",
    reConsentRequired: Boolean(payload.reConsentRequired),
    binderUpdateRequired: Boolean(payload.binderUpdateRequired),
    trainingRequired: Boolean(payload.trainingRequired),
    irbSubmissionRef: payload.irbSubmissionRef || "",
    impactedSiteCodes: Array.isArray(payload.impactedSiteCodes)
      ? payload.impactedSiteCodes.slice()
      : [],
    sites: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actingRole(),
    history: [],
  };
  amendment.sites = buildInitialSites(amendment);
  amendment.history = stampHistory(amendment, "AMENDMENT_CREATED");

  const all = readAll();
  all.push(amendment);
  writeAll(all);

  addAuditLog("AMENDMENT_CREATED", {
    amendmentId: amendment.id,
    amendmentNumber: amendment.amendmentNumber,
    studyCode: amendment.studyCode,
    classification: amendment.classification,
    version: amendment.version,
    timestamp: amendment.createdAt,
  });
  return amendment;
}

export function getAmendment(amendmentId) {
  if (!amendmentId) return null;
  return readAll().find((a) => String(a.id) === String(amendmentId)) || null;
}

export function getAmendmentsByStudy(studyCode) {
  if (!studyCode) return [];
  const key = normalizeValue(studyCode);
  return readAll()
    .filter((a) => normalizeValue(a.studyCode) === key)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getAllAmendments() {
  return readAll().slice().sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  );
}

/**
 * Impact assessment (spec step 3): move Draft -> Under Assessment.
 * Kept as an explicit action so the record shows assessment state before
 * publication. Re-runnable while still in Draft/Under Assessment.
 */
export function runImpactAssessment(amendmentId) {
  const all = readAll();
  const index = findIndex(all, amendmentId);
  if (index === -1) throw new Error("Amendment not found.");

  const amendment = all[index];
  if (amendment.status !== "Draft" && amendment.status !== "Under Assessment") {
    throw new Error(
      "Impact assessment can only run while the amendment is Draft or Under Assessment."
    );
  }
  amendment.status = "Under Assessment";
  amendment.updatedAt = new Date().toISOString();
  amendment.updatedBy = actingRole();
  amendment.history = stampHistory(amendment, "IMPACT_ASSESSMENT_RUN");
  all[index] = amendment;
  writeAll(all);

  addAuditLog("AMENDMENT_IMPACT_ASSESSMENT", {
    amendmentId: amendment.id,
    amendmentNumber: amendment.amendmentNumber,
    impactedSites: amendment.impactedSiteCodes.length,
    timestamp: amendment.updatedAt,
  });
  return amendment;
}

/**
 * Publish (spec step 5/6): auto-create per-site implementation task packs and
 * move to Published (Site Rollout once any task is executed).
 */
export function publishAmendment(amendmentId) {
  const all = readAll();
  const index = findIndex(all, amendmentId);
  if (index === -1) throw new Error("Amendment not found.");

  const amendment = all[index];
  if (amendment.status !== "Draft" && amendment.status !== "Under Assessment") {
    throw new Error("Only Draft / Under Assessment amendments can be published.");
  }
  if (amendment.impactedSiteCodes.length === 0) {
    throw new Error("Publish at least one impacted site before publishing.");
  }

  amendment.status = "Published";
  amendment.updatedAt = new Date().toISOString();
  amendment.updatedBy = actingRole();
  amendment.history = stampHistory(amendment, "AMENDMENT_PUBLISHED");

  Object.keys(amendment.sites).forEach((siteCode) => {
    const site = amendment.sites[siteCode];
    site.status = site.tasks.length > 0 ? "Tasks Assigned" : "Not Started";
  });

  all[index] = amendment;
  writeAll(all);

  addAuditLog("AMENDMENT_PUBLISHED", {
    amendmentId: amendment.id,
    amendmentNumber: amendment.amendmentNumber,
    studyCode: amendment.studyCode,
    timestamp: amendment.updatedAt,
  });
  return amendment;
}

function siteTasksComplete(site) {
  const tasks = Array.isArray(site.tasks) ? site.tasks : [];
  return tasks.every((task) => task.done);
}

function recomputeAmendmentStatus(amendment) {
  const siteCodes = Object.keys(amendment.sites || {});
  if (siteCodes.length === 0) return;
  const allCompliant = siteCodes.every(
    (code) => amendment.sites[code].status === "Compliant"
  );
  const anyTaskDone = siteCodes.some((code) =>
    (amendment.sites[code].tasks || []).some((task) => task.done)
  );

  if (allCompliant && amendment.status !== "Closed") {
    amendment.status = "Compliant";
  } else if (anyTaskDone && amendment.status !== "Compliant") {
    amendment.status = "Site Rollout";
  }
}

/**
 * Complete one implementation task on a site (spec automation: task pack
 * execution drives rollout). Sets the per-site status to In Progress.
 */
export function completeSiteTask(amendmentId, siteCode, taskId) {
  const all = readAll();
  const index = findIndex(all, amendmentId);
  if (index === -1) throw new Error("Amendment not found.");

  const amendment = all[index];
  const site = amendment.sites && amendment.sites[siteCode];
  if (!site) throw new Error("Site is not part of this amendment's impact scope.");

  if (amendment.status !== "Published" && amendment.status !== "Site Rollout") {
    throw new Error(
      "Amendment must be published before implementation tasks can be completed."
    );
  }

  const task = (site.tasks || []).find((t) => String(t.id) === String(taskId));
  if (!task) throw new Error("Task not found for this site.");

  task.done = true;
  task.doneAt = new Date().toISOString();
  site.status = "In Progress";
  amendment.updatedAt = new Date().toISOString();
  amendment.updatedBy = actingRole();
  amendment.history = stampHistory(
    amendment,
    "SITE_TASK_COMPLETED:" + siteCode + ":" + task.kind
  );
  recomputeAmendmentStatus(amendment);
  all[index] = amendment;
  writeAll(all);

  addAuditLog("AMENDMENT_SITE_TASK_COMPLETED", {
    amendmentId: amendment.id,
    siteCode,
    taskKind: task.kind,
    timestamp: task.doneAt,
  });
  return amendment;
}

/**
 * Mark a site implementation Compliant. Validation:
 *  - AMD-02: a Substantial amendment needs a linked IRB/IEC submission ref.
 *  - all generated tasks (documents/training/consent) must be done.
 */
export function markSiteCompliant(amendmentId, siteCode) {
  const all = readAll();
  const index = findIndex(all, amendmentId);
  if (index === -1) throw new Error("Amendment not found.");

  const amendment = all[index];
  const site = amendment.sites && amendment.sites[siteCode];
  if (!site) throw new Error("Site is not part of this amendment's impact scope.");

  if (amendment.status !== "Published" && amendment.status !== "Site Rollout") {
    throw new Error("Amendment must be published before sites can be marked compliant.");
  }
  if (!siteTasksComplete(site)) {
    throw new Error(
      "All implementation tasks (documents / training / re-consent) must be completed for this site."
    );
  }
  // AMD-02
  if (
    amendment.classification === "Substantial" &&
    !String(amendment.irbSubmissionRef || "").trim()
  ) {
    throw new Error(
      "Substantial amendments require a linked IRB/IEC submission reference before a site can be marked compliant."
    );
  }

  site.status = "Compliant";
  site.complianceDate = new Date().toISOString();
  amendment.updatedAt = new Date().toISOString();
  amendment.updatedBy = actingRole();
  amendment.history = stampHistory(amendment, "SITE_COMPLIANT:" + siteCode);
  recomputeAmendmentStatus(amendment);
  all[index] = amendment;
  writeAll(all);

  addAuditLog("AMENDMENT_SITE_COMPLIANT", {
    amendmentId: amendment.id,
    siteCode,
    timestamp: site.complianceDate,
  });
  return amendment;
}

/**
 * Close the amendment. AMD-01: blocked while any impacted site is not
 * compliant.
 */
export function closeAmendment(amendmentId) {
  const all = readAll();
  const index = findIndex(all, amendmentId);
  if (index === -1) throw new Error("Amendment not found.");

  const amendment = all[index];
  const siteCodes = Object.keys(amendment.sites || {});
  const nonCompliant = siteCodes.filter(
    (code) => amendment.sites[code].status !== "Compliant"
  );

  // AMD-01
  if (nonCompliant.length > 0) {
    throw new Error(
      "Amendment cannot close while " +
        nonCompliant.length +
        " impacted site(s) remain non-compliant."
    );
  }

  amendment.status = "Closed";
  amendment.closedAt = new Date().toISOString();
  amendment.updatedAt = amendment.closedAt;
  amendment.updatedBy = actingRole();
  amendment.history = stampHistory(amendment, "AMENDMENT_CLOSED");
  all[index] = amendment;
  writeAll(all);

  addAuditLog("AMENDMENT_CLOSED", {
    amendmentId: amendment.id,
    amendmentNumber: amendment.amendmentNumber,
    timestamp: amendment.closedAt,
  });
  return amendment;
}

/** Draft amendments can still be withdrawn entirely (no downstream effect). */
export function deleteAmendment(amendmentId) {
  const all = readAll();
  const index = findIndex(all, amendmentId);
  if (index === -1) return false;
  const amendment = all[index];
  if (amendment.status !== "Draft") {
    throw new Error("Only Draft amendments can be deleted.");
  }
  all.splice(index, 1);
  writeAll(all);
  addAuditLog("AMENDMENT_DELETED", {
    amendmentId: amendment.id,
    amendmentNumber: amendment.amendmentNumber,
    timestamp: new Date().toISOString(),
  });
  return true;
}

/**
 * Attach/link an IRB/IEC submission reference (AMD-02 evidence) after
 * creation — used when the submission is prepared while the amendment
 * is being rolled out.
 */
export function setAmendmentIrbSubmissionRef(amendmentId, irbSubmissionRef) {
  const all = readAll();
  const index = findIndex(all, amendmentId);
  if (index === -1) throw new Error("Amendment not found.");

  const amendment = all[index];
  if (amendment.status === "Closed") {
    throw new Error("A closed amendment cannot be changed.");
  }
  amendment.irbSubmissionRef = String(irbSubmissionRef || "").trim();
  amendment.updatedAt = new Date().toISOString();
  amendment.updatedBy = actingRole();
  amendment.history = stampHistory(amendment, "IRB_SUBMISSION_REF_UPDATED");
  all[index] = amendment;
  writeAll(all);

  addAuditLog("AMENDMENT_IRB_REF_UPDATED", {
    amendmentId: amendment.id,
    amendmentNumber: amendment.amendmentNumber,
    irbSubmissionRef: amendment.irbSubmissionRef,
    timestamp: amendment.updatedAt,
  });
  return amendment;
}

/* ------------------------------------------------------------------
   Read-side helpers
------------------------------------------------------------------- */

export function getAmendmentComplianceSummary(amendment: any = {}) {
  const sites = amendment.sites || {};
  const codes = Object.keys(sites);
  const compliant = codes.filter((c) => sites[c].status === "Compliant").length;
  return {
    total: codes.length,
    compliant,
    remaining: codes.length - compliant,
    percent:
      codes.length > 0 ? Math.round((compliant / codes.length) * 100) : 0,
  };
}

export function getAmendmentDisplayName(amendment: any = {}) {
  return (
    (amendment.amendmentNumber || "Amendment") +
    " v" +
    (amendment.version || "")
  );
}

export function subscribeAmendments(handler) {
  if (isBrowser() && typeof handler === "function") {
    window.addEventListener("amendments-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("amendments-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }
  return () => {};
}

export const AMENDMENT_TASK_KIND_LABELS = TASK_KIND_LABELS;

const AmendmentService = {
  AMENDMENT_STATUSES,
  AMENDMENT_CLASSIFICATIONS,
  SITE_IMPLEMENTATION_STATUSES,

  createAmendment,
  getAmendment,
  getAmendmentsByStudy,
  getAllAmendments,
  runImpactAssessment,
  publishAmendment,
  completeSiteTask,
  markSiteCompliant,
  closeAmendment,
  setAmendmentIrbSubmissionRef,
  deleteAmendment,

  getAmendmentComplianceSummary,
  getAmendmentDisplayName,
  subscribeAmendments,
};

export default AmendmentService;
