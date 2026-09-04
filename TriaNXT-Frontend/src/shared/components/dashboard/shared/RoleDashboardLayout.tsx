import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ROLES from "../../../constants/roles";
import {
  ADMIN_PREVIEW_ROLE_EVENT,
  PI_PREVIEW_ROLE_EVENT,
} from "../../../constants/headerFilters";
import { getCurrentUser, getEffectiveRole } from "../../../services/roleService";
import AdminDashboardLayout from "../../../../Admin/components/AdminDashboardLayout";
import SiteStaffDashboardLayout from "../../../../SiteStaff/components/SiteStaffDashboardLayout";
import PIDashboardLayout from "../../../../PI/components/PIDashboardLayout";
import CROLayout from "../../../../CRO/pages/CROLayout";
import AppLayout from "../../../../Sponsor/pages/AppLayout";

function RoleDashboardLayout({ children }: any) {
  const location = useLocation();
  const [effectiveRole, setEffectiveRole] = useState(() =>
    getEffectiveRole(getCurrentUser())
  );

  useEffect(() => {
    const nextRole = getEffectiveRole(getCurrentUser());
    setEffectiveRole((currentRole) =>
      currentRole === nextRole ? currentRole : nextRole
    );
  }, [location.pathname]);

  useEffect(() => {
    const syncRole = () => {
      const nextRole = getEffectiveRole(getCurrentUser());
      setEffectiveRole((currentRole) =>
        currentRole === nextRole ? currentRole : nextRole
      );
    };

    window.addEventListener(ADMIN_PREVIEW_ROLE_EVENT, syncRole);
    window.addEventListener(PI_PREVIEW_ROLE_EVENT, syncRole);

    return () => {
      window.removeEventListener(ADMIN_PREVIEW_ROLE_EVENT, syncRole);
      window.removeEventListener(PI_PREVIEW_ROLE_EVENT, syncRole);
    };
  }, []);

  switch (effectiveRole) {
    case ROLES.SITE_STAFF:
      return (
        <SiteStaffDashboardLayout>{children}</SiteStaffDashboardLayout>
      );
    case ROLES.PI:
      return <PIDashboardLayout>{children}</PIDashboardLayout>;
    case ROLES.CRO:
      return <CROLayout>{children}</CROLayout>;
    case ROLES.SPONSOR:
      return <AppLayout>{children}</AppLayout>;
    case ROLES.ADMIN:
    default:
      return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
  }
}

export default RoleDashboardLayout;
