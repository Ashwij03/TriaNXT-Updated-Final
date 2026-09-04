/**
 * monitoringApi — Monitoring Access Requests.
 *
 * Net-new module served by the Django backend's /api/monitoring/* routes
 * (tria_engine.apps.monitoring). Lets a CRA / Sponsor / CRO user request
 * time-boxed, view-only access to a site for a specific date range, and lets
 * an Admin / Site Staff user approve, reject, or revoke that access.
 *
 * Same shape as safetyApi.js / etmfApi.js: a thin fetch wrapper with no
 * localStorage fallback — pages using this should gate on `isApiEnabled()`.
 */
import api from "./client";

export function listMonitoringRequests(params?) {
  // params: { status? } — "pending" | "approved" | "rejected" | "revoked"
  return api.get("/monitoring/requests/", { query: params });
}

export function createMonitoringRequest(payload) {
  // payload: { site, start_date, end_date, reason? }
  return api.post("/monitoring/requests/", payload);
}

export function approveMonitoringRequest(requestId, note) {
  return api.put(`/monitoring/requests/${encodeURIComponent(requestId)}/approve/`, { note });
}

export function rejectMonitoringRequest(requestId, note) {
  return api.put(`/monitoring/requests/${encodeURIComponent(requestId)}/reject/`, { note });
}

export function revokeMonitoringRequest(requestId, note) {
  return api.put(`/monitoring/requests/${encodeURIComponent(requestId)}/revoke/`, { note });
}

export function checkMonitoringAccess(siteId) {
  return api.get("/monitoring/access-check/", { query: { site: siteId } });
}

// Sites picker for the request form — organizations/urls.py exposes this,
// see tria_engine/urls.py.
export function listSites() {
  return api.get("/organizations/");
}

const monitoringApi = {
  listMonitoringRequests,
  createMonitoringRequest,
  approveMonitoringRequest,
  rejectMonitoringRequest,
  revokeMonitoringRequest,
  checkMonitoringAccess,
  listSites,
};

export default monitoringApi;
