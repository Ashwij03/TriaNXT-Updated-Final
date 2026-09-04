import EISFMenuConfig from "../Constants/EISFMenuConfig";

/**
 * Find a section by section id (e.g. 1.0)
 */
export const getSectionById = (sectionId) => {
  return EISFMenuConfig.find((section) => section.id === sectionId) || null;
};

/**
 * Find a section by path
 */
export const getSectionByPath = (path = "") => {
  return (
    EISFMenuConfig.find((section) => section.path === path) || null
  );
};

/**
 * Find a child folder by id (e.g. 1.2)
 */
export const getFolderById = (folderId) => {
  for (const section of EISFMenuConfig) {
    const folder = section.children?.find(
      (child) => child.id === folderId
    );

    if (folder) return folder;
  }

  return null;
};

/**
 * Find a child folder by path
 */
export const getFolderByPath = (path = "") => {
  for (const section of EISFMenuConfig) {
    const folder = section.children?.find(
      (child) => child.path === path
    );

    if (folder) return folder;
  }

  return null;
};

/**
 * Get all folders under a section
 */
export const getSectionFolders = (sectionId) => {
  return getSectionById(sectionId)?.children || [];
};

/**
 * Flatten all folders
 */
export const getAllFolders = () => {
  return EISFMenuConfig.flatMap((section) => section.children || []);
};

/**
 * Search sections & folders
 */
export const searchFolders = (keyword = "") => {
  if (!keyword.trim()) return EISFMenuConfig;

  const value = keyword.toLowerCase();

  return EISFMenuConfig.filter((section) => {
    const sectionMatch = section.title
      ?.toLowerCase()
      .includes(value);

    const childMatch = section.children?.some((child) =>
      child.title?.toLowerCase().includes(value)
    );

    return sectionMatch || childMatch;
  });
};

/**
 * Breadcrumb from folder path
 */
export const getFolderBreadcrumb = (path = "") => {
  for (const section of EISFMenuConfig) {
    const folder = section.children?.find(
      (child) => child.path === path
    );

    if (folder) {
      return [section.title, folder.title];
    }
  }

  return [];
};

/* -------------------------------------------------------------------------- */
/*                          Additional Reusable Helpers                        */
/* -------------------------------------------------------------------------- */

/**
 * Returns all sections.
 */
export const getAllSections = () => EISFMenuConfig;

/**
 * Checks if section exists.
 */
export const hasSection = (sectionId) =>
  !!getSectionById(sectionId);

/**
 * Checks if folder exists.
 */
export const hasFolder = (folderId) =>
  !!getFolderById(folderId);

/**
 * Returns parent section of a folder.
 */
export const getParentSection = (folderId) => {
  return (
    EISFMenuConfig.find((section) =>
      section.children?.some(
        (child) => child.id === folderId
      )
    ) || null
  );
};

/**
 * Returns parent section id.
 */
export const getParentSectionId = (folderId) => {
  return getParentSection(folderId)?.id || null;
};

/**
 * Returns parent section title.
 */
export const getParentSectionTitle = (folderId) => {
  return getParentSection(folderId)?.title || "";
};

/**
 * Returns folder count.
 */
export const getFolderCount = () => {
  return getAllFolders().length;
};

/**
 * Returns section count.
 */
export const getSectionCount = () => {
  return EISFMenuConfig.length;
};

/**
 * Returns folders under a section count.
 */
export const getSectionFolderCount = (sectionId) => {
  return getSectionFolders(sectionId).length;
};

/**
 * Returns whether section has folders.
 */
export const hasChildren = (sectionId) => {
  return getSectionFolders(sectionId).length > 0;
};
