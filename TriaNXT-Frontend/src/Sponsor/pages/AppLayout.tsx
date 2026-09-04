import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MdDashboard,
  MdMenuBook,
  MdWorkspaces,
  MdMonitorHeart,
  MdBusiness,
  MdAnalytics,
  MdGroups,
  MdWarning,
  MdAssessment,
  MdNotifications,
  MdSettings,
  MdCardGiftcard,
  MdCreditCard,
} from "react-icons/md";
import "../../shared/components/dashboard/shared/DashboardLayout.css";
import "../styles/AppLayout.css";
import "./AppLayout.js";
import LiveChatFab from "../../shared/components/LiveChatFab";
import RoleStudiesSidebarTree from "../../shared/components/RoleStudiesSidebarTree";
import SponsorNavbar from "../components/SponsorNavbar";
import TriaNXTLogo from "../../shared/components/TriaNXTLogo";
import { useEnterpriseDashboardShell } from "../../shared/hooks/useEnterpriseDashboardShell";
import { useRoleStudiesSidebar } from "../../shared/hooks/useRoleStudiesSidebar";

const MENU_ITEMS = [
  { name: "Dashboard", path: "/sponsor-dashboard", icon: MdDashboard },
  { name: "Portfolio Management", path: "/portfolio", icon: MdWorkspaces },
  { name: "Study Oversight", path: "/study-oversight", icon: MdMonitorHeart },
  { name: "CRO Oversight", path: "/cro-oversight", icon: MdBusiness },
  { name: "Site Performance", path: "/site-performance", icon: MdAnalytics },
  { name: "Recruitment", path: "/recruitment", icon: MdGroups },
  { name: "Risk Management", path: "/risk-management", icon: MdWarning },
  { name: "Reports", path: "/reports", icon: MdAssessment },
  { name: "Notifications", path: "/notifications", icon: MdNotifications },
  { name: "Settings", path: "/settings", icon: MdSettings },
  { name: "Referral Program", path: "/referral", icon: MdCardGiftcard },
  { name: "My License", path: "/my-license", icon: MdCreditCard },
];

const AppLayout = ({ children }: any) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    studyCount,
    studiesOpen,
    isStudiesActive,
    isCommentsRoute,
    handleStudiesClick,
  } = useRoleStudiesSidebar();

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

  const collapsed = viewportMode === "desktop" && sidebarCollapsed;

  const isActive = (item) => {
    const { pathname } = location;
    if (item.path === "/sponsor-dashboard") {
      return pathname === "/sponsor-dashboard";
    }
    if (item.path === "/subjects") {
      return pathname === "/subjects" || pathname.startsWith("/subject/");
    }
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  };

  const handleNav = (path) => {
    if (location.pathname !== path) {
      navigate(path);
    }
    closeSidebar();
  };

  return (
    <div className="dashboard-shell dashboard-shell--sponsor app-layout">
      {viewportMode !== "desktop" && (
        <div
          className={`sidebar-backdrop${sidebarIsOpen ? " is-visible" : ""}`}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div className={sidebarWrapClass}>
        <aside
          className={`sidebar sponsor-enterprise-sidebar${
            collapsed ? " is-collapsed" : ""
          }`}
        >
          {/* Kept in the DOM (just made invisible) while collapsed, so its
              exact same box/height keeps reserving space and the icons
              below don't jump up into the header row. The same brand is
              shown instead in the navbar, between the hamburger and the
              welcome text, while collapsed. */}
          <div
            className={`sidebar-logo${
              collapsed ? " sidebar-logo--hidden" : ""
            }`}
          >
            <TriaNXTLogo
              size="sidebar"
              onClick={() => handleNav("/sponsor-dashboard")}
            />
          </div>

          <nav className="sidebar-menu">
            <div
              className={`sidebar-item${
                location.pathname === "/sponsor-dashboard" ? " active" : ""
              }`}
              onClick={() => handleNav("/sponsor-dashboard")}
              role="button"
              tabIndex={0}
            >
              <MdDashboard className="sidebar-icon" size={20} />
              {!collapsed && <span>Dashboard</span>}
            </div>

            <div
              className={`sidebar-item studies-sidebar-item${
                isStudiesActive || isCommentsRoute ? " active" : ""
              }`}
              onClick={() => {
                handleStudiesClick();
                closeSidebar();
              }}
              role="button"
              tabIndex={0}
            >
              <MdMenuBook className="sidebar-icon" size={20} />
              {!collapsed && <span>Studies ({studyCount})</span>}
            </div>

            {/* Not rendered at all while collapsed, so it can't reserve
                leftover vertical space and push later items (Site
                Performance, Reports, Settings, etc.) out of view. */}
            {studiesOpen && !collapsed && (
              <div className="sponsor-studies-submenu">
                <RoleStudiesSidebarTree onNavigate={closeSidebar} />
              </div>
            )}

            {MENU_ITEMS.slice(1).map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <div
                  key={item.name}
                  className={`sidebar-item${active ? " active" : ""}`}
                  onClick={() => handleNav(item.path)}
                  role="button"
                  tabIndex={0}
                >
                  <Icon className="sidebar-icon" size={20} />
                  {!collapsed && <span>{item.name}</span>}
                </div>
              );
            })}
          </nav>
        </aside>
      </div>

      <div className="dashboard-main">
        <div className="dashboard-main-scaled">
          <div className={headerWrapClass}>
            <SponsorNavbar
              onToggleSidebar={handleToggleSidebar}
              sidebarOpen={sidebarIsOpen}
            />
          </div>

          <main className="dashboard-content main-layout" ref={contentRef}>
            {children}
          </main>
        </div>
      </div>

      <LiveChatFab liveChatPath="/live-chat" />
    </div>
  );
};

export default AppLayout;