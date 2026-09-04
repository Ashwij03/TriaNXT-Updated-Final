export function readJson(key, fallback = null) {
  if (typeof window === "undefined" || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) ?? fallback : fallback;
  } catch {
    return fallback;
  }
}

export function readStorage(key, fallbackValue = null) {
  return readJson(key, fallbackValue);
}

export function readStorageArray(key) {
  const value = readStorage(key, []);
  return Array.isArray(value) ? value : [];
}
