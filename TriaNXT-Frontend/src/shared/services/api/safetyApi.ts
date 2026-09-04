/**
 * safetyApi — Safety / AE-SAE Management (Architecture Blueprint
 * Section 4/12, Phase 19). Net-new module served by the Django admin
 * service via the gateway's /api/v1/safety/* routes.
 */
import api from "./client";

export function listAeCases(params) {
  // params: { studyId?, seriousOnly?, status? }
  return api.get("/safety/ae-cases/", { query: params });
}

export function getAeCase(caseId) {
  return api.get(`/safety/ae-cases/${encodeURIComponent(caseId)}/`);
}

export function createAeCase(payload) {
  // payload: { study_id, subject_ref, description, is_serious?, ... }
  return api.post("/safety/ae-cases/", payload);
}

export function updateAeCase(caseId, payload) {
  return api.patch(`/safety/ae-cases/${encodeURIComponent(caseId)}/`, payload);
}

export function reconcileAeCase(caseId, pvCaseReference) {
  return api.post(`/safety/ae-cases/${encodeURIComponent(caseId)}/reconcile/`, {
    pv_case_reference: pvCaseReference,
  });
}

export function getSummary(params) {
  // params: { studyId?, seriousOnly?, status? } — same filters as listAeCases
  return api.get("/safety/ae-cases/summary/", { query: params });
}

const safetyApi = {
  listAeCases,
  getAeCase,
  createAeCase,
  updateAeCase,
  reconcileAeCase,
  getSummary,
};

export default safetyApi;
