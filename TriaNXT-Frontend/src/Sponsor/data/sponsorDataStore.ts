import { getFilteredStudies } from "../../shared/services/filterService";
import { readJson } from "../../shared/utils/storageHelpers";

import {
  getNotifications as getAdminNotifications,
  markNotificationRead as markAdminNotificationRead,
  markAllNotificationsRead as markAllAdminNotificationsRead,
  getRecruitment as getAdminRecruitment,
  getRegulatoryDocs,
  getReports as getAdminReports,
  // getSitePerformance,
  // getSites as getAdminSites,
} from "../../shared/services/adminService";

import { getStudies } from "../../shared/services/studyService";
import { getSubjectsForStudy } from "../../shared/services/subjectService";
import { isEnrolledSubjectStatus } from "../../shared/utils/normalizeStatus";
import {
  getCurrentUser,
  restrictStudiesToUserScope,
  restrictSubjectsToUserScope,
} from "../../shared/services/roleService";

// A subject only counts toward a study's enrollment/recruitment when its
// canonical status is an enrolled stage (Enrolled/Ongoing/Completed — raw
// Active/Randomized tokens normalize in). Raw bucket size (which would also
// count Screened/Withdrawn subjects) is intentionally NOT used, so the
// Sponsor dashboard's enrollment numbers never disagree with the CRO or
// Site Staff surfaces reading the same subject store.
function countEnrolledSubjects(studyCode) {
  try {
    return getSubjectsForStudy(studyCode).filter((subject) =>
      isEnrolledSubjectStatus(subject?.status)
    ).length;
  } catch {
    return 0;
  }
}

// Item 8 (Stage 5A) statuses that represent an ongoing/active study:
// Startup, Recruitment Phase, and Conduct Phase. Kept in sync with the
// same list used on the Admin Dashboard (ONGOING_STUDY_STATUSES).
const ACTIVE_STUDY_STATUSES = [
  "Startup",
  "Recruitment Phase",
  "Conduct Phase",
];

const STORAGE_PREFIX = "sponsor_data_";
const SETTINGS_KEY = "sponsor_settings";
const SUBSCRIPTION_KEY = "sponsor_subscription";
const RISKS_KEY = `${STORAGE_PREFIX}risks`;

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));

  window.dispatchEvent(
    new CustomEvent("sponsor-data-updated", {
      detail: { key },
    }),
  );
}

function getSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getAdminSiteRecords() {
  return getSafeArray(readJson("sites", []));
}

function resolveAdminSiteByStudySite(study: any = {}) {
  const siteReference = study.site || study.location;

  if (!siteReference) {
    return null;
  }

  const normalizedReference = normalizeValue(siteReference);

  return (
    getAdminSiteRecords().find((site) =>
      [site.siteNumber, site.id, site.name].some(
        (value) => normalizeValue(value) === normalizedReference
      )
    ) || null
  );
}


function mapStudyToPortfolio(study: any = {}) {
  let enrolled = countEnrolledSubjects(study.code);

  return {
    studyId: study.code || study.studyId || study.id || "",
    studyName: study.name || study.studyName || "",
    phase: study.phase || "",
    status: study.status || "",
    cro: study.cro || study.croName || "",

    sites: Number(study.sites || study.siteCount || 0),

    // Dynamic subject count
    enrolled,

    target: Number(study.targetSubjects || study.target || 0),

    startDate: study.startDate || "",

    therapeuticArea: study.indication || study.therapeuticArea || "",
  };
}

export function getPortfolioStudies() {
  // RBAC scope_data parity: never surface a study outside the signed-in
  // user's assigned study/site codes, regardless of which upstream source
  // (header-filtered or raw) feeds the list.
  const user = getCurrentUser();
  const filteredStudies = restrictStudiesToUserScope(
    getSafeArray(getFilteredStudies(user)),
    user
  );

  if (filteredStudies.length > 0) {
    return filteredStudies.map(mapStudyToPortfolio);
  }

  const allStudies = restrictStudiesToUserScope(
    getSafeArray(getStudies()),
    user
  );
  return allStudies.map(mapStudyToPortfolio);
}

export function savePortfolioStudies(data) {
  writeJson(`${STORAGE_PREFIX}portfolioStudies`, data);
}

export function getOversightStudies() {
  return getPortfolioStudies().map((study) => {
    const progress =
      study.target > 0
        ? Math.min(Math.round((study.enrolled / study.target) * 100), 100)
        : 0;

    return {
      studyId: study.studyId,
      studyName: study.studyName,
      status:
        study.status === "Completed"
          ? "Completed"
          : progress >= 70
            ? "On Track"
            : study.enrolled > 0
              ? "Delayed"
              : "Planning",
      progress,
      enrollment: `${study.enrolled}/${study.target}`,
      milestone: study.status || "",
      nextReview: study.startDate || "",
    };
  });
}

export function saveOversightStudies(data) {
  writeJson(`${STORAGE_PREFIX}oversightStudies`, data);
}

export function getCROs() {
  const studies = getPortfolioStudies();
  const croMap = new Map();

  studies.forEach((study) => {
    if (!study.cro) {
      return;
    }

    const existing = croMap.get(study.cro) || {
      id: `CRO-${study.cro}`,
      name: study.cro,
      studies: 0,
      sites: 0,
      performance: 0,
      status: "Active",
      contact: "",
    };

    existing.studies += 1;
    existing.sites += Number(study.sites) || 0;

    croMap.set(study.cro, existing);
  });

  const recruitedCROs = readJson("sponsorRecruitedCROs", []);

  getSafeArray(recruitedCROs).forEach((cro) => {
    const croName = typeof cro === "string" ? cro : cro?.name;

    if (!croName || croMap.has(croName)) {
      return;
    }

    croMap.set(croName, {
      id: cro?.id || `CRO-${croName}`,
      name: croName,
      studies: Number(cro?.studies || 0),
      sites: Number(cro?.sites || 0),
      performance: Number(cro?.performance || 0),
      status: cro?.status || "Active",
      contact: cro?.contact || "",
    });
  });

  return Array.from(croMap.values());
}

export function saveCROs(data) {
  writeJson(`${STORAGE_PREFIX}cros`, data);
}

export function getSites(study?) {
  // Subject counts are now sourced from subjectService — "enrolled" means
  // canonical enrolled stages only, matching the rest of the app.
  function getEnrolledCount(studyCode) {
    return countEnrolledSubjects(studyCode);
  }

  // SCOPED MODE — used by the per-study Clinical Sites tab.
  // Studies that share the same Sponsor AND Indication as the currently
  // open study are treated as one group — their sites all appear
  // together here, so opening either study shows the combined set.
  // Each study's own Site/Hospital name (its "Site / Hospital" form
  // field, stored as study.site / study.location) is the site name.
  if (study && study.code) {
    const allStudies = getStudies();

    const normalize = (value) => String(value || "").trim().toLowerCase();

    const matchingStudies = allStudies.filter(
      (candidate) =>
        normalize(candidate.sponsor) === normalize(study.sponsor) &&
        normalize(candidate.indication) === normalize(study.indication),
    );

    // Fallback to just the current study if sponsor/indication are blank
    // and nothing matched.
    const studiesToShow =
      matchingStudies.length > 0 ? matchingStudies : [study];

    return studiesToShow.map((matchedStudy, index) => {
      const adminSite = resolveAdminSiteByStudySite(matchedStudy);

      const enrolled = getEnrolledCount(matchedStudy.code);

      const target = Number(matchedStudy.targetSubjects || 0);

      const siteName =
        matchedStudy.site ||
        matchedStudy.location ||
        matchedStudy.name ||
        "Unnamed Site";

      const siteNumber =
        matchedStudy.siteNumber ||
        matchedStudy.siteNo ||
        `SITE-${String(index + 1).padStart(3, "0")}`;

      return {
        id: adminSite?.id || index + 1,

        // Site Number is now a first-class field used by
        // operational/reference displays.
        siteNumber,

        // Preserve Site Name as separate master-data semantic field.
        siteName,

        // Legacy `name` retained for existing consumers (filters,
        // search text, etc.) — DO NOT drop.
        name: siteName,

        sponsor: matchedStudy.sponsor,

        account: matchedStudy.sponsor,

        country: matchedStudy.country,

        status: matchedStudy.status || "Active",

        enrolled,

        target,

        performance: target > 0 ? Math.round((enrolled / target) * 100) : 0,
      };
    });
  }

  // UNSCOPED MODE (unchanged) — used by portfolio-wide views like
  // Sponsor > Site Performance, which intentionally show every study.
  const studies = getStudies();

  return studies.map((singleStudy, index) => {
    const adminSite = resolveAdminSiteByStudySite(singleStudy);

    const enrolled = getEnrolledCount(singleStudy.code);

    const target = Number(singleStudy.targetSubjects || 0);

    const siteName =
      singleStudy.site || singleStudy.location || singleStudy.name;

    const siteNumber =
      singleStudy.siteNumber ||
      singleStudy.siteNo ||
      `SITE-${String(index + 1).padStart(3, "0")}`;

    return {
      id: adminSite?.id || singleStudy.code,

      siteNumber,

      siteName,

      name: siteName,

      sponsor: singleStudy.sponsor,

      account: singleStudy.sponsor,

      country: singleStudy.country,

      status: singleStudy.status || "Active",

      enrolled,

      target,

      performance: target > 0 ? Math.round((enrolled / target) * 100) : 0,
    };
  });
}

export function saveSites(data) {
  writeJson(`${STORAGE_PREFIX}sites`, data);
}

export function getRecruitment() {
  return getSafeArray(getAdminRecruitment()).map((item = {}) => ({
    id: item.id || "",
    study: item.study || item.studyCode || "",
    screened: Number(item.screened || 0),
    enrolled: Number(item.enrolled || 0),
    target: Number(item.target || 0),
    rate: Number(item.rate || 0),
    status: item.status || "",
  }));
}

export function saveRecruitment(data) {
  writeJson(`${STORAGE_PREFIX}recruitment`, data);
}

export function getRegulatory() {
  return getSafeArray(getRegulatoryDocs()).map((doc = {}) => ({
    id: doc.id || "",
    study: doc.study || doc.studyCode || "",
    document: doc.document || doc.name || "",
    status: doc.status || "",
    authority: doc.authority || "",
    dueDate: doc.dueDate || "",
    submittedDate: doc.submittedDate || "",
  }));
}

export function saveRegulatory(data) {
  writeJson(`${STORAGE_PREFIX}regulatory`, data);
}

export function getRisks() {
  return getSafeArray(readJson(RISKS_KEY, []));
}

export function saveRisks(data) {
  writeJson(RISKS_KEY, data);
}

export function getReports() {
  return getSafeArray(getAdminReports()).map((report = {}) => ({
    id: report.id || "",
    name: report.name || report.title || "",
    type: report.type || "",
    study: report.study || report.studyCode || "",
    generatedDate: report.generatedDate || report.date || "",
    status: report.status || "",
  }));
}

export function saveReports(data) {
  writeJson(`${STORAGE_PREFIX}reports`, data);
}

// Shared notification records (services/notificationService.js, written by
// every role's subject/visit/document/report/comment/permission actions)
// carry title/message/studyCode/createdAt/read -- not the type/severity/date
// shape this page expects. This map derives a severity from the record's
// title so the Critical/High/Medium/Low badges and filters here reflect
// something real instead of always being blank.
const NOTIFICATION_SEVERITY_BY_TITLE = {
  'Permission request submitted': 'High',
  'Permission request rejected': 'High',
  'Permission request approved': 'Medium',
  'Document added': 'Medium',
  'Report created': 'Medium',
  'Report updated': 'Medium',
  'Visit scheduled': 'Medium',
  'Visit updated': 'Medium',
  'Subject added': 'Low',
  'Subject updated': 'Low',
  'New comment': 'Low',
};

function formatSponsorNotificationDate(isoString) {
  const parsed = new Date(isoString);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getNotifications() {
  return getSafeArray(getAdminNotifications()).map((item = {}) => ({
    id: item.id || '',
    type: item.title || '',
    message: item.message || item.title || '',
    severity: NOTIFICATION_SEVERITY_BY_TITLE[item.title] || 'Medium',
    date: formatSponsorNotificationDate(item.createdAt),
    read: Boolean(item.read),
  }));
}

// Diffs the incoming (page-local, optimistic) items against the shared
// notification records and marks any newly-read ids through the shared
// service, so "read" actually persists instead of being written to a
// sponsor-only key that getNotifications() never reads back from.
export function saveNotifications(data) {
  const items = getSafeArray(data);

  const previouslyUnreadIds = new Set<any>(
    getSafeArray(getAdminNotifications())
      .filter((item) => !item.read)
      .map((item) => item.id)
  );

  items.forEach((item) => {
    if (item.read && previouslyUnreadIds.has(item.id)) {
      markAdminNotificationRead(item.id);
    }
  });
}

// Exposed for callers (e.g. a future "mark all read" action) that want to
// go through the shared service directly rather than diffing a full item
// list via saveNotifications().
export function markAllNotificationsRead() {
  markAllAdminNotificationsRead();
}

export function getAlerts() {
  const regulatoryKPIs = getRegulatoryKPIs();
  const recruitmentKPIs = getRecruitmentKPIs();
  const riskKPIs = getRiskKPIs();
  const notificationKPIs = getNotificationKPIs();
  const croKPIs = getCROKPIs();

  const alerts = [];

  if (regulatoryKPIs.overdue > 0) {
    alerts.push({
      id: "ALT-REG",
      message: `${regulatoryKPIs.overdue} regulatory document${
        regulatoryKPIs.overdue > 1 ? "s" : ""
      } overdue`,
      severity: "Critical",
      module: "Regulatory",
    });
  }

  if (recruitmentKPIs.belowTarget > 0) {
    alerts.push({
      id: "ALT-REC",
      message: `${recruitmentKPIs.belowTarget} ${
        recruitmentKPIs.belowTarget > 1 ? "studies" : "study"
      } below enrollment target`,
      severity: "High",
      module: "Recruitment",
    });
  }

  if (riskKPIs.open > 0) {
    alerts.push({
      id: "ALT-RISK",
      message: `${riskKPIs.open} open risk${
        riskKPIs.open > 1 ? "s" : ""
      } requiring attention`,
      severity: riskKPIs.critical > 0 ? "Critical" : "High",
      module: "Risk Management",
    });
  }

  if (notificationKPIs.unread > 0) {
    alerts.push({
      id: "ALT-NOT",
      message: `${notificationKPIs.unread} unread notification${
        notificationKPIs.unread > 1 ? "s" : ""
      }`,
      severity: notificationKPIs.critical > 0 ? "Critical" : "High",
      module: "Notifications",
    });
  }

  if (croKPIs.total > 0) {
    alerts.push({
      id: "ALT-CRO",
      message: `${croKPIs.active} active CRO partner${
        croKPIs.active > 1 ? "s" : ""
      }`,
      severity: "Medium",
      module: "CRO Oversight",
    });
  }

  return alerts;
}

export function saveAlerts(data) {
  writeJson(`${STORAGE_PREFIX}alerts`, data);
}

export function getQuickActions() {
  const kpis = getDashboardKPIs();

  return [
    {
      id: "QA-001",
      label: "Create Study",
      value: String(kpis.portfolio),
      subtitle: "Portfolio studies",
      icon: "study",
      color: "#2563eb",
      bg: "#eff6ff",
      route: "/studies",
    },
    {
      id: "QA-002",
      label: "Review Risks",
      value: String(kpis.risks),
      subtitle: "Open risks",
      icon: "risk",
      color: "#dc2626",
      bg: "#fee2e2",
      route: "/risk-management",
    },
    {
      id: "QA-003",
      label: "Generate Report",
      value: String(kpis.reports),
      subtitle: "Ready reports",
      icon: "report",
      color: "#7c3aed",
      bg: "#ede9fe",
      route: "/reports",
    },
    {
      id: "QA-004",
      label: "View Recruitment",
      value: `${kpis.recruitment}%`,
      subtitle: "Enrollment rate",
      icon: "recruitment",
      color: "#16a34a",
      bg: "#ecfdf5",
      route: "/recruitment",
    },
    {
      id: "QA-005",
      label: "CRO Dashboard",
      value: String(kpis.cros),
      subtitle: "Active CROs",
      icon: "cro",
      color: "#d97706",
      bg: "#fef3c7",
      route: "/cro-oversight",
    },
    {
      id: "QA-006",
      label: "Protocol Amendments",
      value: String(kpis.portfolio),
      subtitle: "Track amendment rollout",
      icon: "report",
      color: "#6d28d9",
      bg: "#ede9fe",
      route: "/amendments",
    },
    {
      id: "QA-007",
      label: "Site Feasibility",
      value: String(kpis.cros),
      subtitle: "Candidate site pipeline",
      icon: "study",
      color: "#0d9488",
      bg: "#ccfbf1",
      route: "/site-feasibility",
    },
    {
      id: "QA-008",
      label: "IP / Supply",
      value: String(kpis.portfolio),
      subtitle: "Product accountability",
      icon: "report",
      color: "#0369a1",
      bg: "#e0f2fe",
      route: "/ip-accountability",
    },
    {
      id: "QA-009",
      label: "IRB / IEC",
      value: String(kpis.studies),
      subtitle: "Committee submissions",
      icon: "documents",
      color: "#6d28d9",
      bg: "#ede9fe",
      route: "/irb-submissions",
    },
    {
      id: "QA-010",
      label: "ICF / eConsent",
      value: String(kpis.portfolio),
      subtitle: "ICF versions & re-consent",
      icon: "report",
      color: "#b45309",
      bg: "#fef3c7",
      route: "/icf-consent",
    },
    {
      id: "QA-011",
      label: "Vendors & Labs",
      value: String(kpis.cros),
      subtitle: "Vendor contracts & kits",
      icon: "cro",
      color: "#15803d",
      bg: "#dcfce7",
      route: "/vendor-management",
    },
  ];
}

export function saveQuickActions(data) {
  writeJson(`${STORAGE_PREFIX}quickActions`, data);
}

export function loadSettings() {
  const currentUser = readJson("currentUser", {});
  const storedSettings = readJson(SETTINGS_KEY, {});

  return {
    firstName: currentUser.firstName || "",
    lastName: currentUser.lastName || "",
    fullName: currentUser.name || "",
    employeeId: currentUser.employeeId || "",
    email: currentUser.email || "",
    phone: currentUser.phone || "",
    jobTitle: currentUser.jobTitle || "",
    department: currentUser.department || "",
    organization: currentUser.orgType || currentUser.organization || "",
    country: currentUser.country || "",
    timeZone: currentUser.timeZone || "",
    language: currentUser.language || "",
    profilePhoto: currentUser.profilePhoto || "",
    digitalSignature: currentUser.digitalSignature || "",
    emailAlerts: false,
    smsAlerts: false,
    criticalOnly: false,
    enrollmentAlerts: false,
    regulatoryAlerts: false,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorEnabled: false,
    sessionTimeout: false,
    defaultStudyView: "",
    dashboardRefresh: "",
    preferredTherapeuticArea: "",
    showCompletedStudies: false,
    theme: "",
    ...storedSettings,
  };
}

export function saveSettings(data) {
  writeJson(SETTINGS_KEY, data);
}

export function getSubscription() {
  return readJson(SUBSCRIPTION_KEY, {
    plan: "",
    status: "",
    startDate: "",
    endDate: "",
    maxUsers: "",
    maxStudies: "",
    storageLimit: "",
    autoRenewal: false,
    notes: "",
  });
}

export function saveSubscription(data) {
  writeJson(SUBSCRIPTION_KEY, data);
}

export function getAllSubjectsFromStorage() {
  const subjects = readJson("subjects", []);
  return restrictSubjectsToUserScope(getSafeArray(subjects), getCurrentUser());
}

export function syncQuickActionValues() {
  return getQuickActions();
}

export function getEnrollmentTrend() {
  return getPortfolioStudies()
    .slice(0, 6)
    .map((study, index) => ({
      month: study.studyId || `Study ${index + 1}`,
      enrolled: Number(study.enrolled || 0),
    }));
}

export function useSponsorDataRefresh(callback) {
  const handler = () => callback();

  window.addEventListener("sponsor-data-updated", handler);
  window.addEventListener("studies-updated", handler);
  window.addEventListener("subjects-updated", handler);
  window.addEventListener("reports-updated", handler);
  window.addEventListener("notifications-updated", handler);

  return () => {
    window.removeEventListener("sponsor-data-updated", handler);
    window.removeEventListener("studies-updated", handler);
    window.removeEventListener("subjects-updated", handler);
    window.removeEventListener("reports-updated", handler);
    window.removeEventListener("notifications-updated", handler);
  };
}

export function getDashboardKPIs() {
  const portfolio = getPortfolioStudies();
  const cros = getCROs();
  const risks = getRisks();
  const reports = getReports();
  const notifications = getNotifications();

  const activeStudies = portfolio.filter((study) =>
    ACTIVE_STUDY_STATUSES.includes(study.status),
  ).length;

  const totalEnrolled = portfolio.reduce(
    (sum, study) => sum + Number(study.enrolled || 0),
    0,
  );

  const totalTarget = portfolio.reduce(
    (sum, study) => sum + Number(study.target || 0),
    0,
  );

  return {
    portfolio: portfolio.length,
    studies: activeStudies,
    cros: cros.filter((cro) => cro.status === "Active").length,
    recruitment:
      totalTarget > 0 ? Math.round((totalEnrolled / totalTarget) * 100) : 0,
    recruitmentCount: totalEnrolled,
    risks: risks.filter((risk) => risk.status === "Open").length,
    reports: reports.filter((report) => report.status === "Ready").length,
    notifications: notifications.filter((notification) => !notification.read)
      .length,
    totalNotifications: notifications.length,
  };
}

export function getEnrollmentByStudy() {
  return getPortfolioStudies().map((study) => ({
    study: study.studyId,
    enrolled: Number(study.enrolled || 0),
  }));
}

export function getStudyStatusData() {
  const counts: Record<string, any> = {};;

  getPortfolioStudies().forEach((study) => {
    const status = study.status || "Unknown";
    counts[status] = (counts[status] || 0) + 1;
  });

  return Object.entries(counts).map(([name, value]) => ({
    name,
    value,
  }));
}

export function getPhaseDistribution() {
  const counts: Record<string, any> = {};;

  getPortfolioStudies().forEach((study) => {
    const phase = study.phase || "Unspecified";
    counts[phase] = (counts[phase] || 0) + 1;
  });

  return Object.entries(counts).map(([phase, studies]) => ({
    phase,
    studies,
  }));
}

export function getEnrollmentStatusPie() {
  let onTrack = 0;
  let belowTarget = 0;
  let completed = 0;

  getPortfolioStudies().forEach((study) => {
    const rate =
      study.target > 0
        ? (Number(study.enrolled) / Number(study.target)) * 100
        : 0;

    if (study.status === "Completed") {
      completed += 1;
    } else if (rate >= 70) {
      onTrack += 1;
    } else {
      belowTarget += 1;
    }
  });

  return [
    { name: "On Track", value: onTrack },
    { name: "Below Target", value: belowTarget },
    { name: "Completed", value: completed },
  ].filter((item) => item.value > 0);
}

export function getPortfolioKPIs() {
  const studies = getPortfolioStudies();

  return {
    total: studies.length,
    active: studies.filter((study) => study.status === "Active").length,
    recruiting: studies.filter((study) => study.status === "Recruiting").length,
    completed: studies.filter((study) => study.status === "Completed").length,
    planning: studies.filter((study) => study.status === "Planning").length,
  };
}

export function getOversightKPIs() {
  const studies = getOversightStudies();

  return {
    total: studies.length,
    onTrack: studies.filter((study) => study.status === "On Track").length,
    delayed: studies.filter((study) => study.status === "Delayed").length,
    completed: studies.filter((study) => study.status === "Completed").length,
  };
}

export function getCROKPIs() {
  const cros = getCROs();

  const averagePerformance =
    cros.length > 0
      ? Math.round(
          cros.reduce((sum, cro) => sum + Number(cro.performance || 0), 0) /
            cros.length,
        )
      : 0;

  return {
    total: cros.length,
    active: cros.filter((cro) => cro.status === "Active").length,
    avgPerformance: averagePerformance,
    totalStudies: cros.reduce((sum, cro) => sum + Number(cro.studies || 0), 0),
  };
}

export function getRecruitmentKPIs() {
  const recruitment = getRecruitment();

  const totalEnrolled = recruitment.reduce(
    (sum, item) => sum + Number(item.enrolled || 0),
    0,
  );

  const totalTarget = recruitment.reduce(
    (sum, item) => sum + Number(item.target || 0),
    0,
  );

  return {
    totalStudies: recruitment.length,
    enrolled: totalEnrolled,
    target: totalTarget,
    rate: totalTarget > 0 ? Math.round((totalEnrolled / totalTarget) * 100) : 0,
    belowTarget: recruitment.filter((item) => item.status === "Below Target")
      .length,
  };
}

export function getRegulatoryKPIs() {
  const regulatory = getRegulatory();

  return {
    total: regulatory.length,
    approved: regulatory.filter((item) => item.status === "Approved").length,
    inReview: regulatory.filter((item) => item.status === "In Review").length,
    submitted: regulatory.filter((item) => item.status === "Submitted").length,
    overdue: regulatory.filter((item) => item.status === "Overdue").length,
  };
}

export function getRiskKPIs() {
  const risks = getRisks();

  return {
    total: risks.length,
    critical: risks.filter((risk) => risk.severity === "Critical").length,
    high: risks.filter((risk) => risk.severity === "High").length,
    medium: risks.filter((risk) => risk.severity === "Medium").length,
    low: risks.filter((risk) => risk.severity === "Low").length,
    open: risks.filter((risk) => risk.status === "Open").length,
    resolved: risks.filter(
      (risk) => risk.status === "Closed" || risk.status === "Mitigated",
    ).length,
  };
}

export function getReportKPIs() {
  const reports = getReports();

  return {
    total: reports.length,
    ready: reports.filter((report) => report.status === "Ready").length,
    pending: reports.filter((report) => report.status === "Pending").length,
  };
}

export function getNotificationKPIs() {
  const notifications = getNotifications();

  return {
    total: notifications.length,
    critical: notifications.filter(
      (notification) => notification.severity === "Critical",
    ).length,
    high: notifications.filter(
      (notification) => notification.severity === "High",
    ).length,
    unread: notifications.filter((notification) => !notification.read).length,
    resolved: notifications.filter((notification) => notification.read).length,
  };
}

export function getSiteKPIs(study?) {
  const sites = getSites(study);

  const totalSites = sites.length;

  const totalEnrolled = sites.reduce((sum, site) => sum + site.enrolled, 0);

  const averagePerformance =
    totalSites > 0
      ? Math.round(
          sites.reduce((sum, site) => sum + site.performance, 0) / totalSites,
        )
      : 0;

  return {
    total: totalSites,
    totalEnrolled,
    avgPerformance: averagePerformance,
  };
}

export const SEVERITY_COLORS = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#ca8a04",
  Low: "#2563eb",
};