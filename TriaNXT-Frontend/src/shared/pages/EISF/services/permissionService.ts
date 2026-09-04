import { getEISFModuleDocuments } from "./eisfService";

/**
 * Default roles allowed to upload documents.
 */
const UPLOAD_ROLES = ["Admin", "SiteStaff", "Sponsor", "CRO"];

/**
 * Default roles allowed to approve documents.
 */
const APPROVAL_ROLES = ["Admin", "Sponsor", "CRO"];

/**
 * Returns whether user can view a document.
 */
export function canViewDocument(document,user: any = {}) {
  if (!document) return false;

  if (!document.permissions?.length) {
    return true;
  }

  return document.permissions.includes(user.role);
}

/**
 * Returns whether user can upload documents.
 */
export function canUploadDocument(user: any = {}) {
  return UPLOAD_ROLES.includes(user.role);
}

/**
 * Returns whether user can edit a document.
 */
export function canEditDocument(document,user: any = {}) {
  if (!document) return false;

  if (user.role === "Admin") {
    return true;
  }

  return document.createdBy === user.id;
}

/**
 * Returns whether user can delete a document.
 */
export function canDeleteDocument(document,user: any = {}) {
  if (!document) return false;

  return user.role === "Admin";
}

/**
 * Returns whether user can download a document.
 */
export function canDownloadDocument(document,user: any = {}) {
  return canViewDocument(document, user);
}

/**
 * Returns whether user can replace a document.
 */
export function canReplaceDocument(document,user: any = {}) {
  return canEditDocument(document, user);
}

/**
 * Returns whether user can approve a document.
 */
export function canApproveDocument(user: any = {}) {
  return APPROVAL_ROLES.includes(user.role);
}

/**
 * Returns documents accessible to the user.
 */
export function getAccessibleDocuments(user: any = {}) {
  return getEISFModuleDocuments().filter((document) =>
    canViewDocument(document, user)
  );
}

/* -------------------------------------------------------------------------- */
/*                         Additional Reusable Helpers                         */
/* -------------------------------------------------------------------------- */

/**
 * Checks if user has one of the given roles.
 */
export function hasRole(user: any = {},roles: any = []) {
  return roles.includes(user.role);
}

/**
 * Checks whether user is document owner.
 */
export function isDocumentOwner(document,user: any = {}) {
  if (!document) return false;

  return document.createdBy === user.id;
}

/**
 * Returns all permissions for a document.
 */
export function getDocumentPermissions(document) {
  return document?.permissions || [];
}

/**
 * Checks whether document has restricted permissions.
 */
export function isRestrictedDocument(document) {
  return Boolean(document?.permissions?.length);
}

/**
 * Returns all available actions for the user on a document.
 */
export function getDocumentActions(document,user: any = {}) {
  return {
    view: canViewDocument(document, user),
    upload: canUploadDocument(user),
    edit: canEditDocument(document, user),
    delete: canDeleteDocument(document, user),
    download: canDownloadDocument(document, user),
    replace: canReplaceDocument(document, user),
    approve: canApproveDocument(user),
  };
}

/**
 * Returns permission summary for dashboard/widgets.
 */
export function getPermissionSummary(user: any = {}) {
  return {
    canUpload: canUploadDocument(user),
    canApprove: canApproveDocument(user),
    isAdmin: user.role === "Admin",
    role: user.role || null,
  };
}