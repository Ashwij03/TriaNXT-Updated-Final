// UPDATED: Protected route with role-based access control

import { Navigate, useLocation } from "react-router-dom";
import rolePermissions from "../utils/rolePermissions";
import ROLES from "../constants/roles";
import {
  canAccessRoute,
  getAdminPreviewRole,
  getCurrentUser,
  getDashboardPath,
  getPIPreviewRole,
  isAdmin
} from "../services/roleService";

function ProtectedRoute({ children, requiredPermission, allowedRoles }: any) {
  const location = useLocation();
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const currentUser = getCurrentUser();

  if (isLoggedIn !== "true" || !currentUser) {
    return <Navigate to="/login" replace />;
  }

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
      return (
        <Navigate
          to={getDashboardPath(currentUser.role)}
          replace
        />
      );
    }
  }

  if (!canAccessRoute(location.pathname, currentUser)) {
    return (
      <Navigate
        to={getDashboardPath(
          isAdmin(currentUser)
            ? getAdminPreviewRole() || ROLES.ADMIN
            : currentUser.role === ROLES.PI
              ? getPIPreviewRole() || ROLES.PI
              : currentUser.role
        )}
        replace
      />
    );
  }

  if (
    requiredPermission &&
    currentUser.role !== "Admin"
  ) {
    const permissions =
      rolePermissions[currentUser.role] || [];

    if (!permissions.includes(requiredPermission)) {
      return (
        <Navigate
          to={getDashboardPath(currentUser.role)}
          replace
        />
      );
    }
  }

  return children;
}

export default ProtectedRoute;
