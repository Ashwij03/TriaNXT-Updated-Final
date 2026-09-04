import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAccessibleStudies, getCurrentUser, hasPermission, PERMISSIONS } from "../services/roleService";
import { FOLDER_TREE_EVENT } from "../services/folderService";
import { canViewFinancials } from "../pages/studies/StudyWorkspaceTabsConfig";
import { resolveStudyKey as getCanonicalStudyKey, getSubjectsForStudy, getStudyDisplayName as getCanonicalStudyDisplayName, getStudyMeta as getCanonicalStudyMeta } from "../services/subjectService";

export const STUDY_SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "subjects", label: "Subjects", expandable: true },
  { key: "eisf", label: "eISF" },
  { key: "logs", label: "Logs" },
  { key: "study-milestone", label: "Study Milestone" },
  { key: "visitPlan", label: "Visit Plan" },
  { key: "clinicalSites", label: "Clinical Sites" },
  { key: "reports", label: "Reports" },
  { key: "studyFiles", label: "Study Files" },
  { key: "financials", label: "Financials" },
  { key: "others", label: "Others" },
  { key: "activity", label: "Activity" },
];

// Same STUDY_SECTIONS list, with `financials` dropped for roles that
// cannot view it. Order of the remaining sections is preserved.
export function getVisibleStudySections(currentUser = getCurrentUser()) {
  return STUDY_SECTIONS.filter((section) => {
    if (section.key === "financials") {
      return canViewFinancials(currentUser);
    }

    if (section.key === "activity") {
      return hasPermission(PERMISSIONS.VIEW_SITE_ACTIVITIES);
    }

    return true;
  });
}

// Re-export canonical implementations from subjectService for backward
// compatibility (PIDashboard.js imports getStudyKey from here).
export const getStudyKey = getCanonicalStudyKey;
export const getStudyDisplayName = getCanonicalStudyDisplayName;
export const getStudyMeta = getCanonicalStudyMeta;

// All subject data now flows through subjectService — the single source
// of truth. No more direct localStorage access or duplicated filtering.
function getStudySubjects(study) {
  return getSubjectsForStudy(getCanonicalStudyKey(study));
}

function readStudies() {
  try {
    // A2 (Role-Scoped Study Visibility): the sidebar tree must only ever
    // list studies the current role is authorized to see.
    const result = getAccessibleStudies(getCurrentUser());

    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export function useRoleStudiesSidebar({ onNavigate }: any = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const previousActiveStudyKeyRef = useRef(null);

  const [studies, setStudies] = useState(() => readStudies());

  const [studiesOpen, setStudiesOpen] = useState(() => {
    return (
      pathname === "/studies" ||
      pathname.startsWith("/study-dashboard") ||
      pathname.startsWith("/study/") ||
      pathname === "/comments" ||
      pathname.includes("/comments")
    );
  });

  const [studyBinderOpen, setStudyBinderOpen] = useState(false);
  const [expandedStudies, setExpandedStudies] = useState<Record<string, any>>({});
  const [expandedStudySections, setExpandedStudySections] = useState<Record<string, any>>({});

  const studyCount = studies.length;

  const isStudiesOverviewRoute = pathname === "/studies";

  const isStudyInternalRoute =
    pathname.startsWith("/study-dashboard") || pathname.startsWith("/study/");

  const isCommentsRoute =
    pathname === "/comments" || pathname.includes("/comments");

  const isStudiesActive =
    isStudiesOverviewRoute || isStudyInternalRoute || isCommentsRoute;

  useEffect(() => {
    const refreshStudies = () => {
      setStudies(readStudies());
    };

    window.addEventListener("studies-updated", refreshStudies);
    window.addEventListener("subjects-updated", refreshStudies);
    window.addEventListener("sponsor-data-updated", refreshStudies);
    window.addEventListener("planning-updated", refreshStudies);
    window.addEventListener("visit-plans-updated", refreshStudies);
    window.addEventListener("study-overview-updated", refreshStudies);
    window.addEventListener("storage", refreshStudies);

    return () => {
      window.removeEventListener("studies-updated", refreshStudies);
      window.removeEventListener("subjects-updated", refreshStudies);
      window.removeEventListener("sponsor-data-updated", refreshStudies);
      window.removeEventListener("planning-updated", refreshStudies);
      window.removeEventListener("visit-plans-updated", refreshStudies);
      window.removeEventListener("study-overview-updated", refreshStudies);
      window.removeEventListener("storage", refreshStudies);
    };
  }, []);

  useEffect(() => {
    const refreshSidebar = () => {
      setStudies(readStudies());
    };

    window.addEventListener(FOLDER_TREE_EVENT, refreshSidebar);

    return () => {
      window.removeEventListener(FOLDER_TREE_EVENT, refreshSidebar);
    };
  }, []);

  useEffect(() => {
    if (isStudiesOverviewRoute || isStudyInternalRoute || isCommentsRoute) {
      setStudiesOpen((currentValue) => (currentValue ? currentValue : true));
      return;
    }

    setStudiesOpen((currentValue) => (currentValue ? false : currentValue));
  }, [isStudiesOverviewRoute, isStudyInternalRoute, isCommentsRoute, pathname]);

  useEffect(() => {
    if (!isStudyInternalRoute) {
      previousActiveStudyKeyRef.current = null;
      return;
    }

    const studyMatch = pathname.match(/^\/study-dashboard\/([^/?]+)/);
    const activeStudyKey = studyMatch?.[1];

    if (!activeStudyKey) {
      return;
    }

    if (previousActiveStudyKeyRef.current !== activeStudyKey) {
      setStudiesOpen(true);
      setStudyBinderOpen(true);
      setExpandedStudies({ [activeStudyKey]: true });
      setExpandedStudySections({});
      previousActiveStudyKeyRef.current = activeStudyKey;
    }
  }, [pathname, isStudyInternalRoute]);

  const handleNav = (path) => {
    navigate(path);
    onNavigate?.();
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
    event?.stopPropagation();
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

  const navigateToStudySection = (studyKey, sectionKey) => {
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

    let tab = tabMap[sectionKey] || "Overview";

    if (tab === "Financials" && !canViewFinancials()) {
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

    setStudiesOpen(true);
    setStudyBinderOpen(true);
    setExpandedStudies({ [studyKey]: true });
    setExpandedStudySections({
      [`${studyKey}__subjects`]: true,
    });

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

  const getSubjectsForStudy = (study) => getStudySubjects(study);

  return {
    studies,
    studyCount,
    studiesOpen,
    setStudiesOpen,
    studyBinderOpen,
    expandedStudies,
    expandedStudySections,
    isStudiesActive,
    isCommentsRoute,
    handleStudiesClick,
    handleStudyBinderClick,
    handleStudiesCommentsClick,
    toggleStudyNode,
    toggleStudySection,
    navigateToStudySection,
    handleStudyNameClick,
    handleExpandableSectionLabelClick,
    handleSubjectClick,
    getSubjectsForStudy,
    handleNav,
  };
}