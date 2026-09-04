import ROLES from "../constants/roles";
import { getEffectiveRole, getCurrentUser } from "../services/roleService";
import { hasApprovedScope } from "../services/accessPermissionService";
import {
  getUserAccessLevel,
  ACCESS_EDIT,
  ACCESS_READ_WRITE,
  ACCESS_READ
} from "../services/accessLevelService";

const EDIT_ROLES = [ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.PI];
const RESTRICTED_ROLES = [ROLES.CRO, ROLES.SPONSOR];

export function getEffectiveRoleForAccess(user = getCurrentUser()) {
  return getEffectiveRole(user);
}

export function canEditStudyContent(user = getCurrentUser()) {
  const role = getEffectiveRoleForAccess(user);
  if (EDIT_ROLES.includes(role)) {
    return true;
  }
  // CRO/Sponsor with Edit access level can also edit study content.
  return getUserAccessLevel(user?.email, role) === ACCESS_EDIT;
}

// An Admin approving a Request Edit Permission request writes an approved
// scope (see accessPermissionService.acceptAccessRequest) but nothing was
// reading it back — the user stayed permanently locked out even after
// approval, with the Edit Permission action doing nothing. This checks
// that approved scope so edit access actually unlocks once granted.
export function hasApprovedEditAccess(user = getCurrentUser(), module, studyCode = "") {
  if (!user?.email || !module) {
    return false;
  }
  return hasApprovedScope(user.email, undefined, module, "", studyCode);
}

export function canDeleteStudy(user = getCurrentUser()) {
  const role = getEffectiveRoleForAccess(user);
  if (EDIT_ROLES.includes(role)) {
    return true;
  }
  // Only CRO/Sponsor with Edit access level can delete.
  return getUserAccessLevel(user?.email, role) === ACCESS_EDIT;
}

export function canAddStudy(user = getCurrentUser()) {
  const role = getEffectiveRoleForAccess(user);
  return [
    ROLES.ADMIN,
    ROLES.SITE_STAFF,
    ROLES.PI,
    ROLES.CRO,
    ROLES.SPONSOR
  ].includes(role);
}

export function canEditSubjectContent(user = getCurrentUser()) {
  const role = getEffectiveRoleForAccess(user);
  if (EDIT_ROLES.includes(role)) {
    return true;
  }
  // CRO/Sponsor with Edit or Read+Write access level can edit subjects.
  const level = getUserAccessLevel(user?.email, role);
  return level === ACCESS_EDIT || level === ACCESS_READ_WRITE;
}

export function canAddSubject(user = getCurrentUser()) {
  return canEditSubjectContent(user);
}

export function canComment(user = getCurrentUser()) {
  const role = getEffectiveRoleForAccess(user);
  return role !== null;
}

export function canRecruitCRO(user = getCurrentUser()) {
  return getEffectiveRoleForAccess(user) === ROLES.SPONSOR;
}

export function requiresPermissionRequest(user = getCurrentUser()) {
  const role = getEffectiveRoleForAccess(user);
  if (!RESTRICTED_ROLES.includes(role)) {
    return false;
  }
  // CRO/Sponsor with Read access still need permission requests for
  // write/edit actions; those with Read+Write or Edit have been granted
  // sufficient access via the Access column and no longer require a
  // separate permission request for view/create/edit operations.
  const level = getUserAccessLevel(user?.email, role);
  return level === ACCESS_READ;
}

export function isViewOnlySubjectAccess(user = getCurrentUser()) {
  return requiresPermissionRequest(user);
}

export {
  getSubjectStatusAnalytics,
  getAllSubjectsFromStorage,
  SUBJECT_STATUS_ORDER
} from "./subjectStatusAnalytics";

export { getEnrollmentStatusAnalytics } from "./enrollmentStatusAnalytics";
