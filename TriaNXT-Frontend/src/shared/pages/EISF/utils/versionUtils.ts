/**
 * Returns latest version from version list
 */
export const getCurrentVersion = (versions: any = []) => {
  if (!versions.length) return null;

  return [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
};

/**
 * Returns previous versions
 */
export const getPreviousVersions = (versions: any = []) => {
  if (versions.length <= 1) return [];

  return sortVersions(versions).slice(1);
};

/**
 * Find version by id
 */
export const getVersionById = (versions: any = [], versionId) => {
  return versions.find((version) => version.id === versionId) || null;
};

/**
 * Check if version is latest
 */
export const isLatestVersion = (versions: any = [], versionId) => {
  return getCurrentVersion(versions)?.id === versionId;
};

/**
 * Sort versions (Newest First)
 */
export const sortVersions = (versions: any = []) => {
  return [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

/**
 * Format version label
 */
export const formatVersion = (version) => {
  if (version === null || version === undefined || version === "") {
    return "v1";
  }

  return `v${version}`;
};

/**
 * Generate next version number
 */
export const getNextVersion = (versions: any = []) => {
  if (!versions.length) return 1;

  const maxVersion = Math.max(
    ...versions.map((version) => Number(version.version) || 1)
  );

  return maxVersion + 1;
};

/**
 * Filter superseded versions
 */
export const getSupersededVersions = (versions: any = []) => {
  return versions.filter(
    (version) => version.status === "Superseded"
  );
};

/**
 * Filter approved versions
 */
export const getApprovedVersions = (versions: any = []) => {
  return versions.filter(
    (version) => version.status === "Approved"
  );
};

/**
 * Group versions by document
 */
export const groupVersionsByDocument = (versions: any = []) => {
  return versions.reduce((groups, version) => {
    const key = version.documentId;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(version);

    return groups;
  }, {});
};

/* -------------------------------------------------------------------------- */
/*                         Additional Reusable Helpers                         */
/* -------------------------------------------------------------------------- */

/**
 * Returns version count.
 */
export const getVersionCount = (versions: any = []) => versions.length;

/**
 * Returns whether document has multiple versions.
 */
export const hasMultipleVersions = (versions: any = []) =>
  versions.length > 1;

/**
 * Returns latest approved version.
 */
export const getLatestApprovedVersion = (versions: any = []) => {
  return sortVersions(
    getApprovedVersions(versions)
  )[0] || null;
};

/**
 * Returns latest superseded version.
 */
export const getLatestSupersededVersion = (versions: any = []) => {
  return sortVersions(
    getSupersededVersions(versions)
  )[0] || null;
};

/**
 * Returns version by version number.
 */
export const getVersionByNumber = (versions: any = [],
  versionNumber
) => {
  return (
    versions.find(
      (version) =>
        String(version.version) === String(versionNumber)
    ) || null
  );
};

/**
 * Returns version statistics.
 */
export const getVersionStatistics = (versions: any = []) => ({
  total: versions.length,
  approved: getApprovedVersions(versions).length,
  superseded: getSupersededVersions(versions).length,
  latest: getCurrentVersion(versions),
});

/**
 * Returns unique version numbers.
 */
export const getVersionNumbers = (versions: any = []) => {
  return [...new Set<any>(versions.map((v) => v.version))];
};