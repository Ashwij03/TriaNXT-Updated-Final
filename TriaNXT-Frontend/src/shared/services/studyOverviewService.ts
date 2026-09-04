import { readJson } from "../utils/storageHelpers";
import { getSubjectsForStudy } from "./subjectService";
import { getStudyByCode, getStudies } from "./studyService";
import { getSitePerformance, getTrainingLogs, getSites } from "./adminService";
import { getFilteredSchedules } from "./visitScheduleService";
import { getCurrentUser } from "./roleService";
import { getEssentialDocumentsHealth } from "../pages/EISF/services/essentialDocumentsHealthService";
import {
  normalizeSiteActivationStatus,
  normalizeGCPStatus,
  SITE_ACTIVATION_BUCKETS,
  GCP_CERT_BUCKETS,
} from "../utils/siteStatusNormalizer";
import { getSubjectStatusAnalytics } from "../utils/subjectStatusAnalytics";
// Item 15 — reuse the single authoritative milestone store (Planning service).
// Study Overview no longer maintains its own copy; it delegates to planning.
import {
  getPlanningMilestones,
  savePlanningMilestone,
  deletePlanningMilestone,
  PLANNING_MILESTONES_KEY,
} from "./planningService";

// Kept for backward-compatibility with any external consumer that imports it.
// The Study Overview no longer stores milestones under this key — it delegates
// to the Planning service's PLANNING_MILESTONES_KEY store (single source).
export const STUDY_MILESTONES_KEY = PLANNING_MILESTONES_KEY;
export const STUDY_OVERVIEW_EVENT = "study-overview-updated";

const DEFAULT_MILESTONE_TITLES = [
  "Study Start",
  "FPI",
  "50% Enrollment",
  "Close-Out",
];

// Adapters between the Planning shape ({title, dueDate, owner, status, notes})
// and the Study Overview shape ({title, targetDate, actualDate, status, notes}).
// Both views operate on the same underlying record — only field aliases differ.
function toOverviewMilestone(planningEntry) {
  if (!planningEntry || typeof planningEntry !== "object") return planningEntry;
  return {
    ...planningEntry,
    id: planningEntry.id,
    title: planningEntry.title,
    // Overview reads/edits `targetDate`; Planning stores it as `dueDate`.
    targetDate: planningEntry.targetDate ?? planningEntry.dueDate ?? "",
    actualDate: planningEntry.actualDate ?? "",
    status: planningEntry.status ?? "Pending",
    owner: planningEntry.owner ?? "",
    notes: planningEntry.notes ?? "",
  };
}

function toPlanningMilestone(overviewEntry) {
  if (!overviewEntry || typeof overviewEntry !== "object") return overviewEntry;
  const merged = { ...overviewEntry };
  // Keep both aliases in sync so downstream planning-shape consumers still work.
  const target =
    overviewEntry.targetDate ?? overviewEntry.dueDate ?? "";
  merged.dueDate = target;
  merged.targetDate = target;
  return merged;
}

export function dispatchStudyOverviewUpdated() {
  window.dispatchEvent(new CustomEvent(STUDY_OVERVIEW_EVENT));
}

export function getEssentialDocumentsCompletion(studyCode) {
  return getEssentialDocumentsHealth(studyCode);
}

export function getStudyProgressSummary(studyCode) {
  const code = String(studyCode || "");
  const study = getStudyByCode(code);

  let subjects = [];
  try {
    subjects = getSubjectsForStudy(code);
  } catch {
    subjects = [];
  }

  // Reuse the authoritative subject status analytics (normalizeStatus)
  // so the summary always reflects the same lifecycle engine used elsewhere.
  const analytics = getSubjectStatusAnalytics(subjects);
  const byStatus = analytics.reduce((acc, entry) => {
    acc[entry.name] = entry.value;
    return acc;
  }, {} as Record<string, number>);

  const screened = byStatus.Screening || 0;
  const enrolled = byStatus.Enrolled || 0;
  const ongoing = byStatus.Ongoing || 0;
  const completed = byStatus.Completed || 0;

  return {
    screened,
    enrolled,
    ongoing,
    completed,
    targetSubjects: Number(study?.targetSubjects) || 0,
    // Preserved for the study-health enrollment-progress factor
    // so downstream calculations remain backward compatible.
    enrolledTotal: Number(study?.enrolled) || subjects.length,
  };
}

function createDefaultMilestones(studyCode) {
  const today = new Date().toISOString().slice(0, 10);
  return DEFAULT_MILESTONE_TITLES.map((title, index) => ({
    id: `ms-${studyCode}-${index + 1}`,
    title,
    targetDate: "",
    actualDate: index === 0 ? today : "",
    status: index === 0 ? "Completed" : "Pending",
    notes: "",
  }));
}

// Item 15 — Study Overview reads from the same authoritative Planning store.
// No duplicate localStorage bucket, no parallel state.
//
// Backward-compat migration: if legacy `studyMilestonesByStudy` data exists,
// migrate it into the shared planning store on first read, then rely solely
// on the planning store going forward.
const LEGACY_STUDY_MILESTONES_KEY = "studyMilestonesByStudy";
let __legacyMilestonesMigrated = false;
function migrateLegacyMilestonesIfNeeded() {
  if (__legacyMilestonesMigrated) return;
  __legacyMilestonesMigrated = true;
  try {
    const legacy = readJson(LEGACY_STUDY_MILESTONES_KEY, null);
    if (!legacy || typeof legacy !== "object") return;
    Object.entries(legacy).forEach(([code, list]) => {
      if (!Array.isArray(list) || !list.length) return;
      const existing = getPlanningMilestones(code);
      const existingIds = new Set<any>(existing.map((row) => row.id));
      list.forEach((entry) => {
        if (!entry || existingIds.has(entry.id)) return;
        savePlanningMilestone(code, toPlanningMilestone(entry));
      });
    });
  } catch {
    // Migration is best-effort; never block reads.
  }
}

export function getStudyMilestones(studyCode) {
  const code = String(studyCode || "");
  migrateLegacyMilestonesIfNeeded();
  const list = getPlanningMilestones(code);
  if (Array.isArray(list) && list.length) {
    return list.map(toOverviewMilestone);
  }
  return createDefaultMilestones(code);
}

export function saveStudyMilestones(studyCode, milestones) {
  const list = Array.isArray(milestones) ? milestones : [];
  // Persist each entry through the Planning service so both pages stay in sync.
  list.forEach((entry) => savePlanningMilestone(studyCode, toPlanningMilestone(entry)));
  dispatchStudyOverviewUpdated();
  return getStudyMilestones(studyCode);
}

export function addStudyMilestone(studyCode, milestone) {
  const entry = toPlanningMilestone({
    title: String(milestone?.title ?? "").trim() || "New Milestone",
    targetDate: milestone?.targetDate || "",
    actualDate: milestone?.actualDate || "",
    status: milestone?.status || "Pending",
    notes: milestone?.notes || "",
    owner: milestone?.owner || "",
  });
  savePlanningMilestone(studyCode, entry);
  dispatchStudyOverviewUpdated();
  return getStudyMilestones(studyCode);
}

export function updateStudyMilestone(studyCode, milestoneId, updates) {
  const existing = getPlanningMilestones(studyCode).find(
    (item) => item.id === milestoneId
  );
  if (!existing) return getStudyMilestones(studyCode);
  const merged = toPlanningMilestone({ ...toOverviewMilestone(existing), ...updates, id: milestoneId });
  savePlanningMilestone(studyCode, merged);
  dispatchStudyOverviewUpdated();
  return getStudyMilestones(studyCode);
}

export function deleteStudyMilestone(studyCode, milestoneId) {
  deletePlanningMilestone(studyCode, milestoneId);
  dispatchStudyOverviewUpdated();
  return getStudyMilestones(studyCode);
}

// Item 14 — Site Performance Summary
// The table must be fully dynamic: never render static/mock/hardcoded rows.
// Every row (Site Number, Enrollment, Screening %, Compliance %) is derived
// from the existing shared study/site data sources — the authoritative Sites
// store, the subjectsByStudy map and the visit schedules store — so the
// values automatically update whenever the underlying data changes.
function siteMatchesStudy(name, studySite) {
  if (!studySite) return true;
  const value = String(name || "");
  return (
    value === studySite ||
    value.includes(studySite) ||
    studySite.includes(value)
  );
}

function normalizeSiteMatchTokens(...values) {
  return values
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function subjectBelongsToSite(subject, siteTokens) {
  if (!siteTokens.length) return true;
  const candidates = normalizeSiteMatchTokens(
    subject?.site,
    subject?.siteName,
    subject?.siteNumber,
    subject?.location
  );
  if (!candidates.length) return false;
  return candidates.some((candidate) =>
    siteTokens.some(
      (token) => token === candidate || token.includes(candidate) || candidate.includes(token)
    )
  );
}

function scheduleBelongsToSite(schedule, siteTokens) {
  if (!siteTokens.length) return true;
  const candidates = normalizeSiteMatchTokens(
    schedule?.site,
    schedule?.siteName,
    schedule?.siteNumber
  );
  if (!candidates.length) return false;
  return candidates.some((candidate) =>
    siteTokens.some(
      (token) => token === candidate || token.includes(candidate) || candidate.includes(token)
    )
  );
}

function scheduleBelongsToStudy(schedule, studyCode) {
  if (!studyCode) return true;
  const tokens = normalizeSiteMatchTokens(
    schedule?.study,
    schedule?.studyKey,
    schedule?.studyCode
  );
  if (!tokens.length) return false;
  const code = String(studyCode).toLowerCase();
  return tokens.some((token) => token === code || token.includes(code));
}

function computePercent(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return Math.round((Number(numerator) / Number(denominator)) * 100);
}

function computeEnrollmentMetricsForSite({
  siteTokens,
  studySubjects,
  studySchedules,
  studyCode,
  fallbackSubjectsEnrolled,
  fallbackEnrollmentTarget,
}: any) {
  const subjectsForSite = studySubjects.filter((subject) =>
    subjectBelongsToSite(subject, siteTokens)
  );

  const screenedSubjects = subjectsForSite.filter((subject) => {
    const status = String(subject?.status || "").toLowerCase();
    if (!status) return Boolean(subject?.screeningDate);
    return (
      status.includes("screen") ||
      status.includes("enroll") ||
      status.includes("ongoing") ||
      status.includes("complete") ||
      status.includes("withdraw") ||
      status.includes("discontinue")
    ) || Boolean(subject?.screeningDate);
  });

  const enrolledSubjects = subjectsForSite.filter((subject) => {
    const status = String(subject?.status || "").toLowerCase();
    if (status) {
      if (status.includes("screen") && !status.includes("passed")) {
        return false;
      }
      return (
        status.includes("enroll") ||
        status.includes("ongoing") ||
        status.includes("complete") ||
        status.includes("randomiz") ||
        status.includes("active") ||
        status.includes("withdraw") ||
        status.includes("discontinue")
      );
    }
    return Boolean(subject?.enrollmentDate);
  });

  const enrolledCount =
    enrolledSubjects.length ||
    (Number(fallbackSubjectsEnrolled) || 0);

  const enrollmentTarget = Number(fallbackEnrollmentTarget) || 0;

  const schedulesForSite = studySchedules.filter((schedule) =>
    scheduleBelongsToSite(schedule, siteTokens)
  );

  const completedVisits = schedulesForSite.filter((schedule) => {
    const status = String(schedule?.status || "").toLowerCase();
    return status.includes("complete");
  }).length;

  const visitCompliance = schedulesForSite.length
    ? computePercent(completedVisits, schedulesForSite.length)
    : null;

  const screeningDenominator = subjectsForSite.length || enrolledCount;
  const screeningRate = screeningDenominator
    ? computePercent(screenedSubjects.length, screeningDenominator)
    : null;

  return {
    subjectsForSiteCount: subjectsForSite.length,
    enrolledCount,
    enrollmentTarget,
    screeningRate,
    visitCompliance,
    totalVisits: schedulesForSite.length,
    completedVisits,
    studyCode,
  };
}

function buildDynamicSitePerformance(study, user, studyCode) {
  const code = String(studyCode || study?.code || "");
  const studySite = String(study?.site || study?.location || "").trim();
  const sites = getSites(user);

  let studySubjects = [];
  try {
    studySubjects = getSubjectsForStudy(code);
  } catch {
    studySubjects = [];
  }

  // Visit schedules are the authoritative source for compliance. We reuse the
  // same shared filtered-schedules service that every other visit widget uses.
  let studySchedules = [];
  try {
    studySchedules = getFilteredSchedules(user).filter((schedule) =>
      scheduleBelongsToStudy(schedule, code)
    );
  } catch {
    studySchedules = [];
  }

  const relevantSites = sites.filter((site) =>
    siteMatchesStudy(site.name || site.siteName, studySite)
  );

  if (relevantSites.length) {
    return relevantSites.map((site) => {
      const siteName = site.name || site.siteName || "";
      const siteNumber =
        site.siteNumber || site.number || site.siteNo || site.site_number || "";
      const siteTokens = normalizeSiteMatchTokens(
        siteName,
        siteNumber,
        site.id,
        site.siteId
      );
      const metrics = computeEnrollmentMetricsForSite({
        siteTokens,
        studySubjects,
        studySchedules,
        studyCode: code,
        fallbackSubjectsEnrolled: site.subjectsEnrolled,
        fallbackEnrollmentTarget:
          site.enrollmentTarget != null
            ? Number(site.enrollmentTarget) || 0
            : Number(study?.targetSubjects) || 0,
      });

      return {
        siteId: site.id || site.siteId || siteNumber || siteName,
        siteName,
        siteNumber,
        enrolled: metrics.enrolledCount,
        subjectsEnrolled: metrics.enrolledCount,
        enrollmentTarget: metrics.enrollmentTarget,
        targetSubjects: metrics.enrollmentTarget,
        screeningRate:
          site.screeningRate != null
            ? Number(site.screeningRate)
            : metrics.screeningRate,
        visitCompliance:
          site.visitCompliance != null
            ? Number(site.visitCompliance)
            : metrics.visitCompliance,
      };
    });
  }

  // Fall back to the single site referenced on the study itself so the
  // summary still populates when no Sites records exist yet, using the same
  // dynamic computation over subjects and visit schedules.
  if (studySite) {
    const siteTokens = normalizeSiteMatchTokens(studySite, study?.siteNumber);
    const metrics = computeEnrollmentMetricsForSite({
      siteTokens,
      studySubjects,
      studySchedules,
      studyCode: code,
      fallbackSubjectsEnrolled: study?.enrolled,
      fallbackEnrollmentTarget: study?.targetSubjects,
    });

    return [
      {
        siteId: study?.siteNumber || studySite,
        siteName: studySite,
        siteNumber: study?.siteNumber || "",
        enrolled: metrics.enrolledCount,
        subjectsEnrolled: metrics.enrolledCount,
        enrollmentTarget: metrics.enrollmentTarget,
        targetSubjects: metrics.enrollmentTarget,
        screeningRate: metrics.screeningRate,
        visitCompliance: metrics.visitCompliance,
      },
    ];
  }

  return [];
}

export function getStudyScopedSitePerformance(studyCode, user = getCurrentUser()) {
  const study = getStudyByCode(studyCode);
  const code = String(studyCode || study?.code || "");
  const studySite = String(study?.site || study?.location || "").trim();
  const records = getSitePerformance(user);

  const scoped = studySite
    ? records.filter((item) =>
        siteMatchesStudy(
          item.siteName || item.site || item.name,
          studySite
        )
      )
    : records;

  // Item 14 — When explicit sitePerformance records exist we still enrich
  // them with the shared dynamic metrics so every column (Site Number,
  // Enrollment, Screening %, Compliance %) reflects the authoritative
  // subject/visit-schedule data, not the stored snapshot.
  if (scoped && scoped.length) {
    let studySubjects = [];
    try {
      studySubjects = getSubjectsForStudy(code);
    } catch {
      studySubjects = [];
    }

    let studySchedules = [];
    try {
      studySchedules = getFilteredSchedules(user).filter((schedule) =>
        scheduleBelongsToStudy(schedule, code)
      );
    } catch {
      studySchedules = [];
    }

    return scoped.map((record) => {
      const siteName =
        record.siteName || record.site || record.name || "";
      const siteNumber =
        record.siteNumber ||
        record.number ||
        record.siteNo ||
        record.site_number ||
        record.siteId ||
        "";
      const siteTokens = normalizeSiteMatchTokens(
        siteName,
        siteNumber,
        record.siteId
      );
      const metrics = computeEnrollmentMetricsForSite({
        siteTokens,
        studySubjects,
        studySchedules,
        studyCode: code,
        fallbackSubjectsEnrolled:
          record.enrolled ?? record.subjectsEnrolled ?? 0,
        fallbackEnrollmentTarget:
          record.enrollmentTarget ??
          record.targetSubjects ??
          Number(study?.targetSubjects) ??
          0,
      });

      return {
        ...record,
        siteNumber,
        enrolled: metrics.enrolledCount,
        subjectsEnrolled: metrics.enrolledCount,
        enrollmentTarget: metrics.enrollmentTarget,
        targetSubjects: metrics.enrollmentTarget,
        screeningRate:
          metrics.screeningRate != null
            ? metrics.screeningRate
            : record.screeningRate ?? null,
        visitCompliance:
          metrics.visitCompliance != null
            ? metrics.visitCompliance
            : record.visitCompliance ?? null,
      };
    });
  }

  // No explicit sitePerformance rows exist yet — synthesize from the shared
  // studies/sites/subjects data so the widget is never left with static or
  // stale mock content.
  return buildDynamicSitePerformance(study, user, studyCode);
}

export function getSiteActivationCounts(studyCode, user = getCurrentUser()) {
  const study = getStudyByCode(studyCode);
  const studySite = String(study?.site || study?.location || "").trim();
  const sites = getSites(user);
  const counts = Object.fromEntries(
    SITE_ACTIVATION_BUCKETS.map((label) => [label, 0])
  );

  const relevant = sites.filter((site) => {
    const name = String(site.name || site.siteName || "");
    if (!studySite) return true;
    return (
      name === studySite ||
      name.includes(studySite) ||
      studySite.includes(name)
    );
  });

  if (!relevant.length && studySite) {
    const normalized = normalizeSiteActivationStatus(study?.status);
    if (counts[normalized] !== undefined) {
      counts[normalized] += 1;
    } else {
      counts.Pending += 1;
    }
    return counts;
  }

  relevant.forEach((site) => {
    const bucket = normalizeSiteActivationStatus(site.status);
    if (counts[bucket] !== undefined) {
      counts[bucket] += 1;
    } else {
      counts.Pending += 1;
    }
  });

  return counts;
}

export function getGCPCertificationSummary(studyCode, user = getCurrentUser()) {
  const study = getStudyByCode(studyCode);
  const studySite = String(study?.site || study?.location || "").trim();
  const logs = getTrainingLogs(user).filter((log) => {
    const training = String(log.training || "").toLowerCase();
    if (!training.includes("gcp")) return false;
    if (!studySite) return true;
    const site = String(log.site || "");
    return site === studySite || site.includes(studySite) || studySite.includes(site);
  });

  const counts = Object.fromEntries(
    GCP_CERT_BUCKETS.map((label) => [label, 0])
  );

  if (!logs.length) {
    counts.Missing += studySite ? 1 : 0;
    return counts;
  }

  logs.forEach((log) => {
    const bucket = normalizeGCPStatus(log.status);
    if (counts[bucket] !== undefined) {
      counts[bucket] += 1;
    } else {
      counts.Missing += 1;
    }
  });

  return counts;
}

export function getStudyHealthSummary(studyCode /* legacy signature */) {
  // Item 13 — eISF Summary
  // The percentage displayed must come from the SAME shared 22-module
  // completion calculation used by Essential Documents Health. We reuse
  // getEssentialDocumentsCompletion() (which wraps getEssentialDocumentsHealth)
  // directly — no separate calculation, no duplicated math.
  const docs = getEssentialDocumentsCompletion(studyCode);

  const score = Number(docs?.percent) || 0;
  const completedModules = Number(
    docs?.completedModules ?? docs?.uploaded ?? 0
  );
  const totalModules = Number(
    docs?.totalModules ?? docs?.expected ?? 22
  );

  let status = "In Progress";
  if (score >= 100) status = "Complete";
  else if (score === 0) status = "Not Started";

  // Item 13 — derive the list of INCOMPLETE eISF module names dynamically
  // from the same shared moduleBreakdown produced by the 22-module
  // completion calculation. No hardcoded module list, no static copy.
  const breakdown = Array.isArray(docs?.moduleBreakdown)
    ? docs.moduleBreakdown
    : [];
  const incompleteModules = breakdown
    .filter((entry) => entry && entry.complete === false)
    .map((entry) => ({
      id: entry.id,
      title: String(entry.title ?? "").trim() || `Module ${entry.id}`,
    }));

  const factors = [];
  const outstanding = Math.max(totalModules - completedModules, 0);
  if (outstanding > 0) {
    factors.push({
      label: `${outstanding} of ${totalModules} eISF module(s) outstanding`,
      impact: score < 50 ? "High" : "Medium",
    });
  }

  return { score, status, factors, incompleteModules };
}

export function getStudiesForOverview() {
  return getStudies();
}
