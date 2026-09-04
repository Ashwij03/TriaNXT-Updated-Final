import { normalizeStatus } from "./normalizeStatus";
import { getAllSubjects } from "../services/subjectService";
export const SUBJECT_STATUS_ORDER = [
  "Screened",
  "Enrolled",
  "Ongoing",
  "Completed",
  "Withdrawn",
  "Dropout"
];

export function getSubjectStatusAnalytics(subjects: any = []) {
  const counts = Object.fromEntries(
    SUBJECT_STATUS_ORDER.map((status) => [status, 0])
  );

  subjects.forEach((subject) => {
    const normalized = normalizeStatus(subject?.status);

    if (normalized) {
      counts[normalized] += 1;
    }
  });

  return SUBJECT_STATUS_ORDER.map((name) => ({
    name,
    value: counts[name]
  }));
}

/**
 * Get all subjects from the canonical subjectService (single source of truth).
 * Each subject is tagged with its owning studyKey.
 */
export function getAllSubjectsFromStorage() {
  try {
    return getAllSubjects().map((subject) => ({
      ...subject,
      studyKey: subject.studyId,
    }));
  } catch {
    return [];
  }
}
