// UPDATED: Admin dashboard — Phase 8 subject-status analytics and full-height Upcoming Visits

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminDashboardLayout from "../components/AdminDashboardLayout";

import KPICard from "../../shared/components/dashboard/shared/KPICard";
import SubjectAnalyticsSection from "../../shared/components/dashboard/shared/SubjectAnalyticsSection";
import { getStudies } from "../../shared/services/studyService";
import AlertsPanel from "../../shared/components/dashboard/shared/AlertsPanel";
import QuickActions from "../../shared/components/dashboard/shared/QuickActions";
import VisitCalendarSection from "../../shared/components/dashboard/shared/VisitCalendarSection";
import {
  getAdminDashboardData,
  getSubjectsForAnalytics
} from "../../shared/services/adminService";
import { useComments } from "../../shared/comments/CommentsContext";
import {
  ALL_HEADER_FILTER_KEYS,
  HEADER_FILTERS_EVENT,
  INSTITUTION_FILTER_EVENT,
  getStoredIndicationFilter,
  getStoredInstitutionFilter,
  getStoredSiteNumberFilter,
  getStoredStudyFilter,
  setStoredValue
} from "../../shared/constants/headerFilters";

import "../styles/Dashboard.css";
import "../../shared/pages/studies/StudyDashboard.css";
import "../../shared/pages/AccessPermissions.css";

// Ongoing studies = studies currently in Startup, Recruitment Phase,
// or Conduct Phase (the statuses set on the study details form's
// Study Status dropdown). Defined at module scope so it's a stable
// reference for the useMemo dependency array below.
const ONGOING_STUDY_STATUSES = ["Startup", "Recruitment Phase", "Conduct Phase"];

function AdminDashboard() {
  const { pendingCount: openCommentsCount } = useComments();

  // Task 18 (Dashboard Opens Filter-Free): the Dashboard must always render
  // fully unfiltered the instant it mounts — it can't depend on winning a
  // race against EnterpriseNavbarBase's own "clear leftover filters" effect
  // (both mount around the same time, and whichever one's effects happen to
  // run first used to decide whether this page's *first* render came out
  // scoped down by a leftover Indication/Site/Study filter or not). Wiping
  // storage here — synchronously, before any of the useState calls below
  // would otherwise read it — guarantees this component's very first state
  // is always empty regardless of what was left over from wherever the user
  // came from. isFreshMountRef makes sure this only runs once per mount
  // (not on every re-render), so a filter the user deliberately picks from
  // the header afterward isn't wiped back out from under them.
  const isFreshMountRef = useRef(true);

  if (isFreshMountRef.current) {
    isFreshMountRef.current = false;
    ALL_HEADER_FILTER_KEYS.forEach((key) => setStoredValue(key, ""));
  }

  const [institutionFilter, setInstitutionFilter] = useState("");
  const [indicationFilter, setIndicationFilter] = useState("");
  const [siteNumberFilter, setSiteNumberFilter] = useState("");
  const [studyCodeFilter, setStudyCodeFilter] = useState("");

  // Every header dropdown that scopes this page's data, bundled together so
  // a single object always reflects what's currently selected.
  const activeFilters = useMemo(
    () => ({
      institution: institutionFilter,
      indication: indicationFilter,
      siteNumber: siteNumberFilter,
      studyCode: studyCodeFilter
    }),
    [institutionFilter, indicationFilter, siteNumberFilter, studyCodeFilter]
  );

  const [dashboardData, setDashboardData] = useState(() =>
    getAdminDashboardData({
      institution: "",
      indication: "",
      siteNumber: "",
      studyCode: ""
    })
  );

  // Bumped whenever the underlying study/subject stores change so the
  // analytics memo below (whose other deps — institutionFilter and
  // filteredStudySites — stay constant while no header filters are active)
  // re-reads the subject store instead of serving a stale snapshot.
  const [subjectDataVersion, setSubjectDataVersion] = useState(0);

  // The Institution dropdown gets its own dedicated event (kept for
  // backward compatibility with other pages that only care about that one
  // filter), while Indication, Site Number, and Study Number all fire the
  // shared HEADER_FILTERS_EVENT. Listening to both keeps every dropdown in
  // this page's filter order in sync with the dashboard's data.
  useEffect(() => {
    const handleFilterChange = (event) => {
      setInstitutionFilter(event?.detail || getStoredInstitutionFilter());
    };

    window.addEventListener(INSTITUTION_FILTER_EVENT, handleFilterChange);

    return () => {
      window.removeEventListener(
        INSTITUTION_FILTER_EVENT,
        handleFilterChange
      );
    };
  }, []);

  useEffect(() => {
    const handleHeaderFiltersChange = () => {
      setIndicationFilter(getStoredIndicationFilter());
      setSiteNumberFilter(getStoredSiteNumberFilter());
      setStudyCodeFilter(getStoredStudyFilter());
    };

    window.addEventListener(HEADER_FILTERS_EVENT, handleHeaderFiltersChange);

    return () => {
      window.removeEventListener(
        HEADER_FILTERS_EVENT,
        handleHeaderFiltersChange
      );
    };
  }, []);

  useEffect(() => {
    setDashboardData(getAdminDashboardData(activeFilters));
  }, [activeFilters]);

  useEffect(() => {
    const refreshDashboard = () => {
      setDashboardData(getAdminDashboardData(activeFilters));
      setSubjectDataVersion((version) => version + 1);
    };

    window.addEventListener("studies-updated", refreshDashboard);
    // Subject adds/edits/deletes dispatch "subjects-updated" (not
    // "studies-updated"), so the dashboard must listen for both — otherwise
    // the Subject Status Analytics and enrollment counts below go stale until
    // the next reload/filter change.
    window.addEventListener("subjects-updated", refreshDashboard);

    return () => {
      window.removeEventListener("studies-updated", refreshDashboard);
      window.removeEventListener("subjects-updated", refreshDashboard);
    };
  }, [activeFilters]);

  const navigate = useNavigate();

  const {
    users,
    studies,
    sites,
    pendingUsers,
    pendingAccessRequests,
    complianceScore
  } = dashboardData;

  // Sites touched by whichever studies match the current Indication/Study
  // Number filters, so subject analytics narrows down the same way the KPI
  // cards above it do, not just by Institution.
  const filteredStudySites = useMemo(() => {
    if (!indicationFilter && !studyCodeFilter) {
      return null;
    }

    return new Set<any>(studies.map((study) => study.site).filter(Boolean));
  }, [indicationFilter, studyCodeFilter, studies]);

  const analyticsSubjects = useMemo(() => {
    return getSubjectsForAnalytics().filter((subject) => {
      const matchesInstitution =
        !institutionFilter ||
        subject.site === institutionFilter ||
        subject.site?.includes(institutionFilter) ||
        institutionFilter.includes(subject.site || "");

      const matchesIndicationSites =
        !filteredStudySites ||
        [...filteredStudySites].some(
          (siteName) =>
            subject.site === siteName ||
            subject.site?.includes(siteName) ||
            siteName.includes(subject.site || "")
        );

      return matchesInstitution && matchesIndicationSites;
    });
  }, [institutionFilter, filteredStudySites, subjectDataVersion]);

  const portfolioStudies = useMemo(() => getStudies(), []);

  const ongoingStudiesCount = useMemo(
    () =>
      studies.filter((study) =>
        ONGOING_STUDY_STATUSES.includes(study.status)
      ).length,
    [studies]
  );

  return (
    <AdminDashboardLayout>
      <div className="admin-dashboard">
        <div className="dashboard-header-row page-section-highlight">
          <div className="dashboard-page-title">
            <h1>Admin Dashboard</h1>
            <p>
              Clinical Trial System Overview
              {institutionFilter ? ` — ${institutionFilter}` : ""}
            </p>
          </div>

          <div className="dashboard-grid-6 dashboard-header-kpis">
            <KPICard
              title="Users"
              value={users.length}
              subtitle="Registered Users"
              icon="👤"
              onClick={() => navigate("/user-management")}
            />

            <KPICard
              title="Pending"
              value={pendingUsers.length + pendingAccessRequests.length}
              subtitle="Access Requests"
              icon="🛡️"
              onClick={() => navigate("/access-permission")}
            />

            <KPICard
              title="Studies"
              value={ongoingStudiesCount}
              subtitle="Ongoing Studies"
              icon="📁"
              onClick={() => navigate("/studies")}
            />

            <KPICard
              title="Sites"
              value={sites.length}
              subtitle="Operational Sites"
              icon="🏥"
              onClick={() => navigate("/sites")}
            />

            <KPICard
              title="Comments"
              value={openCommentsCount}
              subtitle="Open Comments"
              icon="💬"
              onClick={() => navigate("/comments")}
            />

            <KPICard
              title="Compliance"
              value={complianceScore}
              subtitle="Overall Score"
              icon="✅"
            />
          </div>
        </div>

        <SubjectAnalyticsSection
          subjects={analyticsSubjects}
          studies={portfolioStudies}
          compactKpis
        />

        <VisitCalendarSection
          institutionFilter={institutionFilter}
          studyCode={studyCodeFilter}
        />

        <div className="dashboard-grid-2">
          <AlertsPanel
            title="System Alerts"
            alerts={[
              {
                type: "warning",
                title: "Pending Approvals",
                message: `${pendingUsers.length + pendingAccessRequests.length} users awaiting approval`
              },
              {
                type: "danger",
                title: "Open Comments",
                message: `${openCommentsCount} unresolved comments`
              },
              {
                type: "info",
                title: "Study Update",
                message: `${studies.length} studies in portfolio`
              }
            ]}
          />

          <QuickActions
            actions={[
              {
                icon: "👤",
                label: "User Management",
                path: "/user-management"
              },
              {
                icon: "🛡️",
                label: "Access Permission",
                path: "/access-permission"
              },
              {
                icon: "📁",
                label: "Studies",
                path: "/studies"
              },
              {
                icon: "📈",
                label: "Reports",
                path: "/reports"
              }
            ]}
          />
        </div>
      </div>
    </AdminDashboardLayout>
  );
}

export default AdminDashboard;