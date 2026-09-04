import { Navigate } from "react-router-dom";
import { usePermission } from "../context/PermissionContext";
import { getCurrentUser, getDashboardPath } from "../services/roleService";

function PermissionRoute({
  children,
  permission
}: any) {

  const { hasPermission } =
    usePermission();

  if (!hasPermission(permission)) {

    const user = getCurrentUser();
    const destination = user?.role ? getDashboardPath(user.role) : "/login";

    return (
      <Navigate
        to={destination}
        replace
      />
    );
  }

  return children;
}

export default PermissionRoute;