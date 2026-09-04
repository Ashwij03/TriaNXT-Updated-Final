import { readJson } from "../utils/storageHelpers";
import ROLES from "../constants/roles";
import PERMISSIONS from "../constants/permissions";

const ACCESS_LEVELS_KEY = "userAccessLevels";
export const ACCESS_LEVELS_UPDATED = "access-levels-updated";

// Access level constants
export const ACCESS_READ = "Read";
export const ACCESS_READ_WRITE = "Read and Write";
export const ACCESS_EDIT = "Edit";

// Roles that use access-level controls (Admin, SiteStaff, PI always have
// full access and don't need per-user access levels).
const ACCESS_CONTROLLED_ROLES = [ROLES.CRO, ROLES.SPONSOR];

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function notifyAccessLevelsUpdated() {
  window.dispatchEvent(new Event(ACCESS_LEVELS_UPDATED));
  window.dispatchEvent(new Event("permissions-updated"));
}

/**
 * Returns the stored access-level map { [email]: "Read" | "Read and Write" | "Edit" }.
 */
function getAccessLevelMap() {
  return readJson(ACCESS_LEVELS_KEY, {});
}

/**
 * Get the access level for a specific user.
 * Admin, SiteStaff, and PI always return Edit (full access).
 * For CRO/Sponsor, returns the stored level or defaults to Read.
 */
export function getUserAccessLevel(email, role) {
  if (!email) return ACCESS_READ;

  // Admin, SiteStaff, PI always have full access — no access-level control needed.
  if (!ACCESS_CONTROLLED_ROLES.includes(role)) {
    return ACCESS_EDIT;
  }

  const map = getAccessLevelMap();
  return map[String(email).toLowerCase()] || ACCESS_READ;
}

/**
 * Set the access level for a specific user. Only applies to CRO/Sponsor roles.
 */
export function setUserAccessLevel(email, level, role) {
  if (!email) return;

  // Only persist for access-controlled roles.
  if (!ACCESS_CONTROLLED_ROLES.includes(role)) {
    return;
  }

  const map = getAccessLevelMap();
  const key = String(email).toLowerCase();

  if (level === ACCESS_READ) {
    // Read is the default — remove the entry to keep storage clean.
    delete map[key];
  } else {
    map[key] = level;
  }

  writeJson(ACCESS_LEVELS_KEY, map);
  notifyAccessLevelsUpdated();
}

/**
 * Returns true if the given user (email + role) has at least the specified
 * access level. Admin/SiteStaff/PI always return true.
 */
export function userHasAccessLevel(email, role, requiredLevel) {
  const level = getUserAccessLevel(email, role);

  const hierarchy = [ACCESS_READ, ACCESS_READ_WRITE, ACCESS_EDIT];
  const currentIndex = hierarchy.indexOf(level);
  const requiredIndex = hierarchy.indexOf(requiredLevel);

  return currentIndex >= requiredIndex;
}

/**
 * Maps an access level to a set of permissions for the given role.
 * Used by the permission-checking layer to determine what a CRO/Sponsor
 * user is allowed to do based on their assigned access level.
 */
export function getPermissionsForAccessLevel(email, role) {
  if (!ACCESS_CONTROLLED_ROLES.includes(role)) {
    // For Admin/SiteStaff/PI, access-level is irrelevant — they use
    // rolePermissions directly.
    return null;
  }

  const level = getUserAccessLevel(email, role);

  if (level === ACCESS_EDIT) {
    // Full edit access — grant the same broad permissions that CRO/Sponsor
    // base roles have, plus write and delete capabilities.
    return [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_STUDIES,
      PERMISSIONS.CREATE_STUDY,
      PERMISSIONS.EDIT_STUDY,
      PERMISSIONS.DELETE_STUDY,
      PERMISSIONS.VIEW_SUBJECTS,
      PERMISSIONS.CREATE_SUBJECT,
      PERMISSIONS.EDIT_SUBJECT,
      PERMISSIONS.DELETE_SUBJECT,
      PERMISSIONS.VIEW_VISITS,
      PERMISSIONS.CREATE_VISIT,
      PERMISSIONS.EDIT_VISIT,
      PERMISSIONS.COMPLETE_VISIT,
      PERMISSIONS.VIEW_SCREENING,
      PERMISSIONS.CREATE_SCREENING,
      PERMISSIONS.VIEW_ENROLLMENT,
      PERMISSIONS.CREATE_ENROLLMENT,
      PERMISSIONS.VIEW_RANDOMIZATION,
      PERMISSIONS.VIEW_SITE_ACTIVITIES,
      PERMISSIONS.VIEW_MONITORING,
      PERMISSIONS.VIEW_REGULATORY_DOCS,
      PERMISSIONS.UPLOAD_REGULATORY_DOCS,
      PERMISSIONS.EDIT_REGULATORY_DOCS,
      PERMISSIONS.DELETE_REGULATORY_DOCS,
      PERMISSIONS.APPROVE_REGULATORY_DOCS,
      PERMISSIONS.VIEW_COMMENTS,
      PERMISSIONS.CREATE_COMMENT,
      PERMISSIONS.RESOLVE_COMMENT,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.EXPORT_REPORTS,
      PERMISSIONS.VIEW_USERS,
      PERMISSIONS.VIEW_SETTINGS,
      PERMISSIONS.EDIT_SETTINGS,
    ];
  }

  if (level === ACCESS_READ_WRITE) {
    // Read + Write: can view, create, and edit, but not delete or approve.
    return [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_STUDIES,
      PERMISSIONS.CREATE_STUDY,
      PERMISSIONS.EDIT_STUDY,
      PERMISSIONS.VIEW_SUBJECTS,
      PERMISSIONS.CREATE_SUBJECT,
      PERMISSIONS.EDIT_SUBJECT,
      PERMISSIONS.VIEW_VISITS,
      PERMISSIONS.CREATE_VISIT,
      PERMISSIONS.EDIT_VISIT,
      PERMISSIONS.COMPLETE_VISIT,
      PERMISSIONS.VIEW_SCREENING,
      PERMISSIONS.CREATE_SCREENING,
      PERMISSIONS.VIEW_ENROLLMENT,
      PERMISSIONS.CREATE_ENROLLMENT,
      PERMISSIONS.VIEW_RANDOMIZATION,
      PERMISSIONS.VIEW_SITE_ACTIVITIES,
      PERMISSIONS.VIEW_MONITORING,
      PERMISSIONS.VIEW_REGULATORY_DOCS,
      PERMISSIONS.UPLOAD_REGULATORY_DOCS,
      PERMISSIONS.EDIT_REGULATORY_DOCS,
      PERMISSIONS.VIEW_COMMENTS,
      PERMISSIONS.CREATE_COMMENT,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.EXPORT_REPORTS,
      PERMISSIONS.VIEW_SETTINGS,
      PERMISSIONS.EDIT_SETTINGS,
    ];
  }

  // Default: Read-only — view permissions only.
  return [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_STUDIES,
    PERMISSIONS.VIEW_SUBJECTS,
    PERMISSIONS.VIEW_VISITS,
    PERMISSIONS.VIEW_SCREENING,
    PERMISSIONS.VIEW_ENROLLMENT,
    PERMISSIONS.VIEW_RANDOMIZATION,
    PERMISSIONS.VIEW_SITE_ACTIVITIES,
    PERMISSIONS.VIEW_MONITORING,
    PERMISSIONS.VIEW_REGULATORY_DOCS,
    PERMISSIONS.VIEW_COMMENTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_SETTINGS,
  ];
}
