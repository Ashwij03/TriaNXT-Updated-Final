import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaTachometerAlt,
  FaBook,
  FaChartLine,
  FaFileAlt,
  FaBell,
  FaCog,
  FaChevronDown,
  FaChevronRight,
  FaTasks,
  FaShieldAlt,
  FaUserFriends,
  FaTimes,
  FaGift,
  FaCreditCard,
  FaHistory,
  FaExclamationTriangle,
  FaClipboardCheck,
} from "react-icons/fa";
import "../styles/CRODashboard.css";
import "./CRODashboard.js";
import RoleStudiesSidebarTree from "../../shared/components/RoleStudiesSidebarTree";
import TriaNXTLogo from "../../shared/components/TriaNXTLogo";
import { useRoleStudiesSidebar } from "../../shared/hooks/useRoleStudiesSidebar";

const MAIN_ITEMS = [
  { to: "/cro-dashboard", icon: FaTachometerAlt, label: "Dashboard" },
  {
    to: "/cro-subject-management",
    icon: FaUserFriends,
    label: "Subject Management",
  },
  { to: "/cro-monitoring", icon: FaTasks, label: "Monitoring" },
  {
    to: "/cro-regulatory-documents",
    icon: FaShieldAlt,
    label: "Regulatory Docs",
  },
  {
    to: "/cro-site-performance",
    icon: FaChartLine,
    label: "Site Performance",
  },
  { to: "/cro-reports", icon: FaFileAlt, label: "Reports" },
  { to: "/cro-notifications", icon: FaBell, label: "Notifications" },
  { to: "/cro-settings", icon: FaCog, label: "Settings" },
  { to: "/cro-referral", icon: FaGift, label: "Referral Program" },
  { to: "/my-license", icon: FaCreditCard, label: "My License" },
  { to: "/audit", icon: FaHistory, label: "Audit Trail" },
  { to: "/issues", icon: FaExclamationTriangle, label: "Deviations" },
  { to: "/capa", icon: FaClipboardCheck, label: "CAPA" },
  { to: "/risks", icon: FaChartLine, label: "Risk Engine" },
];

function SidebarItem({ to, icon: Icon, label, onNavigate }: any) {
  return (
    <li className="cro-sidebar-item">
      <NavLink
        to={to}
        className={({ isActive }) =>
          `cro-sidebar-link${isActive ? " active" : ""}`
        }
        onClick={onNavigate}
      >
        <span className="cro-sidebar-icon">
          <Icon />
        </span>

        <span className="cro-sidebar-label">{label}</span>
      </NavLink>
    </li>
  );
}

function CROSidebar({ isOpen = false, collapsed = false, onClose }: any) {
  const navigate = useNavigate();

  const {
    studyCount,
    studiesOpen,
    isStudiesActive,
    isCommentsRoute,
    handleStudiesClick,
  } = useRoleStudiesSidebar({ onNavigate: onClose });

  const handleNavigate = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const handleStudiesToggle = () => {
    handleStudiesClick();
  };

  return (
    <aside
      className={`cro-sidebar cro-sidebar-aligned
        ${isOpen ? " open" : ""}
        ${collapsed ? " collapsed" : ""}`}
    >
      <div className="cro-sidebar-top">
        <div
          className="cro-sidebar-logo-link"
          onClick={() => {
            handleNavigate();
            navigate("/cro-dashboard");
          }}
        >
          <TriaNXTLogo size="sidebar" />
        </div>

        <button
          type="button"
          className="cro-sidebar-close"
          onClick={onClose}
        >
          <FaTimes />
        </button>
      </div>

      <ul className="sidebar-menu cro-sidebar-menu-aligned">
        <SidebarItem
          to="/cro-dashboard"
          icon={FaTachometerAlt}
          label="Dashboard"
          onNavigate={handleNavigate}
        />

        <li className="cro-sidebar-item">
          <button
            type="button"
            className={`cro-sidebar-link cro-sidebar-toggle${
              isStudiesActive || isCommentsRoute ? " active" : ""
            }`}
            onClick={handleStudiesToggle}
          >
            <span className="cro-sidebar-icon">
              <FaBook />
            </span>

            <span className="cro-sidebar-label">Studies ({studyCount})</span>

            <span className="cro-sidebar-chevron">
              {studiesOpen ? <FaChevronDown /> : <FaChevronRight />}
            </span>
          </button>

          {studiesOpen && (
            <div className="cro-studies-submenu">
              <RoleStudiesSidebarTree onNavigate={handleNavigate} />
            </div>
          )}
        </li>

        {MAIN_ITEMS.slice(1).map((item) => (
          <SidebarItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            onNavigate={handleNavigate}
          />
        ))}
      </ul>
    </aside>
  );
}

export default CROSidebar;