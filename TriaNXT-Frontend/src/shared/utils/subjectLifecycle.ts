import { readJson } from "./storageHelpers";

export const SUBJECT_LIFECYCLE_STAGES = [
  "Screened",
  "Enrolled",
  "Ongoing",
  "Completed",
];

export const SUBJECT_TERMINAL_STATES = ["Withdrawn", "Dropout"];

const VISIT_PROGRESS_KEY = "subjectVisitProgress";

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isNonEmptyDate(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  const parsed = new Date(trimmed);
  return !Number.isNaN(parsed.getTime());
}

// Terminal detection uses subject.status because withdrawal/discontinuation
// is only represented in the current model by the stored status token.
export function getTerminalSubjectState(subject) {
  const raw = normalizeToken(subject?.status);
  if (!raw) return null;
  if (raw.includes("withdraw")) return "Withdrawn";
  if (raw.includes("drop") || raw.includes("discontin") || raw.includes("terminat")) {
    return "Dropout";
  }
  return null;
}

// Completed evidence — actual subject-level signals only. Does NOT cascade
// from study.status === "Completed".
export function hasSubjectCompletionEvidence(subject,visits: any = []) {
  if (normalizeToken(subject?.currentVisit) === "completed") {
    return true;
  }

  if (normalizeToken(subject?.status).includes("complete")) {
    return true;
  }

  // If any recorded visit is explicitly the "Completed" stage and marked
  // Completed, the subject lifecycle is considered complete.
  return visits.some(
    (visit) =>
      normalizeToken(visit?.name) === "completed" &&
      normalizeToken(visit?.status) === "completed"
  );
}

// Ongoing evidence — actual study-visit participation past enrollment.
// Uses subject-specific visit records; other subjects' visits cannot leak in.
export function hasActiveParticipationEvidence(subject,visits: any = [], progress = null) {
  const currentVisit = normalizeToken(subject?.currentVisit);

  if (currentVisit && !["", "screening", "enrollment", "completed"].includes(currentVisit)) {
    return true;
  }

  const hasStudyVisitRecord = visits.some((visit) => {
    const name = normalizeToken(visit?.name);
    return name && !["screening", "enrollment"].includes(name);
  });

  if (hasStudyVisitRecord) {
    return true;
  }

  if (progress && Array.isArray(progress.completedStages)) {
    return progress.completedStages.some((stage) => {
      const name = normalizeToken(stage);
      return name && !["screening", "enrollment"].includes(name);
    });
  }

  // Legacy fallback: an explicit stored "Ongoing" or "Active" status token.
  const raw = normalizeToken(subject?.status);
  return raw === "ongoing" || raw === "active" || raw === "in progress" || raw === "in-progress";
}

// Enrolled evidence — an actual enrollment date on the subject record. Legacy
// subjects whose status was manually set to "Enrolled" without a date still
// derive Enrolled via the raw-status fallback.
export function hasEnrollmentEvidence(subject) {
  if (isNonEmptyDate(subject?.enrollmentDate)) {
    return true;
  }
  return normalizeToken(subject?.status).includes("enroll");
}

// Screened evidence — screening date on the record, current-visit set to
// "Screening", or a stored "Screening" status. Subject creation alone (with
// no screening data) does not derive Screened.
export function hasScreeningEvidence(subject) {
  if (isNonEmptyDate(subject?.screeningDate)) {
    return true;
  }
  if (normalizeToken(subject?.currentVisit) === "screening") {
    return true;
  }
  return normalizeToken(subject?.status).includes("screen");
}

// Load subject-specific visit records without leaking other subjects' data.
export function loadSubjectVisits(subjectId) {
  if (!subjectId) return [];
  try {
    const raw = readJson(`subject_${subjectId}_visits`, []);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function loadSubjectVisitProgress(studyId, subjectId) {
  if (!studyId || !subjectId) return null;
  try {
    const all = readJson(VISIT_PROGRESS_KEY, {});
    return all?.[`${studyId}::${subjectId}`] || null;
  } catch {
    return null;
  }
}

// Single deterministic priority chain. Highest applicable stage wins.
export function deriveSubjectLifecycleStatus(subject,options: any = {}) {
  if (!subject || typeof subject !== "object") {
    return "";
  }

  const subjectId = subject.subjectId || subject.id;
  const studyId = subject.studyId || subject.studyKey || options.studyId;

  const visits =
    options.visits !== undefined ? options.visits : loadSubjectVisits(subjectId);
  const progress =
    options.progress !== undefined
      ? options.progress
      : loadSubjectVisitProgress(studyId, subjectId);

  // 1. Terminal states — preserve unconditionally.
  const terminal = getTerminalSubjectState(subject);
  if (terminal) {
    return terminal;
  }

  // 2. Completed — actual subject-level completion evidence only.
  if (hasSubjectCompletionEvidence(subject, visits)) {
    return "Completed";
  }

  // 3. Ongoing — actual active-participation evidence.
  if (hasActiveParticipationEvidence(subject, visits, progress)) {
    return "Ongoing";
  }

  // 4. Enrolled — actual enrollment evidence.
  if (hasEnrollmentEvidence(subject)) {
    return "Enrolled";
  }

  // 5. Screened — actual screening evidence.
  if (hasScreeningEvidence(subject)) {
    return "Screened";
  }

  return "";
}

// Convenience selector used by consumers that already have a subject in hand.
// Stage 4 (SiteStaff Subject Activity) consumes this without reimplementing
// the screening/enrollment/visit priority chain.
export function getCanonicalSubjectStatus(subject,options: any = {}) {
  return deriveSubjectLifecycleStatus(subject, options);
}
