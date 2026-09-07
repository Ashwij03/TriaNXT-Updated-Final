// UPDATED: Central role-based access service — scopes data and routes per RBAC docs

import ROLES from "../constants/roles";
import PERMISSIONS from "../constants/permissions";
import rolePermissions from "../utils/rolePermissions";
import { getPermissionsForAccessLevel } from "./accessLevelService";
import {
  getStoredAdminPreviewRole,
  getStoredPIPreviewRole,
  setStoredAdminPreviewRole,
  setStoredPIPreviewRole,
} from "../constants/headerFilters";
import { getStudies } from "./studyService";
import { api, isApiEnabled } from "./api/client";
import { establishBackendSession } from "./backendSession";
import { PROFILE_PHOTO_EVENT } from "../constants/profileEvents";

const SITES_STORAGE_KEY = "sites";

const ORG_TO_SITE = {
  "Apollo Hospitals": "Apollo Hospital",
  "Fortis Healthcare": "Fortis Healthcare",
  "Manipal Hospitals": "City Hospital",
  "Max Healthcare": "City Hospital",
  "Aster Hospitals": "Fortis Healthcare",
};

export function getCurrentUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem("currentUser")) || null;
  } catch {
    return null;
  }
}

export function getAssignedSite(user = getCurrentUser()) {
  if (!user) {
    return null;
  }

  if (user.role === ROLES.ADMIN) {
    return null;
  }

  return (
    user.assignedSite ||
    ORG_TO_SITE[user.orgType] ||
    user.orgType ||
    user.site ||
    null
  );
}

export function isAdmin(user = getCurrentUser()) {
  return user?.role === ROLES.ADMIN;
}

export function getAdminPreviewRole() {
  return getStoredAdminPreviewRole() || null;
}

export function setAdminPreviewRole(role) {
  if (!role || role === ROLES.ADMIN) {
    setStoredAdminPreviewRole("");
    return;
  }

  setStoredAdminPreviewRole(role);
}

export function getPIPreviewRole() {
  return getStoredPIPreviewRole() || null;
}

export function setPIPreviewRole(role) {
  if (!role || role === ROLES.PI) {
    setStoredPIPreviewRole("");
    return;
  }

  if (role === ROLES.SITE_STAFF) {
    setStoredPIPreviewRole(role);
  }
}

export function isPIViewingAsSiteStaff(user = getCurrentUser()) {
  return user?.role === ROLES.PI && getPIPreviewRole() === ROLES.SITE_STAFF;
}

export function formatUserDisplayName(user = getCurrentUser()) {
  if (!user) {
    return "";
  }

  const rawName =
    user.displayName ||
    user.name ||
    [user.firstName, user.middleName, user.lastName]
      .filter(Boolean)
      .join(" ") ||
    "";

  const normalizedName = String(rawName).trim().replace(/\s+/g, " ");

  if (!normalizedName) {
    return "";
  }

  const role = String(user.role || "").trim();
  const hasPIRole = role === ROLES.PI || role.toLowerCase() === "pi";

  if (hasPIRole && !normalizedName.toLowerCase().startsWith("dr.")) {
    return `Dr. ${normalizedName}`;
  }

  return normalizedName;
}

export function getUserDisplayName(user = getCurrentUser()) {
  return formatUserDisplayName(user);
}

export function getAuthenticatedRole(user = getCurrentUser()) {
  return user?.role || null;
}

export function getEffectiveRole(user = getCurrentUser()) {
  if (!user) {
    return null;
  }

  if (isAdmin(user)) {
    return getAdminPreviewRole() || ROLES.ADMIN;
  }

  if (user.role === ROLES.PI) {
    return getPIPreviewRole() || ROLES.PI;
  }

  return user.role;
}

export function getEffectiveUser(user = getCurrentUser()) {
  if (!user) {
    return null;
  }

  const effectiveRole = getEffectiveRole(user);
  const effectiveUser =
    effectiveRole === user.role ? user : { ...user, role: effectiveRole };

  return {
    ...effectiveUser,
    displayName: formatUserDisplayName(effectiveUser),
  };
}

export function isAdminViewingAsRole(user = getCurrentUser()) {
  return isAdmin(user) && getEffectiveRole(user) !== ROLES.ADMIN;
}

export function hasPermission(permission, user = getCurrentUser()) {
  if (!user) {
    return false;
  }

  const effectiveRole = getEffectiveRole(user);

  if (effectiveRole === ROLES.ADMIN || user.permissions?.includes("*")) {
    return true;
  }

  // For CRO/Sponsor roles, use access-level-based permissions instead of
  // the static rolePermissions map — this is how the Access column in
  // Permission Approval / User Directory actually controls what the user
  // can do in the application.
  const accessLevelPermissions = getPermissionsForAccessLevel(
    user.email,
    effectiveRole,
  );

  if (accessLevelPermissions !== null) {
    return accessLevelPermissions.includes(permission);
  }

  const permissions = rolePermissions[effectiveRole] || [];
  return permissions.includes(permission);
}

export function getDashboardPath(role) {
  switch (role) {
    case ROLES.ADMIN:
      return "/admin-dashboard";
    case ROLES.SITE_STAFF:
      return "/site-staff-dashboard";
    case ROLES.PI:
      return "/pi-dashboard";
    case ROLES.CRO:
      return "/cro-dashboard";
    case ROLES.SPONSOR:
      return "/sponsor-dashboard";
    default:
      return "/dashboard";
  }
}

function readSitesFromStorage() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(localStorage.getItem(SITES_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function getAccessibleSites(user = getCurrentUser()) {
  const sites = readSitesFromStorage();

  if (isAdmin(user)) {
    return sites;
  }

  const assignedSite = getAssignedSite(user);

  if (!assignedSite) {
    return sites;
  }

  return sites.filter(
    (site) => site.id === assignedSite || matchesOrg(site.name, assignedSite),
  );
}

// UPDATED: CRO and Sponsor users are not tied to a single site the way
// Site Staff / PI are — they oversee studies across many sites. Filtering
// them by assignedSite (a site-based concept) incorrectly returned zero
// studies even when the sidebar (which reads studies directly) showed
// them correctly. CRO/Sponsor now match on their organization against
// the study's cro/sponsor field instead, matching the sidebar's data
// source. Admin/Site Staff/PI behavior is unchanged.
function getUserOrgName(user) {
  return (
    user?.organization ||
    user?.orgType ||
    user?.assignedSite ||
    user?.company ||
    user?.name ||
    ""
  );
}

export function matchesOrg(value, orgName) {
  if (!value || !orgName) {
    return false;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  const normalizedOrg = String(orgName).trim().toLowerCase();

  return (
    normalizedValue === normalizedOrg ||
    normalizedValue.includes(normalizedOrg) ||
    normalizedOrg.includes(normalizedValue)
  );
}

// ---------------------------------------------------------------------------
// Per-user scope_data code filtering (RBAC backend parity)
//
// Mirrors the FastAPI record-level scoping (_scope_condition in
// tria_engine/apps/ctms/common.py): a record is hidden when it carries an
// explicit study/site CODE that is not in the user's assigned scope codes
// (user.scope_data). Records without an explicit code stay visible (the
// backend treats NULL study/site columns as org-level rows). Admin and
// users with no scope_data are unrestricted — identical to the backend
// superuser / empty-scope behavior.
// ---------------------------------------------------------------------------

export function getUserScopeRestrictions(user = getCurrentUser()) {
  if (!user || isAdmin(user)) {
    return { studies: [], sites: [] };
  }
  const scope = user?.scope_data || {};
  return {
    studies: normalizeScopeCodes(scope.studies),
    sites: normalizeScopeCodes(scope.sites),
  };
}

export function firstRecordCode(record, keys) {
  if (!record || typeof record !== "object") {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

// Study rows carry their study code on `code` (normalized) and optionally a
// site code on siteCode/siteNo/siteNumber. Scope codes are exact matches
// (same as the backend SQL `IN` comparisons).
export function restrictStudiesToUserScope(
  studies,
  user = getCurrentUser()
) {
  const scope = getUserScopeRestrictions(user);
  if (!scope.studies.length && !scope.sites.length) {
    return studies;
  }
  return (studies || []).filter((study) => {
    const studyCode = firstRecordCode(study, ["code", "studyId", "study_code"]);
    if (scope.studies.length && studyCode && !scope.studies.includes(studyCode)) {
      return false;
    }
    const siteCode = firstRecordCode(study, [
      "siteCode",
      "siteNo",
      "siteNumber",
      "site_code",
    ]);
    if (scope.sites.length && siteCode && !scope.sites.includes(siteCode)) {
      return false;
    }
    return true;
  });
}

// Subject rows carry their study on `studyId`/`studyCode` and (when present)
// an explicit site code on `siteCode`. Applied to flat subject lists and
// per-study subject stores so subject counts never include rows whose study
// or explicit site code is outside the user's scope.
export function restrictSubjectsToUserScope(
  subjects,
  user = getCurrentUser()
) {
  const scope = getUserScopeRestrictions(user);
  if (!scope.studies.length && !scope.sites.length) {
    return subjects;
  }
  return (subjects || []).filter((subject) => {
    const studyCode = firstRecordCode(subject, ["studyId", "studyCode", "study"]);
    if (scope.studies.length && studyCode && !scope.studies.includes(studyCode)) {
      return false;
    }
    const siteCode = firstRecordCode(subject, ["siteCode"]);
    if (scope.sites.length && siteCode && !scope.sites.includes(siteCode)) {
      return false;
    }
    return true;
  });
}

export function getAccessibleStudiesBase(user = getCurrentUser()) {
  const studies = getStudies();

  if (isAdmin(user)) {
    return studies;
  }

  const effectiveRole = user?.role;

  if (effectiveRole === ROLES.CRO || effectiveRole === ROLES.SPONSOR) {
    const orgName = getUserOrgName(user);

    if (!orgName) {
      return studies;
    }

    const studyField = effectiveRole === ROLES.CRO ? "cro" : "sponsor";

    // A2 (Role-Scoped Study Visibility): decide per study, not for the
    // whole list. A study that IS explicitly assigned to a different
    // CRO/Sponsor must never be shown — falling back to "show everything"
    // here would leak another organization's study data.
    //
    // For CRO specifically: a study with no CRO recorded is not this CRO's
    // study, so it must be excluded rather than shown by default — a CRO
    // user should only ever see studies that list their own CRO name.
    // Sponsor keeps its existing behavior (an unassigned sponsor study
    // stays visible) since that wasn't part of this fix.
    return studies.filter((study) => {
      const fieldValue = study[studyField];

      if (!fieldValue) {
        return effectiveRole !== ROLES.CRO;
      }

      return matchesOrg(fieldValue, orgName);
    });
  }

  const assignedSite = getAssignedSite(user);

  if (!assignedSite) {
    return studies;
  }

  const siteScopedStudies = studies.filter((study) => {
    const studySite = study.site || study.location || "";
    return matchesOrg(studySite, assignedSite);
  });

  if (effectiveRole !== ROLES.PI) {
    return siteScopedStudies;
  }

  // A PI must additionally be the named Principal Investigator recorded on
  // the study — being at the right site isn't enough, since multiple PIs
  // can be registered at the same site. Match against the PI's registered
  // name (First Name + Last Name from registration), the same way name is
  // stored in the study's principalInvestigator field. A study with no PI
  // recorded yet is treated as unassigned and stays visible, consistent
  // with the fallback used for unassigned CRO/Sponsor studies above.
  const piName = user?.name || "";

  if (!piName) {
    return siteScopedStudies;
  }

  return siteScopedStudies.filter((study) => {
    const studyPi = study.principalInvestigator || "";

    if (!studyPi) {
      return true;
    }

    return matchesOrg(studyPi, piName);
  });
}

export function getAccessibleStudies(user = getCurrentUser()) {
  // RBAC scope_data codes on top of the role/org/site visibility logic, so
  // the UI can never surface a study outside the Admin-assigned scope.
  return restrictStudiesToUserScope(getAccessibleStudiesBase(user), user);
}

// UPDATED: returns studies scoped to an arbitrary site name (used by Admin
// header institution filter, independent of the logged-in user's own site).
export function getStudiesForSite(siteName) {
  const studies = getStudies();

  if (!siteName) {
    return studies;
  }

  return studies.filter((study) => {
    const studySite = study.site || study.location || "";
    return matchesOrg(studySite, siteName);
  });
}

// UPDATED: role labels + list used to populate the Admin header's role
// switcher dropdown.
export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.SITE_STAFF]: "Site Staff",
  [ROLES.PI]: "Principal Investigator",
  [ROLES.CRO]: "CRO",
  [ROLES.SPONSOR]: "Sponsor",
};

export function getAllRoles() {
  return Object.values(ROLES).map((role) => ({
    value: role,
    label: ROLE_LABELS[role] || role,
  }));
}

// UPDATED: roles whose dashboard the Admin header can switch into.
export const SWITCHABLE_ROLE_DASHBOARDS = [
  ROLES.SITE_STAFF,
  ROLES.PI,
  ROLES.CRO,
  ROLES.SPONSOR,
];

export function filterBySite(
  items,
  siteField = "site",
  user = getCurrentUser(),
) {
  if (!Array.isArray(items)) {
    return [];
  }

  if (isAdmin(user)) {
    return items;
  }

  const assignedSite = getAssignedSite(user);

  if (!assignedSite) {
    return items;
  }

  return items.filter((item) => {
    const value = item[siteField] || item.siteName || item.location || "";
    return matchesOrg(value, assignedSite);
  });
}

export function canAccessRoute(path, user = getCurrentUser()) {
  if (!user) {
    return false;
  }

  const routeUser = getEffectiveUser(user);

  if (routeUser.role === ROLES.ADMIN) {
    return true;
  }

  const routeAccess = {
    "/admin-dashboard": [ROLES.ADMIN],
    "/admin-livechat": [ROLES.ADMIN],
    "/site-staff-dashboard": [ROLES.SITE_STAFF, ROLES.PI],
    "/site-staff-livechat": [ROLES.SITE_STAFF, ROLES.PI],
    "/pi-dashboard": [ROLES.PI],
    "/cro-dashboard": [ROLES.CRO],
    "/sponsor-dashboard": [ROLES.SPONSOR],
    "/user-management": [ROLES.ADMIN, ROLES.SITE_STAFF],
    "/permission-approval": [ROLES.ADMIN, ROLES.SITE_STAFF],
    "/access-permission": [ROLES.ADMIN, ROLES.SITE_STAFF],
    "/cro-overview": [ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.CRO],
    // ===== START: Safety / AI Review / eTMF route access =====
    "/safety": [ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR],
    "/ai-review": [ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR],
    "/etmf": [ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR],
    // ===== END: Safety / AI Review / eTMF route access =====
    // ===== START: Monitoring Access route access =====
    "/monitoring-access": [ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.CRO, ROLES.SPONSOR],
    // ===== END: Monitoring Access route access =====
    "/sites": [ROLES.ADMIN, ROLES.CRO],
    "/portfolio": [ROLES.SPONSOR],
    "/study-oversight": [ROLES.SPONSOR],
    "/cro-oversight": [ROLES.SPONSOR],
    "/risk-management": [ROLES.SPONSOR],
    "/site-ranking": [ROLES.SPONSOR],
    "/cro-details": [ROLES.SPONSOR],
    "/cro-report": [ROLES.SPONSOR],
    "/cro-contracts": [ROLES.SPONSOR],
    "/site-details": [ROLES.SPONSOR, ROLES.ADMIN],
    "/report-details": [ROLES.SPONSOR],
    "/recruitment-details": [ROLES.SPONSOR],
    "/regulatory-details": [ROLES.SPONSOR],
    "/risk-details": [ROLES.SPONSOR],
    "/query-details": [ROLES.SPONSOR],
    "/notification-details": [ROLES.SPONSOR],
    "/screening": [ROLES.SPONSOR, ROLES.CRO],
    "/enrollment": [ROLES.SPONSOR, ROLES.CRO],
    "/visits": [ROLES.SPONSOR, ROLES.CRO],
    "/files": [ROLES.SPONSOR, ROLES.CRO],
    "/monitoring": [ROLES.CRO],
    "/site-management": [ROLES.CRO],
    "/subject-management": [ROLES.CRO],
    "/visit-management": [ROLES.CRO],
    "/add-visit": [ROLES.CRO],
    "/cro-studies": [ROLES.CRO],
    "/cro-screening": [ROLES.CRO],
    "/cro-enrollment": [ROLES.CRO],
    "/cro-eisf": [ROLES.CRO],
    "/cro-icf": [ROLES.CRO],
    "/cro-study-folder": [ROLES.CRO],
    "/cro-logs": [ROLES.CRO],
    "/cro-comments": [ROLES.CRO],
    "/cro-queries": [ROLES.CRO],
    "/cro-recruitment": [ROLES.CRO],
    "/cro-regulatory": [ROLES.CRO],
    "/cro-site-performance": [ROLES.CRO],
    "/cro-reports": [ROLES.CRO],
    "/cro-notifications": [ROLES.CRO],
    "/cro-livechat": [ROLES.CRO],
    "/cro-settings": [ROLES.CRO],
    "/cro-subject-management": [ROLES.CRO],
    "/cro-subject/:id": [ROLES.CRO],
    "/cro-monitoring": [ROLES.CRO],
    "/cro-regulatory-documents": [ROLES.CRO],
    "/cro-subjects": [ROLES.CRO],
    "/cro-visits": [ROLES.CRO],
    "/cro-files": [ROLES.CRO],
    "/queries": [ROLES.CRO, ROLES.SPONSOR],
    "/pi-comments": [ROLES.PI],
    "/pi-site-performance": [ROLES.PI],
    "/pi-recruitment": [ROLES.PI],
    "/pi-regulatory": [ROLES.PI],
    "/pi-reports": [ROLES.PI],
    "/pi-notifications": [ROLES.PI],
    "/pi-settings": [ROLES.PI],
    "/pi-subjects-dashboard": [ROLES.PI],
    "/pi-study-folder-dashboard": [ROLES.PI],
    "/pi-study-subject-profile": [ROLES.PI],
    "/pi-eisf-dashboard": [ROLES.PI],
    "/pi-icf-dashboard": [ROLES.PI],
    "/pi-livechat": [ROLES.PI],
    "/site-performance": [
      ROLES.ADMIN,
      ROLES.SITE_STAFF,
      ROLES.PI,
      ROLES.CRO,
      ROLES.SPONSOR,
    ],
    "/recruitment": [
      ROLES.ADMIN,
      ROLES.SITE_STAFF,
      ROLES.PI,
      ROLES.CRO,
      ROLES.SPONSOR,
    ],
    "/regulatory": [
      ROLES.ADMIN,
      ROLES.SITE_STAFF,
      ROLES.PI,
      ROLES.CRO,
      ROLES.SPONSOR,
    ],
    "/reports": [
      ROLES.ADMIN,
      ROLES.SITE_STAFF,
      ROLES.PI,
      ROLES.CRO,
      ROLES.SPONSOR,
    ],
    // ===== START: Custom Report Builder / Financials / Milestones routes =====
    "/reports/builder": [
      ROLES.ADMIN,
      ROLES.SITE_STAFF,
      ROLES.PI,
      ROLES.CRO,
      ROLES.SPONSOR,
    ],
    "/finance": [
      ROLES.ADMIN,
      ROLES.SITE_STAFF,
      ROLES.CRO,
      ROLES.SPONSOR,
    ],
    "/milestones": [
      ROLES.ADMIN,
      ROLES.SITE_STAFF,
      ROLES.CRO,
      ROLES.SPONSOR,
    ],
    // ===== END: Custom Report Builder / Financials / Milestones routes =====
    "/notifications": Object.values(ROLES),
    "/live-chat": [ROLES.SPONSOR, ROLES.ADMIN],
    "/settings": Object.values(ROLES),
    "/profile": Object.values(ROLES),
    "/security": Object.values(ROLES),
    "/comments": Object.values(ROLES),
    "/studies": Object.values(ROLES),
    "/audit-logs": [ROLES.ADMIN, ROLES.SITE_STAFF],

    // ===== Shared study/site/ops modules (data-scoped per role) =====
    "/": Object.values(ROLES),
    "/access-request": Object.values(ROLES),
    "/amendments": Object.values(ROLES),
    "/completedvisit": Object.values(ROLES),
    // ===== START: Governance module route access (Phases 1-4) =====
    "/compliance": [ROLES.ADMIN, ROLES.SPONSOR],
    "/audit": [ROLES.ADMIN, ROLES.SPONSOR, ROLES.CRO],
    "/issues": Object.values(ROLES),
    "/capa": Object.values(ROLES),
    "/risks": [ROLES.ADMIN, ROLES.SPONSOR, ROLES.CRO],
    // ===== END: Governance module route access (Phases 1-4) =====

    "/eisf": Object.values(ROLES),
    "/ereg-comments": Object.values(ROLES),
    "/file-details": Object.values(ROLES),
    "/icf": Object.values(ROLES),
    "/icf-consent": Object.values(ROLES),
    "/ip-accountability": Object.values(ROLES),
    "/irb-submissions": Object.values(ROLES),
    "/logs": Object.values(ROLES),
    "/logs/delegation": Object.values(ROLES),
    "/logs/training": Object.values(ROLES),
    "/my-license": Object.values(ROLES),
    "/operations/comments": Object.values(ROLES),
    "/progress-notes": Object.values(ROLES),
    "/referral": Object.values(ROLES),
    "/site-feasibility": Object.values(ROLES),
    "/study-folder": Object.values(ROLES),
    "/subjects": Object.values(ROLES),
    "/vendor-management": Object.values(ROLES),

    // ===== Role-specific routes =====
    "/admin/subscription": [ROLES.ADMIN, ROLES.SPONSOR],
    "/pi-referral": [ROLES.PI],
    "/cro-referral": [ROLES.CRO],
    "/sponsor-monitoring": [ROLES.SPONSOR, ROLES.ADMIN],
    "/sponsor-queries": [ROLES.SPONSOR, ROLES.ADMIN],
  };

  const normalizedPath = path.split("?")[0].replace(/\/$/, "") || "/";

  if (
    normalizedPath.startsWith("/study-dashboard") ||
    normalizedPath.startsWith("/study/") ||
    normalizedPath.startsWith("/subject/") ||
    normalizedPath.startsWith("/visit/") ||
    normalizedPath.startsWith("/site-queries/") ||
    normalizedPath.startsWith("/site-documents/") ||
    normalizedPath.startsWith("/progress-note-details/") ||
    normalizedPath.startsWith("/visit-details/")
  ) {
    return true;
  }

  const allowedRoles = routeAccess[normalizedPath];

  // Deny-by-default (RBAC validation G2): a path that is not registered in
  // the access matrix must never render — the caller (ProtectedRoute)
  // redirects to the role dashboard instead of serving the route.
  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(routeUser.role);
}

export function getUserProfile(user = getCurrentUser()) {
  if (!user) {
    return {};
  }

  const nameParts = String(user.name || "")
    .trim()
    .split(/\s+/);
  const storedProfile = (() => {
    try {
      return (
        JSON.parse(localStorage.getItem(`profile_${user.id || user.email}`)) ||
        {}
      );
    } catch {
      return {};
    }
  })();

  return {
    email: user.email || "",
    firstName: storedProfile.firstName || nameParts[0] || "",
    lastName: storedProfile.lastName || nameParts.slice(1).join(" ") || "",
    middleName: storedProfile.middleName || "",
    credentials: storedProfile.credentials || "",
    officePhone: storedProfile.officePhone || "",
    cellPhone: storedProfile.cellPhone || "",
    fax: storedProfile.fax || "",
    headline: storedProfile.headline || "",
    department: storedProfile.department || "",
    jobTitle: storedProfile.jobTitle || "",
    bio: storedProfile.bio || "",
    timezone: storedProfile.timezone || "Asia/Kolkata",
    profilePhoto: storedProfile.profilePhoto || user.profilePhoto || "",
    preferredLanguage: storedProfile.preferredLanguage || "English",
    assignedSite: getAssignedSite(user) || "",
    role: user.role || "",
    orgType: user.orgType || "",
    pincode: storedProfile.pincode || user.pincode || "",
  };
}

export function syncProfilePhoto(photo, user = getCurrentUser()) {
  if (!user || typeof window === "undefined") {
    return null;
  }

  const key = `profile_${user.id || user.email}`;
  let storedProfile: Record<string, any> = {};;

  try {
    storedProfile = JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    storedProfile = {};
  }

  const safePhoto = photo || "";

  try {
    storedProfile.profilePhoto = safePhoto;
    localStorage.setItem(key, JSON.stringify(storedProfile));

    /*
      Do not store the same Base64 image again in a separate "profilePhoto"
      localStorage key. It wastes browser storage and causes quota errors.
    */
    localStorage.removeItem("profilePhoto");

    const updatedUser = updateCurrentUserProfile({
      profilePhoto: safePhoto,
      profileImage: safePhoto || null,
      avatar: safePhoto || null,
    });

    window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_EVENT));
    return updatedUser;
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      throw new Error(
        "Profile photo could not be saved because browser storage is full. Please upload a smaller image.",
      );
    }

    throw error;
  }
}

export function clearProfilePhoto(user = getCurrentUser()) {
  return syncProfilePhoto("", user);
}

export function saveUserProfile(profile, user = getCurrentUser()) {
  if (!user) {
    return null;
  }

  const key = `profile_${user.id || user.email}`;

  /*
    Save profile information without the Base64 image first.
    The photo is saved separately once by syncProfilePhoto().
  */
  const { profilePhoto, ...profileWithoutPhoto } = profile;

  try {
    localStorage.setItem(key, JSON.stringify(profileWithoutPhoto));
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      throw new Error(
        "Profile details could not be saved because browser storage is full.",
      );
    }

    throw error;
  }

  const fullName = [profile.firstName, profile.middleName, profile.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // Pincode is part of the referral anti-abuse rule (referralService reads
  // it from the "users" array via adminService.getUsers()), so it must stay
  // in sync on the underlying user record — updateCurrentUserProfile()
  // patches both "currentUser" and the matching "users" row in one call.
  const updatedUser = updateCurrentUserProfile({
    name: fullName || user.name,
    assignedSite: profile.assignedSite || user.assignedSite,
    orgType: profile.assignedSite || user.orgType,
    pincode: profile.pincode || user.pincode,
  });

  if (Object.prototype.hasOwnProperty.call(profile, "profilePhoto")) {
    syncProfilePhoto(profilePhoto, user);
  }

  return updatedUser;
}

// ---------------------------------------------------------------------------
// Site/study scope assignment (RBAC 4.1/4.2)
//
// Admins assign a Site Staff / PI / CRO / Sponsor user a set of site and/or
// study codes ("scope_data"). The assignment is persisted on the directory
// user record and, when the app runs in API mode, mirrored onto the backend
// user (accounts_user.scope_data, matched by email) so the user's very next
// backend request is narrowed at the SQL level.
// ---------------------------------------------------------------------------

export const USER_SCOPE_UPDATED = "user-scope-updated";

export function normalizeScopeCodes(values: any) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value: any) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

export interface ScopeSyncResult {
  persisted: boolean;
  reason: string;
}

/**
 * Push a scope assignment to the backend user matched by email. Returns an
 * explicit outcome instead of swallowing the failure:
 *   * "no-backend-user"  — directory user has no accounts_user mirror
 *   * "forbidden"        — signed-in session is not a backend Admin
 *   * "persisted"        — accounts_user.scope_data updated (next request
 *     of the target user is narrowed at the SQL level, no re-login)
 *   * "api-disabled" / "offline" — localStorage-only run
 * On 401 the Admin's backend session is (re-)established once and the PUT
 * retried, so a stale/expired cookie cannot silently drop the assignment.
 */
async function syncUserScopeToBackend(
  email: string,
  scope: any,
  transport: any = api
): Promise<ScopeSyncResult> {
  if (!isApiEnabled()) {
    return { persisted: false, reason: "api-disabled" };
  }

  const putScope = async (): Promise<ScopeSyncResult> => {
    const res: any = await transport.get(
      "/api/accounts/users/?page_size=100"
    );
    const results = (res && (res.results || res)) || [];
    const backendUser = results.find((entry: any) => entry?.email === email);

    if (!backendUser || !backendUser.id) {
      return { persisted: false, reason: "no-backend-user" };
    }

    await transport.put(`/api/accounts/users/${backendUser.id}/scope/`, {
      studies: normalizeScopeCodes(scope.studies),
      sites: normalizeScopeCodes(scope.sites),
    });
    return { persisted: true, reason: "persisted" };
  };

  try {
    return await putScope();
  } catch (err: any) {
    if (err?.status === 401) {
      // Stale/absent backend session — bootstrap one and retry once.
      await establishBackendSession(getCurrentUser(), transport, true);
      try {
        return await putScope();
      } catch {
        return { persisted: false, reason: "offline" };
      }
    }
    if (err?.status === 403) {
      return { persisted: false, reason: "forbidden" };
    }
    return { persisted: false, reason: "offline" };
  }
}

export function saveUserScope(user: any, scope: any = {}) {
  const normalized = {
    studies: normalizeScopeCodes(scope.studies),
    sites: normalizeScopeCodes(scope.sites),
  };
  const email = user?.email;

  if (!email) {
    return normalized;
  }

  // Patch the directory "users" row.
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const index = users.findIndex((entry: any) => entry.email === email);

  if (index >= 0) {
    users[index] = { ...users[index], scope_data: normalized };
    localStorage.setItem("users", JSON.stringify(users));
  }

  // Mirror onto the signed-in currentUser when the Admin edits their own
  // row so the data layer (getAccessibleStudies / getSitesForUser) honors
  // it immediately.
  const current = getCurrentUser();

  if (current && current.email === email) {
    localStorage.setItem(
      "currentUser",
      JSON.stringify({ ...current, scope_data: normalized })
    );
  }

  window.dispatchEvent(new Event(USER_SCOPE_UPDATED));
  void syncUserScopeToBackend(email, normalized);
  return normalized;
}

/**
 * Local scope save (identical to saveUserScope) PLUS the backend mirror,
 * awaiting the outcome so the UI can distinguish "Saved ✓ (API persisted)"
 * from "Saved locally — API sync failed". Admin User Management calls this.
 */
export async function saveUserScopeWithBackend(
  user: any,
  scope: any = {},
  transport: any = api
): Promise<ScopeSyncResult> {
  saveUserScope(user, scope);
  const email = user?.email;
  if (!email) {
    return { persisted: false, reason: "no-user" };
  }
  return syncUserScopeToBackend(email, scope, transport);
}

export function getSiteSettings(user = getCurrentUser()) {
  return getUserSettings(user);
}

export function saveSiteSettings(settings, user = getCurrentUser()) {
  return saveUserSettings(settings, user);
}

export function updateCurrentUserProfile(updates) {
  const user = getCurrentUser();

  if (!user) {
    return null;
  }

  const updatedUser = {
    ...user,
    ...updates,
    displayName: formatUserDisplayName({ ...user, ...updates }),
  };

  localStorage.setItem("currentUser", JSON.stringify(updatedUser));

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const index = users.findIndex((u) => u.email === user.email);

  if (index >= 0) {
    users[index] = {
      ...users[index],
      ...updates,
      displayName: updatedUser.displayName,
    };
    localStorage.setItem("users", JSON.stringify(users));
  }

  if (updates.name) {
    localStorage.setItem("userFullName", updates.name);
  }

  return updatedUser;
}

export function updateUserPassword(currentPassword, newPassword) {
  const user = getCurrentUser();

  if (!user) {
    return { success: false, message: "User account not found." };
  }

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const userIndex = users.findIndex((entry) => entry.email === user.email);

  if (userIndex === -1) {
    return { success: false, message: "User account not found." };
  }

  if (users[userIndex].password !== currentPassword) {
    return { success: false, message: "Current password is incorrect." };
  }

  users[userIndex] = {
    ...users[userIndex],
    password: newPassword,
  };
  localStorage.setItem("users", JSON.stringify(users));
  updateCurrentUserProfile({ password: newPassword });
  return { success: true, message: "Password updated successfully." };
}

export function getUserSettingsKey(user = getCurrentUser()) {
  if (isAdmin(user)) {
    return "adminSettings";
  }

  const site = getAssignedSite(user) || "default";
  return `siteSettings_${site.replace(/\s+/g, "_")}`;
}

export function getUserSettings(user = getCurrentUser()) {
  const key = getUserSettingsKey(user);

  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    /* fall through */
  }

  return {
    emailNotifications: true,
    smsNotifications: false,
    dashboardRefresh: "daily",
    preferredLanguage: "English",
    twoFactorEnabled: false,
    loginAlerts: true,
    sessionTimeoutMinutes: isAdmin(user) ? 60 : 30,
  };
}

export function saveUserSettings(settings, user = getCurrentUser()) {
  const key = getUserSettingsKey(user);
  localStorage.setItem(key, JSON.stringify(settings));
  return settings;
}

// UPDATED: Sidebar menu items per role — same modules, scoped by site for Site Staff
export function getSidebarMenuItems(user = getCurrentUser()) {
  const effectiveUser = getEffectiveUser(user);

  if (!effectiveUser) {
    return [];
  }

  const allItems = [
    { key: "dashboard", roles: Object.values(ROLES) },
    { key: "studies", roles: Object.values(ROLES) },
    { key: "comments", roles: Object.values(ROLES) },
    { key: "site-performance", roles: Object.values(ROLES) },
    {
      key: "recruitment",
      roles: [
        ROLES.ADMIN,
        ROLES.SITE_STAFF,
        ROLES.PI,
        ROLES.CRO,
        ROLES.SPONSOR,
      ],
    },
    { key: "regulatory", roles: Object.values(ROLES) },
    { key: "reports", roles: Object.values(ROLES) },
    { key: "user-management", roles: [ROLES.ADMIN, ROLES.SITE_STAFF] },
    { key: "permission-approval", roles: [ROLES.ADMIN, ROLES.SITE_STAFF] },
    { key: "notifications", roles: Object.values(ROLES) },
    { key: "settings", roles: Object.values(ROLES) },
  ];

  return allItems.filter((item) => item.roles.includes(effectiveUser.role));
}

export { ROLES, PERMISSIONS };
