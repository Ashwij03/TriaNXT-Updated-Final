import STORAGE_KEYS from "../Constants/storageKeys";

/**
 * Save value to localStorage
 */
export const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Fadelled to save ${key}`, error);
    return false;
  }
};

/**
 * Read value from localStorage
 */
export const getStorageItem = (key, defaultValue = null) => {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return defaultValue;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(`Failed to read ${key}`, error);
    return defaultValue;
  }
};

/**
 * Remove one storage item
 */
export const removeStorageItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove ${key}`, error);
    return false;
  }
};

/**
 * Clear all eISF storage
 */
export const clearEISFStorage = () => {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });

  return true;
};

/* -------------------------------------------------------------------------- */
/*                              Generic Helpers                               */
/* -------------------------------------------------------------------------- */

/**
 * Check whether storage key exists.
 */
export const hasStorageItem = (key) => {
  return localStorage.getItem(key) !== null;
};

/**
 * Toggle boolean storage value.
 */
export const toggleStorageItem = (
  key,
  defaultValue = false
) => {
  const value = getStorageItem(key, defaultValue);

  setStorageItem(key, !value);

  return !value;
};

/**
 * Returns all eISF storage values.
 */
export const getAllStorageItems = () => {
  const storage: Record<string, any> = {};;

  Object.values(STORAGE_KEYS).forEach((key) => {
    storage[key] = getStorageItem(key);
  });

  return storage;
};

/**
 * Merge existing object with new values.
 */
export const updateStorageItem = (
  key,newValue: any = {}) => {
  const currentValue = getStorageItem(key, {});

  const updatedValue = {
    ...currentValue,
    ...newValue,
  };

  setStorageItem(key, updatedValue);

  return updatedValue;
};

/* -------------------------------------------------------------------------- */
/*                              Selected Folder                               */
/* -------------------------------------------------------------------------- */

export const setSelectedFolder = (folder) =>
  setStorageItem(STORAGE_KEYS.SELECTED_FOLDER, folder);

export const getSelectedFolder = () =>
  getStorageItem(STORAGE_KEYS.SELECTED_FOLDER);

/* -------------------------------------------------------------------------- */
/*                             Selected Document                              */
/* -------------------------------------------------------------------------- */

export const setSelectedDocument = (document) =>
  setStorageItem(STORAGE_KEYS.SELECTED_DOCUMENT, document);

export const getSelectedDocument = () =>
  getStorageItem(STORAGE_KEYS.SELECTED_DOCUMENT);

/* -------------------------------------------------------------------------- */
/*                                   Search                                   */
/* -------------------------------------------------------------------------- */

export const setSearchValue = (value) =>
  setStorageItem(STORAGE_KEYS.SEARCH, value);

export const getSearchValue = () =>
  getStorageItem(STORAGE_KEYS.SEARCH, "");

export const clearSearchValue = () =>
  removeStorageItem(STORAGE_KEYS.SEARCH);

/* -------------------------------------------------------------------------- */
/*                                   Filters                                  */
/* -------------------------------------------------------------------------- */

export const setFilters = (filters) =>
  setStorageItem(STORAGE_KEYS.FILTERS, filters);

export const getFilters = () =>
  getStorageItem(STORAGE_KEYS.FILTERS, {});

export const clearFilters = () =>
  removeStorageItem(STORAGE_KEYS.FILTERS);

/* -------------------------------------------------------------------------- */
/*                                 View Mode                                  */
/* -------------------------------------------------------------------------- */

export const setViewMode = (mode) =>
  setStorageItem(STORAGE_KEYS.VIEW_MODE, mode);

export const getViewMode = () =>
  getStorageItem(STORAGE_KEYS.VIEW_MODE, "grid");

/* -------------------------------------------------------------------------- */
/*                                   Sorting                                  */
/* -------------------------------------------------------------------------- */

export const setSortBy = (sortBy) =>
  setStorageItem(STORAGE_KEYS.SORT_BY, sortBy);

export const getSortBy = () =>
  getStorageItem(STORAGE_KEYS.SORT_BY, "name");

export const clearSortBy = () =>
  removeStorageItem(STORAGE_KEYS.SORT_BY);
