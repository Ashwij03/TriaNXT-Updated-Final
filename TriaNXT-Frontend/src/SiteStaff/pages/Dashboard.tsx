// UPDATED: Site Staff dashboard — Phase 8 subject-status analytics and full-height Upcoming Visits

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteStaffDashboardLayout from "../components/SiteStaffDashboardLayout";
import KPICard from "../../shared/components/dashboard/shared/KPICard";
import SubjectAnalyticsSection from "../../shared/components/dashboard/shared/SubjectAnalyticsSection";
import { getStudies } from "../../shared/services/studyService";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import AlertsPanel from "../../shared/components/dashboard/shared/AlertsPanel";
import QuickActions from "../../shared/components/dashboard/shared/QuickActions";
import VisitCalendarSection from "../../shared/components/dashboard/shared/VisitCalendarSection";
import {
  getSiteStaffDashboardData,
  getSubjectsForAnalytics
} from "../../shared/services/adminService";
import { getAccessibleStudies, getAssignedSite } from "../../shared/services/roleService";
import { useComments } from "../../shared/comments/CommentsContext";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

import "../../Admin/styles/Dashboard.css";
import "../../shared/pages/AccessPermissions.css";
import "../styles/Dashboard.css";
import "../../shared/pages/studies/StudyDashboard.css";

function SiteStaffDashboard() {
  const navigate = useNavigate();
  const { pendingCount: openCommentsCount } = useComments();
  const [dashboardData, setDashboardData] = useState(() =>
    getSiteStaffDashboardData()
  );
  const assignedSite = getAssignedSite();
  const studyCount = useMemo(() => getAccessibleStudies().length, []);

  // Bumped on every study/subject store change so the analytics memo below
  // (which previously had no reactive dependencies and only ever ran once)
  // re-reads the subject store instead of serving a mount-time snapshot.
  const [subjectDataVersion, setSubjectDataVersion] = useState(0);

  const analyticsSubjects = useMemo(
    () => getSubjectsForAnalytics(),
    [subjectDataVersion],
  );
  const portfolioStudies = useMemo(() => getStudies(), []);

  useEffect(() => {
    const refreshDashboardData = () => {
      setDashboardData(getSiteStaffDashboardData());
      setSubjectDataVersion((version) => version + 1);
    };

    window.addEventListener("subjects-updated", refreshDashboardData);
    window.addEventListener("studies-updated", refreshDashboardData);
    window.addEventListener("sponsor-data-updated", refreshDashboardData);
    window.addEventListener("admin-data-updated", refreshDashboardData);
    window.addEventListener("storage", refreshDashboardData);

    return () => {
      window.removeEventListener("subjects-updated", refreshDashboardData);
      window.removeEventListener("studies-updated", refreshDashboardData);
      window.removeEventListener("sponsor-data-updated", refreshDashboardData);
      window.removeEventListener("admin-data-updated", refreshDashboardData);
      window.removeEventListener("storage", refreshDashboardData);
    };
  }, []);

  const {
    enrolledCount,
    upcomingVisitsCount,
    subjectActivity,
    alerts
  } = dashboardData;

  // Item 17 — operational Site column shows Site Number, not Site Name.
  const siteResolvedSubjectActivity = useMemo(() => {
    const list = Array.isArray(subjectActivity)
      ? (subjectActivity as Array<Record<string, any>>)
      : [];
    return list.map((row) => ({
      ...row,
      site: resolveSiteDisplay(row?.site, {
        sources: portfolioStudies,
        fallback: row?.site || "—",
      }),
    }));
  }, [subjectActivity, portfolioStudies]);

  return (
    <SiteStaffDashboardLayout>
      <div className="admin-dashboard site-dashboard tnxt-compact">
        <div className="dashboard-header-row page-section-highlight">
          <div className="dashboard-page-title">
            <h1>Site Staff Dashboard</h1>
            <p>
              Site Operations Overview
              {assignedSite
                ? ` — ${resolveSiteDisplay(assignedSite, {
                    sources: portfolioStudies,
                    fallback: assignedSite,
                  })}`
                : ""}
            </p>
          </div>

          <div className="dashboard-grid-6 kpi-grid dashboard-header-kpis">
            <KPICard
              title="Studies"
              value={studyCount}
              subtitle="Active Studies"
              icon="📁"
              onClick={() => navigate("/studies")}
            />

            <KPICard
              title="Enrollment"
              value={enrolledCount}
              subtitle="Active Enrollment"
              icon="➕"
              onClick={() => navigate("/subjects")}
            />

            <KPICard
              title="Upcoming Visits"
              value={upcomingVisitsCount}
              subtitle="Next 7 Days"
              icon="📅"
              onClick={() => navigate("/site-performance")}
            />

            <KPICard
              title="Open Comments"
              value={openCommentsCount}
              subtitle="Pending Resolution"
              icon="💬"
              onClick={() => navigate("/comments")}
            />
          </div>
        </div>

        <SubjectAnalyticsSection
          subjects={analyticsSubjects}
          studies={portfolioStudies}
          compactKpis
        />

        <VisitCalendarSection />

        <div className="dashboard-grid-2">
          <AlertsPanel title="Site Alerts" alerts={alerts} />

          <QuickActions
            actions={[
              {
                icon: "📁",
                label: "Studies",
                path: "/studies"
              },
              {
                icon: "🔍",
                label: "Recruitment",
                path: "/recruitment"
              },
              {
                icon: "📚",
                label: "Study Logs",
                path: "/studies"
              },
              {
                icon: "💬",
                label: "Comments",
                path: "/comments"
              }
            ]}
          />
        </div>

        <DataTable
          className="ctms-standard-table"
          title="Subject Activity"
          columns={[
            {
              key: "studyNumber",
              label: "Study Number"
            },
            {
              key: "siteNumber",
              label: "Site Number"
            },
            {
              key: "subjectId",
              label: "Subject ID"
            },
            {
              key: "status",
              label: "Status"
            }
          ]}
          data={subjectActivity}
          searchable
          searchPlaceholder="Search subject activity..."
          searchFields={[
            "studyNumber",
            "siteNumber",
            "subjectId",
            "status"
          ]}
          filters={[
            {
              key: "status",
              label: "Status"
            }
          ]}
          pagination
          initialPageSize={5}
          data1={siteResolvedSubjectActivity}
        />
      </div>
    </SiteStaffDashboardLayout>
  );
}

export default SiteStaffDashboard;