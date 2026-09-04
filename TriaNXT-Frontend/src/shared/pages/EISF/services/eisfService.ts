import participatingSiteDocuments from "../mock/participatingSiteDocuments";
import eisfModuleDocuments from "../mock/eisfModuleDocuments";

/**
 * Returns all participating site documents.
 */
export function getParticipatingSiteDocuments() {
  return participatingSiteDocuments;
}

/**
 * Generic alias.
 */
export function getAllDocuments() {
  return eisfModuleDocuments;
}

/**
 * Returns mock documents for every eISF module.
 */
export function getEISFModuleDocuments(..._ignored: any[]) {
  return eisfModuleDocuments;
}

/**
 * Returns mock documents for a specific eISF module.
 */
export function getDocumentsByModule(moduleId) {
  return eisfModuleDocuments.filter(
    (document) => document.moduleId === moduleId
  );
}

/**
 * Returns document by id.
 */
export function getDocumentById(documentId) {
  return getAllDocuments().find(
    (document) => document.id === documentId
  );
}

/**
 * Returns documents by section.
 */
export function getDocumentsBySection(sectionId) {
  return getAllDocuments().filter(
    (document) => document.sectionId === sectionId || document.section === sectionId
  );
}

/**
 * Returns documents by folder.
 */
export function getDocumentsByFolder(folderId) {
  return getAllDocuments().filter(
    (document) => document.folderId === folderId
  );
}

/**
 * Returns documents by status.
 */
export function getDocumentsByStatus(status) {
  return getAllDocuments().filter(
    (document) => document.status === status
  );
}

/**
 * Returns documents by document type.
 */
export function getDocumentsByType(documentType) {
  return getAllDocuments().filter(
    (document) => document.documentType === documentType
  );
}

/**
 * Generic search.
 */
export function searchDocuments(searchText = "") {
  const keyword = searchText.trim().toLowerCase();

  if (!keyword) {
    return getAllDocuments();
  }

  return getAllDocuments().filter((document) =>
    [
      document.documentName,
      document.name,
      document.description,
      document.documentType,
      document.status,
      document.fileName,
      document.uploadedBy,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(keyword))
  );
}

/**
 * Returns total document count.
 */
export function getDocumentCount() {
  return getAllDocuments().length;
}

/**
 * Generic reusable filter.
 */
export function filterDocuments(filters: any = {}) {
  const {
    sectionId,
    folderId,
    status,
    documentType,
  } = filters;

  return getAllDocuments().filter((document) => {
    if (sectionId && document.sectionId !== sectionId && document.section !== sectionId) return false;
    if (folderId && document.folderId !== folderId) return false;
    if (status && document.status !== status) return false;
    if (documentType && document.documentType !== documentType) return false;

    return true;
  });
}
