import StudyActivity from "./StudyActivity";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import { getSubjectsForStudy } from "../../services/subjectService";
import SubjectAnalyticsSection from "../../components/dashboard/shared/SubjectAnalyticsSection";
import VisitCalendarSection from "../../components/dashboard/shared/VisitCalendarSection";
import StudySubjects from "./StudySubjects";
/* Subjects tab: mounts the completed Subject Explorer workspace (Phases 1-7).
   The Overview section below still renders `StudySubjects`, unchanged. */
import StudySubjectsWorkspace from "../../components/SubjectExplorer/StudySubjectsWorkspace";
import StudyWorkspaceTabs from "./StudyWorkspaceTabs";
import { canViewFinancials } from "./StudyWorkspaceTabsConfig";
import StudyDocuments from "./StudyDocuments";
import StudyComments from "./StudyComments";
import StudyLogsTab from "./StudyLogsTab";
import StudyReports from "./StudyReports";
import StudyPlanning from "./StudyPlanning";
import StudyVisitPlan from "./StudyVisitPlan";
import EssentialDocumentsWidget from "../../components/studies/EssentialDocumentsWidget";
import StudyProgressSummary from "../../components/studies/StudyProgressSummary";
import StudyMilestoneTimeline from "../../components/studies/StudyMilestoneTimeline";
import SiteActivationStatus from "../../components/studies/SiteActivationStatus";
import StudyHealthSummary from "../../components/studies/StudyHealthSummary";
import StudyModal from "../../components/studies/StudyModal";
import useStudyOverview from "../../hooks/useStudyOverview";
import StudyFinancials from "../Financials/StudyFinancials";
import AlertsPanel from "../../components/dashboard/shared/AlertsPanel";
import useStudiesDashboard from "../../hooks/useStudiesDashboard";
import useVisitSchedules from "../../hooks/useVisitSchedules";
import {
  getStudyByCode,
  deleteStudy,
  updateStudy,
} from "../../services/studyService";
import {
  STUDY_STATUS_OPTIONS,
  STUDY_STATUS_DEFAULT,
  STUDY_STATUS_COMPLETED,
} from "../../constants/studyStatus";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import RecentSubjectsWidget from "../../components/dashboard/shared/RecentSubjectsWidget";
import PendingCommentsWidget from "../../components/dashboard/shared/PendingCommentsWidget";
import DocumentFolderManager from "../../components/DocumentFolderManager";
import EISFWorkspace from "../EISF/EISFWorkspace";
import { EISF_SIDEBAR_COLLAPSE_EVENT } from "../../constants/headerFilters";
import {
  FiTrash2,
  FiArrowLeft,
  FiEdit2,
  FiRefreshCw,
} from "react-icons/fi";
import {
  canDeleteStudy,
  requiresPermissionRequest,
} from "../../utils/contentAccess";
import useCanEditStudyContent from "../../hooks/useCanEditStudyContent";
import { submitAccessRequest } from "../../services/accessPermissionService";
import {
  getCurrentUser,
  getAccessibleStudies,
  hasPermission,
  PERMISSIONS,
} from "../../services/roleService";
import { useComments } from "../../comments/CommentsContext";
import { isOpenComment } from "../../services/commentService";
import "../AccessPermissions.css";
import "../../../Admin/styles/Dashboard.css";

import ClinicalSitesDashboard from "./ClinicalSitesDashboard";

function StudyDashboard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() => {
    const initialTab = searchParams.get("tab") || "Overview";

    if (initialTab === "Regulatory") {
      return "Overview";
    }

    if (initialTab === "Financials" && !canViewFinancials()) {
      return "Overview";
    }

    return initialTab;
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [studyRefreshKey, setStudyRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Task 14 — eISF Sidebar Auto Close: collapse whichever dashboard
  // sidebar is currently mounted the moment the eISF tab becomes active,
  // and only then. Every other tab is untouched, and the sidebar stays
  // wherever the user leaves it after that (it isn't forced back open
  // when navigating away from eISF).
  //
  // Subjects Sidebar Auto Close: the Subjects tab now gets the exact same
  // treatment as eISF, so it reuses the same event/listener pair instead
  // of introducing a parallel mechanism - every dashboard shell already
  // knows how to respond to EISF_SIDEBAR_COLLAPSE_EVENT, so opening
  // Subjects collapses the sidebar the same way opening eISF does. As
  // with eISF, the sidebar isn't forced back open when navigating away.
  useEffect(() => {
    if (activeTab === "eISF" || activeTab === "Subjects") {
      window.dispatchEvent(new Event(EISF_SIDEBAR_COLLAPSE_EVENT));
    }
  }, [activeTab]);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");

    if (tabFromUrl) {
      // ===== ITEM 16: Redirect Regulatory tab to Overview =====
      let resolvedTab = tabFromUrl === "Regulatory" ? "Overview" : tabFromUrl;

      if (resolvedTab === "Activity" && !hasPermission(PERMISSIONS.VIEW_SITE_ACTIVITIES)) {
        resolvedTab = "Overview";
      }

      if (resolvedTab === "Financials" && !canViewFinancials()) {
        resolvedTab = "Overview";
      }

      setActiveTab((currentTab) =>
        currentTab === resolvedTab ? currentTab : resolvedTab,
      );
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem("sidebarStudiesOpen", JSON.stringify(true));
    localStorage.setItem("sidebarStudyBinderOpen", JSON.stringify(true));
  }, [id]);
  useEffect(() => {
const handleStudyUpdated = (event) => {
  if (event.detail?.code === id) {
    localStorage.setItem(
      "selectedStudy",
      JSON.stringify(event.detail)
    );

    setCurrentStudy(event.detail);
    setStudyRefreshKey((value) => value + 1);
  }
};

  window.addEventListener("study-updated", handleStudyUpdated);

  return () => {
    window.removeEventListener("study-updated", handleStudyUpdated);
  };
}, [id]);

  const { data } = useStudiesDashboard();
  const { comments: liveComments } = useComments();
  const currentUser = getCurrentUser();

  const canEditStudy = useCanEditStudyContent("Study Overview", id);
  const canRemoveStudy = canDeleteStudy(currentUser);
  const needsPermissionRequest = requiresPermissionRequest(currentUser) && !canEditStudy;
  const canViewActivity = hasPermission(PERMISSIONS.VIEW_SITE_ACTIVITIES, currentUser);

  const [currentStudy, setCurrentStudy] = useState(() => getStudyByCode(id));
  const overview = useStudyOverview(id, studyRefreshKey);

useEffect(() => {
  const study = getStudyByCode(id);
  setCurrentStudy(study);
}, [id, studyRefreshKey]);
  // A2 (Role-Scoped Study Visibility): the route itself allows any
  // authenticated role to reach /study-dashboard/:id, and getStudyByCode()
  // reads the unfiltered study list, so this is the only place left that
  // can stop a direct URL from exposing a study the current user's role,
  // site, or organization isn't authorized to see.
  const accessibleStudies = useMemo(
    () => getAccessibleStudies(currentUser),
    [currentUser],
  );

  const isStudyAccessible = useMemo(() => {
    if (!currentStudy) {
      // Let the existing "study not found" handling deal with an unknown id.
      return true;
    }

    return accessibleStudies.some(
      (study) => String(study.code) === String(currentStudy.code),
    );
  }, [accessibleStudies, currentStudy]);

  useEffect(() => {
    if (currentStudy && !isStudyAccessible) {
      navigate("/studies", { replace: true });
    }
  }, [currentStudy, isStudyAccessible, navigate]);

  const getStudyKey = useCallback((study) => {
    return String(
      study?.code ??
        study?.id ??
        study?.studyId ??
        study?.title ??
        study?.name ??
        "",
    );
  }, []);

  const currentStudyKey = getStudyKey(currentStudy);

  const safeArray = useCallback((value) => {
    return Array.isArray(value) ? value : [];
  }, []);

  const matchesCurrentStudy = useCallback(
    (item) => {
      if (!item || !currentStudy) {
        return false;
      }

      const possibleKeys = [
        item.studyCode,
        item.studyId,
        item.studyKey,
        item.code,
        item.study?.code,
        item.study?.id,
        item.study?.studyId,
        item.study?.name,
        item.studyName,
        item.studyTitle,
        item.protocolCode,
      ]
        .filter(Boolean)
        .map(String);

      return possibleKeys.includes(currentStudyKey);
    },
    [currentStudy, currentStudyKey],
  );

  const studySubjectsFromStorage = useMemo(() => {
    try {
      return getSubjectsForStudy(currentStudyKey);
    } catch {
      return [];
    }
  }, [currentStudyKey]);

  const { upcomingWindow } = useVisitSchedules({
    studyCode: id,
  });

  const filteredUpcomingVisits = useMemo(() => {
    return upcomingWindow.map((item) => ({
      subject: item.subjectid || item.subjectId || item.subject,
      subjectId: item.subjectid || item.subjectId || item.subject,
      visit: item.visit,
      date: item.date,
    }));
  }, [upcomingWindow]);

  // Phase 7 — IMP-4.12: derive Open Comments for this study from the
  // canonical liveComments feed so the KPI card, PendingCommentsWidget
  // header count, and any dashboard drilldown all update in the same
  // tick when a comment is added / resolved / reopened. The visible
  // list is still capped for the widget, but the total count exposed
  // downstream is the full study-scoped open count.
  const studyOpenComments = useMemo(() => {
    return liveComments
      .filter(isOpenComment)
      .filter(
        (comment) =>
          matchesCurrentStudy({ studyCode: comment.study }) ||
          matchesCurrentStudy(comment),
      );
  }, [liveComments, matchesCurrentStudy]);

  const filteredPendingComments = useMemo(() => {
    return studyOpenComments.slice(0, 5).map((comment) => ({
      id: comment.id,
      subject: comment.subjectId,
      status: comment.status,
    }));
  }, [studyOpenComments]);

  const filteredRecentSubjects = useMemo(() => {
    if (studySubjectsFromStorage.length > 0) {
      return studySubjectsFromStorage;
    }

    return safeArray(data?.recentSubjects).filter(matchesCurrentStudy);
  }, [
    data?.recentSubjects,
    studySubjectsFromStorage,
    safeArray,
    matchesCurrentStudy,
  ]);

  // Study-scoped Alerts: build a fully dynamic feed from the same live
  // data that already powers the KPIs and widgets on this Overview tab
  // (open comments, upcoming visits, recent subjects, study progress /
  // health). We reuse the existing AlertsPanel component — this just
  // gives it real, per-study rows instead of the empty result the old
  // `data.alerts.filter(matchesCurrentStudy)` produced (dashboard-level
  // alerts have no study key, so the filter always yielded []).
  const filteredAlerts = useMemo(() => {
    const alerts = [];
    const openCommentCount = studyOpenComments.length;
    const upcomingVisitCount = filteredUpcomingVisits.length;
    const subjectCount = filteredRecentSubjects.length;
    const targetSubjects = Number(currentStudy?.targetSubjects) || 0;
    const enrolled = Number(currentStudy?.enrolled) || subjectCount;
    const enrollmentRatio =
      targetSubjects > 0 ? enrolled / targetSubjects : null;
    const overdueDocs = Number((overview?.documents as any)?.overdue) || 0;
    const missingDocs = Number((overview?.documents as any)?.missing) || 0;
    const healthScore =
      typeof overview?.health?.score === "number"
        ? overview.health.score
        : null;

    if (openCommentCount > 0) {
      alerts.push({
        type: openCommentCount >= 5 ? "danger" : "warning",
        title: "Open Comments",
        message: `${openCommentCount} comment${openCommentCount === 1 ? "" : "s"} awaiting resolution`,
      });
    }

    if (upcomingVisitCount > 0) {
      alerts.push({
        type: "info",
        title: "Upcoming Visits",
        message: `${upcomingVisitCount} visit${upcomingVisitCount === 1 ? "" : "s"} scheduled in the next window`,
      });
    }

    if (overdueDocs > 0) {
      alerts.push({
        type: "danger",
        title: "Overdue Documents",
        message: `${overdueDocs} essential document${overdueDocs === 1 ? "" : "s"} past due`,
      });
    }

    if (missingDocs > 0) {
      alerts.push({
        type: "warning",
        title: "Missing Documents",
        message: `${missingDocs} essential document${missingDocs === 1 ? "" : "s"} not yet uploaded`,
      });
    }

    if (enrollmentRatio !== null) {
      if (enrollmentRatio >= 1) {
        alerts.push({
          type: "success",
          title: "Enrollment Target Met",
          message: `${enrolled} of ${targetSubjects} subjects enrolled`,
        });
      } else if (enrollmentRatio < 0.5) {
        alerts.push({
          type: "warning",
          title: "Enrollment Behind Target",
          message: `${enrolled} of ${targetSubjects} subjects enrolled (${Math.round(
            enrollmentRatio * 100,
          )}%)`,
        });
      }
    }

    if (healthScore !== null) {
      if (healthScore < 60) {
        alerts.push({
          type: "danger",
          title: "Study Health Low",
          message: `Composite health score is ${healthScore}`,
        });
      } else if (healthScore >= 85) {
        alerts.push({
          type: "success",
          title: "Study Health Strong",
          message: `Composite health score is ${healthScore}`,
        });
      }
    }

    if (currentStudy?.status) {
      alerts.push({
        type: "info",
        title: "Study Status",
        message: `Currently in ${currentStudy.status}`,
      });
    }

    return alerts;
  }, [
    studyOpenComments,
    filteredUpcomingVisits,
    filteredRecentSubjects,
    currentStudy,
    overview,
  ]);

  const studyKpis = useMemo(() => {
    return {
      subjects: filteredRecentSubjects.length,
      // Phase 7 — IMP-4.12: KPI reflects the full study-scoped Open
      // Comments count, not the 5-row widget slice, and updates
      // automatically when any comment status changes upstream.
      comments: studyOpenComments.length,
      visits: filteredUpcomingVisits.length,
    };
  }, [filteredRecentSubjects, studyOpenComments, filteredUpcomingVisits]);

  const handleRefreshStudy = () => {
    setIsRefreshing(true);
    setStudyRefreshKey((value) => value + 1);
    overview.refresh();

    window.setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const handleNavigateToEisf = () => {
    setActiveTab("eISF");
    navigate(`/study-dashboard/${encodeURIComponent(id)}?tab=eISF`);
  };

  const handleRequestEditPermission = () => {
    submitAccessRequest(
      {
        studySubject: currentStudy?.code || id,
        studyCode: currentStudy?.code || id,
        module: "Study Overview",
        accessType: "Edit Access",
        notes: "Study overview edit request",
      },
      currentUser,
    );

    alert("Edit permission request submitted for admin review.");
  };

  const handleDeleteStudy = (deletionDetails) => {
    if (!currentStudy) {
      return;
    }

    try {
      deleteStudy(currentStudy.code, deletionDetails);
      setShowDeleteModal(false);
      alert(`Study "${currentStudy.name}" has been deleted successfully.`);
      navigate("/studies");
    } catch (error) {
      alert(`Error deleting study: ${error.message}`);
    }
  };

  const handleBackToStudies = () => {
    localStorage.setItem("sidebarStudiesOpen", JSON.stringify(true));
    localStorage.setItem("sidebarStudyBinderOpen", JSON.stringify(true));
    navigate("/studies");
  };

  const handleEditStudy = () => {
    if (!currentStudy) {
      return;
    }

    setEditForm({
      code: currentStudy.code || "",
      name: currentStudy.name || "",
      protocol: currentStudy.protocol || "",
      indication: currentStudy.indication || "",
      location: currentStudy.location || currentStudy.site || "",
      site: currentStudy.site || currentStudy.location || "",
      siteNumber: currentStudy.siteNumber || "",
      country: currentStudy.country || "",
      enrolled: currentStudy.enrolled ?? "",
      targetSubjects: currentStudy.targetSubjects ?? "",
      status: currentStudy.status || STUDY_STATUS_DEFAULT,
      principalInvestigator: currentStudy.principalInvestigator || "",
      sponsor: currentStudy.sponsor || "",
      cro: currentStudy.cro || "",
      startDate: currentStudy.startDate || "",
      completedDate: currentStudy.completedDate || "",
      description: currentStudy.description || "",
    });

    setShowEditModal(true);
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;

    setEditForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSaveStudyEdit = (event) => {
    event.preventDefault();

    try {
      const updatedStudy = updateStudy(editForm.code, {
        ...editForm,
        site: editForm.site,
        location: editForm.site,
        enrolled: Number(editForm.enrolled) || 0,
        targetSubjects: Number(editForm.targetSubjects) || 0,
      });
      localStorage.setItem("selectedStudy", JSON.stringify(updatedStudy));
      window.dispatchEvent(
  new CustomEvent("study-updated", {
    detail: updatedStudy,
  })
);
window.dispatchEvent(new Event("studies-updated"));
      setShowEditModal(false);
      setStudyRefreshKey((value) => value + 1);
    } catch (error) {
      alert(`Error saving study: ${error.message}`);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // A2 (Role-Scoped Study Visibility): don't render this study's data even
  // for the single tick before the redirect effect above navigates away.
  if (currentStudy && !isStudyAccessible) {
    return null;
  }

  return (
    <DashboardLayout>
      {!data ? (
        <div className="dashboard-loading">Loading Dashboard...</div>
      ) : (
        <>
          <div className="study-dashboard-page tnxt-compact">
            <div className="page-header">
              {/* Everything sits on one row: title, KPI buttons, and Back
                  to Studies grouped on the left; Refresh / Edit / Delete
                  grouped on the right. The row wraps as a whole on narrow
                  screens instead of the actions floating separately. */}
              <div className="page-header-title-row">
                <div className="page-header-title-group">
                  <h1>{currentStudy?.name || "Study Dashboard"}</h1>

                  <div className="study-header-kpi-buttons">
                    <button
                      type="button"
                      className="study-header-kpi-btn"
                      onClick={() => handleTabChange("Subjects")}>

                      <span className="study-header-kpi-btn-label">
                        Total Subjects
                      </span>
                      <span className="study-header-kpi-btn-value">
                        {studyKpis.subjects}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="study-header-kpi-btn"
                      onClick={() => handleTabChange("Comments")}>

                      <span className="study-header-kpi-btn-label">
                        Open Comments
                      </span>
                      <span className="study-header-kpi-btn-value">
                        {studyKpis.comments}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="study-header-kpi-btn"
                      onClick={() => handleTabChange("Visit Plan")}>

                      <span className="study-header-kpi-btn-label">
                        Site Visits
                      </span>
                      <span className="study-header-kpi-btn-value">
                        {studyKpis.visits}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="back-to-studies-btn"
                      onClick={handleBackToStudies}>

                      <FiArrowLeft />
                      <span>Back to Studies</span>
                    </button>
                  </div>
                </div>

                <div className="page-header-actions">
                  <button
                    type="button"
                    className="refresh-study-btn"
                    onClick={handleRefreshStudy}
                    disabled={isRefreshing}
                    title="Refresh study overview">

                    <FiRefreshCw className={isRefreshing ? "spinning" : ""} />
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </button>

                  {canEditStudy && (
                    <button
                      type="button"
                      className="btn-edit edit-study-btn"
                      onClick={handleEditStudy}
                      title="Edit study"
                      aria-label="Edit study">

                      <FiEdit2 />
                      Edit Study
                    </button>
                  )}

                  {needsPermissionRequest && (
                    <button
                      type="button"
                      className="request-permission-btn"
                      onClick={handleRequestEditPermission}>

                      Request Edit Permission
                    </button>
                  )}

                  {canRemoveStudy && (
                    <button
                      type="button"
                      className="delete-study-btn"
                      onClick={() => setShowDeleteModal(true)}
                      title="Delete study"
                      aria-label="Delete study">

                      <FiTrash2 />
                      Delete Study
                    </button>
                  )}
                </div>
              </div>

              <div className="study-quick-details">
                <span className="study-quick-detail">
                  <span className="study-quick-detail-label">Study ID</span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.code || "-"}
                  </span>
                </span>
                <span className="study-quick-detail">
                  <span className="study-quick-detail-label">Indication</span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.indication || "-"}
                  </span>
                </span>
                <span className="study-quick-detail">
                  <span className="study-quick-detail-label">Site:</span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.siteNumber || currentStudy?.location || "-"}
                  </span>
                  <span className="study-quick-detail-label">-</span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.site || currentStudy?.location || "-"}
                  </span>
                </span>
                {/* <span className="study-quick-detail">
                  <span className="study-quick-detail-label">Site</span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.site || currentStudy?.location || "-"}
                  </span>
                </span> */}
                <span className="study-quick-detail">
                  <span className="study-quick-detail-label">
                    Principal Investigator
                  </span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.principalInvestigator || "-"}
                  </span>
                </span>
                <span className="study-quick-detail">
                  <span className="study-quick-detail-label">Sponsor</span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.sponsor || "-"}
                  </span>
                </span>
                <span className="study-quick-detail">
                  <span className="study-quick-detail-label">CRO</span>
                  <span className="study-quick-detail-value">
                    {currentStudy?.cro || "-"}
                  </span>
                </span>
              </div>
            </div>

            <StudyWorkspaceTabs
              activeTab={activeTab}
              setActiveTab={handleTabChange}
            />

            {activeTab === "Overview" && (
              <>
                <div className="study-overview-widgets">
                  <EssentialDocumentsWidget
                    stats={overview.documents}
                    onNavigateToEisf={handleNavigateToEisf}
                  />

                  <StudyProgressSummary progress={overview.progress} />

                  <StudyHealthSummary health={overview.health} />

                  <SiteActivationStatus counts={overview.siteActivation} />
                </div>

                <VisitCalendarSection studyCode={id} />

                <SubjectAnalyticsSection
                  subjects={filteredRecentSubjects}
                  studies={currentStudy ? [currentStudy] : []}
                  studyCode={id}
                  plannedSubjects={Number(currentStudy?.targetSubjects) || 0}
                  currentSubjects={studyKpis.subjects}
                />

                {/* Recent Subjects + Pending Comments now share the same
                    widget-grid so Pending Comments sits beside Recent
                    Subjects (replacing the removed Upcoming Visits slot).
                    widget-grid is already auto-fit responsive, so the
                    pair collapses to a single column on narrow viewports. */}
                <div className="widget-grid">
                  <RecentSubjectsWidget
                    subjects={filteredRecentSubjects}
                    studyId={id}
                  />

                  <PendingCommentsWidget
                    comments={filteredPendingComments}
                    total={studyOpenComments.length}
                  />
                </div>

                <div className="study-dashboard-alerts">
                  <AlertsPanel alerts={filteredAlerts} />
                </div>

                <StudyMilestoneTimeline
                  studyCode={id}
                  milestones={overview.milestones}
                  canEdit={canEditStudy}
                  onUpdated={() => setStudyRefreshKey((value) => value + 1)}
                />

                <div className="study-dashboard-subjects-section">
                  <StudySubjects
                    setActiveTab={setActiveTab}
                    showTable
                    showBackButton={false}
                  />
                </div>
              </>
            )}

            {/* Subjects tab -> the completed Subject Explorer workspace.
                Integration point only: routing, study context and the subject
                business logic in `StudySubjects` are all left as they were,
                and that component still backs the Overview section above. */}
            {activeTab === "Subjects" && (
              id ? (
                <StudySubjectsWorkspace
                  studyId={id}
                  readOnly={currentStudy?.status === STUDY_STATUS_COMPLETED}
                />
              ) : (
                <div className="dashboard-loading">
                  No study selected. Please select a study from the Studies list.
                </div>
              )
            )}

            {activeTab === "Study Milestone" && <StudyPlanning />}

            {activeTab === "Visit Plan" && <StudyVisitPlan />}

            {activeTab === "Study Files" && <StudyDocuments />}

            {activeTab === "Comments" && <StudyComments />}

            {activeTab === "Logs" && <StudyLogsTab />}

            {activeTab === "Reports" && <StudyReports />}

            {activeTab === "eISF" && <EISFWorkspace studyCode={id} />}
            {activeTab === "Clinical Sites" && (
              <ClinicalSitesDashboard study={currentStudy} />
            )}

            {activeTab === "Financials" && canViewFinancials(currentUser) && (
              <div className="study-financials-tab">
                <StudyFinancials
                  studyCode={id}
                  study={currentStudy}
                  refreshKey={studyRefreshKey}
                />
              </div>
            )}

            {activeTab === "Others" && (
              <div className="module-card">
                <h2>Others</h2>
                <DocumentFolderManager
                  sectionId="others"
                  contextKey={id || "default"}
                  title="Others"
                  studyCode={id}
                  layout="vertical"
                />
              </div>
            )}
          </div>

          {showEditModal && (
            <StudyModal
              mode="edit"
              onClose={() => setShowEditModal(false)}
              onSubmit={handleSaveStudyEdit}>

              <div className="study-form-grid">
                <label>
                  Study ID
                  <input name="code" value={editForm.code || ""} readOnly />
                </label>

                <label>
                  Study Name
                  <input
                    name="name"
                    value={editForm.name || ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  Protocol
                  <input
                    name="protocol"
                    value={editForm.protocol || ""}
                    onChange={handleEditFormChange}
                  />
                </label>

                <label>
                  Indication
                  <input
                    name="indication"
                    value={editForm.indication || ""}
                    onChange={handleEditFormChange}
                  />
                </label>

                <label>
                  Site Number
                  <input
                    name="siteNumber"
                    value={editForm.siteNumber || ""}
                    onChange={handleEditFormChange}
                    required
                    placeholder="Example: 001"
                  />
                </label>

                <label>
                  Site / Hospital
                  <input
                    name="location"
                    value={editForm.location || ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  Country
                  <input
                    name="country"
                    value={editForm.country || ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  Subjects Enrolled
                  <input
                    name="enrolled"
                    type="number"
                    min="0"
                    value={editForm.enrolled ?? ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  Target Subjects
                  <input
                    name="targetSubjects"
                    type="number"
                    min="0"
                    value={editForm.targetSubjects ?? ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  Study Status
                  <select
                    name="status"
                    value={editForm.status || STUDY_STATUS_DEFAULT}
                    onChange={handleEditFormChange}
                    required>

                    {STUDY_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Principal Investigator
                  <input
                    name="principalInvestigator"
                    value={editForm.principalInvestigator || ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  Sponsor
                  <input
                    name="sponsor"
                    value={editForm.sponsor || ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  CRO
                  <input
                    name="cro"
                    value={editForm.cro || ""}
                    onChange={handleEditFormChange}
                  />
                </label>

                <label>
                  Start Date
                  <input
                    name="startDate"
                    type="date"
                    value={editForm.startDate || ""}
                    onChange={handleEditFormChange}
                    required
                  />
                </label>

                <label>
                  Completed Date
                  <input
                    name="completedDate"
                    type="date"
                    value={editForm.completedDate || ""}
                    onChange={handleEditFormChange}
                  />
                </label>

                <label className="study-form-wide">
                  Study Description
                  <textarea
                    name="description"
                    value={editForm.description || ""}
                    onChange={handleEditFormChange}
                    rows={3}
                  />
                </label>
              </div>
            </StudyModal>
          )}

          {showDeleteModal && currentStudy && (
            <DeleteConfirmationModal
              onClose={() => setShowDeleteModal(false)}
              onConfirm={handleDeleteStudy}
              title={`Delete Study: ${currentStudy.name}`}
              message={`Are you sure you want to delete the study "${currentStudy.name}" (${currentStudy.code})? This action cannot be undone.`}
              itemType="study"
            />
          )}
        </>
      )}
      {/* ===== START D2 PART 1 CHANGES ===== */}
      {activeTab === "Activity" && canViewActivity && <StudyActivity />}
      {/* ===== END D2 PART 1 CHANGES ===== */}
    </DashboardLayout>
  );
}

export default StudyDashboard;