const STORAGE_PREFIX = "trianxt_cro_";

export const CRO_STORAGE_KEYS = {
  subjects: `${STORAGE_PREFIX}subjects`,
  visits: `${STORAGE_PREFIX}visits`,
  documents: `${STORAGE_PREFIX}documents`,
  reports: `${STORAGE_PREFIX}reports`,
  comments: `${STORAGE_PREFIX}comments`,
  notifications: `${STORAGE_PREFIX}notifications`,
  files: `${STORAGE_PREFIX}files`,
  settings: `${STORAGE_PREFIX}settings`,
};

export function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to persist CRO data for ${key}:`, err);
  }
}
