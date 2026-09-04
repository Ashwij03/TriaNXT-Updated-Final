import { useViewportMode } from "../../shared/hooks/useViewportMode";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardSidebar from "../../shared/components/dashboard/shared/DashboardSidebar";
import SiteStaffNavbar from "./SiteStaffNavbar";
import LiveChatFab from "../../shared/components/LiveChatFab";
import ROLES from "../../shared/constants/roles";
import {
  getCurrentUser,
  isAdmin,
  setAdminPreviewRole,
  setPIPreviewRole
} from "../../shared/services/roleService";

import "../../shared/components/dashboard/shared/DashboardLayout.css";
import "../../shared/components/dashboard/shared/dashboard.css";
import { EISF_SIDEBAR_COLLAPSE_EVENT } from "../../shared/constants/headerFilters";

const DASHBOARD_ROUTE_ROLES = {
  "/admin-dashboard": ROLES.ADMIN,
  "/site-staff-dashboard": ROLES.SITE_STAFF,
  "/pi-dashboard": ROLES.PI,
  "/cro-dashboard": ROLES.CRO,
  "/sponsor-dashboard": ROLES.SPONSOR
};

function SiteStaffDashboardShell({ children }: any) {
  const location = useLocation();
  const contentRef = useRef(null);
  const viewportMode = useViewportMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();

    if (isAdmin(currentUser)) {
      const matchedRole = DASHBOARD_ROUTE_ROLES[location.pathname];

      if (matchedRole) {
        setAdminPreviewRole(matchedRole);
      }

      return;
    }

    if (currentUser?.role === ROLES.PI) {
      if (location.pathname === "/site-staff-dashboard") {
        setPIPreviewRole(ROLES.SITE_STAFF);
      } else if (location.pathname === "/pi-dashboard") {
        setPIPreviewRole(null);
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (viewportMode === "desktop") {
      setSidebarOpen((open) => (open ? false : open));
      return;
    }

    setSidebarCollapsed((collapsed) => (collapsed ? false : collapsed));
    setSidebarOpen((open) => (open ? false : open));
  }, [location.pathname, viewportMode]);

  const handleToggleSidebar = useCallback(() => {
    if (viewportMode === "desktop") {
      setSidebarCollapsed((prev) => !prev);
      return;
    }

    setSidebarOpen((prev) => !prev);
  }, [viewportMode]);

  // Task 14 — eISF Sidebar Auto Close: see useEnterpriseDashboardShell for
  // the full explanation. SiteStaffDashboardShell keeps its own separate
  // sidebar state (rather than the shared hook), so it needs its own copy
  // of this listener.
  useEffect(() => {
    const handleEisfEntered = () => {
      if (viewportMode === "desktop") {
        setSidebarCollapsed(true);
        return;
      }

      setSidebarOpen(false);
    };

    window.addEventListener(EISF_SIDEBAR_COLLAPSE_EVENT, handleEisfEntered);

    return () => {
      window.removeEventListener(
        EISF_SIDEBAR_COLLAPSE_EVENT,
        handleEisfEntered
      );
    };
  }, [viewportMode]);

  const sidebarWrapClass = [
    "dashboard-sidebar-wrap",
    viewportMode !== "desktop" && sidebarOpen ? "is-open" : "",
    viewportMode === "desktop" && sidebarCollapsed ? "is-collapsed" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const sidebarIsOpen =
    viewportMode === "desktop" ? !sidebarCollapsed : sidebarOpen;

  return (
    <div className="dashboard-shell dashboard-shell--site-staff">
      {viewportMode !== "desktop" && (
        <div
          className={`sidebar-backdrop${sidebarOpen ? " is-visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={sidebarWrapClass}>
        <DashboardSidebar
          collapsed={viewportMode === "desktop" && sidebarCollapsed}
          compact={viewportMode === "tablet"}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>

      <div className="dashboard-main">
        <div className="dashboard-main-scaled">
          <div className="dashboard-header-wrap">
            <SiteStaffNavbar
              onToggleSidebar={handleToggleSidebar}
              sidebarOpen={sidebarIsOpen}
            />
          </div>

          <div className="dashboard-content" ref={contentRef}>
            {children}
          </div>
        </div>
      </div>

      <LiveChatFab liveChatPath="/site-staff-livechat" />
    </div>
  );
}

export default SiteStaffDashboardShell;