import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMessageSquare } from "react-icons/fi";
import {
  getAllSubjects,
  getSubjectsForStudy
} from "../../shared/services/subjectService";
import {
  FaUser,
  FaClipboardList,
  FaShieldAlt,
  FaUsers,
  FaFileAlt,
  FaChartBar,
  FaCalendarAlt,
  FaBookOpen,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaFileMedical,
  FaClock,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";

import PINavbar from "./PINavbar";
import PISidebar from "./PISidebar";
import PILiveChat from "./PILiveChat";
import PICommentModal from "./PICommentModal";
import PIReports from "./PIReports";
import PIRecruitment from "./PIRecruitment";
import PIRegulatory from "./PIRegulatory";
import PISettings from "./PISettings";
import PINotifications from "./PINotifications";
import PISitePerformance from "./PISitePerformance";
import PIComments from "./PIComments";
import PIEISFDashboard from "./PIEISFDashboard";
import PIICFDashboard from "./PIICFDashboard";
import StudyFolderDashboard from "./PIStudyFolderDashboard";
import VisitCalendarSection from "../../shared/components/dashboard/shared/VisitCalendarSection";
import useVisitSchedules from "../../shared/hooks/useVisitSchedules";

import {
  getDashboardData,
  saveDashboardData,
  syncKpisFromData,
  getNavbarData,
  buildDynamicAlerts,
} from "./piDashboardService";
import { useComments } from "../../shared/comments/CommentsContext";

import { getStudies } from "../../shared/services/studyService";
import {
  addOrUpdateVisitSchedule,
  SCHEDULES_EVENT,
} from "../../shared/services/visitScheduleService";
import {
  getStudyKey,
  useRoleStudiesSidebar,
} from "../../shared/hooks/useRoleStudiesSidebar";

import "../styles/PIDashboard.css";
import "../../shared/pages/studies/StudyDashboard.css";

function PIDashboard({ embeddedInLayout = false }: any) {
  const navigate = useNavigate();
  const { comments: liveComments, pendingCount: openCommentsCount } =
    useComments();

  const { studyCount } = useRoleStudiesSidebar();

  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState("dashboard");
  const [settingsView, setSettingsView] = useState("security");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);

  const [selectedStudy, setSelectedStudy] = useState(
    () => getNavbarData().selectedStudy || "All Studies",
  );
  const selectedStudyCode =
    selectedStudy && selectedStudy !== "All Studies" ? selectedStudy : "";
  const { upcomingWindow } = useVisitSchedules({
    studyCode: selectedStudyCode,
  });

  const [dashboardData, setDashboardData] = useState(() =>
    syncKpisFromData(getDashboardData()),
  );

  const [sharedDataVersion, setSharedDataVersion] = useState(0);

  const [newVisit, setNewVisit] = useState({
    subject: "",
    visit: "",
    date: "",
  });

  const [newQuery, setNewQuery] = useState({
    id: "",
    subject: "",
    status: "Open",
  });

  const COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

  const refreshDashboardData = () => {
    setDashboardData(syncKpisFromData(getDashboardData()));
  };

  useEffect(() => {
    const handleStudyChange = (event) => {
      setSelectedStudy(event.detail || "All Studies");
      refreshDashboardData();
    };

    const refreshSharedData = () => {
      setSharedDataVersion((version) => version + 1);
      refreshDashboardData();
    };

    window.addEventListener("pi-study-change", handleStudyChange);
    window.addEventListener("pi-comments-updated", refreshDashboardData);
    window.addEventListener("comments-updated", refreshDashboardData);
    window.addEventListener("pi-dashboard-updated", refreshDashboardData);
    window.addEventListener("studies-updated", refreshSharedData);
    window.addEventListener("subjects-updated", refreshSharedData);
    window.addEventListener("study-overview-updated", refreshSharedData);
    window.addEventListener(SCHEDULES_EVENT, refreshSharedData);

    return () => {
      window.removeEventListener("pi-study-change", handleStudyChange);
      window.removeEventListener("pi-comments-updated", refreshDashboardData);
      window.removeEventListener("comments-updated", refreshDashboardData);
      window.removeEventListener("pi-dashboard-updated", refreshDashboardData);
      window.removeEventListener("studies-updated", refreshSharedData);
      window.removeEventListener("subjects-updated", refreshSharedData);
      window.removeEventListener("study-overview-updated", refreshSharedData);
      window.removeEventListener(SCHEDULES_EVENT, refreshSharedData);
    };
  }, []);

  /*
    sharedDataVersion is intentionally referenced here so this code reruns
    whenever studies or subjects are changed. No useMemo is required.
  */
  void sharedDataVersion;

  let sharedStudies = [];

  try {
    const studies = getStudies();
    sharedStudies = Array.isArray(studies) ? studies : [];
  } catch {
    sharedStudies = [];
  }

  const realSubjects = (() => {
    try {
      const allSubjects = getAllSubjects();
      // Tag each subject with study metadata from the studies list
      return allSubjects.map((subject) => {
        const studyKey = subject.studyId;
        const study = sharedStudies.find((s) => getStudyKey(s) === studyKey);
        return {
          ...subject,
          studyKey,
          studyCode: study?.code || studyKey,
          studyName: study?.name || study?.title || studyKey,
        };
      });
    } catch {
      return [];
    }
  })();

  const activeSubjectsCount = realSubjects.filter((subject) => {
    const status = String(subject.status || "")
      .trim()
      .toLowerCase();

    return !["inactive", "withdrawn", "completed", "screen-failed"].includes(
      status,
    );
  }).length;

  const enrollmentCount =
    realSubjects.length > 0
      ? realSubjects.length
      : sharedStudies.reduce(
          (total, study) =>
            total + Number(study.enrolled || study.enrollmentCount || 0),
          0,
        );

  const targetCount = sharedStudies.reduce(
    (total, study) =>
      total +
      Number(
        study.targetSubjects ||
          study.target ||
          study.targetCount ||
          study.subjectTarget ||
          0,
      ),
    0,
  );

  const consentRate = useMemo(() => {
    if (realSubjects.length === 0) {
      return 0;
    }

    const consentedSubjects = realSubjects.filter((subject) => {
      const consentValue = String(
        subject.consentStatus ||
          subject.consent ||
          subject.icfStatus ||
          subject.status ||
          "",
      )
        .trim()
        .toLowerCase();

      return [
        "consented",
        "signed",
        "complete",
        "completed",
        "active",
        "enrolled",
      ].includes(consentValue);
    }).length;

    return Math.round((consentedSubjects / realSubjects.length) * 100);
  }, [realSubjects]);

  const visitCompletion = useMemo(() => {
    const visitData = dashboardData.visitData || [];

    if (!visitData.length) {
      return 0;
    }

    const total = visitData.reduce(
      (sum, item) => sum + Number(item.completion || 0),
      0,
    );

    return Math.round(total / visitData.length);
  }, [dashboardData.visitData]);

  const actualStudiesCount = sharedStudies.length || studyCount || 0;

  const dynamicKpis = {
    ...dashboardData.kpis,
    enrollmentCount,
    targetCount,
    activeSubjects: activeSubjectsCount,
    studiesCount: actualStudiesCount,
    consentRate,
    visitCompletion,
    commentsCount: openCommentsCount,
    openComments: openCommentsCount,
  };

  const navigateToPage = (page) => {
    const routes = {
      recruitment: "/pi-recruitment",
      reports: "/pi-reports",
      regulatory: "/pi-regulatory",
      "site-performance": "/pi-site-performance",
      notifications: "/pi-notifications",
      comments: "/comments",
      eisf: "/pi-eisf-dashboard",
      icf: "/pi-icf-dashboard",
      "study-folder": "/pi-study-folder-dashboard",
      dashboard: "/pi-dashboard",
    };

    navigate(routes[page] || "/pi-dashboard");
  };

  const navigateToStudies = () => {
    setSelectedPage("studies");
    navigate("/studies");
  };

  const navigateToSubjects = () => {
    const firstStudyWithSubjects = sharedStudies.find((study) => {
      const studyKey = getStudyKey(study);
      try {
        return getSubjectsForStudy(studyKey).length > 0;
      } catch {
        return false;
      }
    });

    const targetStudy = firstStudyWithSubjects || sharedStudies[0];

    if (!targetStudy) {
      navigateToStudies();
      return;
    }

    const studyKey = getStudyKey(targetStudy);

    navigate(
      `/study-dashboard/${encodeURIComponent(
        studyKey,
      )}?tab=${encodeURIComponent("Subjects")}`,
    );
  };

  const getAlertIcon = (type) => {
    if (type === "critical") return <FaFileMedical className="alert-svg" />;
    if (type === "danger") return <FaExclamationCircle className="alert-svg" />;
    if (type === "warning")
      return <FaExclamationCircle className="alert-svg" />;
    if (type === "study-alert") {
      return <FaExclamationTriangle className="alert-svg" />;
    }

    return <FaInfoCircle className="alert-svg" />;
  };

  const handleAlertClick = (alert) => {
    navigateToPage(alert.page || "notifications");
  };

  const quickActionsData = [
    {
      title: "Schedule Visit",
      icon: <FaCalendarAlt />,
      count: upcomingWindow.length,
      action: () => setShowVisitModal(true),
    },
    {
      title: "Studies",
      icon: <FaBookOpen />,
      count: actualStudiesCount,
      action: navigateToStudies,
    },
    {
      title: "Comments",
      icon: <FaFileAlt />,
      count: dynamicKpis.commentsCount || 0,
      action: () => navigateToPage("comments"),
    },
    {
      title: "Generate Report",
      icon: <FaChartBar />,
      count: actualStudiesCount,
      action: () => navigateToPage("reports"),
    },
  ];

  const dynamicAlerts = buildDynamicAlerts(
    {
      ...dashboardData,
      kpis: dynamicKpis,
      studies: sharedStudies,
      recentSubjects: realSubjects,
    },
    liveComments,
  );

  const enrollmentChartData = [
    { name: "Target", value: targetCount },
    { name: "Enrolled", value: enrollmentCount },
  ];

  const consentChartData = [
    {
      name: "Consented",
      value: realSubjects.filter((subject) => {
        const value = String(
          subject.consentStatus ||
            subject.consent ||
            subject.icfStatus ||
            subject.status ||
            "",
        )
          .trim()
          .toLowerCase();

        return [
          "consented",
          "signed",
          "complete",
          "completed",
          "active",
          "enrolled",
        ].includes(value);
      }).length,
    },
    {
      name: "Pending",
      value: realSubjects.filter((subject) => {
        const value = String(
          subject.consentStatus || subject.consent || subject.icfStatus || "",
        )
          .trim()
          .toLowerCase();

        return ["pending", "in progress", "awaiting"].includes(value);
      }).length,
    },
    {
      name: "Declined",
      value: realSubjects.filter((subject) => {
        const value = String(
          subject.consentStatus || subject.consent || subject.icfStatus || "",
        )
          .trim()
          .toLowerCase();

        return ["declined", "refused", "withdrawn"].includes(value);
      }).length,
    },
  ];

  const subjectStatusChartData = [
    {
      name: "Screened",
      value: realSubjects.filter(
        (subject) => String(subject.status || "").toLowerCase() === "screening",
      ).length,
    },
    {
      name: "Enrolled",
      value: realSubjects.filter((subject) =>
        ["active", "enrolled"].includes(
          String(subject.status || "").toLowerCase(),
        ),
      ).length,
    },
    {
      name: "Completed",
      value: realSubjects.filter(
        (subject) => String(subject.status || "").toLowerCase() === "completed",
      ).length,
    },
    {
      name: "Withdrawn",
      value: realSubjects.filter((subject) =>
        ["withdrawn", "screen-failed", "inactive"].includes(
          String(subject.status || "").toLowerCase(),
        ),
      ).length,
    },
  ];

  const updateDashboard = (updatedDashboard) => {
    const syncedData = syncKpisFromData(updatedDashboard);
    const savedData = saveDashboardData(syncedData);

    setDashboardData(savedData);
    window.dispatchEvent(new CustomEvent("pi-dashboard-updated"));
  };

  const handleAddVisit = () => {
    if (!newVisit.subject || !newVisit.visit || !newVisit.date) {
      alert("Please fill all fields");
      return;
    }

    const subjectRecord = realSubjects.find(
      (subject) =>
        String(subject.subjectId || subject.id) === String(newVisit.subject),
    );
    const studyId =
      selectedStudyCode || subjectRecord?.studyCode || subjectRecord?.studyKey;

    if (!studyId) {
      alert("Select a study or enter a subject linked to a study");
      return;
    }

    addOrUpdateVisitSchedule({
      studyId,
      subjectId: newVisit.subject,
      subject: subjectRecord || {
        id: newVisit.subject,
        subjectId: newVisit.subject,
      },
      visitName: newVisit.visit,
      date: newVisit.date,
      status: "Scheduled",
    });
    refreshDashboardData();

    setShowVisitModal(false);
    setNewVisit({
      subject: "",
      visit: "",
      date: "",
    });
  };

  const handleAddQuery = () => {
    if (!newQuery.id || !newQuery.subject || !newQuery.status) {
      alert("Please fill all fields");
      return;
    }

    updateDashboard({
      ...dashboardData,
      pendingQueries: [...(dashboardData.pendingQueries || []), newQuery],
    });

    setShowQueryModal(false);
    setNewQuery({
      id: "",
      subject: "",
      status: "Open",
    });
  };

  const renderPageContent = (forcedPage?) => {
    const page =
      forcedPage && selectedPage === "dashboard" ? forcedPage : selectedPage;

    if (page === "livechat") {
      return <PILiveChat key="livechat" setSelectedPage={setSelectedPage} />;
    }

    if (page === "reports") {
      return <PIReports key="reports" selectedStudy={selectedStudy} />;
    }

    if (page === "recruitment") {
      return <PIRecruitment key="recruitment" selectedStudy={selectedStudy} />;
    }

    if (page === "regulatory") {
      return <PIRegulatory key="regulatory" selectedStudy={selectedStudy} />;
    }

    if (page === "settings") {
      return (
        <PISettings
          key={`settings-${settingsView}`}
          activeView={settingsView}
        />
      );
    }

    if (page === "notifications") {
      return (
        <PINotifications key="notifications" selectedStudy={selectedStudy} />
      );
    }

    if (page === "site-performance") {
      return (
        <PISitePerformance
          key="site-performance"
          selectedStudy={selectedStudy}
        />
      );
    }

    if (page === "comments") {
      return <PIComments embedded />;
    }

    if (page === "eisf") {
      return <PIEISFDashboard />;
    }

    if (page === "icf") {
      return <PIICFDashboard />;
    }

    if (page === "study-folder") {
      return <StudyFolderDashboard />;
    }

    return (
      <div className="pi-page-content">
        <div className="dashboard-header-row page-section-highlight">
          <div className="dashboard-page-title">
            <h1>Principal Investigator Dashboard</h1>
            <p>Site overview and study progress</p>
          </div>

          <div className="pi-kpi-grid dashboard-header-kpis">
            <div
              className="pi-card pi-kpi-clickable"
              onClick={() => navigateToPage("recruitment")}
              role="button"
              tabIndex={0}
            >
              <div className="card-header">
                <div className="icon-circle blue">
                  <FaUsers />
                </div>

                <div className="card-content">
                  <span className="card-title">Enrollment Count</span>
                  <span className="card-value">
                    {dynamicKpis.enrollmentCount || 0}
                  </span>
                  <span className="card-subtitle">
                    Target: {dynamicKpis.targetCount || 0}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="pi-card pi-kpi-clickable"
              onClick={navigateToSubjects}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  navigateToSubjects();
                }
              }}
            >
              <div className="card-header">
                <div className="icon-circle green">
                  <FaUser />
                </div>

                <div className="card-content">
                  <span className="card-title">Active Subjects</span>
                  <span className="card-value">
                    {dynamicKpis.activeSubjects || 0}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="pi-card pi-kpi-clickable"
              onClick={navigateToStudies}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  navigateToStudies();
                }
              }}
            >
              <div className="card-header">
                <div className="icon-circle orange">
                  <FaClipboardList />
                </div>

                <div className="card-content">
                  <span className="card-title">Studies</span>
                  <span className="card-value">{actualStudiesCount}</span>
                </div>
              </div>
            </div>

            <div
              className="pi-card pi-kpi-clickable"
              onClick={() => navigateToPage("comments")}
              role="button"
              tabIndex={0}
            >
              <div className="card-header">
                <div className="icon-circle red">
                  <FaFileAlt />
                </div>

                <div className="card-content">
                  <span className="card-title">Comments</span>
                  <span className="card-value">
                    {dynamicKpis.commentsCount || 0}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="pi-card pi-kpi-clickable"
              onClick={() => navigateToPage("site-performance")}
              role="button"
              tabIndex={0}
            >
              <div className="card-header">
                <div className="icon-circle purple">
                  <FaChartBar />
                </div>

                <div className="card-content">
                  <span className="card-title">Visit Completion %</span>
                  <span className="card-value">
                    {dynamicKpis.visitCompletion || 0}%
                  </span>
                </div>
              </div>
            </div>

            <div
              className="pi-card pi-kpi-clickable"
              onClick={() => navigateToPage("regulatory")}
              role="button"
              tabIndex={0}
            >
              <div className="card-header">
                <div className="icon-circle teal">
                  <FaShieldAlt />
                </div>

                <div className="card-content">
                  <span className="card-title">Consent Rate</span>
                  <span className="card-value">
                    {dynamicKpis.consentRate || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pi-chart-sections">
          <div className="pi-chart-pair-section">
            <div className="pi-chart-pair-grid">
              <div className="chart-card">
                <h4>Enrollment vs Target</h4>

                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={enrollmentChartData}>
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h4>Consent Distribution</h4>

                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={consentChartData}
                      dataKey="value"
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ name, value }) =>
                        value > 0 ? `${name}: ${value}` : ""
                      }
                    >
                      {consentChartData.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                    />

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="pi-chart-pair-section">
            <div className="pi-chart-pair-grid">
              <div className="chart-card">
                <h4>Subject Status Overview</h4>

                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={subjectStatusChartData}
                      dataKey="value"
                      innerRadius={75}
                      outerRadius={120}
                      cx="52%"
                      cy="50%"
                      paddingAngle={2}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#3b82f6" />
                      <Cell fill="#a855f7" />
                      <Cell fill="#ef4444" />
                    </Pie>

                    <Tooltip />

                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                    />

                    <text
                      x="45%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="28"
                      fontWeight="700"
                    >
                      {realSubjects.length}
                    </text>

                    <text
                      x="45%"
                      y="58%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="13"
                    >
                      Total
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h4>Visit Completion Trend</h4>

                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dashboardData.visitData || []}>
                    <XAxis dataKey="visit" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="completion"
                      fill="#a78bfa"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="pi-calendar-visits-section">
          <VisitCalendarSection
            studyCode={
              selectedStudy && selectedStudy !== "All Studies"
                ? selectedStudy
                : ""
            }
          />
        </div>

        <div className="alerts-actions-grid">
          <div className="pi-section alerts-card">
            <h3>Alerts &amp; Notifications ({dynamicAlerts.length})</h3>

            <div className="alerts-list">
              {dynamicAlerts.map((alert, index) => (
                <div
                  key={`${alert.title}-${index}`}
                  className="alert-item pi-alert-clickable"
                  onClick={() => handleAlertClick(alert)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAlertClick(alert);
                    }
                  }}
                >
                  <div className="alert-left">
                    <div className={`alert-icon ${alert.type}`}>
                      {getAlertIcon(alert.type)}
                    </div>

                    <div>
                      <div className="alert-title-row">
                        <h4>{alert.title}</h4>

                        {alert.priority && (
                          <span
                            className={`pi-priority-badge ${alert.priority.toLowerCase()}`}
                          >
                            <FaClipboardList
                              className="alert-field-icon"
                              aria-hidden="true"
                            />
                            {alert.priority}
                          </span>
                        )}
                      </div>

                      <p>{alert.message}</p>
                    </div>
                  </div>

                  <span className="alert-date">
                    <FaClock className="alert-field-icon" aria-hidden="true" />
                    {alert.date}
                  </span>
                </div>
              ))}

              <div
                className="view-alerts-link"
                onClick={() => setShowAlertsModal(true)}
                role="button"
                tabIndex={0}
              >
                View All Alerts →
              </div>
            </div>
          </div>

          <div className="pi-section quick-actions-card">
            <h3>Quick Actions</h3>

            <div className="quick-actions">
              {quickActionsData.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="action-card"
                  onClick={item.action}
                  role="button"
                  tabIndex={0}
                >
                  <div className="action-icon">{item.icon}</div>
                  <p>{item.title}</p>
                  <span className="action-count">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showVisitModal && (
          <div className="study-modal-overlay">
            <div className="study-modal">
              <h3>Schedule Visit</h3>

              <input
                type="text"
                placeholder="Subject ID"
                value={newVisit.subject}
                onChange={(event) =>
                  setNewVisit({
                    ...newVisit,
                    subject: event.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Visit Name"
                value={newVisit.visit}
                onChange={(event) =>
                  setNewVisit({
                    ...newVisit,
                    visit: event.target.value,
                  })
                }
              />

              <input
                type="date"
                value={newVisit.date}
                onChange={(event) =>
                  setNewVisit({
                    ...newVisit,
                    date: event.target.value,
                  })
                }
              />

              <div className="modal-buttons">
                <button onClick={() => setShowVisitModal(false)}>Cancel</button>

                <button onClick={handleAddVisit}>Save Visit</button>
              </div>
            </div>
          </div>
        )}

        {showQueryModal && (
          <div className="study-modal-overlay">
            <div className="study-modal">
              <h3>Create Query</h3>

              <input
                type="text"
                placeholder="Query ID"
                value={newQuery.id}
                onChange={(event) =>
                  setNewQuery({
                    ...newQuery,
                    id: event.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Subject ID"
                value={newQuery.subject}
                onChange={(event) =>
                  setNewQuery({
                    ...newQuery,
                    subject: event.target.value,
                  })
                }
              />

              <select
                value={newQuery.status}
                onChange={(event) =>
                  setNewQuery({
                    ...newQuery,
                    status: event.target.value,
                  })
                }
              >
                <option>Open</option>
                <option>Answered</option>
                <option>Closed</option>
              </select>

              <div className="modal-buttons">
                <button onClick={() => setShowQueryModal(false)}>Cancel</button>

                <button onClick={handleAddQuery}>Save Query</button>
              </div>
            </div>
          </div>
        )}

        {showAlertsModal && (
          <div className="study-modal-overlay">
            <div className="study-modal">
              <h3>All Alerts</h3>

              {dynamicAlerts.map((alert, index) => (
                <div
                  key={`${alert.title}-modal-${index}`}
                  className="pi-alert-modal-item"
                >
                  <div className="alert-title-row">
                    <strong>{alert.title}</strong>

                    {alert.priority && (
                      <span
                        className={`pi-priority-badge ${alert.priority.toLowerCase()}`}
                      >
                        {alert.priority}
                      </span>
                    )}
                  </div>

                  <p>{alert.message}</p>
                  <small>{alert.date}</small>
                </div>
              ))}

              <button
                className="close-alert-btn"
                onClick={() => setShowAlertsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!embeddedInLayout && (
          <button
            type="button"
            className="floating-chat-btn"
            onClick={() =>
              navigate("/pi-livechat", {
                state: { from: "/pi-dashboard" },
              })
            }
            aria-label="Open live chat"
          >
            <FiMessageSquare size={40} />
          </button>
        )}
      </div>
    );
  };

  if (embeddedInLayout) {
    return renderPageContent(selectedPage);
  }

  return (
    <div className="pi-dashboard-wrapper">
      <PINavbar
        setSelectedPage={setSelectedPage}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onProfileNavigate={(view) => setSettingsView(view || "security")}
      />

      <div className="pi-dashboard-layout">
        <PISidebar
          selectedPage={selectedPage}
          setSelectedPage={setSelectedPage}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="pi-dashboard-content">{renderPageContent()}</div>
      </div>

      {showCommentModal && (
        <PICommentModal onClose={() => setShowCommentModal(false)} />
      )}
    </div>
  );
}

export default PIDashboard;
