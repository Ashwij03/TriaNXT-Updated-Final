import { getEISFModuleDocuments } from "./eisfService";

/**
 * Returns all versions of a document.
 */
export function getDocumentVersions(documentId) {
  const document = getEISFModuleDocuments().find(
    (item) => item.id === documentId
  );

  return document?.versions || [];
}

/**
 * Returns the latest version.
 */
export function getCurrentVersion(documentId) {
  const versions = getDocumentVersions(documentId);

  if (!versions.length) return null;

  return versions.reduce((latest, current) =>
    Number(current.version) > Number(latest.version) ? current : latest
  );
}

/**
 * Returns a version by version id.
 */
export function getVersion(versionId) {
  const documents = getEISFModuleDocuments();

  for (const document of documents) {
    const version = document.versions?.find(
      (item) => item.id === versionId
    );

    if (version) {
      return version;
    }
  }

  return null;
}

/**
 * Returns approved versions.
 */
export function getApprovedVersions(documentId) {
  return getDocumentVersions(documentId).filter(
    (version) => version.status === "Approved"
  );
}

/**
 * Returns superseded versions.
 */
export function getSupersededVersions(documentId) {
  return getDocumentVersions(documentId).filter(
    (version) => version.status === "Superseded"
  );
}

/**
 * Returns version history (latest first).
 * Uses a copied array to avoid mutating source data.
 */
export function getVersionHistory(documentId) {
  return [...getDocumentVersions(documentId)].sort(
    (a, b) => Number(b.version) - Number(a.version)
  );
}

/**
 * Returns latest approved version.
 */
export function getLatestApprovedVersion(documentId) {
  const approvedVersions = getApprovedVersions(documentId);

  if (!approvedVersions.length) return null;

  return approvedVersions.reduce((latest, current) =>
    Number(current.version) > Number(latest.version) ? current : latest
  );
}

/**
 * Checks whether a version is the current version.
 */
export function isCurrentVersion(documentId, versionId) {
  const currentVersion = getCurrentVersion(documentId);

  return currentVersion?.id === versionId;
}

/**
 * Returns version by version number.
 */
export function getVersionByNumber(documentId, versionNumber) {
  return getDocumentVersions(documentId).find(
    (version) => String(version.version) === String(versionNumber)
  );
}

/**
 * Returns version statistics.
 */
export function getVersionStatistics(documentId) {
  const versions = getDocumentVersions(documentId);

  return {
    total: versions.length,
    approved: versions.filter(v => v.status === "Approved").length,
    pending: versions.filter(v => v.status === "Pending").length,
    superseded: versions.filter(v => v.status === "Superseded").length,
    rejected: versions.filter(v => v.status === "Rejected").length,
    current: getCurrentVersion(documentId)
  };
}

/**
 * Returns whether document has multiple versions.
 */
export function hasMultipleVersions(documentId) {
  return getDocumentVersions(documentId).length > 1;
}