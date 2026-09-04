/**
 * etmfApi — Trial Master File (Architecture Blueprint Section 4/7).
 * Net-new module served by the Django admin service via the gateway's
 * /api/v1/etmf/* routes. DRF's default list/retrieve responses are
 * plain arrays/objects (no envelope); the completeness action returns
 * `{ data: [...] }`.
 */
import api from "./client";

export function listZones() {
  return api.get("/etmf/zones/");
}

export function listDocuments(params) {
  // params: { studyId? }
  return api.get("/etmf/documents/", { query: params });
}

export function getDocument(documentId) {
  return api.get(`/etmf/documents/${encodeURIComponent(documentId)}/`);
}

export function createDocument(payload) {
  // payload: { study_id, zone, artifact_name, status?, ... }
  return api.post("/etmf/documents/", payload);
}

export function updateDocument(documentId, payload) {
  return api.patch(`/etmf/documents/${encodeURIComponent(documentId)}/`, payload);
}

export function deleteDocument(documentId) {
  return api.delete(`/etmf/documents/${encodeURIComponent(documentId)}/`);
}

/** Completeness index per zone for a study. */
export function getCompleteness(studyId) {
  return api.get("/etmf/documents/completeness/", { query: { studyId } });
}

const etmfApi = {
  listZones,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getCompleteness,
};

export default etmfApi;
