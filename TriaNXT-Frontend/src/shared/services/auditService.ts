// CANONICAL AUDIT SERVICE (Batch A)
//
// This is the ONE centralized Audit Logs data source for the whole
// application. It owns:
//   - persistence            (localStorage, key: "auditLogs")
//   - normalization           (normalizeAuditEvent)
//   - recording                (recordAuditEvent)
//   - retrieval                (getAuditEvents / getRecentAuditEvents)
//   - role/study/site scoping  (getVisibleAuditEvents)
//   - synchronization           (AUDIT_UPDATED_EVENT)
//
// Storage key and event name intentionally reuse the pre-existing
// conventions ("auditLogs" / "activity-log-updated") that were already in
// use in studyService.js and directly relied on by
// src/pages/shared/subjects/SubjectAuditTrail.js. Reusing them means every
// existing audit record already on a user's machine, and every existing
// consumer, keeps working — nothing is migrated or orphaned.
//
// Do NOT add another localStorage key or another CustomEvent name for
// audit activity anywhere else in the app. Everything funnels through the
// functions exported here.

import {
  getAccessibleStudies,
  getAssignedSite,
  getCurrentUser,
  isAdmin,
  matchesOrg
} from "./roleService";

const AUDIT_STORAGE_KEY = "auditLogs";
export const AUDIT_UPDATED_EVENT = "activity-log-updated";

// Audit history must stay useful without becoming an unbounded storage
// hazard. 100 was the pre-existing cap in studyService.js; kept as-is so
// behavior doesn't silently change for existing installs.
const MAX_STORED_AUDIT_EVENTS = 100;

// ---------------------------------------------------------------------
// Normalized action-type vocabulary (Step: ACTION TYPE NORMALIZATION)
// ---------------------------------------------------------------------
export const AUDIT_ACTION_TYPES = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  STATUS_CHANGE: "STATUS_CHANGE",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  RESOLVE: "RESOLVE",
  REOPEN: "REOPEN",
  UPLOAD: "UPLOAD",
  ASSIGN: "ASSIGN",
  UNASSIGN: "UNASSIGN",
  SCHEDULE: "SCHEDULE",
  RESCHEDULE: "RESCHEDULE",
  COMPLETE: "COMPLETE",
  CANCEL: "CANCEL"
};

const ACTION_TYPE_KEYWORD_MAP = [
  [/reschedul/i, AUDIT_ACTION_TYPES.RESCHEDULE],
  [/unassign/i, AUDIT_ACTION_TYPES.UNASSIGN],
  [/assign/i, AUDIT_ACTION_TYPES.ASSIGN],
  [/schedul/i, AUDIT_ACTION_TYPES.SCHEDULE],
  [/reopen/i, AUDIT_ACTION_TYPES.REOPEN],
  [/resolve/i, AUDIT_ACTION_TYPES.RESOLVE],
  [/reject|declin/i, AUDIT_ACTION_TYPES.REJECT],
  [/approve/i, AUDIT_ACTION_TYPES.APPROVE],
  [/cancel/i, AUDIT_ACTION_TYPES.CANCEL],
  [/complet/i, AUDIT_ACTION_TYPES.COMPLETE],
  [/upload/i, AUDIT_ACTION_TYPES.UPLOAD],
  [/status/i, AUDIT_ACTION_TYPES.STATUS_CHANGE],
  [/delet/i, AUDIT_ACTION_TYPES.DELETE],
  [/creat|add|enroll/i, AUDIT_ACTION_TYPES.CREATE],
  [/updat|edit|modif|chang/i, AUDIT_ACTION_TYPES.UPDATE]
];

export function normalizeActionType(rawAction) {
  if (!rawAction) {
    return AUDIT_ACTION_TYPES.UPDATE;
  }

  if (Object.values(AUDIT_ACTION_TYPES).includes(rawAction)) {
    return rawAction;
  }

  const text = String(rawAction);
  const match = ACTION_TYPE_KEYWORD_MAP.find(([pattern]) => (pattern as RegExp).test(text));
  return match ? match[1] : AUDIT_ACTION_TYPES.UPDATE;
}

// ---------------------------------------------------------------------
// Storage (single authoritative read/write pair — nothing else in the
// app should call localStorage directly for the "auditLogs" key)
// ---------------------------------------------------------------------
function readAuditStore() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAuditStore(events) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      // Fail safe rather than crash a business mutation just because audit
      // history is full — the mutation itself already succeeded.
      // eslint-disable-next-line no-console
      console.warn("Audit storage limit reached; oldest records will be trimmed.");
      const trimmed = events.slice(0, Math.max(0, events.length - 20));
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }
    throw error;
  }
}

export function notifyAuditUpdated(detail: any = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUDIT_UPDATED_EVENT, { detail }));
}

// ---------------------------------------------------------------------
// Actor identity (Step: ACTOR IDENTITY REQUIREMENT)
// ---------------------------------------------------------------------
function resolveActor(explicitActor) {
  const sessionUser = getCurrentUser();

  const actorUserId =
    explicitActor?.actorUserId ||
    explicitActor?.userId ||
    sessionUser?.id ||
    sessionUser?.email ||
    null;

  const actorName =
    explicitActor?.actorName ||
    explicitActor?.userName ||
    explicitActor?.name ||
    sessionUser?.name ||
    sessionUser?.email ||
    "Unknown User";

  const actorRole =
    explicitActor?.actorRole ||
    explicitActor?.role ||
    sessionUser?.role ||
    null;

  return { actorUserId, actorName, actorRole };
}

// "User 01 - Admin" / "Dr. Rao - PI" style label. Both identity and role
// are preserved, never role-only ("Added by Admin" is explicitly BAD per
// spec).
export function formatActorLabel(event) {
  if (!event) {
    return "Unknown User";
  }

  const name = event.actorName || event.performedBy || "Unknown User";
  const role = event.actorRole;

  return role ? `${name} - ${role}` : name;
}

// ---------------------------------------------------------------------
// Normalization (Step A3 — canonical audit record model)
// ---------------------------------------------------------------------
function buildAuditId() {
  return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDescription(input, actionType) {
  if (input.description) {
    return input.description;
  }

  // Fall back to the human-readable label/action rather than a raw JSON
  // dump or a bare verb, per the AUDIT DESCRIPTION REQUIREMENT.
  return input.actionLabel || input.action || actionType;
}

/**
 * Normalize a raw audit input (from either the modern recordAuditEvent()
 * call shape or the legacy addAuditLog(action, details) call shape used
 * elsewhere in the app) into the canonical audit record model.
 */
export function normalizeAuditEvent(input: any = {}) {
  const actionType = normalizeActionType(input.actionType || input.action);
  const actor = resolveActor(input);

  const siteNumber = input.siteNumber || input.site || "";
  const siteName = input.siteName || (siteNumber && siteNumber !== input.siteNumber ? "" : "");

  const description = buildDescription(input, actionType);

  const record = {
    id: input.id || buildAuditId(),
    timestamp: input.timestamp || new Date().toISOString(),
    description,

    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,

    actionType,
    actionLabel: input.actionLabel || input.action || actionType,

    module: input.module || null,
    entityType: input.entityType || null,
    entityId: input.entityId || input.subjectId || input.studyCode || null,

    studyId: input.studyId || input.studyCode || null,
    studyCode: input.studyCode || input.studyId || null,
    studyName: input.studyName || null,

    siteNumber: siteNumber || null,
    siteName: siteName || null,
    site: siteNumber || siteName || input.site || null,

    subjectId: input.subjectId || null,
    visitId: input.visitId || null,
    documentId: input.documentId || null,

    changes: input.changes || null,
    metadata: input.metadata || null,

    // Legacy/compat fields — several existing screens (e.g.
    // SubjectAuditTrail.js, dashboardService.js, adminService.js) read
    // these exact keys directly off stored audit records. Preserving them
    // avoids breaking any existing consumer while the canonical fields
    // above are the forward-looking source of truth.
    action: input.action || input.actionLabel || actionType,
    deletedBy: input.deletedBy,
    reason: input.reason,
    performedBy: actor.actorName
  };


  return record;
}

// ---------------------------------------------------------------------
// Recording (Step A5 — one successful mutation → one audit event)
// ---------------------------------------------------------------------
export function recordAuditEvent(input: any = {}) {
  const record = normalizeAuditEvent(input);

  const events = readAuditStore();
  events.unshift(record);

  if (events.length > MAX_STORED_AUDIT_EVENTS) {
    events.length = MAX_STORED_AUDIT_EVENTS;
  }

  writeAuditStore(events);
  notifyAuditUpdated({ actionType: record.actionType, action: record.action });

  return record;
}

// Backward-compatible legacy signature: addAuditLog(action, details).
// studyService.js (and, transitively, any code that imported addAuditLog
// from studyService.js) continues to work unchanged — it now records
// through the canonical service instead of a private duplicate store.
export function addAuditLog(action,details: any = {}) {
  return recordAuditEvent({ action, ...details });
}

// ---------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------
export function getAuditEvents() {
  return readAuditStore();
}

// Legacy alias — same behavior as the old studyService.getRecentActivityLogs.
export function getRecentActivityLogs(limit = 10) {
  return getAuditEvents().slice(0, limit);
}

export function getRecentAuditEvents(limit = 10) {
  return getRecentActivityLogs(limit);
}

// ---------------------------------------------------------------------
// Authorization-ready scoping (Step: AUTHORIZATION-READY ARCHITECTURE)
//
// Batch B wires this into sidebar/routing per role and tightens scoping
// to use authoritative Study relationships (getAccessibleStudies) rather
// than display-name/site string matching alone — the same canonical
// relationship data every other screen in the app (Studies list,
// dashboards, Study binder) already uses to decide what a SiteStaff user
// is authorized to see. Scoping always happens BEFORE search/filter/sort/
// pagination — callers must never load unauthorized rows and hide them
// only visually afterward.
// ---------------------------------------------------------------------
export function getVisibleAuditEvents(options: any = {}) {
  const { user = getCurrentUser(), studyId = null } = options;

  const allEvents = getAuditEvents();

  const scoped = isAdmin(user)
    ? allEvents
    : allEvents.filter((event) => isEventAuthorizedForUser(event, user));

  if (!studyId) {
    return scoped;
  }

  const normalizedStudyId = String(studyId);
  return scoped.filter(
    (event) =>
      String(event.studyId || "") === normalizedStudyId ||
      String(event.studyCode || "") === normalizedStudyId ||
      String(event.studyName || "") === normalizedStudyId
  );
}

function isEventAuthorizedForUser(event, user) {
  const assignedSite = getAssignedSite(user);

  // No site assignment recorded for this user (shouldn't normally happen
  // for non-Admin roles) — fail open to the pre-existing app-wide
  // behavior rather than hiding everything.
  if (!assignedSite) {
    return true;
  }

  // Records with no site/study context at all (system-level activity)
  // remain visible rather than being silently dropped.
  if (
    !event.siteNumber &&
    !event.siteName &&
    !event.site &&
    !event.studyId &&
    !event.studyCode
  ) {
    return true;
  }

  // AUTHORITATIVE PATH: if the event carries a Study reference, check it
  // against the user's actual accessible Study relationships (Study.site
  // / Study.principalInvestigator, etc. — the same canonical relationship
  // roleService.getAccessibleStudies() already uses everywhere else in
  // the app for Subjects, Visits, Comments, Documents that hang off a
  // Study) instead of re-deriving access from a display string.
  const eventStudyRef = event.studyId || event.studyCode || event.studyName;

  if (eventStudyRef) {
    const accessibleStudyIds = getAccessibleStudyIdentifiers(user);
    return accessibleStudyIds.has(String(eventStudyRef));
  }

  // FALLBACK PATH: legacy/system audit records that predate studyId
  // being recorded carry only a site display value — match against the
  // user's assigned site using the same normalization roleService uses
  // (matchesOrg) so this doesn't silently diverge from the rest of the
  // app's site-scoping behavior.
  const eventSite = event.siteNumber || event.siteName || event.site || "";
  return matchesOrg(eventSite, assignedSite);
}

let accessibleStudyIdentifiersCache = null;
let accessibleStudyIdentifiersCacheUser = null;

if (typeof window !== "undefined") {
  window.addEventListener("studies-updated", () => {
    accessibleStudyIdentifiersCache = null;
    accessibleStudyIdentifiersCacheUser = null;
  });
}

function getAccessibleStudyIdentifiers(user) {
  const cacheKey = user?.email || user?.id || null;

  if (
    accessibleStudyIdentifiersCache &&
    accessibleStudyIdentifiersCacheUser === cacheKey
  ) {
    return accessibleStudyIdentifiersCache;
  }

  const studies = getAccessibleStudies(user);
  const identifiers = new Set<any>();

  studies.forEach((study) => {
    if (study.code) identifiers.add(String(study.code));
    if (study.id) identifiers.add(String(study.id));
    if (study.name) identifiers.add(String(study.name));
  });

  accessibleStudyIdentifiersCache = identifiers;
  accessibleStudyIdentifiersCacheUser = cacheKey;

  return identifiers;
}

export function formatAuditTimestamp(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

const auditService = {
  AUDIT_UPDATED_EVENT,
  AUDIT_ACTION_TYPES,
  normalizeActionType,
  normalizeAuditEvent,
  recordAuditEvent,
  addAuditLog,
  getAuditEvents,
  getRecentActivityLogs,
  getRecentAuditEvents,
  getVisibleAuditEvents,
  notifyAuditUpdated,
  formatActorLabel,
  formatAuditTimestamp
};

// NOTE: there is exactly one storage key and one event for audit activity
// in this application (AUDIT_STORAGE_KEY / AUDIT_UPDATED_EVENT above). Do
// not build a second, competing per-role audit store (e.g. AdminAuditStore,
// SiteStaffAuditStore, PIAuditStore, CROAuditStore, SponsorAuditStore).
// New role-scoped views must call getVisibleAuditEvents(), not invent
// their own storage.

export default auditService;