import React from "react";
import { useEnterpriseDashboardShell } from "../../shared/hooks/useEnterpriseDashboardShell";
import CROSidebar from "./CROSidebar";
import CRONavbar from "../components/CRONavbar";
import CROAlertHost from "./CROAlertHost";
import "../../shared/components/dashboard/shared/DashboardLayout.css";
import "../styles/CROLayout.css";
import "./CROLayout.js";
import LiveChatFab from "../../shared/components/LiveChatFab";

function CROLayout({ children }: any) {
const {
  contentRef,
  viewportMode,
  sidebarWrapClass,
  sidebarIsOpen,
  sidebarCollapsed,
  headerWrapClass,
  handleToggleSidebar,
  closeSidebar
} = useEnterpriseDashboardShell();

  return (
    <div className="dashboard-shell dashboard-shell--cro cro-layout">
      {viewportMode !== "desktop" && (
        <div
          className={`sidebar-backdrop${sidebarIsOpen ? " is-visible" : ""}`}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div className={sidebarWrapClass}>
            <CROSidebar
            isOpen={sidebarIsOpen}
            collapsed={viewportMode === "desktop" && sidebarCollapsed}
            onClose={closeSidebar}
          />
      </div>

      <div className="dashboard-main cro-main-content">
        <div className="dashboard-main-scaled">
          <div className={headerWrapClass}>
            <CRONavbar
              onToggleSidebar={handleToggleSidebar}
              sidebarOpen={sidebarIsOpen}
            />
          </div>

          <div className="dashboard-content cro-page-content" ref={contentRef}>
            {children}
          </div>
        </div>
      </div>

      <CROAlertHost />
      <LiveChatFab liveChatPath="/cro-livechat" />
    </div>
  );
}

export default CROLayout;