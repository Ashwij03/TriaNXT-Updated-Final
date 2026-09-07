import "./DashboardSidebar.css";

import TriaNXTLogo from "../../TriaNXTLogo";
import {
  getAccessibleStudies,
  getCurrentUser,
  getDashboardPath,
  getEffectiveRole,
  getEffectiveUser,
  getSidebarMenuItems,

  hasPermission,
  PERMISSIONS,
} from "../../../services/roleService";
import { ADMIN_PREVIEW_ROLE_EVENT } from "../../../constants/headerFilters";
import { FOLDER_TREE_EVENT } from "../../../services/folderService";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiBell,
  FiFolder,
  FiGrid,
  FiSettings,
  FiShield,
  FiTrendingUp,
  FiUsers,
  FiEye,
  FiUser,
  FiBarChart2,
  FiFileText,
  FiLayers,
  FiCpu,
  FiGift,
  FiCreditCard,
  FiAlertTriangle,
  FiCheckSquare,
  FiActivity,
} from "react-icons/fi";
import { getRoleExtraMenuItems } from "../../../constants/roleMenus";

import { canViewFinancials } from "../../../pages/studies/StudyWorkspaceTabsConfig";
import { resolveStudyKey as getStudyKey, getSubjectsForStudy } from "../../../services/subjectService";

const STUDY_SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "subjects", label: "Subjects", expandable: true },
  { key: "planning", label: "Planning" },
  { key: "visitPlan", label: "Visit Plan" },
  { key: "clinicalSites", label: "Clinical Sites" },
  { key: "eisf", label: "eISF" },
  // ===== ITEM 16: Regulatory removed from Studies sidebar sections =====
  // { key: "regulatory", label: "Regulatory" },

  { key: "logs", label: "Logs" },
  { key: "reports", label: "Reports" },
  { key: "studyFiles", label: "Study Files" },
  { key: "financials", label: "Financials" },
  { key: "others", label: "Others" },
  { key: "study-milestone", label: "Study Milestone" },
  { key: "activity", label: "Activity" },
];

function DashboardSidebar({ onNavigate, collapsed = false, compact = false }: any) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const resizingRef = useRef(false);
  const prevActiveStudyKeyRef = useRef(null);

  const currentUser = getCurrentUser();
  const userEmail = currentUser?.email || "";

  const [effectiveRole, setEffectiveRole] = useState(() =>
    getEffectiveRole(currentUser),
  );

  const effectiveUser = getEffectiveUser(currentUser);

  const getStudiesSafe = () => {
    try {
      const studies = getAccessibleStudies(currentUser);
      return Array.isArray(studies) ? studies : [];
    } catch {
      return [];
    }
  };

  const getStudyDisplayName = (study) =>
    study?.name ||
    study?.title ||
    study?.studyName ||
    study?.protocolTitle ||
    study?.protocol ||
    "Untitled Study";

  const getStudyMeta = (study) => {
    const code = study?.code || study?.id || study?.studyId;

    if (!code) {
      return "";
    }

    const name = getStudyDisplayName(study);

    return name && code !== name ? code : "";
  };

  // All subject data now flows through subjectService — the single source
  // of truth. No more direct localStorage access or duplicated filtering.
  const getStudySubjects = (study) => getSubjectsForStudy(getStudyKey(study));

  const [studyBinderOpen, setStudyBinderOpen] = useState(false);

  const [studiesOpen, setStudiesOpen] = useState(() => {
    return (
      pathname === "/studies" ||
      pathname.startsWith("/study-dashboard") ||
      pathname.startsWith("/study/") ||
      pathname.includes("/comments") ||
      pathname === "/comments"
    );
  });

  const [expandedStudies, setExpandedStudies] = useState<Record<string, any>>({});
  const [expandedStudySections, setExpandedStudySections] = useState<Record<string, any>>({});
  const [, setFolderTreeVersion] = useState(0);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const storedWidth = Number(localStorage.getItem("dashboardSidebarWidth"));
    return storedWidth >= 150 ? storedWidth : 150;
  });

  const studies = getStudiesSafe();
  const studyCount = studies.length;
  const sidebarItems = getSidebarMenuItems(currentUser);

  const canManageUsers =
    effectiveUser?.role === "Admin" || effectiveUser?.role === "SiteStaff";

  const canApprovePermissions =
    effectiveUser?.role === "Admin" || effectiveUser?.role === "SiteStaff";

  const canViewCROOverview =
    effectiveUser?.role === "Admin" ||
    effectiveUser?.role === "SiteStaff" ||
    effectiveUser?.role === "CRO";

  const canViewAuditLogs =
    effectiveUser?.role === "Admin" || effectiveUser?.role === "SiteStaff";

  // ===== START: Dynamic Subscription & Plan Catalog sidebar gating =====
  // My License is universal (every role), so it is gated exactly like the
  // Referral Program link below. Subscription Plans is Admin-only.
  const canManageSubscription = effectiveUser?.role === "Admin";
  // ===== END: Dynamic Subscription & Plan Catalog sidebar gating =====


  const canRequestAccess =
    effectiveUser?.role === "CRO" || effectiveUser?.role === "Sponsor";

  // ===== START: Safety / AI Review / eTMF role checks =====
  const canViewSafety =
    effectiveUser?.role === "Admin" ||
    effectiveUser?.role === "CRO" ||
    effectiveUser?.role === "Sponsor";

  const canViewAiReview =
    effectiveUser?.role === "Admin" ||
    effectiveUser?.role === "CRO" ||
    effectiveUser?.role === "Sponsor";

  const canViewEtmf =
    effectiveUser?.role === "Admin" ||
    effectiveUser?.role === "CRO" ||
    effectiveUser?.role === "Sponsor";
  // ===== END: Safety / AI Review / eTMF role checks =====

  // ===== START: Monitoring Access role check =====
  // Mirrors the "/monitoring-access" entry in roleService.js's
  // ROUTE_ACCESS map (Admin, SiteStaff, CRO, Sponsor).
  const canViewMonitoringAccess =
    effectiveUser?.role === "Admin" ||
    effectiveUser?.role === "SiteStaff" ||
    effectiveUser?.role === "CRO" ||
    effectiveUser?.role === "Sponsor";
  // ===== END: Monitoring Access role check =====

  // ===== START: Governance modules (Phases 1-4) role checks =====
  // Mirrors the route-access map in roleService.js — these determine the
  // sidebar entries only; the backend enforces the same matrix server-side.
  const canViewCompliance =
    effectiveUser?.role === "Admin" || effectiveUser?.role === "Sponsor";
  const canViewAuditTrail =
    effectiveUser?.role === "Admin" ||
    effectiveUser?.role === "Sponsor" ||
    effectiveUser?.role === "CRO";
  const canViewDeviations = Boolean(effectiveUser?.role);
  const canViewCapa = Boolean(effectiveUser?.role);
  const canViewRisks =
    effectiveUser?.role === "Admin" ||
    effectiveUser?.role === "Sponsor" ||
    effectiveUser?.role === "CRO";
  // ===== END: Governance modules (Phases 1-4) role checks =====

  const roleExtraMenuItems = getRoleExtraMenuItems(effectiveUser?.role);
  const visibleStudySections = STUDY_SECTIONS.filter((section) => {
    if (section.key === "clinicalSites") {
      return (
        effectiveUser?.role === "Sponsor" || effectiveUser?.role === "Admin"
      );
    }

    if (section.key === "financials") {
      return canViewFinancials(currentUser);
    }

    if (section.key === "activity") {
      return hasPermission(PERMISSIONS.VIEW_SITE_ACTIVITIES);
    }

    return true;
  });

  const sidebarClassName = [
    "enterprise-sidebar",
    collapsed || compact ? "is-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isStudiesOverviewRoute = pathname === "/studies";

  const isStudyInternalRoute =
    pathname.startsWith("/study-dashboard") || pathname.startsWith("/study/");

  const isCommentsRoute =
    pathname.includes("/comments") || pathname === "/comments";

  const isStudiesActive = isStudiesOverviewRoute || isStudyInternalRoute;

  useEffect(() => {
    const handlePreviewRoleChange = () => {
      const nextRole = getEffectiveRole(getCurrentUser());

      setEffectiveRole((currentRole) =>
        currentRole === nextRole ? currentRole : nextRole,
      );
    };

    window.addEventListener(ADMIN_PREVIEW_ROLE_EVENT, handlePreviewRoleChange);

    return () => {
      window.removeEventListener(
        ADMIN_PREVIEW_ROLE_EVENT,
        handlePreviewRoleChange,
      );
    };
  }, [userEmail]);

  useEffect(() => {
    if (isStudiesOverviewRoute || isStudyInternalRoute || isCommentsRoute) {
      setStudiesOpen((open) => (open ? open : true));
      return;
    }

    setStudiesOpen((open) => (open ? false : open));
  }, [isStudiesOverviewRoute, isStudyInternalRoute, isCommentsRoute, pathname]);

  useEffect(() => {
    if (!isStudyInternalRoute) {
      prevActiveStudyKeyRef.current = null;
      return;
    }

    const studyMatch = pathname.match(/^\/study-dashboard\/([^/?]+)/);
    const activeStudyKey = studyMatch?.[1];

    if (!activeStudyKey) {
      return;
    }

    if (prevActiveStudyKeyRef.current !== activeStudyKey) {
      setStudyBinderOpen(true);
      setExpandedStudies({ [activeStudyKey]: true });
      setExpandedStudySections({});
      prevActiveStudyKeyRef.current = activeStudyKey;
    }
  }, [pathname, isStudyInternalRoute]);

  useEffect(() => {
    const handleFolderTreeUpdate = () => {
      setFolderTreeVersion((value) => value + 1);
    };

    window.addEventListener(FOLDER_TREE_EVENT, handleFolderTreeUpdate);

    return () => {
      window.removeEventListener(FOLDER_TREE_EVENT, handleFolderTreeUpdate);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!resizingRef.current) {
        return;
      }

      const nextWidth = Math.min(320, Math.max(150, event.clientX));

      setSidebarWidth(nextWidth);
      localStorage.setItem("dashboardSidebarWidth", String(nextWidth));
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.classList.remove("sidebar-resizing");
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const dashboardPath = getDashboardPath(effectiveRole);

  const isDashboardActive =
    pathname === "/dashboard" ||
    (pathname.endsWith("-dashboard") &&
      !pathname.startsWith("/study-dashboard"));

  const getLinkClass = (isActive) =>
    isActive ? "sidebar-link active" : "sidebar-link";

  const handleNav = (path) => {
    navigate(path);
    onNavigate?.();
  };

  const usesUnifiedSettings =
    effectiveUser?.role === "Admin" || effectiveUser?.role === "SiteStaff";

  const handleSettingsNav = (section = "profile") => {
    navigate("/settings", { state: { section } });
    onNavigate?.();
  };

  const handleDashboardClick = () => {
    handleNav(dashboardPath);
  };

  const handleStudiesClick = () => {
    if (pathname === "/studies" && studiesOpen) {
      setStudiesOpen(false);
      return;
    }

    setStudiesOpen(true);

    if (pathname !== "/studies") {
      handleNav("/studies");
    }
  };

  const handleStudyBinderClick = (event) => {
    event.stopPropagation();
    setStudyBinderOpen((previousValue) => !previousValue);
  };

  const handleStudiesCommentsClick = (event) => {
    event?.stopPropagation();
    handleNav("/comments");
  };

  const toggleStudyNode = (studyKey, event) => {
    event?.stopPropagation();

    const isCurrentStudyOpen = Boolean(expandedStudies[studyKey]);

    if (isCurrentStudyOpen) {
      setExpandedStudies({});
      setExpandedStudySections({});
      return;
    }

    setExpandedStudies({ [studyKey]: true });
    setExpandedStudySections({});
  };

  const toggleStudySection = (studyKey, sectionKey, event) => {
    event?.stopPropagation();

    const compositeKey = `${studyKey}__${sectionKey}`;

    setExpandedStudySections((previousValue) => ({
      ...previousValue,
      [compositeKey]: !Boolean(previousValue[compositeKey]),
    }));
  };

  const navigateToStudySection = (studyKey, section) => {
    const tabMap = {
      overview: "Overview",
      subjects: "Subjects",
      "study-milestone": "Study Milestone",
      visitPlan: "Visit Plan",
      clinicalSites: "Clinical Sites",
      eisf: "eISF",
      // ===== ITEM 16: Regulatory removed from Studies section tab map =====
      // regulatory: "Regulatory",
      reports: "Reports",
      studyFiles: "Study Files",
      logs: "Logs",
      financials: "Financials",
      others: "Others",
      activity: "Activity",
    };

    let tab = tabMap[section] || "Overview";

    if (tab === "Financials" && !canViewFinancials(currentUser)) {
      tab = "Overview";
    }

    handleNav(
      `/study-dashboard/${encodeURIComponent(
        studyKey,
      )}?tab=${encodeURIComponent(tab)}`,
    );
  };

  const handleStudyNameClick = (studyKey, event) => {
    event?.stopPropagation();

    const isCurrentStudyOpen = Boolean(expandedStudies[studyKey]);

    if (isCurrentStudyOpen) {
      setExpandedStudies({});
      setExpandedStudySections({});
      return;
    }

    setExpandedStudies({ [studyKey]: true });
    setExpandedStudySections({
      [`${studyKey}__subjects`]: true,
    });
    navigateToStudySection(studyKey, "subjects");
  };

  const handleSubjectsSectionClick = (studyKey, event) => {
    event?.stopPropagation();

    const compositeKey = `${studyKey}__subjects`;

    setExpandedStudySections((previousValue) => ({
      ...previousValue,
      [compositeKey]: !Boolean(previousValue[compositeKey]),
    }));

    localStorage.removeItem("selectedSubject");

    window.dispatchEvent(
      new CustomEvent("subject-selected", {
        detail: {
          studyId: studyKey,
          subject: null,
        },
      }),
    );

    navigateToStudySection(studyKey, "subjects");
  };

  const handleExpandableSectionLabelClick = (studyKey, sectionKey, event) => {
    event?.stopPropagation();

    if (sectionKey === "subjects") {
      handleSubjectsSectionClick(studyKey, event);
      return;
    }

    toggleStudySection(studyKey, sectionKey, event);
  };

  const handleSubjectClick = (studyKey, subject) => {
    const subjectId = String(subject?.subjectId || subject?.id || "").trim();

    if (!subjectId) {
      return;
    }

    const selectedSubject = {
      ...subject,
      subjectId,
      id: subject?.id || subjectId,
      studyId: studyKey,
    };

    localStorage.setItem("selectedSubject", JSON.stringify(selectedSubject));

    setStudyBinderOpen(true);
    setStudiesOpen(true);
    setExpandedStudies({ [studyKey]: true });
    setExpandedStudySections((previousValue) => ({
      ...previousValue,
      [`${studyKey}__subjects`]: true,
    }));

    window.dispatchEvent(
      new CustomEvent("subject-selected", {
        detail: {
          studyId: studyKey,
          subject: selectedSubject,
        },
      }),
    );

    handleNav(
      `/study-dashboard/${encodeURIComponent(
        studyKey,
      )}?tab=Subjects&subject=${encodeURIComponent(subjectId)}`,
    );
  };

  return (
    <div
      className={sidebarClassName}
      style={
        collapsed || compact
          ? undefined
          : {
              width: sidebarWidth,
              minWidth: sidebarWidth,
              flexBasis: sidebarWidth,
            }
      }>

      <TriaNXTLogo size="sidebar" onClick={() => handleNav(dashboardPath)} />

      <div
        className={getLinkClass(isDashboardActive)}
        onClick={handleDashboardClick}>

        <FiGrid size={16} />
        <span>Dashboard</span>
      </div>

      <div
        className={`${getLinkClass(
          isStudiesActive,
        )} sidebar-folder sidebar-folder--no-indicator${
          studiesOpen ? " submenu-open" : ""
        }`}
        onClick={handleStudiesClick}>

        <FiFolder size={16} />
        <span>Studies ({studyCount})</span>
      </div>

      {studiesOpen && (
        <div className="sidebar-submenu sidebar-studies-tree">
          <div className="sidebar-tree-row sidebar-tree-row--branch">
            <button
              type="button"
              className="sidebar-expander"
              aria-label={
                studyBinderOpen
                  ? "Collapse Study Binder"
                  : "Expand Study Binder"
              }
              onClick={handleStudyBinderClick}>

              {studyBinderOpen ? "−" : "+"}
            </button>

            <span
              className="sidebar-tree-label sidebar-tree-label--strong"
              onClick={handleStudyBinderClick}>

              Study Binder
            </span>
          </div>

          {studyBinderOpen && (
            <div className="sidebar-tree-group">
              {studies.map((study) => {
                const studyKey = getStudyKey(study);
                const studyName = getStudyDisplayName(study);
                const studyMeta = getStudyMeta(study);
                const studySubjects = getStudySubjects(study);
                const subjectCount = studySubjects.length;
                const isStudyOpen = Boolean(expandedStudies[studyKey]);

                return (
                  <div key={studyKey} className="sidebar-tree-study">
                    <div className="sidebar-tree-row sidebar-tree-row--branch">
                      <button
                        type="button"
                        className="sidebar-expander"
                        aria-label={
                          isStudyOpen
                            ? "Collapse study sections"
                            : "Expand study sections"
                        }
                        onClick={(event) => toggleStudyNode(studyKey, event)}>

                        {isStudyOpen ? "−" : "+"}
                      </button>

                      <div
                        className="study-label-block"
                        onClick={(event) =>
                          handleStudyNameClick(studyKey, event)
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleStudyNameClick(studyKey, event);
                          }
                        }}>

                        <span className="study-label-name">{studyName}</span>

                        {studyMeta && (
                          <small className="study-label-meta">
                            {studyMeta}
                          </small>
                        )}
                      </div>
                    </div>

                    {isStudyOpen && (
                      <div className="sidebar-tree-group sidebar-tree-group--sections">
                        {visibleStudySections.map((section) => {
                          const sectionKey = section.key;
                          const compositeKey = `${studyKey}__${sectionKey}`;
                          const isSectionOpen = Boolean(
                            expandedStudySections[compositeKey],
                          );

                          if (section.expandable) {
                            const displayLabel =
                              sectionKey === "subjects"
                                ? `Subjects (${subjectCount})`
                                : section.label;

                            return (
                              <div key={compositeKey}>
                                <div className="sidebar-tree-row sidebar-tree-row--section-leaf sidebar-tree-row--expandable">
                                  <button
                                    type="button"
                                    className="sidebar-expander"
                                    aria-label={
                                      isSectionOpen
                                        ? `Collapse ${displayLabel}`
                                        : `Expand ${displayLabel}`
                                    }
                                    onClick={(event) =>
                                      toggleStudySection(
                                        studyKey,
                                        sectionKey,
                                        event,
                                      )
                                    }>

                                    {isSectionOpen ? "−" : "+"}
                                  </button>

                                  <span
                                    className="sidebar-tree-label"
                                    onClick={(event) =>
                                      handleExpandableSectionLabelClick(
                                        studyKey,
                                        sectionKey,
                                        event,
                                      )
                                    }>

                                    {displayLabel}
                                  </span>
                                </div>

                                {isSectionOpen && sectionKey === "subjects" && (
                                  <div className="sidebar-tree-group sidebar-tree-group--nested">
                                    {studySubjects.map((subject) => {
                                      const subjectKey = String(
                                        subject?.subjectId || subject?.id || "",
                                      ).trim();

                                      if (!subjectKey) {
                                        return null;
                                      }

                                      return (
                                        <div
                                          key={`${studyKey}-${subjectKey}`}
                                          className="sidebar-subject-group">

                                          <div
                                            className="sidebar-tree-row sidebar-tree-row--section-leaf sidebar-subject-row"
                                            onClick={() =>
                                              handleSubjectClick(
                                                studyKey,
                                                subject,
                                              )
                                            }>

                                            <span className="sidebar-tree-label">
                                              {subjectKey}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={compositeKey}
                              className="sidebar-tree-row sidebar-tree-row--section-leaf"
                              onClick={() =>
                                navigateToStudySection(studyKey, sectionKey)
                              }>

                              <span
                                className="sidebar-tree-spacer"
                                aria-hidden="true"
                              />

                              <span className="sidebar-tree-label">
                                {section.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div
            className={`sidebar-tree-row sidebar-tree-row--comments${
              isCommentsRoute ? " active" : ""
            }`}
            onClick={handleStudiesCommentsClick}>

            <span className="sidebar-tree-spacer" aria-hidden="true" />
            <span className="sidebar-tree-label">Comments</span>
          </div>
        </div>
      )}

      {sidebarItems.some((item) => item.key === "site-performance") && (
        <div
          className={getLinkClass(pathname.includes("site-performance"))}
          onClick={() => handleNav("/site-performance")}>

          <FiTrendingUp size={16} />
          <span>Site Performance</span>
        </div>
      )}

      {sidebarItems.some((item) => item.key === "recruitment") && (
        <div
          className={getLinkClass(pathname.includes("recruitment"))}
          onClick={() => handleNav("/recruitment")}>

          <FiUsers size={16} />
          <span>Recruitment</span>
        </div>
      )}

      {sidebarItems.some((item) => item.key === "reports") && (
        <div
          className={getLinkClass(pathname.includes("/reports"))}
          onClick={() => handleNav("/reports")}>

          <FiBarChart2 size={16} />
          <span>Reports</span>
        </div>
      )}

      {/* ===== START: Safety / AI Review / eTMF sidebar links ===== */}
      {canViewSafety && (
        <div
          className={getLinkClass(pathname.includes("/safety"))}
          onClick={() => handleNav("/safety")}>

          <FiShield size={16} />
          <span>Safety</span>
        </div>
      )}

      {canViewAiReview && (
        <div
          className={getLinkClass(pathname.includes("/ai-review"))}
          onClick={() => handleNav("/ai-review")}>

          <FiCpu size={16} />
          <span>AI Review</span>
        </div>
      )}

      {canViewEtmf && (
        <div
          className={getLinkClass(pathname.includes("/etmf"))}
          onClick={() => handleNav("/etmf")}>

          <FiFolder size={16} />
          <span>eTMF</span>
        </div>
      )}
      {/* ===== END: Safety / AI Review / eTMF sidebar links ===== */}

      {/* ===== START: Monitoring Access sidebar link ===== */}
      {canViewMonitoringAccess && (
        <div
          className={getLinkClass(pathname.includes("/monitoring-access"))}
          onClick={() => handleNav("/monitoring-access")}
        >
          <FiEye size={16} />
          <span>Monitoring Access</span>
        </div>
      )}
      {/* ===== END: Monitoring Access sidebar link ===== */}

      {/* ===== START: Governance module sidebar links (Phases 1-4) ===== */}
      {canViewCompliance && (
        <div
          className={getLinkClass(pathname === "/compliance")}
          onClick={() => handleNav("/compliance")}
        >
          <FiShield size={16} />
          <span>Compliance Dashboard</span>
        </div>
      )}

      {canViewAuditTrail && (
        <div
          className={getLinkClass(pathname === "/audit")}
          onClick={() => handleNav("/audit")}
        >
          <FiFileText size={16} />
          <span>Audit Trail</span>
        </div>
      )}

      {canViewDeviations && (
        <div
          className={getLinkClass(pathname === "/issues")}
          onClick={() => handleNav("/issues")}
        >
          <FiAlertTriangle size={16} />
          <span>Deviations</span>
        </div>
      )}

      {canViewCapa && (
        <div
          className={getLinkClass(pathname === "/capa")}
          onClick={() => handleNav("/capa")}
        >
          <FiCheckSquare size={16} />
          <span>CAPA</span>
        </div>
      )}

      {canViewRisks && (
        <div
          className={getLinkClass(pathname === "/risks")}
          onClick={() => handleNav("/risks")}
        >
          <FiActivity size={16} />
          <span>Risk Engine</span>
        </div>
      )}
      {/* ===== END: Governance module sidebar links (Phases 1-4) ===== */}

      {canManageUsers && (
        <div
          className={getLinkClass(pathname.includes("user-management"))}
          onClick={() => handleNav("/user-management")}>

          <FiUsers size={16} />
          <span>User Management</span>
        </div>
      )}

      {canApprovePermissions && (
        <div
          className={getLinkClass(
            pathname.includes("access-permission") ||
              pathname.includes("permission-approval"),
          )}
          onClick={() => handleNav("/access-permission")}>

          <FiShield size={16} />
          <span>Permission Approval</span>
        </div>
      )}

      {canRequestAccess && (
        <div
          className={getLinkClass(pathname.includes("access-request"))}
          onClick={() => handleNav("/access-request")}>

          <FiShield size={16} />
          <span>Request Access</span>
        </div>
      )}

      {canViewCROOverview && (
        <div
          className={getLinkClass(pathname.includes("cro-overview"))}
          onClick={() => handleNav("/cro-overview")}>

          <FiEye size={16} />
          <span>CRO Overview</span>
        </div>
      )}

      {canViewAuditLogs && (
        <div
          className={getLinkClass(pathname === "/audit-logs")}
          onClick={() => handleNav("/audit-logs")}>

          <FiFileText size={16} />
          <span>Audit Logs</span>
        </div>
      )}

      {canViewAuditLogs && (
        <div
          className={getLinkClass(
            pathname === "/logs" || pathname.startsWith("/logs/"),
          )}
          onClick={() => handleNav("/logs")}>

          <FiLayers size={16} />
          <span>Logs</span>
        </div>
      )}

      {/* ---- Global Logs sidebar entry removed by request. Training and
      Delegation logs are reachable from inside each study's Logs tab. ---- */}

      {sidebarItems.some((item) => item.key === "notifications") && (
        <div
          className={getLinkClass(pathname.includes("notifications"))}
          onClick={() => handleNav("/notifications")}>

          <FiBell size={16} />
          <span>Notifications</span>
        </div>
      )}

      {!usesUnifiedSettings && (
        <div
          className={getLinkClass(pathname.includes("/profile"))}
          onClick={() => handleNav("/profile")}>

          <FiUser size={16} />
          <span>Profile</span>
        </div>
      )}

      {sidebarItems.some((item) => item.key === "settings") && (
        <div
          className={getLinkClass(pathname.includes("settings"))}
          onClick={() =>
            usesUnifiedSettings
              ? handleSettingsNav("profile")
              : handleNav("/settings")
          }>

          <FiSettings size={16} />
          <span>Settings</span>
        </div>
      )}

      {sidebarItems.some((item) => item.key === "settings") && (
        <div
          className={getLinkClass(pathname.includes("/referral"))}
          onClick={() => handleNav("/referral")}>

          <FiGift size={16} />
          <span>Referral Program</span>
        </div>
      )}

      {sidebarItems.some((item) => item.key === "settings") && (
        <div
          className={getLinkClass(pathname.includes("/my-license"))}
          onClick={() => handleNav("/my-license")}
        >
          <FiCreditCard size={16} />
          <span>My License</span>
        </div>
      )}

      {canManageSubscription && (
        <div
          className={getLinkClass(pathname.includes("/admin/subscription"))}
          onClick={() => handleNav("/admin/subscription")}
        >
          <FiCreditCard size={16} />
          <span>Subscription Plans</span>
        </div>
      )}

      {roleExtraMenuItems.map((item) => (
        <div
          key={item.key}
          className={getLinkClass(pathname.includes(item.path))}
          onClick={() => handleNav(item.path)}>

          <FiLayers size={16} />
          <span>{item.label}</span>
        </div>
      ))}

      {!collapsed && !compact && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={(event) => {
            event.preventDefault();
            resizingRef.current = true;
            document.body.classList.add("sidebar-resizing");
          }}
        />
      )}
    </div>
  );
}

export default DashboardSidebar;