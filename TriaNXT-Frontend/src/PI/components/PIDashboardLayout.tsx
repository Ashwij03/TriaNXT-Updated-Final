import { useEnterpriseDashboardShell } from "../../shared/hooks/useEnterpriseDashboardShell";

import PINavbar from "../pages/PINavbar";

import PISidebar from "../pages/PISidebar";

import LiveChatFab from "../../shared/components/LiveChatFab";

import { getDashboardData } from "../pages/piDashboardService";

import { useLocation, useNavigate } from "react-router-dom";

import "../pages/PIDashboard.js";

import "../../shared/components/dashboard/shared/DashboardLayout.css";

import "../../shared/components/dashboard/shared/dashboard.css";






import "../styles/PIDashboard.css";

import React from "react";

export const PI_PAGE_ROUTES = {
  dashboard: "/pi-dashboard",

  studies: "/studies",

  recruitment: "/pi-recruitment",

  regulatory: "/pi-regulatory",

  reports: "/pi-reports",

  notifications: "/pi-notifications",

  "site-performance": "/pi-site-performance",

  settings: "/pi-settings",

  referral: "/pi-referral",

  license: "/my-license",

  eisf: "/pi-eisf-dashboard",

  icf: "/pi-icf-dashboard",

  "study-folder": "/pi-study-folder-dashboard",

  livechat: "/pi-livechat",
};

const ROUTE_TO_PAGE = Object.entries(PI_PAGE_ROUTES).reduce(
  (accumulator, [page, path]) => {
    accumulator[path] = page;

    return accumulator;
  },

  {},
);

function getSelectedPageFromPath(pathname) {
  if (
    pathname === "/studies" ||
    pathname.startsWith("/study-dashboard") ||
    pathname.startsWith("/study/") ||
    pathname === "/subjects" ||
    pathname.startsWith("/subject/")
  ) {
    return "studies";
  }
  
  return ROUTE_TO_PAGE[pathname] || "dashboard";
}

function PIDashboardLayout({ children }: any) {
  const navigate = useNavigate();

  const location = useLocation();

  const dashboardData = getDashboardData();

  const selectedPage = getSelectedPageFromPath(location.pathname);

  const {
    contentRef,

    viewportMode,

    sidebarCollapsed,

    sidebarWrapClass,

    sidebarIsOpen,

    headerWrapClass,

    handleToggleSidebar,

    closeSidebar,
  } = useEnterpriseDashboardShell();

  const setSelectedPage = (page) => {
    const path = PI_PAGE_ROUTES[page] || "/pi-dashboard";

    navigate(path);

    closeSidebar();
  };

  return (
    <div className="dashboard-shell dashboard-shell--pi pi-dashboard-wrapper">
      {viewportMode !== "desktop" && (
        <div
          className={`sidebar-backdrop${sidebarIsOpen ? " is-visible" : ""}`}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div className={sidebarWrapClass}>
        <PISidebar
          selectedPage={selectedPage}
          setSelectedPage={setSelectedPage}
          subjects={dashboardData.recentSubjects || []}
          isOpen={sidebarIsOpen}
          collapsed={viewportMode === "desktop" && sidebarCollapsed}
          onClose={closeSidebar}
        />
      </div>

      <div className="dashboard-main">
        <div className="dashboard-main-scaled">
          <div className={headerWrapClass}>
            <PINavbar
              onToggleSidebar={handleToggleSidebar}
              sidebarOpen={sidebarIsOpen}
              setSelectedPage={setSelectedPage}
            />
          </div>

          <div
            className="dashboard-content pi-dashboard-content"
            ref={contentRef}
          >
            {children}
          </div>
        </div>
      </div>

      <LiveChatFab liveChatPath="/pi-livechat" />
    </div>
  );
}

export default PIDashboardLayout;