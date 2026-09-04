/**
 * Subject Explorer - SUBJECT RECORDS (thin wrapper)
 * ==================================================
 *
 * This module is now a thin wrapper around the canonical `subjectService.js`.
 * All logic has been consolidated into `src/shared/services/subjectService.js`
 * to eliminate the duplicate data stores and inconsistent filtering that
 * caused the cross-study data leak.
 *
 * Existing importers (StudySubjectsWorkspace.js, SubjectExplorer.js, etc.)
 * continue to work unchanged — they import from this file and get the same
 * API. New code should import from `subjectService` directly.
 */

import SubjectService from "../../services/subjectService";

/** All metadata records for a study, cross-checked by studyId. */
export function getSubjectsForStudy(studyId) {
  return SubjectService.getSubjectsForStudy(studyId);
}

export function findSubjectRecord(studyId, subjectId) {
  return SubjectService.findSubjectRecord(studyId, subjectId);
}

export function subscribeSubjects(handler) {
  return SubjectService.subscribeSubjects(handler);
}

export function ensureSubjectRecord(studyId, subjectId) {
  return SubjectService.ensureSubjectRecord(studyId, subjectId);
}

export function updateSubjectRecord(studyId, subjectId, updatedFields) {
  return SubjectService.updateSubjectRecord(studyId, subjectId, updatedFields);
}

export function deleteSubjectRecord(studyId, subjectId) {
  return SubjectService.deleteSubjectRecord(studyId, subjectId);
}

export function getSubjectDetailFields(studyId, subjectId) {
  return SubjectService.getSubjectDetailFields(studyId, subjectId);
}

const SubjectRecordsService = {
  getSubjectsForStudy,
  findSubjectRecord,
  subscribeSubjects,
  ensureSubjectRecord,
  updateSubjectRecord,
  deleteSubjectRecord,
  getSubjectDetailFields,
};

export default SubjectRecordsService;
