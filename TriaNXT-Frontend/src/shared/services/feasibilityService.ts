/**
 * Feasibility Service — Site Feasibility & Selection (M23 / spec 6.30)
 * =====================================================================
 * Manages the pre-activation candidate-site pipeline:
 *
 *   Identified -> Questionnaire Sent -> Scored -> Selected | Rejected
 *
 * Candidate sites are distinct, lighter-weight records than activated
 * Site records; conversion to a formal site is explicit and preserves the
 * full questionnaire history on the resulting site stub.
 *
 * Scoring criteria are configurable per study (weighted 0-100 scale with a
 * configurable selection threshold). Rejected candidates are retained for
 * future studies — never deleted silently.
 *
 * Every mutation is stamped and appended to the candidate history plus the
 * global audit log.
 */

import { addAuditLog } from "./auditService";
import { getEffectiveRole, getCurrentUser } from "./roleService";
import { syncGapCollection } from "./gapSync";

const FEASIBILITY_STORAGE_KEY = "trianxtFeasibility";

export const FEASIBILITY_STATUSES = [
  "Identified",
  "Questionnaire Sent",
  "Scored",
  "Selected",
  "Rejected",
];

export const DEFAULT_SCORING_CRITERIA = [
  { key: "population", label: "Patient population", weight: 0.35 },
  { key: "competingTrials", label: "Competing trials", weight: 0.2 },
  { key: "infrastructure", label: "Infrastructure", weight: 0.2 },
  { key: "staff", label: "Staff availability", weight: 0.15 },
  { key: "timeline", label: "Timeline", weight: 0.1 },
];

const DEFAULT_CONFIG = {
  criteria: DEFAULT_SCORING_CRITERIA,
  minScore: 60,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore() {
  if (!isBrowser()) return { candidates: [], scoring: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(FEASIBILITY_STORAGE_KEY));
    if (parsed && typeof parsed === "object") {
      return {
        candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
        scoring:
          parsed.scoring && typeof parsed.scoring === "object"
            ? parsed.scoring
            : {},
      };
    }
  } catch {
    /* fall through to empty store */
  }
  return { candidates: [], scoring: {} };
}

function writeStore(store) {
  if (!isBrowser()) return;
  localStorage.setItem(FEASIBILITY_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("feasibility-updated"));
  // FastAPI integration: mirror each collection (API mode only).
  if (Array.isArray(store.candidates) && store.candidates.length) {
    syncGapCollection("/api/site/feasibility/sync", store.candidates);
  }
  const scoring = store.scoring && typeof store.scoring === "object" ? store.scoring : {};
  const scoringEntries = Object.keys(scoring).map((studyCode) => ({
    id: studyCode,
    studyCode,
    ...scoring[studyCode],
  }));
  if (scoringEntries.length) {
    syncGapCollection("/api/site/feasibility-scoring/sync", scoringEntries);
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

function findIndex(list, candidateId) {
  return list.findIndex((c) => String(c.id) === String(candidateId));
}

function stampHistory(candidate, action) {
  const history = Array.isArray(candidate.history) ? candidate.history : [];
  history.push({
    action,
    at: new Date().toISOString(),
    by: actingRole() || "Unknown",
  });
  return history;
}

function normalizeCandidate(candidate: any = {}) {
  const now = new Date().toISOString();
  return {
    id: candidate.id || "FC-" + Date.now().toString(36).toUpperCase(),
    studyCode: candidate.studyCode || "",
    institution: candidate.institution || "",
    contactName: candidate.contactName || "",
    email: candidate.email || "",
    phone: candidate.phone || "",
    department: candidate.department || "",
    status: FEASIBILITY_STATUSES.includes(candidate.status)
      ? candidate.status
      : "Identified",
    sentDate: candidate.sentDate || null,
    response: candidate.response || null,
    responseSubmittedAt: candidate.responseSubmittedAt || null,
    scores: candidate.scores || {},
    score: candidate.score == null ? null : Number(candidate.score),
    minScoreRequired:
      candidate.minScoreRequired == null ? null : Number(candidate.minScoreRequired),
    rationale: candidate.rationale || "",
    decidedAt: candidate.decidedAt || null,
    converted: candidate.converted || null,
    notes: candidate.notes || "",
    createdAt: candidate.createdAt || now,
    updatedAt: candidate.updatedAt || now,
    updatedBy: candidate.updatedBy || "",
    history: Array.isArray(candidate.history) ? candidate.history : [],
  };
}

/* ------------------------------------------------------------------
   Scoring configuration (spec: configurable per study)
------------------------------------------------------------------- */

export function getScoringConfig(studyCode) {
  const store = readStore();
  const key = normalizeValue(studyCode || "");
  const config = store.scoring[key];
  if (config && Array.isArray(config.criteria)) {
    return {
      criteria: config.criteria,
      minScore:
        config.minScore == null ? DEFAULT_CONFIG.minScore : Number(config.minScore),
    };
  }
  return { criteria: DEFAULT_CONFIG.criteria.slice(), minScore: DEFAULT_CONFIG.minScore };
}

export function setScoringConfig(studyCode, { criteria, minScore }) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new Error("At least one scoring criterion is required.");
  }
  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  if (Math.abs(totalWeight - 1) > 0.0001) {
    throw new Error("Scoring criteria weights must sum to 1.0.");
  }
  const store = readStore();
  store.scoring[normalizeValue(studyCode || "")] = {
    criteria: criteria.map((c) => ({
      key: c.key,
      label: c.label || c.key,
      weight: Number(c.weight || 0),
    })),
    minScore: minScore == null ? DEFAULT_CONFIG.minScore : Number(minScore),
  };
  writeStore(store);
  return getScoringConfig(studyCode);
}

/* ------------------------------------------------------------------
   Candidate lifecycle
------------------------------------------------------------------- */

export function addCandidate(payload: any = {}) {
  if (!payload.institution) {
    throw new Error("Institution name is required.");
  }
  const candidate = normalizeCandidate({
    institution: payload.institution,
    studyCode: payload.studyCode || "",
    contactName: payload.contactName || "",
    email: payload.email || "",
    phone: payload.phone || "",
    department: payload.department || "",
    notes: payload.notes || "",
    status: "Identified",
  });
  candidate.history = stampHistory(candidate, "CANDIDATE_IDENTIFIED");

  const store = readStore();
  store.candidates.push(candidate);
  writeStore(store);

  addAuditLog("FEASIBILITY_CANDIDATE_ADDED", {
    candidateId: candidate.id,
    institution: candidate.institution,
    studyCode: candidate.studyCode || "(portfolio)",
    timestamp: candidate.createdAt,
  });
  return candidate;
}

export function updateCandidateProfile(candidateId, updates: any = {}) {
  const store = readStore();
  const index = findIndex(store.candidates, candidateId);
  if (index === -1) throw new Error("Candidate not found.");

  const candidate = store.candidates[index];
  if (candidate.status === "Selected" || candidate.status === "Rejected") {
    throw new Error("Selected/rejected candidates cannot be edited; record a new candidate.");
  }
  const next = normalizeCandidate({
    ...candidate,
    ...updates,
    id: candidate.id,
    createdAt: candidate.createdAt,
    history: candidate.history,
  });
  next.history = stampHistory(next, "CANDIDATE_UPDATED");
  next.updatedBy = actingRole();
  store.candidates[index] = next;
  writeStore(store);
  return next;
}

/** Send the feasibility questionnaire: Identified -> Questionnaire Sent. */
export function sendQuestionnaire(candidateId) {
  const store = readStore();
  const index = findIndex(store.candidates, candidateId);
  if (index === -1) throw new Error("Candidate not found.");

  const candidate = store.candidates[index];
  if (candidate.status !== "Identified" && candidate.status !== "Questionnaire Sent") {
    throw new Error("Questionnaire can only be sent to Identified candidates.");
  }
  candidate.status = "Questionnaire Sent";
  candidate.sentDate = new Date().toISOString();
  candidate.updatedAt = candidate.sentDate;
  candidate.updatedBy = actingRole();
  candidate.history = stampHistory(candidate, "QUESTIONNAIRE_SENT");
  store.candidates[index] = candidate;
  writeStore(store);
  return candidate;
}

/**
 * Capture the site's questionnaire response (patient population, competing
 * trials, infrastructure, staff). Response is kept for audit and reused as
 * the starting values of the score sheet.
 */
export function submitQuestionnaireResponse(candidateId, response: any = {}) {
  const store = readStore();
  const index = findIndex(store.candidates, candidateId);
  if (index === -1) throw new Error("Candidate not found.");

  const candidate = store.candidates[index];
  if (candidate.status !== "Questionnaire Sent") {
    throw new Error("Candidate must have a sent questionnaire before responding.");
  }
  candidate.response = {
    patientPopulation: response.patientPopulation == null ? 0 : Number(response.patientPopulation),
    competingTrials: Boolean(response.competingTrials),
    competingTrialDetails: response.competingTrialDetails || "",
    infrastructure: response.infrastructure || "",
    staffAvailability: response.staffAvailability || "",
  };
  candidate.responseSubmittedAt = new Date().toISOString();
  candidate.updatedAt = candidate.responseSubmittedAt;
  candidate.updatedBy = actingRole();
  candidate.history = stampHistory(candidate, "QUESTIONNAIRE_RESPONSE_RECEIVED");
  store.candidates[index] = candidate;
  writeStore(store);
  return candidate;
}

function computeWeightedScore(config, rawScores) {
  let total = 0;
  config.criteria.forEach((criterion) => {
    const raw = Number(rawScores[criterion.key]);
    if (!Number.isFinite(raw)) {
      throw new Error("Score for criterion '" + criterion.key + "' is missing.");
    }
    total += Math.min(Math.max(raw, 0), 100) * Number(criterion.weight || 0);
  });
  return Math.round(total);
}

/**
 * Score the candidate against the study's configured criteria:
 * Questionnaire Sent -> Scored. Re-scoring is allowed while Scored.
 */
export function scoreCandidate(candidateId, rawScores = {}) {
  const store = readStore();
  const index = findIndex(store.candidates, candidateId);
  if (index === -1) throw new Error("Candidate not found.");

  const candidate = store.candidates[index];
  if (candidate.status !== "Questionnaire Sent" && candidate.status !== "Scored") {
    throw new Error("Candidate must have returned the questionnaire before scoring.");
  }

  const config = getScoringConfig(candidate.studyCode);
  const score = computeWeightedScore(config, rawScores);

  candidate.score = score;
  candidate.minScoreRequired = config.minScore;
  candidate.scores = { ...rawScores };
  candidate.status = "Scored";
  candidate.updatedAt = new Date().toISOString();
  candidate.updatedBy = actingRole();
  candidate.history = stampHistory(candidate, "CANDIDATE_SCORED:" + score);
  store.candidates[index] = candidate;
  writeStore(store);

  addAuditLog("FEASIBILITY_CANDIDATE_SCORED", {
    candidateId: candidate.id,
    institution: candidate.institution,
    score,
    timestamp: candidate.updatedAt,
  });
  return candidate;
}

/**
 * Selection decision — Scored/Questionnaire Sent -> Selected | Rejected.
 * Rationale is mandatory so decisions stay auditable (spec acceptance).
 */
export function decideCandidate(candidateId, decision, rationale) {
  if (decision !== "Selected" && decision !== "Rejected") {
    throw new Error("Decision must be 'Selected' or 'Rejected'.");
  }
  if (!String(rationale || "").trim()) {
    throw new Error("A rationale is required to record a selection decision.");
  }

  const store = readStore();
  const index = findIndex(store.candidates, candidateId);
  if (index === -1) throw new Error("Candidate not found.");

  const candidate = store.candidates[index];
  if (
    candidate.status !== "Questionnaire Sent" &&
    candidate.status !== "Scored"
  ) {
    throw new Error("Candidate must be scored (or responded) before a decision.");
  }
  if (decision === "Selected" && candidate.status === "Questionnaire Sent") {
    throw new Error("Candidate must be scored before it can be selected.");
  }
  if (decision === "Selected" && candidate.score < candidate.minScoreRequired) {
    throw new Error(
      "Candidate score (" +
        candidate.score +
        ") is below the study selection threshold (" +
        candidate.minScoreRequired +
        ")."
    );
  }

  candidate.status = decision;
  candidate.rationale = rationale;
  candidate.decidedAt = new Date().toISOString();
  candidate.updatedAt = candidate.decidedAt;
  candidate.updatedBy = actingRole();
  candidate.history = stampHistory(
    candidate,
    decision === "Selected" ? "CANDIDATE_SELECTED" : "CANDIDATE_REJECTED"
  );
  store.candidates[index] = candidate;
  writeStore(store);

  addAuditLog(
    decision === "Selected"
      ? "FEASIBILITY_CANDIDATE_SELECTED"
      : "FEASIBILITY_CANDIDATE_REJECTED",
    {
      candidateId: candidate.id,
      institution: candidate.institution,
      rationale,
      timestamp: candidate.decidedAt,
    }
  );
  return candidate;
}

/**
 * Convert a Selected candidate to a formal site record stub. Conversion is
 * explicit, keeps the candidate history, and embeds the questionnaire onto
 * the resulting site stub (spec acceptance criterion).
 */
export function convertCandidateToSite(candidateId) {
  const store = readStore();
  const index = findIndex(store.candidates, candidateId);
  if (index === -1) throw new Error("Candidate not found.");

  const candidate = store.candidates[index];
  if (candidate.status !== "Selected") {
    throw new Error("Only Selected candidates can be converted to a site.");
  }
  if (candidate.converted) {
    throw new Error("Candidate has already been converted to a site.");
  }

  const siteCode = "ST-" + String(candidate.id).replace(/^FC-/, "").slice(0, 8);
  candidate.converted = {
    siteCode,
    siteName: candidate.institution,
    convertedAt: new Date().toISOString(),
    questionnaire: candidate.response,
    score: candidate.score,
    rationale: candidate.rationale,
  };
  candidate.updatedAt = candidate.converted.convertedAt;
  candidate.updatedBy = actingRole();
  candidate.history = stampHistory(
    candidate,
    "CANDIDATE_CONVERTED:" + siteCode
  );
  store.candidates[index] = candidate;
  writeStore(store);

  addAuditLog("FEASIBILITY_CANDIDATE_CONVERTED", {
    candidateId: candidate.id,
    institution: candidate.institution,
    siteCode,
    timestamp: candidate.converted.convertedAt,
  });
  return candidate;
}

/**
 * Candidates are retained by default (rejected candidates remain searchable
 * for future studies). Hard delete is limited to records that were never
 * decided or converted.
 */
export function deleteCandidate(candidateId) {
  const store = readStore();
  const index = findIndex(store.candidates, candidateId);
  if (index === -1) return false;
  const candidate = store.candidates[index];
  // Spec 6.30: rejected candidates remain searchable for future study
  // feasibility ("do not delete"); decided/converted records are audit
  // history. Only never-decided candidates may be removed.
  if (candidate.status !== "Identified" && candidate.status !== "Questionnaire Sent") {
    throw new Error("Decided candidates are retained for audit and future feasibility.");
  }
  store.candidates.splice(index, 1);
  writeStore(store);
  return true;
}

/* ------------------------------------------------------------------
   Reads
------------------------------------------------------------------- */

export function getCandidates(studyCode) {
  const store = readStore();
  if (studyCode) {
    const key = normalizeValue(studyCode);
    return store.candidates.filter(
      (c) => normalizeValue(c.studyCode) === key
    );
  }
  return store.candidates.slice();
}

export function getCandidate(candidateId) {
  if (!candidateId) return null;
  return (
    readStore().candidates.find(
      (c) => String(c.id) === String(candidateId)
    ) || null
  );
}

export function getAllCandidates() {
  return readStore().candidates.slice();
}

export function getCandidateStatusCounts(candidates) {
  const counts: Record<string, number> = {};
  FEASIBILITY_STATUSES.forEach((status) => {
    counts[status] = 0;
  });
  (candidates || []).forEach((candidate) => {
    const key = candidate.status || "Identified";
    counts[key] = (counts[key] || 0) + 1;
  });
  counts.Converted = (candidates || []).filter((c) => c.converted).length;
  return counts;
}

export function subscribeFeasibility(handler) {
  if (isBrowser() && typeof handler === "function") {
    window.addEventListener("feasibility-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("feasibility-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }
  return () => {};
}

/* ------------------------------------------------------------------
   Demo seed (safe: only inserts when the store has no candidates)
------------------------------------------------------------------- */

export function seedSampleCandidates(studyCode = "") {
  const store = readStore();
  if (store.candidates.length > 0) {
    return store.candidates.length;
  }
  const now = new Date();
  const iso = (offsetDays) =>
    new Date(now.getTime() + offsetDays * 86400000).toISOString();

  const samples = [
    {
      id: "FC-SAMPLE-1",
      studyCode,
      institution: "City Medical Center",
      contactName: "Dr. R. Alvarez",
      email: "ralvarez@citymed.example",
      phone: "+1 555-0101",
      status: "Scored",
      sentDate: iso(-12),
      response: {
        patientPopulation: 240,
        competingTrials: true,
        competingTrialDetails: "One Phase III oncology study (same indication).",
        infrastructure: "Oncology day unit, 22 chairs, electronic source.",
        staffAvailability: "2 coordinators, 1 research nurse.",
      },
      scores: { population: 80, competingTrials: 60, infrastructure: 90, staff: 85, timeline: 70 },
      score: 78,
      minScoreRequired: 60,
      score_extra: null,
      rationale: "",
      decidedAt: null,
      converted: null,
      notes: "Strong referral history.",
      createdAt: iso(-15),
      updatedAt: iso(-2),
      updatedBy: "Sponsor",
      history: [],
    },
    {
      id: "FC-SAMPLE-2",
      studyCode,
      institution: "Northside Research Institute",
      contactName: "Dr. P. Novak",
      email: "pnovak@northside.example",
      phone: "+1 555-0102",
      status: "Questionnaire Sent",
      sentDate: iso(-5),
      response: null,
      scores: {},
      score: null,
      minScoreRequired: 60,
      rationale: "",
      decidedAt: null,
      converted: null,
      notes: "",
      createdAt: iso(-8),
      updatedAt: iso(-5),
      updatedBy: "CRO",
      history: [],
    },
    {
      id: "FC-SAMPLE-3",
      studyCode,
      institution: "St. Luke's General",
      contactName: "Dr. M. Osei",
      email: "mosei@stlukes.example",
      phone: "+1 555-0103",
      status: "Rejected",
      sentDate: iso(-20),
      response: {
        patientPopulation: 40,
        competingTrials: true,
        competingTrialDetails: "Two competing trials; limited referral base.",
        infrastructure: "Shared outpatient clinic.",
        staffAvailability: "0.5 FTE coordinator.",
      },
      scores: { population: 30, competingTrials: 40, infrastructure: 55, staff: 35, timeline: 50 },
      score: 40,
      minScoreRequired: 60,
      rationale: "Patient population far below target and competing-trial overlap.",
      decidedAt: iso(-3),
      converted: null,
      notes: "Revisit for future protocol if referral base grows.",
      createdAt: iso(-25),
      updatedAt: iso(-3),
      updatedBy: "Study Manager",
      history: [],
    },
  ];

  samples.forEach((sample) => {
    const candidate = normalizeCandidate(sample);
    candidate.history = stampHistory(candidate, "SEED_SAMPLE");
    store.candidates.push(candidate);
  });
  writeStore(store);
  return store.candidates.length;
}

const FeasibilityService = {
  FEASIBILITY_STATUSES,
  DEFAULT_SCORING_CRITERIA,

  getScoringConfig,
  setScoringConfig,

  addCandidate,
  updateCandidateProfile,
  sendQuestionnaire,
  submitQuestionnaireResponse,
  scoreCandidate,
  decideCandidate,
  convertCandidateToSite,
  deleteCandidate,

  getCandidates,
  getCandidate,
  getAllCandidates,
  getCandidateStatusCounts,
  subscribeFeasibility,

  seedSampleCandidates,
};

export default FeasibilityService;
