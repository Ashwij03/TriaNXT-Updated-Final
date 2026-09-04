// Shared header filter keys, storage helpers, and change events.

export const SELECTED_INDICATION_KEY = "selectedIndication";
export const SELECTED_INSTITUTION_KEY = "selectedInstitution";
export const SELECTED_SITE_NUMBER_KEY = "selectedSiteNumber";
export const SELECTED_SPONSOR_KEY = "selectedSponsor";
export const SELECTED_CRO_KEY = "selectedCRO";
export const SELECTED_STUDY_FILTER_KEY = "selectedStudyFilter";
export const SELECTED_SUBJECT_KEY = "selectedSubject";
export const ADMIN_PREVIEW_ROLE_KEY = "adminPreviewRole";
export const ADMIN_PREVIEW_ROLE_EVENT = "adminPreviewRoleChange";
export const PI_PREVIEW_ROLE_KEY = "piPreviewRole";
export const PI_PREVIEW_ROLE_EVENT = "piPreviewRoleChange";
export const INSTITUTION_FILTER_EVENT = "institutionFilterChange";
export const HEADER_FILTERS_EVENT = "headerFiltersChange";
// Task 14 — eISF Sidebar Auto Close: fired once whenever a Study
// Details page's eISF tab becomes active, so whichever dashboard shell
// is currently mounted (Admin/SiteStaff/PI/CRO/Sponsor) can collapse its
// own sidebar. Every other tab/page leaves the sidebar exactly as the
// user last left it.
//
// Also fired for the Subjects tab (see StudyDashboard.js) so opening
// Subjects collapses the sidebar the same way opening eISF does, without
// a second event/listener pair.
export const EISF_SIDEBAR_COLLAPSE_EVENT = "eisfSidebarAutoCollapse";

function dispatchFilterEvent(detail: any = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(HEADER_FILTERS_EVENT, { detail })
  );
}

export function getStoredValue(key) {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(key) || "";
}

export function setStoredValue(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

export function getStoredInstitutionFilter() {
  return getStoredValue(SELECTED_INSTITUTION_KEY);
}

export function setStoredInstitutionFilter(value) {
  setStoredValue(SELECTED_INSTITUTION_KEY, value);
  dispatchFilterEvent({ institution: value });

  window.dispatchEvent(
    new CustomEvent(INSTITUTION_FILTER_EVENT, { detail: value })
  );
}

export function getStoredIndicationFilter() {
  return getStoredValue(SELECTED_INDICATION_KEY);
}

export function setStoredIndicationFilter(value) {
  setStoredValue(SELECTED_INDICATION_KEY, value);
  dispatchFilterEvent({ indication: value });
}

export function getStoredSiteNumberFilter() {
  return getStoredValue(SELECTED_SITE_NUMBER_KEY);
}

export function setStoredSiteNumberFilter(value) {
  setStoredValue(SELECTED_SITE_NUMBER_KEY, value);
  dispatchFilterEvent({ siteNumber: value });
}

export function getStoredSponsorFilter() {
  return getStoredValue(SELECTED_SPONSOR_KEY);
}

export function setStoredSponsorFilter(value) {
  setStoredValue(SELECTED_SPONSOR_KEY, value);
  dispatchFilterEvent({ sponsor: value });
}

export function getStoredCROFilter() {
  return getStoredValue(SELECTED_CRO_KEY);
}

export function setStoredCROFilter(value) {
  setStoredValue(SELECTED_CRO_KEY, value);
  dispatchFilterEvent({ cro: value });
}

export function getStoredStudyFilter() {
  return getStoredValue(SELECTED_STUDY_FILTER_KEY);
}

export function setStoredStudyFilter(value) {
  setStoredValue(SELECTED_STUDY_FILTER_KEY, value);
  dispatchFilterEvent({ study: value });
}

export function getStoredSubjectFilter() {
  const raw = getStoredValue(SELECTED_SUBJECT_KEY);

  if (!raw) {
    return "";
  }

  // The "selectedSubject" key is also used elsewhere in the app (subjects
  // workspace, sidebar navigation, PI/CRO pages) to store a full subject
  // object (e.g. { id, studyId }) rather than a plain id string. Support
  // both shapes so the header filter stays in sync no matter who wrote it.
  try {
    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === "object") {
      return String(parsed.id || parsed.subjectId || "");
    }
  } catch {
    // Not JSON — it's already a plain subject id string.
  }

  return raw;
}

export function setStoredSubjectFilter(value) {
  setStoredValue(SELECTED_SUBJECT_KEY, value);
  dispatchFilterEvent({ subject: value });
}

export function getStoredAdminPreviewRole() {
  return getStoredValue(ADMIN_PREVIEW_ROLE_KEY);
}

export function setStoredAdminPreviewRole(role) {
  if (typeof window === "undefined") {
    return;
  }

  const nextRole = role || "";
  const currentRole = getStoredAdminPreviewRole() || "";

  if (nextRole === currentRole) {
    return;
  }

  if (role) {
    localStorage.setItem(ADMIN_PREVIEW_ROLE_KEY, role);
  } else {
    localStorage.removeItem(ADMIN_PREVIEW_ROLE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(ADMIN_PREVIEW_ROLE_EVENT, { detail: role || "" })
  );
}

export function getStoredPIPreviewRole() {
  return getStoredValue(PI_PREVIEW_ROLE_KEY);
}

export function setStoredPIPreviewRole(role) {
  if (typeof window === "undefined") {
    return;
  }

  const nextRole = role || "";
  const currentRole = getStoredPIPreviewRole() || "";

  if (nextRole === currentRole) {
    return;
  }

  if (role) {
    localStorage.setItem(PI_PREVIEW_ROLE_KEY, role);
  } else {
    localStorage.removeItem(PI_PREVIEW_ROLE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(PI_PREVIEW_ROLE_EVENT, { detail: role || "" })
  );
}

// Task: Filter Cascade Consistency — shared at module scope (rather than
// re-built inline inside clearDependentFilters) so callers like
// EnterpriseNavbarBase can also ask "which filters depend on this one" via
// getDependentFilterKeys and keep their own local dropdown state in sync
// with whatever clearDependentFilters just wiped out of storage. Previously
// the cascade only cleared localStorage; nothing told the header which of
// its own React state values (selectedSponsor, selectedCRO, etc.) had gone
// stale, so a dropdown could keep visually showing a value that no longer
// existed in storage — e.g. picking "All Indications" cleared Sponsor/CRO/
// Site/Study/Subject in storage but left those dropdowns displaying their
// old selections.
const FILTER_CASCADE = {
  [SELECTED_INDICATION_KEY]: [
    SELECTED_SPONSOR_KEY,
    SELECTED_CRO_KEY,
    SELECTED_INSTITUTION_KEY,
    SELECTED_SITE_NUMBER_KEY,
    SELECTED_STUDY_FILTER_KEY,
    SELECTED_SUBJECT_KEY
  ],
  [SELECTED_SPONSOR_KEY]: [
    SELECTED_CRO_KEY,
    SELECTED_INSTITUTION_KEY,
    SELECTED_SITE_NUMBER_KEY,
    SELECTED_STUDY_FILTER_KEY,
    SELECTED_SUBJECT_KEY
  ],
  [SELECTED_CRO_KEY]: [
    SELECTED_INSTITUTION_KEY,
    SELECTED_SITE_NUMBER_KEY,
    SELECTED_STUDY_FILTER_KEY,
    SELECTED_SUBJECT_KEY
  ],
  [SELECTED_INSTITUTION_KEY]: [
    SELECTED_SITE_NUMBER_KEY,
    SELECTED_STUDY_FILTER_KEY,
    SELECTED_SUBJECT_KEY
  ],
  [SELECTED_SITE_NUMBER_KEY]: [
    SELECTED_STUDY_FILTER_KEY,
    SELECTED_SUBJECT_KEY
  ],
  [SELECTED_STUDY_FILTER_KEY]: [SELECTED_SUBJECT_KEY]
};

export function getDependentFilterKeys(fromKey) {
  return FILTER_CASCADE[fromKey] || [];
}

export function clearDependentFilters(fromKey) {
  getDependentFilterKeys(fromKey).forEach((key) => setStoredValue(key, ""));
}

// Task 18 (Dashboard Opens Filter-Free): every key a Dashboard route's
// widgets can be scoped by, in one place, so any Dashboard page can force
// itself back to the complete/unfiltered view on mount without guessing
// which keys matter. Clears storage for all of them and fires a single
// HEADER_FILTERS_EVENT once everything is already cleared, so any listener
// that reacts to the event reads fully-reset values instead of a partial
// cascade.
export const ALL_HEADER_FILTER_KEYS = [
  SELECTED_INDICATION_KEY,
  SELECTED_SPONSOR_KEY,
  SELECTED_CRO_KEY,
  SELECTED_INSTITUTION_KEY,
  SELECTED_SITE_NUMBER_KEY,
  SELECTED_STUDY_FILTER_KEY,
  SELECTED_SUBJECT_KEY
];

export function resetAllHeaderFilters() {
  ALL_HEADER_FILTER_KEYS.forEach((key) => setStoredValue(key, ""));
  dispatchFilterEvent({ reset: true });
}