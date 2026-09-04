// Global header search — matches studies (with full details) and subjects.

import { getStudies } from "../services/studyService";
import { getAllSubjects } from "../services/subjectService";
import {
  getAccessibleStudies,
  getStudiesForSite,
  isAdmin,
  getCurrentUser
} from "../services/roleService";

/**
 * Get all subjects from the canonical subjectService (single source of truth).
 * This replaces the old direct localStorage read.
 */
function getAllSubjectsFlat() {
  try {
    const all = getAllSubjects();

    return all.map((subject) => ({
      type: "subject",
      id: subject.id || subject.subjectId,
      studyKey: subject.studyId,
      label: subject.id || subject.subjectId,
      meta: [
        subject.status,
        subject.site,
        subject.pi,
        subject.studyId,
      ]
        .filter(Boolean)
        .join(" • ")
    }));
  } catch {
    return [];
  }
}

function getStudySearchFields(study) {
  return [
    study.name,
    study.code,
    study.protocol,
    study.site,
    study.location,
    study.status,
    study.sponsor,
    study.principalInvestigator,
    study.description,
    study.phase
  ]
    .filter(Boolean)
    .map(String);
}

export function searchHeader(query, { institutionFilter }: any = {}) {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return [];
  }

  const user = getCurrentUser();
  const studies = isAdmin(user)
    ? getStudiesForSite(institutionFilter)
    : getAccessibleStudies(user);

  const studyResults = studies
    .filter((study) =>
      getStudySearchFields(study).some((field) =>
        field.toLowerCase().includes(trimmed)
      )
    )
    .slice(0, 5)
    .map((study) => ({
      type: "study",
      study,
      label: study.name || study.code,
      meta: [
        study.code,
        study.protocol,
        study.principalInvestigator
          ? `PI: ${study.principalInvestigator}`
          : null,
        study.site,
        study.status,
        study.sponsor ? `Sponsor: ${study.sponsor}` : null
      ]
        .filter(Boolean)
        .join(" • ")
    }));

  const subjectResults = getAllSubjectsFlat()
    .filter(
      (subject) =>
        String(subject.label || "")
          .toLowerCase()
          .includes(trimmed) ||
        String(subject.meta || "")
          .toLowerCase()
          .includes(trimmed)
    )
    .slice(0, 4);

  return [...studyResults, ...subjectResults];
}

export function getStudiesForSearchContext(institutionFilter) {
  const user = getCurrentUser();

  if (isAdmin(user)) {
    return getStudiesForSite(institutionFilter);
  }

  return getAccessibleStudies(user);
}

export { getStudies };
