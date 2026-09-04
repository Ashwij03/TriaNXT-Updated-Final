import "./StudyWorkspaceTabs.css";

import { STUDY_WORKSPACE_TABS, canViewFinancials } from "./StudyWorkspaceTabsConfig";

import { getEffectiveRole, ROLES, hasPermission, PERMISSIONS } from "../../services/roleService";

function StudyWorkspaceTabs({ activeTab, setActiveTab }: any) {

  const effectiveRole = getEffectiveRole();

  const visibleTabs = STUDY_WORKSPACE_TABS.filter((tab) => {
    if (tab.id === "clinical-sites") {
      return effectiveRole === ROLES.SPONSOR || effectiveRole === ROLES.ADMIN;
    }

    if (tab.id === "activity") {
      return hasPermission(PERMISSIONS.VIEW_SITE_ACTIVITIES);
    }

    if (tab.id === "financials") {
      return canViewFinancials();
    }

    return true;
  });

  return (
    <div className="workspace-header">
      <div className="workspace-tabs">

        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.label
                ? "workspace-tab active"
                : "workspace-tab"
            }
            onClick={() => setActiveTab(tab.label)}
            type="button">

            {tab.label}
          </button>
        )        )}

      </div>
    </div>
  );
}

export default StudyWorkspaceTabs;
