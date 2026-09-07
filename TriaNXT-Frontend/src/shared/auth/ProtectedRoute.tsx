// UPDATED: Protected route with role-based access control.
//
// Universal Access Guard behaviour: when a signed-in user hits a page they
// are not allowed to open, they are redirected to the dedicated 403 page
// (/unauthorized) instead of being silently bounced to their dashboard —
// the page explains the denial and offers Return to Dashboard / Request
// Access actions. Login/session failures still go to /login.

import { Navigate, useLocation } from "react-router-dom";
import rolePermissions from "../utils/rolePermissions";
import ROLES from "../constants/roles";
import {
  canAccessRoute,
  getAdminPreviewRole,
  getCurrentUser,
  getPIPreviewRole,
  isAdmin
} from "../services/roleService";

const UNAUTHORIZED_PATH = "/unauthorized";

function ProtectedRoute({ children, requiredPermission, allowedRoles }: any) {
  const location = useLocation();
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const currentUser = getCurrentUser();

  if (isLoggedIn !== "true" || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  const unauthorized = (fromPath) => (
    <Navigate
      to={UNAUTHORIZED_PATH}
      replace
      state={fromPath ? { from: fromPath } : undefined}
    />
  );

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    const previewRole = getAdminPreviewRole();
    const adminPreviewAllowed =
      isAdmin(currentUser) &&
      previewRole &&
      allowedRoles.includes(previewRole);

    const piPreviewRole = getPIPreviewRole();
    const piPreviewAllowed =
      currentUser.role === ROLES.PI &&
      piPreviewRole &&
      allowedRoles.includes(piPreviewRole);

    if (!adminPreviewAllowed && !piPreviewAllowed) {
      return unauthorized(location.pathname);
    }
  }

  if (!canAccessRoute(location.pathname, currentUser)) {
    return unauthorized(location.pathname);
  }

  if (
    requiredPermission &&
    currentUser.role !== "Admin"
  ) {
    const permissions =
      rolePermissions[currentUser.role] || [];

    if (!permissions.includes(requiredPermission)) {
      return unauthorized(location.pathname);
    }
  }

  return children;
}

export default ProtectedRoute;
