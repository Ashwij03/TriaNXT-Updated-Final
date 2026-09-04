import { readJson } from "../utils/storageHelpers";
import { getAllSubjects } from "./subjectService";
import { DEFAULT_ADMIN_CONFIG } from "../config/defaultAdmin";
// UPDATED: Central admin data service — localStorage-backed, fully dynamic (no default/seed data)

import { getStudies, getRecentActivityLogs, getStudyByCode } from "./studyService";
import {
  filterBySite,
  getAssignedSite,
  getCurrentUser,
  isAdmin
} from "./roleService";
import { getSiteNumberDirectory } from "./filterService";
import {
  getFilteredSchedules,
  getMergedSchedules,
  getUpcomingVisitsWindow
} from "./visitScheduleService";
import { isOpenComment } from "./commentService";
import { getPendingAccessRequests } from "./accessPermissionService";
import {
  getNotificationsForUser,
  markNotificationRead as markSharedNotificationRead,
  markAllNotificationsReadForUser,
  NOTIFICATIONS_UPDATED
} from "./notificationService";
import { getCanonicalSubjectStatus } from "../utils/subjectLifecycle";
import {
  SUBJECT_ENROLLED_STAGES,
  isEnrolledSubjectStatus,
  isInScreeningSubjectStatus
} from "../utils/normalizeStatus";
import { assertCanApproveUser } from "./subscriptionGuard";

// UPDATED: queries storage key renamed to comments (legacy "queries" key migrated on read)
const STORAGE_KEYS = {
  sites: "sites",
  comments: "comments",
  schedules: "adminSchedules",
  notifications: "notifications",
  settings: "adminSettings",
  sitePerformance: "sitePerformance",
  recruitment: "recruitment",
  regulatory: "adminRegulatory",
  reports: "adminReports",
  compliance: "adminCompliance",
  trainingLogs: "trainingLogs",
  delegationLogs: "delegationLogs",
  siteVisitLogs: "siteVisitLogs",
  ntfLogs: "ntfLogs",
  miscellaneousLogs: "miscellaneousLogs",
  aeLogs: "aeLogs",
  pdLogs: "pdLogs",
  tempLogs: "tempLogs"
};

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent("admin-data-updated", {
        detail: { key }
      })
    );
  } catch {
    // Swallow storage write failures (e.g. quota exceeded) rather than
    // crashing the caller; data simply will not persist for this write.
  }
}

function getAllSubjectsFlat() {
  try {
    return getAllSubjects().map((subject) => ({
      ...subject,
      studyKey: subject.studyId,
      subjectId: subject.subjectId || subject.id
    }));
  } catch {
    return [];
  }
}

function normalizeRelationshipValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function resolveStudyForSubject(subject, studies) {
  const studyReference = subject?.studyId || subject?.studyKey;

  if (!studyReference) {
    return null;
  }

  const normalizedReference = normalizeRelationshipValue(studyReference);

  return (
    studies.find((study) =>
      [study.code, study.studyId, study.id].some(
        (value) => normalizeRelationshipValue(value) === normalizedReference
      )
    ) || null
  );
}

function resolveSiteForSubject(subject, sites) {
  const siteReference = subject?.siteId || subject?.siteNumber || subject?.site;

  if (!siteReference) {
    return null;
  }

  const normalizedReference = normalizeRelationshipValue(siteReference);

  return (
    sites.find((site) =>
      [site.siteNumber, site.id, site.name].some(
        (value) => normalizeRelationshipValue(value) === normalizedReference
      )
    ) || null
  );
}

// UPDATED: migrate legacy localStorage key from "queries" to "comments"
function migrateLegacyQueriesStorage() {
  if (typeof window === "undefined") {
    return;
  }

  const legacy = localStorage.getItem("queries");
  const current = localStorage.getItem(STORAGE_KEYS.comments);

  if (legacy && !current) {
    localStorage.setItem(STORAGE_KEYS.comments, legacy);
  }
}

// Task 7 — Registration Changes: Admin is no longer a selectable role on
// the Registration page, so the app must guarantee a working Admin
// account always exists. This seeds the default Admin (using the
// configurable credentials in src/config/defaultAdmin.js) keyed on its
// email address. If the default admin record is missing, it's created;
// if it already exists but its credentials have drifted from the current
// config (e.g. defaultAdmin.js was edited), it's updated in place so the
// configured credentials always work. Any *other* Admin account (a
// different email) is left untouched.
function seedDefaultAdminAccount() {
  if (typeof window === "undefined") {
    return;
  }

  const users = readJson("users", []);
  const existingIndex = users.findIndex(
    (user) => user.email === DEFAULT_ADMIN_CONFIG.email
  );

  if (existingIndex >= 0) {
    const existing = users[existingIndex];
    const needsSync =
      existing.password !== DEFAULT_ADMIN_CONFIG.password ||
      existing.name !== DEFAULT_ADMIN_CONFIG.name ||
      existing.username !== DEFAULT_ADMIN_CONFIG.username ||
      existing.role !== "Admin";

    if (!needsSync) {
      return;
    }

    const nextUsers = [...users];
    nextUsers[existingIndex] = {
      ...existing,
      password: DEFAULT_ADMIN_CONFIG.password,
      name: DEFAULT_ADMIN_CONFIG.name,
      username: DEFAULT_ADMIN_CONFIG.username,
      role: "Admin",
      approvalStatus: "Approved",
      accountStatus: "Active",
    };

    writeJson("users", nextUsers);
    return;
  }

  const nextUsers = [
    ...users,
    {
      id: Date.now(),
      email: DEFAULT_ADMIN_CONFIG.email,
      password: DEFAULT_ADMIN_CONFIG.password,
      name: DEFAULT_ADMIN_CONFIG.name,
      username: DEFAULT_ADMIN_CONFIG.username,
      organizationName: "",
      orgType: "",
      role: "Admin",
      assignedSite: "",
      approvalStatus: "Approved",
      accountStatus: "Active",
      permissions: ["*"],
      requestedPermissions: [],
      permissionRequestDate: null,
      lastPermissionUpdate: null,
    },
  ];

  writeJson("users", nextUsers);
}

// UPDATED: No more default/seed data of any kind. This now only performs the
// one-time legacy key migration so existing real data keeps working; it no
// longer manufactures sites, comments, schedules, reports, training logs,
// delegation logs, or any other demo records. Every getter below reads
// whatever is actually in localStorage and returns an empty array/object
// when nothing has been created yet.
//
// UPDATED (Task 7): also guarantees a default Admin account exists, since
// Admin registration has been removed from the Registration page.
export function initializeAdminData() {
  migrateLegacyQueriesStorage();
  seedDefaultAdminAccount();
}

export function getUsers() {
  return readJson("users", []);
}

export function getPendingSignupRequests() {
  return getUsers().filter((user) => user.approvalStatus === "Pending");
}

export function approveSignupRequest(email) {
  assertCanApproveUser();
  const users = readJson("users", []);
  let updatedUser = null;

  const nextUsers = users.map((user) => {
    if (user.email !== email) {
      return user;
    }

    updatedUser = {
      ...user,
      approvalStatus: "Approved",
      accountStatus: "Active"
    };

    return updatedUser;
  });

  writeJson("users", nextUsers);
  return updatedUser;
}

export function rejectSignupRequest(email) {
  const users = readJson("users", []);
  let updatedUser = null;

  const nextUsers = users.map((user) => {
    if (user.email !== email) {
      return user;
    }

    updatedUser = {
      ...user,
      approvalStatus: "Rejected",
      accountStatus: "Inactive"
    };

    return updatedUser;
  });

  writeJson("users", nextUsers);
  return updatedUser;
}

// UPDATED: Sites are no longer read from a phantom "sites" storage key that
// nothing in the app ever writes to. They are derived from two real sources
// of truth the user actually enters data into:
//   1. Registration — Admin/PI/SiteStaff users register under a hospital
//      "Organization Type", stored as user.assignedSite. Each distinct
//      hospital name is a real clinical site.
//   2. Studies — every study records a site/location string even when no
//      user has registered under that name yet.
// Enrollment counts then roll up from real subject records so the numbers
// stay accurate as subjects are added/removed, with no fabricated data.
const SITE_BASED_ROLES = ["Admin", "PI", "SiteStaff"];

function normalizeSiteKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function deriveSiteRecords() {
  const users = readJson("users", []);
  const studies = getStudies();
  const subjects = getAllSubjectsFlat();
  const siteMap = new Map();

  const ensureSite = (rawName) => {
    const name = String(rawName || "").trim();
    if (!name) return null;

    const key = normalizeSiteKey(name);
    if (!siteMap.has(key)) {
      siteMap.set(key, {
        name,
        location: name,
        pi: "",
        subjectsEnrolled: 0,
        hasActiveStudy: false,
        hasCompletedStudy: false,
        hasStudy: false
      });
    }
    return siteMap.get(key);
  };

  // 1. Registration-derived sites.
  users
    .filter(
      (user) => SITE_BASED_ROLES.includes(user.role) && user.assignedSite
    )
    .forEach((user) => {
      const site = ensureSite(user.assignedSite);
      if (site && user.role === "PI" && !site.pi) {
        site.pi = user.name || "";
      }
    });

  // 2. Study-derived sites.
  studies.forEach((study) => {
    const site = ensureSite(study.site || study.location);
    if (!site) return;

    site.hasStudy = true;

    if (!site.pi && study.principalInvestigator) {
      site.pi = study.principalInvestigator;
    }

    if (study.status === "Completed") {
      site.hasCompletedStudy = true;
    } else {
      site.hasActiveStudy = true;
    }
  });

  // 3. Real enrollment counts, rolled up per site from actual subjects.
  subjects.forEach((subject) => {
    const site = ensureSite(subject.site || subject.siteNumber);
    if (site) {
      site.subjectsEnrolled += 1;
    }
  });

  return Array.from(siteMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((site, index) => {
      const id = `SITE-${String(index + 1).padStart(3, "0")}`;
      let status = "Active";

      if (site.hasStudy && !site.hasActiveStudy && site.hasCompletedStudy) {
        status = "Completed";
      }

      return {
        id,
        siteNumber: id,
        name: site.name,
        location: site.location,
        pi: site.pi || "—",
        subjectsEnrolled: site.subjectsEnrolled,
        status
      };
    });
}

export function getSites(user = getCurrentUser()) {
  initializeAdminData();
  const sites = deriveSiteRecords();
  return isAdmin(user) ? sites : filterBySite(sites, "name", user);
}

export function saveSites(sites) {
  writeJson(STORAGE_KEYS.sites, sites);
}

// Comments are fully implemented — getComments() returns site-filtered comment records
export function getComments(user = getCurrentUser()) {
  initializeAdminData();
  const comments = readJson(STORAGE_KEYS.comments, []);
  return filterBySite(comments, "site", user);
}

export function saveComments(comments) {
  writeJson(STORAGE_KEYS.comments, comments);
}

/** @deprecated Renamed to getComments — kept for backward compatibility */
export function getQueries() {
  return getComments();
}

/** @deprecated Renamed to saveComments — kept for backward compatibility */
export function saveQueries(comments) {
  saveComments(comments);
}

export function getSchedules(user = getCurrentUser(),filterOptions: any = {}) {
  initializeAdminData();
  return getFilteredSchedules(user, filterOptions);
}

export function getAllSchedules(user = getCurrentUser()) {
  initializeAdminData();
  return getMergedSchedules(user);
}

// UPDATED: Admin no longer keeps its own parallel notifications array.
// getNotificationsForUser() reads the same shared "notifications" key that
// CRO/Sponsor/PI notifications use, scoped to the current admin user, so a
// notification created by any role/action shows up here without a separate
// admin-only copy of the data.
export function getNotifications() {
  return getNotificationsForUser(getCurrentUser());
}

// Kept as an alias of the shared event so existing imports of
// ADMIN_NOTIFICATIONS_EVENT / dispatchAdminNotificationsUpdated keep working,
// while actually dispatching the one shared event every role listens for.
export const ADMIN_NOTIFICATIONS_EVENT = NOTIFICATIONS_UPDATED;

export function dispatchAdminNotificationsUpdated() {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED));
}

export function markNotificationRead(notificationId) {
  return markSharedNotificationRead(notificationId, getCurrentUser());
}

export function markNotificationUnread(notificationId) {
  const user = getCurrentUser();
  const visibleIds = new Set<any>(
    getNotificationsForUser(user).map((item) => item.id)
  );

  if (!visibleIds.has(notificationId)) {
    return getNotificationsForUser(user);
  }

  const all = readJson(STORAGE_KEYS.notifications, []);
  const target = all.find((item) => item.id === notificationId);

  if (!target || !target.read) {
    return getNotificationsForUser(user);
  }

  const updated = all.map((item) =>
    item.id === notificationId ? { ...item, read: false } : item
  );
  writeJson(STORAGE_KEYS.notifications, updated);
  dispatchAdminNotificationsUpdated();
  return getNotificationsForUser(user);
}

export function markAllNotificationsRead() {
  return markAllNotificationsReadForUser(getCurrentUser());
}

export function getSettings() {
  initializeAdminData();
  return readJson(STORAGE_KEYS.settings, {});
}

export function saveSettings(settings) {
  writeJson(STORAGE_KEYS.settings, settings);
}

export function getSitePerformance(user = getCurrentUser()): any[] {
  initializeAdminData();

  const sites = getSites(user);
  const studies = getStudies();
  const subjects = getAllSubjectsFlat();
  const comments = getComments();
  const schedules = getMergedSchedules(user);

  const passedScreeningStages = ["Enrolled", "Ongoing", "Completed"];

  const records = sites.map((site) => {
    const siteKey = normalizeSiteKey(site.name);

    const siteStudies = studies.filter(
      (study) => normalizeSiteKey(study.site || study.location) === siteKey
    );
    const siteSubjects = subjects.filter(
      (subject) => normalizeSiteKey(subject.site || subject.siteNumber) === siteKey
    );
    const siteComments = comments.filter(
      (comment) => normalizeSiteKey(comment.site) === siteKey
    );
    const siteSchedules = schedules.filter(
      (schedule) => normalizeSiteKey(schedule.site) === siteKey
    );

    const enrollmentTarget = siteStudies.reduce(
      (sum, study) => sum + Number(study.targetSubjects || 0),
      0
    );

    const statusedSubjects = siteSubjects
      .map((subject) =>
        getCanonicalSubjectStatus(subject, {
          studyId: subject.studyId || subject.studyKey
        })
      )
      .filter(Boolean);

    const screeningRate = statusedSubjects.length
      ? Math.round(
          (statusedSubjects.filter((status) =>
            passedScreeningStages.includes(status)
          ).length /
            statusedSubjects.length) *
            100
        )
      : 0;

    const completedVisits = siteSchedules.filter(
      (schedule) => String(schedule.status || "").toLowerCase() === "completed"
    ).length;

    const visitCompliance = siteSchedules.length
      ? Math.round((completedVisits / siteSchedules.length) * 100)
      : 0;

    const resolvedComments = siteComments.filter(
      (comment) => comment.resolvedAt && comment.createdAt
    );

    const commentResolutionDays = resolvedComments.length
      ? Math.round(
          resolvedComments.reduce((sum, comment) => {
            const created = new Date(comment.createdAt).getTime();
            const resolved = new Date(comment.resolvedAt).getTime();
            const days = (resolved - created) / (1000 * 60 * 60 * 24);
            return sum + (Number.isFinite(days) ? Math.max(days, 0) : 0);
          }, 0) / resolvedComments.length
        )
      : "—";

    return {
      siteName: site.name,
      siteNumber: site.siteNumber,
      enrolled: site.subjectsEnrolled,
      enrollmentTarget,
      screeningRate,
      visitCompliance,
      commentResolutionDays
    };
  });

  return isAdmin(user)
    ? records
    : records.filter((item) => {
        const assignedSite = getAssignedSite(user);
        if (!assignedSite) return true;
        return (
          item.siteName === assignedSite ||
          item.siteName?.includes(assignedSite)
        );
      });
}

export function getTrainingLogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.trainingLogs, []);
  return filterBySite(logs, "site", user);
}

export function getDelegationLogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.delegationLogs, []);
  return filterBySite(logs, "site", user);
}

// ---- Site Visit / NTF / Miscellaneous logs ----
// Same localStorage-backed pattern as Training/Delegation logs: the
// getters read the persisted arrays (site-scoped for non-admin roles)
// and the savers persist the full array back through the shared
// writeJson helper, keeping every log in sync with the app's existing
// logs data/service pattern. No seed/demo data is manufactured — the
// arrays simply start empty until the first record is added.

export function getSiteVisitLogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.siteVisitLogs, []);
  return filterBySite(logs, "site", user);
}

export function saveSiteVisitLogs(logs) {
  writeJson(STORAGE_KEYS.siteVisitLogs, logs);
}

export function getNTFLogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.ntfLogs, []);
  return filterBySite(logs, "site", user);
}

export function saveNTFLogs(logs) {
  writeJson(STORAGE_KEYS.ntfLogs, logs);
}

export function getMiscellaneousLogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.miscellaneousLogs, []);
  return filterBySite(logs, "site", user);
}

export function saveMiscellaneousLogs(logs) {
  writeJson(STORAGE_KEYS.miscellaneousLogs, logs);
}

// ---- Task 2A (Ramya): AE/SE, PD and Temperature logs. These follow the
// exact same localStorage-backed pattern as getTrainingLogs /
// getDelegationLogs above: read from the storage key, then scope to the
// viewer's assigned site. The save functions persist the full array (add /
// edit / delete all go through the StudyLogsTab handlers, which write the
// updated array back here so changes survive refresh/remount). ----
export function getAELogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.aeLogs, []);
  return filterBySite(logs, "site", user);
}

export function saveAELogs(logs) {
  writeJson(STORAGE_KEYS.aeLogs, logs);
}

export function getPDLogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.pdLogs, []);
  return filterBySite(logs, "site", user);
}

export function savePDLogs(logs) {
  writeJson(STORAGE_KEYS.pdLogs, logs);
}

export function getTempLogs(user = getCurrentUser()) {
  initializeAdminData();
  const logs = readJson(STORAGE_KEYS.tempLogs, []);
  return filterBySite(logs, "site", user);
}

export function saveTempLogs(logs) {
  writeJson(STORAGE_KEYS.tempLogs, logs);
}

export function getStudyLogs(studyCode, user = getCurrentUser()) {
  initializeAdminData();

  const study = getStudyByCode(studyCode);
  const studySite = study?.site || study?.location || "";
  const normalizedCode = String(studyCode);

  // D2 (Activity Access Control): match this study's audit entries first,
  // then restrict to the viewer's authorized site scope. isAdmin bypasses
  // this (broad authorized visibility); Site Staff/PI only see entries
  // whose recorded site matches their assigned site — preventing Site A
  // activity from leaking into a Site B user's view of a shared study.
  // Entries with no recorded site (legacy data) remain visible, matching
  // filterBySite's existing behavior used across the rest of the app.
  const matchedAuditLogs = getRecentActivityLogs(50).filter(
    (log) =>
      String(log.studyCode) === normalizedCode ||
      String(log.studyName) === normalizedCode
  );

  const auditLogs = filterBySite(matchedAuditLogs, "site", user).map(
    (log) => ({
      id: `AUD-${log.id}`,
      type: "Audit",
      action: log.action || "System activity",
      user: log.deletedBy || log.user || "System",
      // BUG-5.5: this row represents a historical audit/activity event.
      // It must display the site that was recorded on the event itself,
      // never the study's current live site — falling back to studySite
      // here would make a past entry's site silently change whenever the
      // study's site is edited later.
      site: log.site || "",
      timestamp: log.timestamp
        ? new Date(log.timestamp).toLocaleString()
        : "—",
      status: "Recorded"
    })
  );

  const trainingLogs = getTrainingLogs(user)
    .filter(
      (log) =>
        !studySite ||
        log.site === studySite ||
        String(log.site).includes(studySite)
    )
    .map((log) => ({
      id: log.id,
      type: "Training",
      action: log.training,
      user: log.delegates || "—",
      site: log.site || studySite || "",
      timestamp: "—",
      status: log.status || "Active"
    }));

  const delegationLogs = getDelegationLogs(user)
    .filter(
      (log) =>
        !studySite ||
        log.site === studySite ||
        String(log.site).includes(studySite)
    )
    .map((log) => ({
      id: log.id,
      type: "Delegation",
      action: log.description || log.duty,
      user: log.delegateName || "—",
      site: log.site || studySite || "",
      timestamp: log.effectivePeriod || "—",
      status: log.status || "Active"
    }));

  return [...auditLogs, ...trainingLogs, ...delegationLogs];
}

// UPDATED: Recruitment is no longer read from a phantom "recruitment"
// storage key that nothing in the app ever writes to. Each study is treated
// as a recruitment source, and its screened/enrolled/conversion numbers are
// derived live from the real subjects recorded against that study — the
// same canonical lifecycle status used by Site Performance — so the funnel
// stays accurate as subjects are added, screened, and enrolled.
// Single source of truth for what counts as an enrolled subject lives in
// shared/utils/normalizeStatus (SUBJECT_ENROLLED_STAGES) — every surface
// (CRO, Sponsor, Site Staff/Admin) decides against the same canonical list.
const PASSED_SCREENING_STAGES = SUBJECT_ENROLLED_STAGES;

export function getRecruitment(user = getCurrentUser()) {
  initializeAdminData();

  const studies = getStudies();
  const subjects = getAllSubjectsFlat();

  const records = studies
    .map((study) => {
      const studySubjects = subjects.filter((subject) => {
        const reference = subject.studyId || subject.studyKey;
        if (!reference) return false;

        return [study.code, study.studyId, study.id].some(
          (value) =>
            normalizeRelationshipValue(value) ===
            normalizeRelationshipValue(reference)
        );
      });

      const statusedSubjects = studySubjects
        .map((subject) =>
          getCanonicalSubjectStatus(subject, {
            studyId: subject.studyId || subject.studyKey
          })
        )
        .filter(Boolean);

      const screened = statusedSubjects.length;
      const enrolled = statusedSubjects.filter((status) =>
        PASSED_SCREENING_STAGES.includes(status)
      ).length;
      const conversionRate = screened
        ? Math.round((enrolled / screened) * 100)
        : 0;

      return {
        source: study.name || study.protocol || study.code || "—",
        site: study.site || study.location || "—",
        screened,
        enrolled,
        conversionRate
      };
    })
    .filter((record) => record.screened > 0);

  return filterBySite(records, "site", user);
}

export function getRegulatoryDocs(user = getCurrentUser()) {
  initializeAdminData();
  const docs = readJson(STORAGE_KEYS.regulatory, []);
  return filterBySite(docs, "site", user);
}

export function getReports() {
  initializeAdminData();
  return readJson(STORAGE_KEYS.reports, []);
}

// UPDATED: Compliance score is derived entirely from real stored data — no
// hardcoded baseline. The Regulatory section (and its docs) has been
// removed from the app, so this no longer factors in regulatory doc
// status; it's based solely on open comments. Returns "—" when there are
// no comments recorded yet, instead of a fabricated percentage.
export function getComplianceScore() {
  initializeAdminData();

  const comments = getComments();

  if (comments.length === 0) {
    return "—";
  }

  const openComments = comments.filter(isOpenComment).length;

  const score = Math.max(0, Math.min(100, 100 - openComments));

  return `${score}%`;
}

export function getAdminDashboardData(filters: any = "") {
  // Backward/forward compatible: accept either a plain institution-name
  // string (legacy call shape) or a filters object covering every header
  // dropdown that applies to this page (institution, indication, siteNumber,
  // studyCode).
  const {
    institution = "",
    indication = "",
    siteNumber = "",
    studyCode = ""
  } = typeof filters === "string" ? { institution: filters } : filters || {};

  initializeAdminData();

  const allUsers = getUsers();
  const allStudies = getStudies();
  const allSites = getSites();
  const allComments = getComments();
  const allSchedules = getSchedules();

  // The "Site Number" dropdown identifies a site by its number/id rather
  // than its display name, but every other record in this file (users,
  // studies, comments, schedules) is only ever tagged with the site's
  // *name*. Resolve the chosen site number back to that name so it can
  // feed into the same name-based filtering everything else already uses.
  const siteNumberInstitution = siteNumber
    ? getSiteNumberDirectory().find(
        (entry) => String(entry.number) === String(siteNumber)
      )?.name || ""
    : "";

  const effectiveInstitution = institution || siteNumberInstitution;

  // Indication and Study Number narrow things down at the *study* level
  // first. Whatever site(s) the matching studies run at then become the
  // effective site filter for users/sites/comments/schedules, the same way
  // an explicit Institution selection already does.
  let indicationSites = null;

  if (indication || studyCode) {
    const matchingStudies = allStudies.filter((study) => {
      const matchesIndication =
        !indication || (study.indication || "General") === indication;
      const matchesStudyCode =
        !studyCode || String(study.code) === String(studyCode);
      return matchesIndication && matchesStudyCode;
    });

    indicationSites = new Set<any>(
      matchingStudies.map((study) => study.site).filter(Boolean)
    );
  }

  const matchesEffectiveInstitution = (value) =>
    !effectiveInstitution ||
    value === effectiveInstitution ||
    String(value).includes(effectiveInstitution) ||
    effectiveInstitution.includes(String(value || ""));

  const matchesIndicationSites = (value) =>
    !indicationSites ||
    [...indicationSites].some(
      (siteName) =>
        value === siteName ||
        String(value).includes(siteName) ||
        siteName.includes(String(value || ""))
    );

  const passesSiteFilters = (value) =>
    matchesEffectiveInstitution(value) && matchesIndicationSites(value);

  const users = allUsers.filter((user) => passesSiteFilters(user.assignedSite));

  const studies = allStudies.filter((study) => {
    const matchesIndication =
      !indication || (study.indication || "General") === indication;
    const matchesStudyCode =
      !studyCode || String(study.code) === String(studyCode);

    return (
      matchesIndication &&
      matchesStudyCode &&
      passesSiteFilters(study.site)
    );
  });

  const sites = allSites.filter((site) =>
    passesSiteFilters(site.name || site.id)
  );

  const comments = allComments.filter((comment) =>
    passesSiteFilters(comment.site)
  );

  const schedules = allSchedules.filter((schedule) =>
    passesSiteFilters(schedule.site)
  );

  const pendingUsers = users.filter(
    (user) => user.approvalStatus === "Pending"
  );

  // UPDATED: no more fabricated fallback numbers (previously "index + 4")
  // when a study/site has no recorded enrollment yet — real values only,
  // defaulting to 0 rather than an invented figure.
  const studyData =
    studies.length > 0
      ? studies.slice(0, 6).map((study, index) => ({
          name: study.code || study.name || `Study ${index + 1}`,
          value: Number(study.enrolled || study.subjects || 0)
        }))
      : sites.slice(0, 5).map((site, index) => ({
          name: site.name || `Site ${index + 1}`,
          value: Number(site.subjectsEnrolled || 0)
        }));

  const auditActivities = getRecentActivityLogs(5).map((log) => ({
    id: `audit-${log.id}`,
    title: log.action || "System activity",
    description: log.studyName || log.studyCode || log.subjectId || "Audit log entry",
    time: log.timestamp
      ? new Date(log.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      : "Recently",
    type: "info"
  }));

  return {
    users,
    studies,
    sites,
    comments,
    schedules,
    pendingUsers,
    pendingAccessRequests: getPendingAccessRequests(),
    pieData: [
      {
        name: "Approved",
        value: Math.max(users.length - pendingUsers.length, 0)
      },
      {
        name: "Pending",
        value: pendingUsers.length
      }
    ],
    studyData,
    requestData: pendingUsers.map((user) => ({
      name: user.name || "N/A",
      email: user.email || "N/A",
      role: user.role || "N/A",
      status: user.approvalStatus || "Pending"
    })),
    complianceScore: getComplianceScore(),
    auditActivities
  };
}

export function getSiteStaffDashboardData(user = getCurrentUser()) {
  initializeAdminData();

  const assignedSite = getAssignedSite(user);
  const studies = getStudies();
  const sites = getSites(user);
  const subjects = getAllSubjectsFlat().filter((subject) => {
    if (isAdmin(user) || !assignedSite) {
      return true;
    }

    const subjectSite = subject.site || "";

    return (
      subjectSite === assignedSite ||
      subjectSite.includes(assignedSite) ||
      assignedSite.includes(subjectSite) ||
      !subjectSite
    );
  });

  const comments = getComments(user).filter(isOpenComment);
  const schedules = getSchedules(user);
  const today = new Date();

  const upcomingVisits = getUpcomingVisitsWindow(schedules, 7, today);

  const screeningCount = subjects.filter((s) =>
    isInScreeningSubjectStatus(s.status)
  ).length;

  // Canonical enrolled stages only (Enrolled/Ongoing/Completed, with raw
  // Active/Randomized aliases normalized in) — a "Screened" subject is not
  // enrolled, and a stored "Active" token counts the same as "Ongoing".
  const enrolledCount = subjects.filter((s) =>
    isEnrolledSubjectStatus(s.status)
  ).length;

  const subjectActivity = subjects.map((subject) => {
    const study = resolveStudyForSubject(subject, studies);
    const site = resolveSiteForSubject(subject, sites);
    const studyId = subject.studyId || subject.studyKey;

    return {
      id: `${studyId || "study"}-${subject.subjectId || subject.id}`,
      studyNumber: study?.code || "",
      siteNumber: site?.siteNumber || site?.id || subject.siteNumber || "",
      subjectId: subject.subjectId || subject.id,
      status: getCanonicalSubjectStatus(subject, { studyId }) || ""
    };
  });

  // UPDATED: recruitment/site totals are still real, dynamically-derived
  // fallbacks (used only when no subject records exist yet for this site) —
  // not fabricated demo numbers.
  return {
    screeningCount: screeningCount || getRecruitment(user).reduce((sum, r) => sum + Number(r.screened || 0), 0),
    enrolledCount: enrolledCount || getSites(user).reduce((sum, s) => sum + Number(s.subjectsEnrolled || 0), 0),
    upcomingVisitsCount: upcomingVisits.length,
    openCommentsCount: comments.length,
    upcomingVisits,
    subjectActivity,
    alerts: [
      {
        type: "warning",
        title: "Upcoming Visit",
        message: `${upcomingVisits.length} visits scheduled in the next 7 days`
      },
      {
        type: comments.length > 0 ? "danger" : "success",
        title: "Open Comments",
        message:
          comments.length > 0
            ? `${comments.length} comments require review`
            : "All comments are resolved"
      }
    ]
  };
}

export function getPIDashboardData() {
  initializeAdminData();

  const subjects = getAllSubjectsFlat();
  const comments = getComments().filter(isOpenComment);
  const schedules = getSchedules();
  const studies = getStudies();
  const totalTarget = studies.reduce(
    (sum, study) => sum + Number(study.targetSubjects || 0),
    0
  );
  const totalEnrolled = studies.reduce(
    (sum, study) => sum + Number(study.enrolled || 0),
    0
  );
  const activeSubjects = subjects.filter((s) =>
    String(s.status || "").toLowerCase().includes("active")
  ).length;

  const completedVisitCount = schedules.filter((s) => s.status === "Completed").length;

  // UPDATED: removed hardcoded fallback percentages ("92%", "88%") and the
  // hardcoded enrollment-target fallback (150). Metrics now reflect actual
  // stored data and show "—" when there is nothing yet to compute from.
  return {
    enrollmentCount: totalEnrolled,
    enrollmentTarget: totalTarget,
    activeSubjects: activeSubjects || totalEnrolled,
    pendingTasks: comments.length,
    overdueDocuments: 0,
    visitCompletion:
      schedules.length > 0
        ? `${Math.round((completedVisitCount / schedules.length) * 100)}%`
        : "—",
    consentRate: subjects.length
      ? `${Math.round((activeSubjects / subjects.length) * 100)}%`
      : "—",
    recentSubjects: subjects.slice(0, 5).map((s) => ({
      subjectId: s.subjectId || s.id,
      status: s.status || "Unknown",
      lastVisit: s.lastVisit || s.currentVisit || "N/A"
    })),
    upcomingVisits: getUpcomingVisitsWindow(schedules, 30).slice(0, 5).map((s) => ({
      subjectId: s.subjectId,
      visit: s.visit,
      date: s.date
    })),
    pendingComments: comments.slice(0, 5).map((c) => ({
      commentId: c.id,
      subjectId: c.subjectId,
      status: c.status
    })),
    schedules,
    alerts: [
      {
        type: "warning",
        title: "Pending Tasks",
        message: `${comments.length} open comments assigned to site`
      },
      {
        type: "info",
        title: "Upcoming Visit",
        message:
          schedules.find((s) => s.status === "Scheduled")?.visit ||
          "No scheduled visits"
      }
    ]
  };
}

export function getCRODashboardData() {
  initializeAdminData();

  const sites = getSites();
  const comments = getComments();
  const studies = getStudies();

  return {
    sites,
    studies,
    openComments: comments.filter(isOpenComment),
    sitePerformance: getSitePerformance(),
    alerts: [
      {
        type: "warning",
        title: "Monitoring Due",
        message: `${sites.filter((s) => s.status === "Active").length} active sites under monitoring`
      },
      {
        type: "danger",
        title: "Open Comments",
        message: `${comments.filter(isOpenComment).length} unresolved comments across sites`
      }
    ]
  };
}

export function getSponsorDashboardData() {
  initializeAdminData();

  const studies = getStudies();
  const sites = getSites();
  const reports = getReports();

  return {
    studies,
    sites,
    reports,
    portfolioValue: studies.length,
    activeSites: sites.filter((s) => s.status === "Active").length,
    complianceScore: getComplianceScore(),
    enrollmentTotal: studies.reduce(
      (sum, s) => sum + Number(s.enrolled || 0),
      0
    ),
    alerts: [
      {
        type: "info",
        title: "Portfolio Update",
        message: `${studies.length} studies in sponsor portfolio`
      },
      {
        type: "success",
        title: "Compliance",
        message: `Overall compliance score: ${getComplianceScore()}`
      }
    ]
  };
}

export function getSubjectsForAnalytics(user = getCurrentUser()) {
  const subjects = getAllSubjectsFlat();

  if (isAdmin(user)) {
    return subjects;
  }

  return filterBySite(subjects, "site", user);
}

// ---------------------------------------------------------------------------
// Task 6 (Ashwij) — Referral & Limited Free License Model.
// Additive only: everything above this line is unchanged.
//
// The R6 admin toggle ("does the referrer also earn 15 free days") rides on
// this file's existing getSettings()/saveSettings() key ("adminSettings")
// rather than a brand-new storage key, so no new plumbing/migration is
// needed here. referralService.js is the source of truth for reading and
// writing the nested `referralProgram` object; this wrapper exists purely
// for discoverability/consistency with the rest of this file's naming.
// ---------------------------------------------------------------------------

export function getReferralProgramSettings() {
  const settings = getSettings();
  return settings.referralProgram || { referrerBonusEnabled: false };
}