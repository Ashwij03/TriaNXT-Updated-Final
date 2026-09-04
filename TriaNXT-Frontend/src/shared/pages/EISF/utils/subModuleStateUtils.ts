import STORAGE_KEYS from "../Constants/storageKeys";
import { getStorageItem, setStorageItem } from "./storageUtils";

/**
 * Sub-Module Enable/Disable state (Item 9)
 *
 * Stores a map of { [studyCode]: { [sectionId]: boolean } } in localStorage.
 * A missing entry is treated as ENABLED (backwards compatible default).
 *
 * Sections that are DISABLED must:
 *   - stay visible in the module sidebar
 *   - hide documents and details
 *   - block Upload / Edit / Delete / Download of protected content
 * Enabling restores existing documents unchanged.
 */

const STORAGE_KEY = STORAGE_KEYS.SUBMODULE_ENABLED;

function readAll() {
  const value = getStorageItem(STORAGE_KEY, {});
  return value && typeof value === "object" ? value : {};
}

function writeAll(next) {
  setStorageItem(STORAGE_KEY, next);
}

function studyKey(studyCode) {
  return studyCode || "default-study";
}

export function getSubModuleEnabledMap(studyCode) {
  const all = readAll();
  const scope = all[studyKey(studyCode)];
  return scope && typeof scope === "object" ? scope : {};
}

export function isSubModuleEnabled(studyCode, sectionId) {
  if (!sectionId) return true;
  const scope = getSubModuleEnabledMap(studyCode);
  // Default = enabled (undefined means never toggled).
  return scope[sectionId] !== false;
}

export function setSubModuleEnabled(studyCode, sectionId, enabled) {
  if (!sectionId) return;

  const all = readAll();
  const key = studyKey(studyCode);
  const scope = { ...(all[key] || {}) };

  scope[sectionId] = !!enabled;

  writeAll({
    ...all,
    [key]: scope,
  });
}

export function toggleSubModuleEnabled(studyCode, sectionId) {
  const currentlyEnabled = isSubModuleEnabled(studyCode, sectionId);
  setSubModuleEnabled(studyCode, sectionId, !currentlyEnabled);
  return !currentlyEnabled;
}
