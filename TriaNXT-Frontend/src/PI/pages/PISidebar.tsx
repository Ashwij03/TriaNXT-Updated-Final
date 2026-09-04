import React from "react";
import { useLocation } from "react-router-dom";
import {
  FaHome,
  FaBookOpen,
  FaChartBar,
  FaUserFriends,
  FaUniversity,
  FaChartPie,
  FaBell,
  FaCog,
  FaGift,
  FaCreditCard,
} from "react-icons/fa";
import "../styles/PISidebar.css";
import { getSidebarMenuData } from "./piDashboardService";
import TriaNXTLogo from "../../shared/components/TriaNXTLogo";
import RoleStudiesSidebarTree from "../../shared/components/RoleStudiesSidebarTree";
import { useRoleStudiesSidebar } from "../../shared/hooks/useRoleStudiesSidebar";

const ICON_MAP = {
  home: FaHome,
  chart: FaChartBar,
  users: FaUserFriends,
  university: FaUniversity,
  pie: FaChartPie,
  bell: FaBell,
  cog: FaCog,
  gift: FaGift,
};

function PISidebar({
  selectedPage,
  setSelectedPage,
  isOpen = true,
  collapsed = false,
  onClose,
}: any) {
  const { pathname } = useLocation();

  const menuData = getSidebarMenuData();

  const {
    studyCount,
    studiesOpen,
    isStudiesActive,
    handleStudiesClick,
  } = useRoleStudiesSidebar({
    onNavigate: onClose,
  });

  const handleStudiesNav = () => {
    handleStudiesClick();

    if (typeof setSelectedPage === "function") {
      setSelectedPage("studies");
    }
  };

  const handleMenuClick = (page) => {
    if (typeof setSelectedPage === "function") {
      setSelectedPage(page);
    }

    if (typeof onClose === "function") {
      onClose();
    }
  };

  const getMenuClass = (page) => {
    const routeMap = {
      dashboard: "/pi-dashboard",
      comments: "/pi-comments",
      sitePerformance: "/pi-site-performance",
      recruitment: "/pi-recruitment",
      regulatory: "/pi-regulatory",
      reports: "/pi-reports",
      notifications: "/pi-notifications",
      settings: "/pi-settings",
      referral: "/pi-referral",
      license: "/my-license",
    };

    const route = routeMap[page];

    const isActive =
      route &&
      (pathname === route || pathname.startsWith(`${route}/`));

    return `menu-item${isActive ? " active-menu" : ""}`;
  };

  const mainSections = menuData.sections.filter(
    (section) => section.id !== "dashboard",
  );

  const dashboardSection = menuData.sections.find(
    (section) => section.id === "dashboard",
  );

  return (
    <>
      <div
        className={`pi-sidebar-overlay${isOpen ? " visible" : ""}`}
        onClick={onClose}
      />

      <div
        className={`sidebar pi-sidebar${isOpen ? " open" : ""}${
          collapsed ? " is-collapsed" : ""
        }`}
      >
        {/* Kept in the DOM (just made invisible) while collapsed, so its
            exact same box/height keeps reserving space and the icons
            below don't jump up into the header row. The same brand is
            shown instead in the navbar, between the hamburger and the
            welcome text, while collapsed. */}
        <TriaNXTLogo
          size="sidebar"
          className={`pi-sidebar-brand${
            collapsed ? " pi-sidebar-brand--hidden" : ""
          }`}
          onClick={() => handleMenuClick("dashboard")}
        />

        {/* Dashboard */}
        {dashboardSection && (
          <div
            className={getMenuClass(dashboardSection.page)}
            onClick={() => handleMenuClick(dashboardSection.page)}
          >
            <FaHome />
            {!collapsed && <span>{dashboardSection.label}</span>}
          </div>
        )}

        {/* Studies */}
        <div
          className={`menu-item studies-menu${
            selectedPage === "studies" || isStudiesActive
              ? " active-menu"
              : ""
          }`}
          onClick={handleStudiesNav}
        >
          <FaBookOpen />
          {!collapsed && <span>Studies ({studyCount})</span>}
        </div>

        {/* Studies submenu — not rendered at all while collapsed, so it
            can't reserve leftover vertical space and push later items
            (Site Performance, Reports, Settings, etc.) out of view. */}
        {studiesOpen && !collapsed && (
          <div className="submenu-container pi-studies-tree">
            <RoleStudiesSidebarTree onNavigate={onClose} />
          </div>
        )}

        {/* Other menu items */}
        {mainSections.map((section) => {
          const Icon = ICON_MAP[section.icon] || FaChartBar;

          return (
            <div
              key={section.id}
              className={getMenuClass(section.page)}
              onClick={() => handleMenuClick(section.page)}
            >
              <Icon />
              {!collapsed && <span>{section.label}</span>}
            </div>
          );
        })}

        {/* Referral Program — always shown directly below Settings, as the
            very last item in the PI sidebar. */}
        <div
          className={getMenuClass("referral")}
          onClick={() => handleMenuClick("referral")}
        >
          <FaGift />
          {!collapsed && <span>Referral Program</span>}
        </div>

        {/* My License — shown directly below Referral Program. Read-only for
            every role; only Admin can change the plan. */}
        <div
          className={getMenuClass("license")}
          onClick={() => handleMenuClick("license")}
        >
          <FaCreditCard />
          {!collapsed && <span>My License</span>}
        </div>
      </div>
    </>
  );
}

export default PISidebar;