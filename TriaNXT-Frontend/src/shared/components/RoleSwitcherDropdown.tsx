import { useNavigate } from "react-router-dom";
import SearchableDropdown from "./SearchableDropdown";
import ROLES from "../constants/roles";
import {
  getAllRoles,
  getCurrentUser,
  getDashboardPath,
  getEffectiveRole,
  isAdmin,
  ROLE_LABELS,
  setAdminPreviewRole,
  setPIPreviewRole,
  SWITCHABLE_ROLE_DASHBOARDS
} from "../services/roleService";

const PI_ROLE_OPTIONS = [
  { value: ROLES.PI, label: ROLE_LABELS[ROLES.PI] },
  { value: ROLES.SITE_STAFF, label: ROLE_LABELS[ROLES.SITE_STAFF] }
];

function RoleSwitcherDropdown({ className = "" }: any) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const userIsAdmin = isAdmin(currentUser);
  const effectiveRole = getEffectiveRole(currentUser) || currentUser?.role;

  const handleAdminRoleChange = (nextRole) => {
    if (!nextRole || !userIsAdmin) {
      return;
    }

    if (nextRole === ROLES.ADMIN) {
      setAdminPreviewRole(null);
      navigate("/admin-dashboard");
      return;
    }

    if (SWITCHABLE_ROLE_DASHBOARDS.includes(nextRole)) {
      setAdminPreviewRole(nextRole);
      navigate(getDashboardPath(nextRole));
    }
  };

  const handlePIRoleChange = (nextRole) => {
    if (currentUser?.role !== ROLES.PI) {
      return;
    }

    if (nextRole === ROLES.SITE_STAFF) {
      setPIPreviewRole(ROLES.SITE_STAFF);
      navigate("/site-staff-dashboard");
      return;
    }

    setPIPreviewRole(null);
    navigate("/pi-dashboard");
  };

  if (userIsAdmin) {
    return (
      <SearchableDropdown
        value={effectiveRole}
        onChange={handleAdminRoleChange}
        options={getAllRoles()}
        placeholder="Admin"
        searchPlaceholder="Search Role"
        className={`header-dropdown header-dropdown--admin ${className}`.trim()}
      />
    );
  }

  if (currentUser?.role === ROLES.PI) {
    const piViewRole = effectiveRole === ROLES.SITE_STAFF ? ROLES.SITE_STAFF : ROLES.PI;

    return (
      <SearchableDropdown
        value={piViewRole}
        onChange={handlePIRoleChange}
        options={PI_ROLE_OPTIONS}
        placeholder={ROLE_LABELS[ROLES.PI]}
        searchPlaceholder="Search Role"
        className={`header-dropdown ${className}`.trim()}
      />
    );
  }

  return (
    <span className="header-static-value">
      {ROLE_LABELS[currentUser?.role] || currentUser?.role || "—"}
    </span>
  );
}

export default RoleSwitcherDropdown;