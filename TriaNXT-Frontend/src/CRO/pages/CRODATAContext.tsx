import { readStorageArray } from "../../shared/utils/storageHelpers";
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { addCommentRecord } from "../../shared/services/commentService";
import { getCurrentUser } from "../../shared/services/roleService";
import { getStudies } from "../../shared/services/studyService";
import { getAllSubjects } from "../../shared/services/subjectService";
import { isEnrolledSubjectStatus } from "../../shared/utils/normalizeStatus";
import {
  getFilteredSchedules,
  getUpcomingVisitsWindow,
  SCHEDULES_EVENT
} from "../../shared/services/visitScheduleService";
import { useComments } from "../../shared/comments/CommentsContext";

// The CRO data context carries a large localStorage-backed dataset assembled
// in this file; its full shape is intentionally left loose (typed core comes
// in a later phase). undefined default matches the createContext() call sites
// that previously compiled as plain JS.
const CRODataContext = createContext<any>(undefined);

function getSharedStudies() {
  try {
    const studies = getStudies();
    return Array.isArray(studies) ? studies : [];
  } catch {
    return [];
  }
}

function getSharedSubjects() {
  try {
    const allSubjects = getAllSubjects();
    const studiesByCode = new Map(
      getStudies().map((study) => [String(study.code), study]),
    );

    return allSubjects.map((subject, index) => {
      const studyCode = subject.studyId;
      const study = studiesByCode.get(String(studyCode));

      return {
        ...subject,
        id:
          subject.id ||
          subject.subjectId ||
          `${studyCode}-SUB-${String(index + 1).padStart(3, "0")}`,
        subjectId:
          subject.subjectId ||
          subject.id ||
          `${studyCode}-SUB-${String(index + 1).padStart(3, "0")}`,
        studyCode,
        study: (study as any)?.name || studyCode,
        studyName: (study as any)?.name || studyCode,
        site: subject.site || (study as any)?.site || (study as any)?.location || "",
        status: subject.status || "Active",
      };
    });
  } catch {
    return [];
  }
}

/*
  These readers are read-only.

  They support the common shared storage keys used across the project.
  If a key does not exist yet, CRO shows an empty list instead of demo data.
*/
function getSharedVisits() {
  try {
    return getFilteredSchedules(getCurrentUser()).map((schedule) => ({
      ...schedule,
      id: schedule.id,
      visitId: schedule.id,
      visitType: schedule.visit || schedule.visitType || "Visit",
      cra: schedule.cra || "—",
      subject: schedule.subjectId,
      subjectId: schedule.subjectId,
      study: schedule.study || schedule.studyKey || "",
      studyCode: schedule.study || schedule.studyKey || "",
      date: schedule.date,
      status: schedule.status || "Scheduled"
    }));
  } catch {
    return [];
  }
}

function getSharedDocuments() {
  return readStorageArray("documents");
}

function getSharedReports() {
  return readStorageArray("reports");
}

function getSharedNotifications() {
  return readStorageArray("notifications");
}

function getSharedFiles() {
  return readStorageArray("files");
}

export const CROProvider = ({ children }: any) => {
  const [isLoading, setIsLoading] = useState(true);

  // Consume canonical comments from CommentsContext instead of maintaining duplicate state
  const { comments } = useComments();

  const [studies, setStudies] = useState(() => getSharedStudies());
  const [subjects, setSubjects] = useState(() => getSharedSubjects());
  const [visits, setVisits] = useState(() => getSharedVisits());
  const [documents, setDocuments] = useState(() => getSharedDocuments());
  const [reports, setReports] = useState(() => getSharedReports());
  const [notifications, setNotifications] = useState(() =>
    getSharedNotifications(),
  );
  const [files, setFiles] = useState(() => getSharedFiles());

  const [alertModal, setAlertModal] = useState({
    open: false,
    title: "",
    message: "",
  });

  const refreshSharedData = useCallback(() => {
    setStudies(getSharedStudies());
    setSubjects(getSharedSubjects());
    setVisits(getSharedVisits());
    setDocuments(getSharedDocuments());
    setReports(getSharedReports());
    setNotifications(getSharedNotifications());
    setFiles(getSharedFiles());
  }, []);

  useEffect(() => {
    refreshSharedData();

    const handleSharedDataUpdate = () => {
      refreshSharedData();
    };

    window.addEventListener("studies-updated", handleSharedDataUpdate);
    window.addEventListener("subjects-updated", handleSharedDataUpdate);
    window.addEventListener("visits-updated", handleSharedDataUpdate);
    window.addEventListener(SCHEDULES_EVENT, handleSharedDataUpdate);
    window.addEventListener("documents-updated", handleSharedDataUpdate);
    window.addEventListener("reports-updated", handleSharedDataUpdate);
    window.addEventListener("notifications-updated", handleSharedDataUpdate);
    window.addEventListener("files-updated", handleSharedDataUpdate);
    window.addEventListener("sponsor-data-updated", handleSharedDataUpdate);
    window.addEventListener("storage", handleSharedDataUpdate);

    return () => {
      window.removeEventListener("studies-updated", handleSharedDataUpdate);
      window.removeEventListener("subjects-updated", handleSharedDataUpdate);
      window.removeEventListener("visits-updated", handleSharedDataUpdate);
      window.removeEventListener(SCHEDULES_EVENT, handleSharedDataUpdate);
      window.removeEventListener("documents-updated", handleSharedDataUpdate);
      window.removeEventListener("reports-updated", handleSharedDataUpdate);
      window.removeEventListener(
        "notifications-updated",
        handleSharedDataUpdate,
      );
      window.removeEventListener("files-updated", handleSharedDataUpdate);
      window.removeEventListener(
        "sponsor-data-updated",
        handleSharedDataUpdate,
      );
      window.removeEventListener("storage", handleSharedDataUpdate);
    };
  }, [refreshSharedData]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);

    return () => clearTimeout(timer);
  }, []);

  const showAlert = useCallback((title, message) => {
    setAlertModal({ open: true, title, message });
  }, []);

  const showModal = useCallback(({ title, message }) => {
    setAlertModal({ open: true, title, message });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModal({ open: false, title: "", message: "" });
  }, []);

  const closeModal = closeAlert;

  // CRO is allowed to add comments (create-only). It must never edit,
  // reply to, resolve, or delete comments — those remain Admin/Site
  // Staff/PI actions. This writes to the same shared "comments" key
  // used across the app and notifies other roles via the same event
  // this context already listens for.
  const addComment = useCallback((newComment) => {
    const user = getCurrentUser();

    return addCommentRecord(
      {
        subjectId: newComment.subject || newComment.subjectId || "",
        description: newComment.message || newComment.text || "",
        site: newComment.site || "",
        study: newComment.study || newComment.studyCode || "",
        stage: "Monitoring",
      },
      user
    );
  }, []);

  const kpiMetrics = useMemo(() => {
    const uniqueSites = new Set<any>(
      visits.map((visit) => visit.site).filter(Boolean),
    ).size;

    const pendingReviews = documents.filter(
      (document) => document.status === "Pending",
    ).length;

    const openCommentsCount = comments.filter((comment) => {
      const status = String(comment?.status || "").toLowerCase();
      return status === "open" || status === "unresolved";
    }).length;

    const completedVisits = visits.filter(
      (visit) => visit.status === "Completed",
    ).length;

    const approvedDocs = documents.filter(
      (document) => document.status === "Approved",
    ).length;

    const visitCompliance =
      visits.length > 0
        ? Math.round((completedVisits / visits.length) * 100)
        : 0;

    const documentCompliance =
      documents.length > 0
        ? Math.round((approvedDocs / documents.length) * 100)
        : 0;

    const complianceValues = [];

    if (visits.length > 0) {
      complianceValues.push(visitCompliance);
    }

    if (documents.length > 0) {
      complianceValues.push(documentCompliance);
    }

    const complianceRate =
      complianceValues.length > 0
        ? Math.round(
            complianceValues.reduce((total, value) => total + value, 0) /
              complianceValues.length,
          )
        : 0;

    return {
      sitesUnderMonitoring: uniqueSites,
      monitoringVisits: visits.length,
      pendingReviews,
      comments: openCommentsCount,
      commentsCount: openCommentsCount,
      complianceMetrics: `${complianceRate}%`,
    };
  }, [visits, documents, comments]);

  const sitePerformanceData = useMemo(() => {
    const siteNames = [
      ...new Set<any>(subjects.map((subject) => subject.site).filter(Boolean)),
    ];

    return siteNames.map((site, index) => {
      const siteSubjects = subjects.filter((subject) => subject.site === site);
      const siteVisits = visits.filter((visit) => visit.site === site);

      const completedVisits = siteVisits.filter(
        (visit) => visit.status === "Completed",
      ).length;

      // Enrolled = canonical enrolled stages (Enrolled/Ongoing/Completed;
      // raw Active/Randomized normalize in) — same contract as every other
      // dashboard, so a stored "Enrolled" subject counts here too.
      const enrolled = siteSubjects.filter((subject) =>
        isEnrolledSubjectStatus(subject.status),
      ).length;

      const withdrawn = siteSubjects.filter(
        (subject) => subject.status === "Withdrawn",
      ).length;

      const enrollmentPct =
        siteSubjects.length > 0
          ? Math.round((enrolled / siteSubjects.length) * 100)
          : 0;

      const screenFailurePct =
        siteSubjects.length > 0
          ? Math.round((withdrawn / siteSubjects.length) * 100)
          : 0;

      const compliancePct =
        siteVisits.length > 0
          ? Math.round((completedVisits / siteVisits.length) * 100)
          : 0;

      let status = "Good";

      if (compliancePct >= 95 && enrollmentPct >= 80) {
        status = "Excellent";
      } else if (compliancePct < 75 || enrollmentPct < 60) {
        status = "At Risk";
      }

      const siteNumber = `SITE-${String(index + 1).padStart(3, "0")}`;
      return {
        id: siteNumber,
        siteNumber,
        siteName: site,
        site,
        study: siteSubjects[0]?.study || "—",
        enrollment: `${enrollmentPct}%`,
        screenFailure: `${screenFailurePct}%`,
        compliance: `${compliancePct}%`,
        status,
      };
    });
  }, [subjects, visits]);

  const upcomingVisits = useMemo(() => {
    return getUpcomingVisitsWindow(visits, 30).slice(0, 8);
  }, [visits]);

  const globalSearch = useCallback(
    (query) => {
      if (!query || query.trim().length < 1) {
        return [];
      }

      const normalizedQuery = query.toLowerCase().trim();
      const results = [];

      subjects.forEach((subject) => {
        const subjectId = String(subject.subjectId || subject.id || "");
        const site = String(subject.site || "");
        const study = String(subject.study || subject.studyName || "");

        if (
          subjectId.toLowerCase().includes(normalizedQuery) ||
          site.toLowerCase().includes(normalizedQuery) ||
          study.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            type: "Subject",
            id: subjectId,
            label: subjectId,
            sublabel: `${site} · ${subject.status || ""}`,
            route: `/cro-subject/${subjectId}`,
            data: subject,
          });
        }
      });

      visits.forEach((visit) => {
        const visitId = String(visit.id || "");
        const site = String(visit.site || "");
        const visitType = String(visit.visitType || visit.visit || "");

        if (
          visitId.toLowerCase().includes(normalizedQuery) ||
          site.toLowerCase().includes(normalizedQuery) ||
          visitType.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            type: "Visit",
            id: visitId,
            label: visitId,
            sublabel: `${site} · ${visitType}`,
            route: "/cro-monitoring",
            data: visit,
          });
        }
      });

      documents.forEach((document) => {
        const documentId = String(document.id || "");
        const name = String(document.name || document.fileName || "");
        const site = String(document.site || "");

        if (
          documentId.toLowerCase().includes(normalizedQuery) ||
          name.toLowerCase().includes(normalizedQuery) ||
          site.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            type: "Regulatory Document",
            id: documentId,
            label: name,
            sublabel: `${site} · ${document.status || ""}`,
            route: "/cro-regulatory-documents",
            data: document,
          });
        }
      });

      reports.forEach((report) => {
        const reportId = String(report.id || "");
        const name = String(report.name || report.title || "");
        const type = String(report.type || "");

        if (
          reportId.toLowerCase().includes(normalizedQuery) ||
          name.toLowerCase().includes(normalizedQuery) ||
          type.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            type: "Report",
            id: reportId,
            label: name,
            sublabel: type,
            route: "/cro-reports",
            data: report,
          });
        }
      });

      comments.forEach((comment) => {
        const commentId = String(comment.id || "");
        const message = String(comment.message || comment.comment || "");

        if (
          commentId.toLowerCase().includes(normalizedQuery) ||
          message.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            type: "Comment",
            id: commentId,
            label: commentId,
            sublabel: message.substring(0, 50),
            route: "/cro-comments",
            data: comment,
          });
        }
      });

      files.forEach((file) => {
        const fileId = String(file.id || "");
        const name = String(file.name || file.fileName || "");
        const category = String(file.category || "");

        if (
          fileId.toLowerCase().includes(normalizedQuery) ||
          name.toLowerCase().includes(normalizedQuery) ||
          category.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            type: "File",
            id: fileId,
            label: name,
            sublabel: category,
            route: "/cro-files",
            data: file,
          });
        }
      });

      return results.slice(0, 12);
    },
    [subjects, visits, documents, reports, comments, files],
  );

  return (
    <CRODataContext.Provider
      value={{
        isLoading,

        // Read-only shared data
        studies,
        subjects,
        visits,
        documents,
        reports,
        comments,
        notifications,
        files,

        kpiMetrics,
        kpis: kpiMetrics,
        sitePerformanceData,
        upcomingVisits,
        globalSearch,
        addComment,

        alertModal,
        modal: alertModal,
        showAlert,
        showModal,
        closeAlert,
        closeModal,
      }}
    >
      {children}
    </CRODataContext.Provider>
  );
};

export const useCROData = () => {
  const context = useContext(CRODataContext);

  if (!context) {
    throw new Error("useCROData must be used within CROProvider");
  }

  return context;
};