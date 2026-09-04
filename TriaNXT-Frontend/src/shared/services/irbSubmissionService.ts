/**
 * IRB / IEC Submission & Continuing Review Service (M20 / spec 6.27)
 * ==================================================================
 * Tracks the full ethics-committee interaction lifecycle per study/site,
 * beyond storing the approval PDF:
 *
 *   Preparing -> Submitted -> Under Review -> Approved | Contingent | Rejected
 *   (Approved -> Continuing Review Due when the next cycle date passes)
 *
 * Key business rules:
 *   - A site cannot be marked activation-ready while it has an open,
 *     unresolved IRB condition (contingent approval).
 *   - Continuing-review due dates are calculated from the prior approval
 *     date + the committee-specific review cycle (months).
 *   - Reportable-event submissions are linked to their originating
 *     Finding / SAE reference.
 *   - Submission history reconstructs the full committee correspondence.
 */

import { addAuditLog } from "./auditService";
import { getEffectiveRole, getCurrentUser } from "./roleService";
import { pullGapRecords, syncGapCollection } from "./gapSync";

const IRB_STORAGE_KEY = "trianxtIrbSubmissions";

export const IRB_TYPES = [
  "Initial",
  "Amendment",
  "Continuing Review",
  "Reportable event",
];

export const IRB_STATUSES = [
  "Preparing",
  "Submitted",
  "Under Review",
  "Approved",
  "Contingent",
  "Rejected",
];

const DEFAULT_REVIEW_CYCLE_MONTHS = 12;

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore() {
  if (!isBrowser()) return { submissions: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(IRB_STORAGE_KEY));
    return {
      submissions: Array.isArray(parsed && parsed.submissions)
        ? parsed.submissions
        : [],
    };
  } catch {
    return { submissions: [] };
  }
}

function writeStore(store) {
  if (!isBrowser()) return;
  localStorage.setItem(IRB_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("irb-submissions-updated"));
  // FastAPI integration: mirror submissions to the backend (API mode only).
  syncGapCollection("/api/site/irb/sync", store.submissions);
}

let hydratedIrbFromBackend = false;

/** Pull IRB submissions from the backend into an empty local store (once). */
export async function hydrateIrbFromBackend() {
  if (hydratedIrbFromBackend) {
    return;
  }
  hydratedIrbFromBackend = true;
  if (!isBrowser()) {
    return;
  }
  try {
    const remote = await pullGapRecords("/api/site/irb/");
    if (!remote || remote.length === 0) {
      return;
    }
    if (readStore().submissions.length > 0) {
      return;
    }
    localStorage.setItem(IRB_STORAGE_KEY, JSON.stringify({ submissions: remote }));
    window.dispatchEvent(new Event("irb-submissions-updated"));
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

function findIndex(list, submissionId) {
  return list.findIndex((s) => String(s.id) === String(submissionId));
}

function stampHistory(submission, action) {
  const history = Array.isArray(submission.history) ? submission.history : [];
  history.push({
    action,
    at: new Date().toISOString(),
    by: actingRole() || "Unknown",
  });
  return history;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString();
}

/* ------------------------------------------------------------------
   Lifecycle
------------------------------------------------------------------- */

export function createSubmission(payload: any = {}) {
  if (!payload.studyCode || !payload.type) {
    throw new Error("studyCode and submission type are required.");
  }
  if (!IRB_TYPES.includes(payload.type)) {
    throw new Error("A valid submission type is required.");
  }
  if (payload.type === "Reportable event" && !payload.linkedRef) {
    throw new Error(
      "Reportable-event submissions must link the originating Finding / SAE reference."
    );
  }

  const now = new Date().toISOString();
  const submission = {
    id: "IRB-" + Date.now().toString(36).toUpperCase(),
    studyCode: payload.studyCode,
    siteCode: payload.siteCode || "",
    type: payload.type,
    title: payload.title || "",
    committee: payload.committee || "",
    linkedRef: payload.linkedRef || "",
    status: "Preparing",
    submittedAt: null,
    approvedAt: null,
    nextDueDate: null,
    reviewCycleMonths:
      Number(payload.reviewCycleMonths) || DEFAULT_REVIEW_CYCLE_MONTHS,
    conditions: [], // { text, resolved, resolvedAt }
    correspondence: [], // { date, from, message }
    outcomeNote: "",
    createdAt: now,
    updatedAt: now,
    updatedBy: actingRole(),
    history: [
      {
        action: "IRB_SUBMISSION_CREATED",
        at: now,
        by: actingRole() || "Unknown",
      },
    ],
  };

  const store = readStore();
  store.submissions.push(submission);
  writeStore(store);

  addAuditLog("IRB_SUBMISSION_CREATED", {
    submissionId: submission.id,
    studyCode: submission.studyCode,
    type: submission.type,
    timestamp: submission.createdAt,
  });
  return submission;
}

export function getSubmission(submissionId) {
  if (!submissionId) return null;
  return (
    readStore().submissions.find(
      (s) => String(s.id) === String(submissionId)
    ) || null
  );
}

export function getSubmissions(studyCode) {
  const store = readStore();
  if (!studyCode) return store.submissions.slice();
  const key = normalizeValue(studyCode);
  return store.submissions
    .filter((s) => normalizeValue(s.studyCode) === key)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getAllSubmissions() {
  return readStore()
    .submissions.slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** Preparing -> Submitted. */
export function submitSubmission(submissionId) {
  const store = readStore();
  const index = findIndex(store.submissions, submissionId);
  if (index === -1) throw new Error("Submission not found.");
  const submission = store.submissions[index];
  if (submission.status !== "Preparing") {
    throw new Error("Only Preparing submissions can be submitted.");
  }
  submission.status = "Submitted";
  submission.submittedAt = new Date().toISOString();
  submission.updatedAt = submission.submittedAt;
  submission.updatedBy = actingRole();
  submission.history = stampHistory(submission, "IRB_SUBMITTED");
  store.submissions[index] = submission;
  writeStore(store);
  return submission;
}

/** Submitted -> Under Review. */
export function startReview(submissionId) {
  const store = readStore();
  const index = findIndex(store.submissions, submissionId);
  if (index === -1) throw new Error("Submission not found.");
  const submission = store.submissions[index];
  if (submission.status !== "Submitted") {
    throw new Error("Only Submitted submissions can move to Under Review.");
  }
  submission.status = "Under Review";
  submission.updatedAt = new Date().toISOString();
  submission.updatedBy = actingRole();
  submission.history = stampHistory(submission, "IRB_UNDER_REVIEW");
  store.submissions[index] = submission;
  writeStore(store);
  return submission;
}

/**
 * Committee decision: Under Review -> Approved | Contingent | Rejected.
 * Approval schedules the next continuing-review due date from the approval
 * date + the committee-specific cycle.
 */
export function recordDecision(submissionId, outcome, note = "") {
  if (!["Approved", "Contingent", "Rejected"].includes(outcome)) {
    throw new Error("Outcome must be Approved, Contingent or Rejected.");
  }
  const store = readStore();
  const index = findIndex(store.submissions, submissionId);
  if (index === -1) throw new Error("Submission not found.");
  const submission = store.submissions[index];
  if (submission.status !== "Under Review") {
    throw new Error("Only Under Review submissions can receive a decision.");
  }

  submission.status = outcome;
  submission.outcomeNote = note;
  submission.updatedAt = new Date().toISOString();
  submission.updatedBy = actingRole();

  if (outcome === "Approved") {
    submission.approvedAt = submission.updatedAt;
    submission.nextDueDate = addMonths(
      new Date(submission.updatedAt),
      submission.reviewCycleMonths
    );
    submission.conditions = [];
  } else if (outcome === "Contingent") {
    // A contingent approval carries conditions that must be resolved before
    // the site can be considered activation-ready.
    submission.conditions = (note || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text, resolved: false, resolvedAt: null }));
  }
  submission.history = stampHistory(
    submission,
    "IRB_DECISION:" + outcome
  );
  store.submissions[index] = submission;
  writeStore(store);

  addAuditLog("IRB_SUBMISSION_DECISION", {
    submissionId: submission.id,
    studyCode: submission.studyCode,
    outcome,
    timestamp: submission.updatedAt,
  });
  return submission;
}

export function resolveCondition(submissionId, conditionIndex) {
  const store = readStore();
  const index = findIndex(store.submissions, submissionId);
  if (index === -1) throw new Error("Submission not found.");
  const submission = store.submissions[index];
  if (submission.status !== "Contingent") {
    throw new Error("Only contingent approvals carry resolvable conditions.");
  }
  const condition = submission.conditions[conditionIndex];
  if (!condition) throw new Error("Condition not found.");
  condition.resolved = true;
  condition.resolvedAt = new Date().toISOString();
  submission.updatedAt = condition.resolvedAt;
  submission.updatedBy = actingRole();
  submission.history = stampHistory(submission, "IRB_CONDITION_RESOLVED");
  store.submissions[index] = submission;
  writeStore(store);
  return submission;
}

export function addCorrespondence(submissionId, message) {
  if (!String(message || "").trim()) {
    throw new Error("Correspondence message is required.");
  }
  const store = readStore();
  const index = findIndex(store.submissions, submissionId);
  if (index === -1) throw new Error("Submission not found.");
  const submission = store.submissions[index];
  if (submission.status === "Rejected") {
    throw new Error("Rejected submissions are closed to new correspondence.");
  }
  submission.correspondence.push({
    date: new Date().toISOString(),
    from: actingRole() || "Unknown",
    message,
  });
  submission.updatedAt = new Date().toISOString();
  submission.updatedBy = actingRole();
  submission.history = stampHistory(submission, "CORRESPONDENCE_ADDED");
  store.submissions[index] = submission;
  writeStore(store);
  return submission;
}

/* ------------------------------------------------------------------
   Read-side helpers
------------------------------------------------------------------- */

/** True while any condition of a contingent approval is unresolved. */
export function hasOpenConditions(submission: any = {}) {
  return (submission.conditions || []).some((condition) => !condition.resolved);
}

export function isContinuingReviewDue(submission: any = {}) {
  if (
    submission.status !== "Approved" ||
    !submission.nextDueDate
  ) {
    return false;
  }
  return new Date(submission.nextDueDate).getTime() <= Date.now();
}

export function subscribeIrbSubmissions(handler) {
  if (isBrowser() && typeof handler === "function") {
    window.addEventListener("irb-submissions-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("irb-submissions-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }
  return () => {};
}

const IrbSubmissionService = {
  IRB_TYPES,
  IRB_STATUSES,
  createSubmission,
  getSubmission,
  getSubmissions,
  getAllSubmissions,
  submitSubmission,
  startReview,
  recordDecision,
  resolveCondition,
  addCorrespondence,
  hasOpenConditions,
  isContinuingReviewDue,
  subscribeIrbSubmissions,
};

export default IrbSubmissionService;
