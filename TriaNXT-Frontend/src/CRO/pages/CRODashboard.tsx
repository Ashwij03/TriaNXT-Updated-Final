import React from "react";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import "../styles/CRODashboard.css";
import "../../shared/pages/studies/StudyDashboard.css";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import StudyStatusChart from "./StudyStatusChart";
import EnrollmentChart from "./EnrollmentChart";
import VisitCompletionChart from "./VisitCompletionChart";
import QueryStatusChart from "./QueryStatusChart";
import UpcomingMonitoringVisits from "./UpcomingMonitoringVisits";
import CROStatusBadge from "./CROStatusBadge";
import SkeletonLoader from "./SkeletonLoader";
import EmptyState from "./EmptyState";
import { useNavigate } from "react-router-dom";

function CRODashboard() {
  const { visits, subjects, comments, notifications, kpis, isLoading } =
    useCROData();
  const navigate = useNavigate();

  const loading = isLoading;

  const safeVisits = Array.isArray(visits) ? visits : [];
  const safeComments = Array.isArray(comments) ? comments : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeKpis = kpis || {};

  const uniqueSites = [
    ...new Set<any>(
      safeVisits
        .map((v) => v?.site)
        .filter(Boolean)
        .map((site) => String(site)),
    ),
  ];
  const recentActivities = safeVisits.slice(0, 3);
  const recentComments = safeComments
    .filter((c) => String(c?.status ?? "").toLowerCase() === "open")
    .slice(0, 3);
  const unreadNotifications = safeNotifications.filter(
    (n) => String(n?.status ?? "Unread").toLowerCase() === "unread",
  );

  const kpiCards = [
    {
      icon: "🏥",
      title: "Sites Under Monitoring",
      value: safeKpis.sitesUnderMonitoring ?? 0,
      route: "/cro-subject-management",
    },
    {
      icon: "📅",
      title: "Monitoring Visits",
      value: safeKpis.monitoringVisits ?? 0,
      route: "/cro-monitoring",
    },
    {
      icon: "📋",
      title: "Pending Reviews",
      value: safeKpis.pendingReviews ?? 0,
      route: "/cro-regulatory-documents",
    },
    {
      icon: "💬",
      title: "Comments",
      value: safeKpis.comments ?? 0,
      route: "/comments",
    },
    {
      icon: "📊",
      title: "Compliance Metrics",
      value: safeKpis.complianceMetrics ?? 0,
      route: "/cro-site-performance",
    },
  ];

  const quickActions = [
    {
      label: "📋 Create Monitoring Report",
      route: "/cro-reports",
    },
    {
      label: "📊 Review Site Performance",
      route: "/cro-site-performance",
    },
    {
      label: "💬 Review Comments",
      route: "comments",
    },
    {
      label: "📁 Regulatory Review",
      route: "/cro-regulatory-documents",
    },
  ];

  return (
    <CROLayout>
      <div className="cro-dashboard tnxt-compact">
        <div className="cro-header dashboard-header-row page-section-highlight">
          <div className="dashboard-header">
            <h1>CRO Dashboard</h1>

            <div className="dashboard-subtitle">
              Clinical Research Operations Overview
            </div>
          </div>

          {!loading && (
            <div className="kpi-grid dashboard-header-kpis">
              {kpiCards.map((card) => (
                <div
                  key={card.title}
                  className="kpi-card"
                  onClick={() => navigate(card.route)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(card.route)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="kpi-icon">{card.icon}</div>
                  <div className="kpi-text">
                    <h3>{card.title}</h3>
                    <p>{card.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <SkeletonLoader rows={5} type="cards" />
        ) : (
          <>
            <div className="charts-grid">
              <div
                className="dashboard-card clickable-card"
                onClick={() => navigate("/cro-enrollment")}
                role="button"
                tabIndex={0}
              >
                <EnrollmentChart />
              </div>
              <div
                className="dashboard-card clickable-card"
                onClick={() => navigate("/cro-monitoring")}
                role="button"
                tabIndex={0}
              >
                <VisitCompletionChart />
              </div>
              <div
                className="dashboard-card clickable-card"
                onClick={() => navigate("comments")}
                role="button"
                tabIndex={0}
              >
                <QueryStatusChart />
              </div>
              <div
                className="dashboard-card clickable-card"
                onClick={() => navigate("/cro-subjects")}
                role="button"
                tabIndex={0}
              >
                <StudyStatusChart />
              </div>
            </div>

            <div
              className="dashboard-card clickable-card"
              onClick={() => navigate("/cro-subject-management")}
              role="button"
              tabIndex={0}
            >
              <h2>Sites Under Monitoring</h2>
              {uniqueSites.length === 0 ? (
                <EmptyState title="No Sites Found" />
              ) : (
                <div className="cro-table-wrap">
                  <table className="ctms-standard-table">
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th>Study</th>
                        <th>Subjects</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueSites.map((site) => {
                        const safeSubjects = Array.isArray(subjects)
                          ? subjects
                          : [];
                        const siteSubjects = safeSubjects.filter(
                          (s) => String(s?.site ?? "") === site,
                        );
                        const siteDisplay = resolveSiteDisplay(site, {
                          sources: getStudies(),
                          fallback: site,
                        });
                        return (
                          <tr key={site}>
                            <td>{siteDisplay}</td>
                            <td>{siteSubjects[0]?.study || "—"}</td>
                            <td>{siteSubjects.length}</td>
                            <td>
                              <span className="status-active">Active</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div
              className="dashboard-card clickable-card"
              onClick={() => navigate("/cro-monitoring")}
              role="button"
              tabIndex={0}
            >
              <h2>Monitoring Visits</h2>
              {safeVisits.length === 0 ? (
                <EmptyState title="No Visits Found" />
              ) : (
                <div className="cro-table-wrap">
                  <table className="ctms-standard-table">
                    <thead>
                      <tr>
                        <th>Visit ID</th>
                        <th>Site</th>
                        <th>Visit Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeVisits.slice(0, 5).map((visit) => (
                        <tr
                          key={
                            visit?.id ?? `${visit?.site}-${visit?.visitType}`
                          }
                        >
                          <td>{visit?.id ?? "—"}</td>
                          <td>{visit?.site ?? "—"}</td>
                          <td>{visit?.visitType ?? visit?.visit ?? "—"}</td>
                          <td>
                            <CROStatusBadge status={visit?.status ?? "—"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="dashboard-card">
              <UpcomingMonitoringVisits />
            </div>

            <div className="info-grid">
              <div
                className="dashboard-card clickable-card"
                onClick={() => navigate("/cro-monitoring")}
                role="button"
                tabIndex={0}
              >
                <h2>Recent Monitoring Activities</h2>
                {recentActivities.length === 0 ? (
                  <EmptyState title="No Activities" />
                ) : (
                  <div className="cro-table-wrap">
                    <table className="ctms-standard-table">
                      <thead>
                        <tr>
                          <th>Site</th>
                          <th>Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivities.map((v, index) => (
                          <tr key={v?.id ?? `activity-${index}`}>
                            <td>{v?.site ?? "—"}</td>
                            <td>
                              {v?.visitType ?? v?.visit ?? "Visit"} —{" "}
                              {v?.status ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div
                className="dashboard-card clickable-card"
                onClick={() => navigate("/cro-comments")}
                role="button"
                tabIndex={0}
              >
                <h2>Recent Comments</h2>
                {recentComments.length === 0 ? (
                  <EmptyState title="No Comments Found" />
                ) : (
                  <div className="cro-table-wrap">
                    <table className="ctms-standard-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Comment</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentComments.map((c) => {
                          const preview = String(
                            c?.message ?? c?.description ?? c?.text ?? "",
                          );
                          const truncated =
                            preview.length > 50
                              ? `${preview.substring(0, 50)}...`
                              : preview || "—";

                          return (
                            <tr key={c?.id ?? `${c?.subject}-${preview}`}>
                              <td>{c?.subject ?? c?.subjectId ?? "—"}</td>
                              <td>{truncated}</td>
                              <td>
                                <CROStatusBadge status={c?.status ?? "—"} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div
                className="dashboard-card clickable-card"
                onClick={() => navigate("/cro-notifications")}
                role="button"
                tabIndex={0}
              >
                <h2>🔔 Alerts & Notifications</h2>

                <div className="alerts-list">
                  {unreadNotifications.length === 0 ? (
                    <EmptyState title="No Unread Alerts" />
                  ) : (
                    unreadNotifications.map((alert) => {
                      const severity = String(
                        alert?.severity ?? alert?.type ?? "info",
                      ).toLowerCase();

                      return (
                        <div
                          key={alert?.id ?? `${alert?.title}-${alert?.date}`}
                          className={`alert-card ${severity}`}
                        >
                          <div className="alert-card-header">
                            <h4>{alert?.title ?? "Alert"}</h4>

                            <span className={`status-${severity}`}>
                              {alert?.severity ?? alert?.type ?? "Info"}
                            </span>
                          </div>

                          <p>{alert?.message ?? "—"}</p>

                          <div className="alert-card-footer">
                            <span>{alert?.type ?? "—"}</span>
                            <span>
                              {alert?.date ?? alert?.createdAt ?? "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="dashboard-card quick-actions-container">
                <h2>⚡ Quick Actions</h2>

                <div className="quick-actions">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => navigate(action.route)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CROLayout>
  );
}

export default CRODashboard;
