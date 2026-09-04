import { readJson } from "../utils/storageHelpers";
import {
  notifyPermissionRequestApproved,
  notifyPermissionRequestCreated,
  notifyPermissionRequestRejected,
} from "./notificationService";

const REQUESTS_KEY = "accessPermissionRequests";
const HISTORY_KEY = "accessPermissionHistory";
const APPROVED_SCOPES_KEY = "approvedPermissionScopes";

export const PERMISSION_REQUESTS_UPDATED = "permission-requests-updated";
export const PERMISSIONS_UPDATED = "permissions-updated";

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function notifyPermissionRequestsUpdated() {
  window.dispatchEvent(new Event(PERMISSION_REQUESTS_UPDATED));
  window.dispatchEvent(new Event(PERMISSIONS_UPDATED));
  window.dispatchEvent(new Event("sponsor-data-updated"));
}

function normalizeRequest(request) {
  return {
    id: request.id,
    user: request.user || request.requestedBy || "Unknown User",
    email: request.email || "",
    role: request.role || "",
    studyCode: request.studyCode || request.study || "",
    action: request.action || request.accessType || "Edit Access",
    module: request.module || "General",
    recordId: request.recordId || "",
    recordName: request.recordName || "",
    studySubject:
      request.studySubject ||
      request.recordName ||
      request.recordId ||
      request.module ||
      "General",
    accessType: request.accessType || request.action || "Edit Access",
    reason: request.reason || request.notes || "",
    notes: request.notes || request.reason || "",
    requestedBy: request.requestedBy || request.user || "Unknown User",
    requestedOn:
      request.requestedOn ||
      request.timestamp?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10),
    timestamp: request.timestamp || new Date().toISOString(),
    status: request.status || "Pending",
    resolvedOn: request.resolvedOn || "",
  };
}

export function getAllAccessRequests() {
  return readJson(REQUESTS_KEY, []).map(normalizeRequest);
}

export function getPendingAccessRequests() {
  return getAllAccessRequests().filter((request) => request.status === "Pending");
}

export function getAccessRequestHistory() {
  const history = readJson(HISTORY_KEY, []).map(normalizeRequest);
  const seenIds = new Set<any>(history.map((request) => request.id));

  // Only fall back to REQUESTS_KEY for resolved requests that were never
  // recorded in HISTORY_KEY (e.g. legacy data from before history tracking
  // existed). Requests resolved via acceptAccessRequest/revokeAccessRequest
  // are already in `history` above, so re-adding them here would duplicate
  // the id and break React's key uniqueness.
  const resolvedFromPending = getAllAccessRequests().filter(
    (request) => request.status !== "Pending" && !seenIds.has(request.id),
  );

  return [...history, ...resolvedFromPending].sort((a, b) =>
    String(b.timestamp || b.requestedOn).localeCompare(
      String(a.timestamp || a.requestedOn),
    ),
  );
}

export function getApprovedPermissionScopes(email) {
  const scopes = readJson(APPROVED_SCOPES_KEY, []);
  if (!email) return scopes;
  return scopes.filter(
    (scope) => String(scope.email).toLowerCase() === String(email).toLowerCase(),
  );
}

// studyCode is optional so existing callers that haven't been updated yet
// keep working unscoped (matches prior behavior) — but once a scope carries
// a studyCode, it only ever satisfies a check for that exact study, never
// every study the user happens to have access to.
export function hasApprovedScope(
  email,
  action,
  module,
  recordId = "",
  studyCode = "",
) {
  return getApprovedPermissionScopes(email).some((scope) => {
    const actionMatch =
      !action || scope.action === action || scope.accessType === action;
    const moduleMatch = scope.module === module;
    const recordMatch = !scope.recordId || !recordId || scope.recordId === recordId;
    const studyMatch =
      !scope.studyCode || !studyCode || scope.studyCode === studyCode;
    return actionMatch && moduleMatch && recordMatch && studyMatch;
  });
}

function grantApprovedScope(request) {
  const scopes = readJson(APPROVED_SCOPES_KEY, []);
  scopes.push({
    id: `SCOPE-${Date.now()}`,
    email: request.email,
    role: request.role,
    studyCode: request.studyCode || "",
    action: request.action,
    module: request.module,
    recordId: request.recordId,
    recordName: request.recordName,
    accessType: request.accessType,
    grantedOn: new Date().toISOString(),
    requestId: request.id,
  });
  writeJson(APPROVED_SCOPES_KEY, scopes);
}

export function acceptAccessRequest(requestId) {
  const requests = readJson(REQUESTS_KEY, []);
  const index = requests.findIndex((request) => request.id === requestId);

  if (index < 0) {
    return null;
  }

  const updated = normalizeRequest({
    ...requests[index],
    status: "Approved",
    resolvedOn: new Date().toISOString().slice(0, 10),
  });

  requests[index] = updated;
  writeJson(REQUESTS_KEY, requests);
  grantApprovedScope(updated);

  const history = readJson(HISTORY_KEY, []);
  history.unshift(updated);
  writeJson(HISTORY_KEY, history);

  notifyPermissionRequestsUpdated();
  notifyPermissionRequestApproved(updated);
  return updated;
}

export function revokeAccessRequest(requestId) {
  const requests = readJson(REQUESTS_KEY, []);
  const index = requests.findIndex((request) => request.id === requestId);

  if (index < 0) {
    return null;
  }

  const updated = normalizeRequest({
    ...requests[index],
    status: "Rejected",
    resolvedOn: new Date().toISOString().slice(0, 10),
  });

  requests[index] = updated;
  writeJson(REQUESTS_KEY, requests);

  const history = readJson(HISTORY_KEY, []);
  history.unshift(updated);
  writeJson(HISTORY_KEY, history);

  notifyPermissionRequestsUpdated();
  notifyPermissionRequestRejected(updated);
  return updated;
}

export function removeUserPermission(userEmail) {
  const users = readJson("users", []);
  const updated = users.map((user) => {
    if (user.email !== userEmail) {
      return user;
    }

    return {
      ...user,
      permissions: [],
      requestedPermissions: [],
      approvalStatus: "Revoked",
      lastPermissionUpdate: new Date().toISOString(),
    };
  });

  writeJson("users", updated);

  const scopes = readJson(APPROVED_SCOPES_KEY, []).filter(
    (scope) => String(scope.email).toLowerCase() !== String(userEmail).toLowerCase(),
  );
  writeJson(APPROVED_SCOPES_KEY, scopes);
  notifyPermissionRequestsUpdated();

  return updated.find((user) => user.email === userEmail) || null;
}

export const removeUserPermissions = removeUserPermission;

export function submitAccessRequest(payload, user) {
  const requests = readJson(REQUESTS_KEY, []);
  const nextId = `REQ-${String(requests.length + 1).padStart(3, "0")}`;

  const entry = normalizeRequest({
    id: nextId,
    user: user?.name || "Unknown User",
    email: user?.email || "",
    role: user?.role || "",
    studyCode: payload.studyCode || payload.study || "",
    action: payload.action || payload.accessType || "Edit Access",
    module: payload.module || "General",
    recordId: payload.recordId || "",
    recordName: payload.recordName || payload.studySubject || "",
    studySubject: payload.studySubject || payload.recordName || "General",
    accessType: payload.accessType || payload.action || "Edit Access",
    reason: payload.reason || payload.notes || "",
    notes: payload.notes || payload.reason || "",
    requestedBy: user?.name || "Unknown User",
    requestedOn: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    status: "Pending",
  });

  requests.push(entry);
  writeJson(REQUESTS_KEY, requests);
  notifyPermissionRequestsUpdated();
  notifyPermissionRequestCreated(entry);
  return entry;
}