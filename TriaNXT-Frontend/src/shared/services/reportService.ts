// Shared reports data service.
//
// Single localStorage key holds every report record across every study;
// every record carries its own studyCode so callers must always scope
// reads/writes to a specific study (mirrors the pattern used by
// folderService/commentService — no cross-study leakage by construction).
//
// Write access (create/update/delete) follows the existing role design:
// Admin, Site Staff, and PI can manage reports directly. CRO and Sponsor
// can only view reports for studies they're accessible for, unless an
// approved permission scope exists for the specific action (reusing the
// existing accessPermissionService approval model rather than inventing a
// second one — see B8/B9 for the full permission-request workflow).
import ROLES from "../constants/roles";
import PERMISSIONS from "../constants/permissions";
import {
  getCurrentUser,
  getEffectiveRole,
  hasPermission,
  getAccessibleStudies,
} from "./roleService";
import { hasApprovedScope } from "./accessPermissionService";
import { notifyReportCreated, notifyReportUpdated } from "./notificationService";

const REPORTS_STORAGE_KEY = "trianxtReports";
const REPORT_PERMISSION_MODULE = "Reports";

function readReports() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REPORTS_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReports(reports) {
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
    return true;
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      window.alert("Storage limit reached. Unable to save this report.");
      return false;
    }

    throw error;
  }
}

function notifyReportsUpdated() {
  window.dispatchEvent(new Event("reports-updated"));
  window.dispatchEvent(new Event("sponsor-data-updated"));
  // "notifications-updated" is dispatched separately, only when
  // notifyReportCreated/notifyReportUpdated below actually creates a
  // notification record (see B10) — never fired unconditionally from here.
}

function accessibleStudyCodeSet(user) {
  return new Set<any>(
    getAccessibleStudies(user)
      .map((study) => String(study?.code || ""))
      .filter(Boolean),
  );
}

export function canViewReports(user = getCurrentUser()) {
  return hasPermission(PERMISSIONS.VIEW_REPORTS, user);
}

export function canManageReports(user = getCurrentUser()) {
  const role = getEffectiveRole(user);
  return [ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.PI].includes(role);
}

function hasApprovedReportAction(user, action, reportId = "") {
  if (!user?.email) {
    return false;
  }

  return hasApprovedScope(
    user.email,
    action,
    REPORT_PERMISSION_MODULE,
    reportId,
  );
}

export function canCreateReport(user = getCurrentUser()) {
  return (
    canManageReports(user) || hasApprovedReportAction(user, "Create Report")
  );
}

export function canEditReport(report, user = getCurrentUser()) {
  return (
    canManageReports(user) ||
    hasApprovedReportAction(user, "Edit Report", report?.id || "")
  );
}

export function canDeleteReport(report, user = getCurrentUser()) {
  return (
    canManageReports(user) ||
    hasApprovedReportAction(user, "Delete Report", report?.id || "")
  );
}

function canViewStudyReports(studyCode, user) {
  if (canManageReports(user)) {
    return true;
  }

  return accessibleStudyCodeSet(user).has(String(studyCode));
}

// Every read is scoped to a single studyCode on purpose — there is no
// "get all reports" export, so a caller can never accidentally render
// reports from a study the current user isn't permitted to see.
export function getReportsForStudy(studyCode, user = getCurrentUser()) {
  if (!studyCode || !canViewReports(user)) {
    return [];
  }

  if (!canViewStudyReports(studyCode, user)) {
    return [];
  }

  return readReports()
    .filter((report) => String(report.studyCode) === String(studyCode))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getReportById(reportId, user = getCurrentUser()) {
  const report = readReports().find((item) => item.id === reportId);

  if (!report || !canViewStudyReports(report.studyCode, user)) {
    return null;
  }

  return report;
}

export function createReport(payload, user = getCurrentUser()) {
  const studyCode = String(payload?.studyCode || "").trim();
  const name = String(payload?.name || "").trim();

  if (!studyCode || !name || !canCreateReport(user)) {
    return null;
  }

  const newReport = {
    id: `RPT-${Date.now()}`,
    name,
    reportType: payload.reportType || "General",
    status: payload.status || "Draft",
    studyCode,
    createdAt: new Date().toISOString(),
    createdBy: user?.name || "Unknown",
  };

  const saved = writeReports([newReport, ...readReports()]);

  if (!saved) {
    return null;
  }

  notifyReportsUpdated();
  notifyReportCreated(newReport);
  return newReport;
}

export function updateReport(reportId, updates, user = getCurrentUser()) {
  const reports = readReports();
  const target = reports.find((report) => report.id === reportId);

  if (!target || !canEditReport(target, user)) {
    return null;
  }

  const updatedReport = {
    ...target,
    ...updates,
    id: target.id,
    studyCode: target.studyCode,
    createdAt: target.createdAt,
    createdBy: target.createdBy,
    updatedAt: new Date().toISOString(),
    updatedBy: user?.name || "Unknown",
  };

  const nextReports = reports.map((report) =>
    report.id === reportId ? updatedReport : report,
  );

  const saved = writeReports(nextReports);

  if (!saved) {
    return null;
  }

  notifyReportsUpdated();
  notifyReportUpdated(updatedReport);
  return updatedReport;
}

export function deleteReport(reportId, user = getCurrentUser()) {
  const reports = readReports();
  const target = reports.find((report) => report.id === reportId);

  if (!target || !canDeleteReport(target, user)) {
    return false;
  }

  const nextReports = reports.filter((report) => report.id !== reportId);
  const saved = writeReports(nextReports);

  if (!saved) {
    return false;
  }

  notifyReportsUpdated();
  return true;
}