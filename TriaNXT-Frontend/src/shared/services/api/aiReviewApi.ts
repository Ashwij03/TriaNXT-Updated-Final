/**
 * aiReviewApi — AI Review Engine (Cloudbyz-class AI, Architecture
 * Blueprint Section 6). Net-new module with no Node predecessor, so this
 * talks to the FastAPI core service via the gateway's
 * /api/v1/ai-review/* routes. Response envelope is `{ data: ... }`
 * (unlike the re-platformed studies/notifications modules, which mirror
 * Node's `{ studies: [...] }` style for wire compatibility) since there
 * is no legacy contract to match here.
 */
import api from "./client";

/** Run AI document QC on an uploaded eISF/eTMF document. */
export function reviewDocument(documentId) {
  return api.post(`/ai-review/documents/${encodeURIComponent(documentId)}/qc`);
}

/** Get (and record) a Risk-Based Monitoring score for a site. */
export function getSiteRisk(siteId) {
  return api.get(`/ai-review/sites/${encodeURIComponent(siteId)}/risk`);
}

/** Triage an open comment for urgency/SLA risk. */
export function triageComment(commentId) {
  return api.post(`/ai-review/comments/${encodeURIComponent(commentId)}/triage`);
}

/** Human-in-the-loop accept/reject of an AI finding. decision: "Accepted" | "Rejected" */
export function decideFinding(findingId, decision) {
  return api.post(`/ai-review/findings/${encodeURIComponent(findingId)}/decision`, { decision });
}

/** Natural-language study copilot query (keyword fallback until RAG/Bedrock are provisioned). */
export function copilotQuery(q) {
  return api.get("/ai-review/copilot", { query: { q } });
}

const aiReviewApi = {
  reviewDocument,
  getSiteRisk,
  triageComment,
  decideFinding,
  copilotQuery,
};

export default aiReviewApi;
