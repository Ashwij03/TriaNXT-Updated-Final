import { readJson } from "../utils/storageHelpers";
// Dynamic visit schedules from subject data, folder workflows, and header filters.

import { getStudies } from "./studyService";
import { getAllSubjects } from "./subjectService";
import { getCurrentUser } from "./roleService";
import { getFilterState } from "./filterService";
import ROLES from "../constants/roles";
import {
  notifyUpcomingVisitReminder,
  notifyVisitCreated,
  notifyVisitUpdated
} from "./notificationService";
import { pullGapRecords, syncGapCollection } from "./gapSync";

/** FastAPI mirror endpoints for the adminSchedules store (API mode). */
export const VISITS_SYNC_ENDPOINT = "/api/site/visits/sync";
export const VISITS_LIST_ENDPOINT = "/api/site/visits/";

export const VISIT_STAGES = [
  "Screening",
  "Enrollment",
  "Visit 1",
  "Visit 2",
  "Visit 3",
  "Completed"
];

export const SCHEDULES_EVENT = "visitSchedulesChange";
export const VISIT_PROGRESS_KEY = "subjectVisitProgress";
export const VISIT_STATUS_COMPLETED = "Completed";
const SCHEDULES_STORAGE_KEY = "adminSchedules";
const SUBJECT_DETAILS_KEY = "subjectDetailsByStudy";
const UPCOMING_VISIT_REMINDER_ROLES = [ROLES.SITE_STAFF, ROLES.PI];
let upcomingVisitReminderSyncInitialized = false;

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function dispatchSchedulesChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(SCHEDULES_EVENT));
}

export function isCompletedVisitStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  return [
    "completed",
    "dropout",
    "withdrawn",
    "auto withdraw",
    "auto-withdraw"
  ].includes(normalized);
}

export function isCompletedVisitSchedule(schedule) {
  return isCompletedVisitStatus(schedule?.status);
}

// BUG-2 fix: statuses that mean the visit is operationally closed and
// must NOT appear on the active Calendar / Upcoming Visits views. These
// mirror the Add/Edit Visit modal options ("Completed", "Missed",
// "Cancelled"). Kept as a shared constant so every consumer (calendar,
// upcoming list, day-drill-down) uses the exact same predicate — no
// duplicated status vocabulary.
export const INACTIVE_VISIT_STATUSES = ["completed", "cancelled", "missed"];

export function isInactiveVisitStatus(status) {
  return INACTIVE_VISIT_STATUSES.includes(
    String(status || "").trim().toLowerCase()
  );
}

export function isInactiveVisitSchedule(schedule) {
  return isInactiveVisitStatus(schedule?.status);
}

export function toLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function getCalendarDateKey(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : toLocalDateKey(value);
  }

  const raw = String(value).trim();
  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDateMatch) {
    return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : toLocalDateKey(parsed);
}

function getCalendarDateSortValue(value) {
  const dateKey = getCalendarDateKey(value);

  if (!dateKey) {
    return Number.POSITIVE_INFINITY;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function compareScheduleDates(first, second) {
  return (
    getCalendarDateSortValue(first?.date ?? first) -
    getCalendarDateSortValue(second?.date ?? second)
  );
}

export function isPastCalendarDate(value, referenceDate = new Date()) {
  const visitSortValue = getCalendarDateSortValue(value);
  const referenceSortValue = getCalendarDateSortValue(referenceDate);

  if (
    !Number.isFinite(visitSortValue) ||
    !Number.isFinite(referenceSortValue)
  ) {
    return false;
  }

  return visitSortValue < referenceSortValue;
}

export function isUpcomingVisitSchedule(item, referenceDate = new Date()) {
  // BUG-2 fix: the calendar and Upcoming Visits list must agree on which
  // visits are still "operationally active". A visit is upcoming only if
  // it has a real date, its status is NOT Completed/Cancelled/Missed,
  // and its date is on/after today. Reused by both the calendar filter
  // and the upcoming-visits table so the two views can never disagree.
  return Boolean(
    item?.date &&
      !isInactiveVisitSchedule(item) &&
      !isPastCalendarDate(item.date, referenceDate)
  );
}

function addCalendarDays(dateKey, days) {
  const parts = String(dateKey || "")
    .split("-")
    .map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return "";
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
}

function isOneCalendarDayBefore(visitDateValue, referenceDate = new Date()) {
  const visitDateKey = getCalendarDateKey(visitDateValue);
  const referenceDateKey = getCalendarDateKey(referenceDate);

  if (!visitDateKey || !referenceDateKey) {
    return false;
  }

  return addCalendarDays(referenceDateKey, 1) === visitDateKey;
}

function resolveReminderRecipient(schedule) {
  const studyCode = String(schedule?.study || schedule?.studyKey || "").trim();

  if (!studyCode) {
    return null;
  }

  return {
    studyCode,
    targetRoles: UPCOMING_VISIT_REMINDER_ROLES,
    recipientKey: `${studyCode}:${UPCOMING_VISIT_REMINDER_ROLES.join("+")}`
  };
}

export function synchronizeUpcomingVisitReminders(referenceDate = new Date()) {
  if (typeof window === "undefined") {
    return {
      scanned: 0,
      eligible: 0,
      created: 0,
      skippedCompleted: 0,
      skippedInvalidDate: 0,
      skippedRecipient: 0
    };
  }

  const schedules = filterCalendarSchedules(readJson(SCHEDULES_STORAGE_KEY, []));
  const result = {
    scanned: schedules.length,
    eligible: 0,
    created: 0,
    skippedCompleted: 0,
    skippedInvalidDate: 0,
    skippedRecipient: 0
  };

  schedules.forEach((schedule) => {
    if (!schedule?.id) {
      return;
    }

    if (isCompletedVisitSchedule(schedule)) {
      result.skippedCompleted += 1;
      return;
    }

    const occurrenceDate = getCalendarDateKey(schedule.date);

    if (!occurrenceDate) {
      result.skippedInvalidDate += 1;
      return;
    }

    if (!isOneCalendarDayBefore(schedule.date, referenceDate)) {
      return;
    }

    const recipient = resolveReminderRecipient(schedule);

    if (!recipient) {
      result.skippedRecipient += 1;
      return;
    }

    result.eligible += 1;

    const notification = notifyUpcomingVisitReminder({
      schedule,
      occurrenceDate: schedule.date,
      ...recipient
    });

    if (notification) {
      result.created += 1;
    }
  });

  return result;
}

export function initializeUpcomingVisitReminderSynchronization() {
  if (typeof window === "undefined" || upcomingVisitReminderSyncInitialized) {
    return;
  }

  upcomingVisitReminderSyncInitialized = true;
  const sync = () => synchronizeUpcomingVisitReminders();

  sync();
  window.addEventListener(SCHEDULES_EVENT, sync);
}

function normalizeStudy(study) {
  return {
    ...study,
    indication: study.indication || "General",
    sponsor: study.sponsor || "TriaNXT Research",
    cro: study.cro || "TriaNXT CRO",
    site: study.site || study.location || ""
  };
}

function getStudyMap() {
  const map = new Map();

  getStudies().forEach((study) => {
    const normalized = normalizeStudy(study);
    map.set(String(study.code || study.id), normalized);
  });

  return map;
}

function readSubjectDetails(studyId, subjectId) {
  const all = readJson(SUBJECT_DETAILS_KEY, {});
  return all[`${studyId}::${subjectId}`] || {};
}

function readSubjectVisits(subjectId) {
  const visits = readJson(`subject_${subjectId}_visits`, []);

  // Include all statuses except deleted visits
  return Array.isArray(visits)
    ? visits.filter((visit) => visit && visit.name)
    : [];
}

function buildScheduleId(studyKey, subjectId, visit) {
  return `${studyKey}::${subjectId}::${visit}`;
}

const CALENDAR_EXCLUDED_VISITS = new Set<any>(["Enrollment"]);

function isCalendarScheduleEntry(entry) {
  return entry && !CALENDAR_EXCLUDED_VISITS.has(String(entry.visit || ""));
}

function filterCalendarSchedules(schedules) {
  return (Array.isArray(schedules) ? schedules : []).filter((item) => {
    if (!item || !item.date) {
      return false;
    }

    return isCalendarScheduleEntry(item);
  });
}

function createScheduleEntry({
  studyKey,
  subject,
  visit,
  date,
  status = "Scheduled",
  time = "09:00 AM",
  source = "subject"
}: any) {
  if (!date || !visit) {
    return null;
  }

  const subjectId = String(subject.subjectId || subject.id);
  const studyMeta = getStudyMap().get(String(studyKey)) || {};

  return {
    id: buildScheduleId(studyKey, subjectId, visit),
    date,
    subjectId,
    subjectName:
      subject.initials ||
      subject.name ||
      readSubjectDetails(studyKey, subjectId).initials ||
      subjectId,
    visit,
    status,
    study: studyKey,
    site:
      subject.site ||
      readSubjectDetails(studyKey, subjectId).site ||
      studyMeta.site ||
      "—",
    time,
    studyKey,
    source
  };
}

export function getNextVisitStage(completedStage) {
  const index = VISIT_STAGES.indexOf(completedStage);

  if (index === -1 || index >= VISIT_STAGES.length - 1) {
    return null;
  }

  return VISIT_STAGES[index + 1];
}

export function getVisitProgress(studyId, subjectId) {
  const all = readJson(VISIT_PROGRESS_KEY, {});
  return (
    all[`${studyId}::${subjectId}`] || {
      completedStages: [],
      pendingNextVisitPrompt: false,
      lastCompletedStage: ""
    }
  );
}

export function saveVisitProgress(studyId, subjectId, progress) {
  const all = readJson(VISIT_PROGRESS_KEY, {});
  all[`${studyId}::${subjectId}`] = {
    ...getVisitProgress(studyId, subjectId),
    ...progress
  };
  writeJson(VISIT_PROGRESS_KEY, all);
  dispatchSchedulesChange();
}

export function markVisitStageCompleted(studyId, subjectId, stageName) {
  const progress = getVisitProgress(studyId, subjectId);
  const completedStages = progress.completedStages.includes(stageName)
    ? progress.completedStages
    : [...progress.completedStages, stageName];

  saveVisitProgress(studyId, subjectId, {
    completedStages,
    lastCompletedStage: stageName,
    pendingNextVisitPrompt: Boolean(getNextVisitStage(stageName))
  });
}

export function clearNextVisitPrompt(studyId, subjectId) {
  saveVisitProgress(studyId, subjectId, {
    pendingNextVisitPrompt: false
  });
}

export function shouldPromptNextVisit(studyId, subjectId) {
  const progress = getVisitProgress(studyId, subjectId);
  return Boolean(progress.pendingNextVisitPrompt && progress.lastCompletedStage);
}

export function buildSchedulesFromSubjects() {
  const generated = [];

  try {
    const allSubjects = getAllSubjects();

    allSubjects.forEach((subject) => {
      const studyKey = subject.studyId;
      const subjectId = String(subject.subjectId || subject.id);
      const details = readSubjectDetails(studyKey, subjectId);

      if (details.screeningDate || subject.screeningDate) {
        const entry = createScheduleEntry({
          studyKey,
          subject: { ...subject, ...details },
          visit: "Screening",
          date: details.screeningDate || subject.screeningDate,
          status: String(subject.status || details.status || "")
            .toLowerCase()
            .includes("screen")
            ? "Scheduled"
            : "Completed"
        });

        if (entry) {
          generated.push(entry);
        }
      }

      if (details.enrollmentDate || subject.enrollmentDate) {
        const entry = createScheduleEntry({
          studyKey,
          subject: { ...subject, ...details },
          visit: "Enrollment",
          date: details.enrollmentDate || subject.enrollmentDate,
          status: "Completed",
          source: "subject"
        });

        if (entry) {
          generated.push(entry);
        }
      }

      readSubjectVisits(subjectId).forEach((visit) => {
  const entry = createScheduleEntry({
    studyKey,
    subject: { ...subject, ...details },
    visit: visit.name,
    // FIX: support all possible date fields
    date:
      visit.plannedDate ||
      visit.actualDate ||
      visit.date ||
      visit.visitDate ||
      "",
    status: visit.status || "Scheduled",
    time: visit.time || "09:00 AM",
    source: "visit-record"
  });
        if (entry) {
          generated.push(entry);
        }
      });
    });
  } catch {
    // ignore — schedules will be empty if subjectService fails
  }

  return generated;
}

let hydratedVisitsFromBackend = false;

/**
 * Boot hydration (API mode): when this browser's schedule store is empty,
 * pull the backend mirror's visit rows back in so a fresh session starts
 * with the visits pushed from other sessions/personas. Best-effort and once
 * per page load — offline sessions and non-empty stores are untouched.
 */
export async function hydrateVisitsFromBackend() {
  if (hydratedVisitsFromBackend || typeof window === "undefined") {
    return;
  }
  hydratedVisitsFromBackend = true;
  try {
    const existing = readJson(SCHEDULES_STORAGE_KEY, []);
    if (Array.isArray(existing) && existing.length > 0) {
      return;
    }
    const records = await pullGapRecords(VISITS_LIST_ENDPOINT);
    if (!records || records.length === 0) {
      return;
    }
    saveSchedules(records);
  } catch {
    // Backend unreachable / API mode off — hydration is best effort.
  }
}

export function saveSchedules(schedules) {
  writeJson(SCHEDULES_STORAGE_KEY, schedules);
  dispatchSchedulesChange();

  // Write-through mirror: every schedule mutation (addOrUpdateVisitSchedule,
  // syncSubjectSchedules, the next-visit form, calendar edits) funnels
  // through this helper, so a single push keeps the FastAPI side live with
  // the visit rows created by enrollment/screening actions. Fail-soft:
  // offline/API-off behavior is unchanged.
  syncGapCollection(VISITS_SYNC_ENDPOINT, Array.isArray(schedules) ? schedules : []);
}

export function syncSubjectSchedules(studyId, subjectId,subject: any = {}) {
  const details = readSubjectDetails(studyId, subjectId);
  const mergedSubject = { ...subject, ...details, id: subjectId };
  const generated = [];

  if (mergedSubject.screeningDate) {
    const entry = createScheduleEntry({
      studyKey: studyId,
      subject: mergedSubject,
      visit: mergedSubject.currentVisit || "Screening",
      date: mergedSubject.screeningDate
    });

    if (entry) {
      generated.push(entry);
    }
  }

  if (mergedSubject.enrollmentDate) {
    const entry = createScheduleEntry({
      studyKey: studyId,
      subject: mergedSubject,
      visit: "Enrollment",
      date: mergedSubject.enrollmentDate,
      status: "Completed",
      source: "subject"
    });

    if (entry) {
      generated.push(entry);
    }
  }

  readSubjectVisits(subjectId).forEach((visit) => {
  const entry = createScheduleEntry({
    studyKey: studyId,
    subject: mergedSubject,
    visit: visit.name,
    date: visit.plannedDate || visit.actualDate,
    status: visit.status || "Scheduled",
    time: visit.time || "09:00 AM",
    source: "visit-record"
  });

  if (entry) {
    generated.push(entry);
  }
});
  const existing = readJson(SCHEDULES_STORAGE_KEY, []);
  const subjectPrefix = `${studyId}::${subjectId}::`;
  const manualEntries = existing.filter(
    (item) =>
      !String(item.id || "").startsWith(subjectPrefix) &&
      !(
        String(item.subjectId) === String(subjectId) &&
        String(item.study || item.studyKey) === String(studyId) &&
        item.source !== "manual"
      )
  );

  saveSchedules([...manualEntries, ...generated]);
}

export function addOrUpdateVisitSchedule({
  studyId,
  subjectId,
  subject = {},
  visitName,
  date,
  time = "09:00 AM",
  status = "Scheduled"
}: any) {
  const entry = createScheduleEntry({
    studyKey: studyId,
    subject,
    visit: visitName,
    date,
    time,
    status,
    source: "manual"
  });

  if (!entry) {
    return null;
  }

  const existing = readJson(SCHEDULES_STORAGE_KEY, []);

  // BUG-1 fix: dedupe both by exact schedule id AND by the logical
  // (study, subject, normalized-visit-name) tuple. Previously we only
  // matched on the raw id string, which meant any drift in casing,
  // whitespace, or subjectId form left a stale calendar marker with the
  // OLD date after a reschedule. Now, on every save/update the previous
  // entry for the same subject+visit is always removed before the new
  // entry is inserted, so the calendar can never show duplicate/stale
  // markers for the same rescheduled visit.
  const normalizedStudy = String(studyId || "").trim();
  const normalizedSubject = String(subjectId || "").trim();
  const normalizedVisit = String(visitName || "").trim().toLowerCase();

  const matchesReschedule = (item) => {
    if (item.id === entry.id) {
      return true;
    }

    const sameStudy =
      String(item.study || item.studyKey || "").trim() === normalizedStudy;
    const sameSubject =
      String(item.subjectId || "").trim() === normalizedSubject;
    const sameVisit =
      String(item.visit || "").trim().toLowerCase() === normalizedVisit;

    return sameStudy && sameSubject && sameVisit;
  };

  const wasExisting = existing.some(matchesReschedule);
  const withoutDuplicate = existing.filter((item) => !matchesReschedule(item));
  // saveSchedules dispatches SCHEDULES_EVENT, which useVisitSchedules
  // already listens on — so the Calendar re-renders with only the new
  // date, no page refresh needed.
  saveSchedules([...withoutDuplicate, entry]);
  clearNextVisitPrompt(studyId, subjectId);

  // "manual" is the one source that represents a real, user-driven
  // create/update action (visit-plan sync and the next-visit form both
  // funnel through here) — this is the single choke point for the B10
  // "visit created/updated" notification triggers.
  const notifyPayload = { studyCode: studyId, subjectId, date, status };
  if (wasExisting) {
    notifyVisitUpdated(notifyPayload);
  } else {
    notifyVisitCreated(notifyPayload);
  }

  return entry;
}

export function saveNextVisitDetails(studyId, subjectId, details,subject: any = {}) {
  const nextStage =
    details.visitName ||
    getNextVisitStage(getVisitProgress(studyId, subjectId).lastCompletedStage);

  if (!nextStage) {
    clearNextVisitPrompt(studyId, subjectId);
    return null;
  }

  // BUG-1 fix: upsert the subject-visit record by visit name instead of
  // always appending a brand-new Date.now()-keyed record. The old code
  // pushed a second row for the same visit every time it was
  // "rescheduled", which caused buildSchedulesFromSubjects() to emit two
  // calendar entries (old date + new date) for the same logical visit.
  const visits = readSubjectVisits(subjectId);
  const normalizedNextStage = String(nextStage || "").trim().toLowerCase();
  const existingVisitIndex = visits.findIndex(
    (v) => String(v.name || "").trim().toLowerCase() === normalizedNextStage
  );
  const existingVisit = existingVisitIndex >= 0 ? visits[existingVisitIndex] : null;

  const visitRecord = {
    id: existingVisit?.id || Date.now(),
    name: nextStage,
    plannedDate: details.date,
    actualDate: existingVisit?.actualDate || "",
    status: details.status || "Scheduled",
    time: details.time || "09:00 AM"
  };

  const updatedVisits =
    existingVisitIndex >= 0
      ? visits.map((v, i) => (i === existingVisitIndex ? visitRecord : v))
      : [...visits, visitRecord];
  writeJson(`subject_${subjectId}_visits`, updatedVisits);

  return addOrUpdateVisitSchedule({
    studyId,
    subjectId,
    subject,
    visitName: nextStage,
    date: details.date,
    time: details.time,
    status: details.status
  });
}

export function rebuildSchedulesFromSubjects() {
  const generated = buildSchedulesFromSubjects();
  const existing = readJson(SCHEDULES_STORAGE_KEY, []);
  const generatedIds = new Set<any>(generated.map((item) => item.id));
  const legacyManual = existing.filter(
    (item) => !item.id || !generatedIds.has(item.id)
  );

  const merged = [...legacyManual];

  generated.forEach((entry) => {
    const index = merged.findIndex((item) => item.id === entry.id);

    if (index >= 0) {
      merged[index] = { ...merged[index], ...entry };
    } else {
      merged.push(entry);
    }
  });

  writeJson(SCHEDULES_STORAGE_KEY, merged);
  dispatchSchedulesChange();
  return merged;
}

function matchesHeaderFilters(schedule, filters, studyMap) {
  const studyMeta = studyMap.get(String(schedule.study || schedule.studyKey));

  if (filters.indication && studyMeta?.indication !== filters.indication) {
    return false;
  }

  if (filters.sponsor && studyMeta?.sponsor !== filters.sponsor) {
    return false;
  }

  if (filters.cro && studyMeta?.cro !== filters.cro) {
    return false;
  }

  if (filters.studyCode) {
    const scheduleStudy = String(schedule.study || schedule.studyKey || "");
    if (scheduleStudy !== String(filters.studyCode)) {
      return false;
    }
  }

  if (filters.institution) {
    const site = schedule.site || studyMeta?.site || "";
    if (
      site !== filters.institution &&
      !String(site).includes(filters.institution) &&
      !filters.institution.includes(String(site))
    ) {
      return false;
    }
  }

  if (filters.siteNumber) {
    const siteNumber = studyMeta?.siteNumber || "";
    if (
      String(siteNumber) !== String(filters.siteNumber) &&
      !String(schedule.site).includes(String(filters.siteNumber))
    ) {
      return false;
    }
  }

  if (filters.subject) {
    if (String(schedule.subjectId) !== String(filters.subject)) {
      return false;
    }
  }

  return true;
}

export function getMergedSchedules(user = getCurrentUser()) {
  const schedules = filterCalendarSchedules(
    readJson(SCHEDULES_STORAGE_KEY, [])
  );

  // TEMPORARY: return all schedules for debugging
  return schedules;
}
export function getFilteredSchedules(user = getCurrentUser(),options: any = {}) {
  const schedules = getMergedSchedules(user);

  // When the dashboard calendar does not pass any filters,
  // return all available schedules directly.
  if (!options.studyCode && !options.institutionFilter) {
    return schedules;
  }

  const filters = {
    ...getFilterState(),
    ...options,
  };

  const studyMap = getStudyMap();

  return schedules.filter((schedule) =>
    matchesHeaderFilters(schedule, filters, studyMap)
  );
}

export function getUpcomingVisitsForDate(schedules, date, referenceDate = new Date()) {
  const targetDate = getCalendarDateKey(date);

  if (!targetDate) {
    return [];
  }

  return schedules
    .filter(
      (item) =>
        // BUG-2 fix: use the shared upcoming predicate so a selected
        // calendar day never drills into stale (past/cancelled/missed/
        // completed) events. The active-view check is applied first,
        // then the "on this date" match.
        isUpcomingVisitSchedule(item, referenceDate) &&
        getCalendarDateKey(item.date) === targetDate
    )
    .sort(compareScheduleDates)
    .map((item) => ({
      subjectid: item.subjectId,
      subject: item.subjectId,
      visit: item.visit,
      date: item.date,
      status: item.status,
      study: item.study,
      site: item.site
    }));
}

export function mapScheduleToTableRow(item) {
  return {
    id: item.id,
    subjectid: item.subjectId,
    subjectId: item.subjectId,
    subject: item.subjectId,
    subjectName: item.subjectName || item.subjectId,
    visit: item.visit,
    date: item.date,
    status: item.status || "Scheduled",
    study: item.study || item.studyKey || "—",
    site: item.site || "—"
  };
}

export function getUpcomingVisitsWindow(
  schedules,
  daysAhead = 7,
  referenceDate = new Date()
) {
  const startKey = getCalendarDateKey(referenceDate);

  if (!startKey) {
    return [];
  }

  const endKey = addCalendarDays(startKey, daysAhead);
  const startValue = getCalendarDateSortValue(startKey);
  const endValue = getCalendarDateSortValue(endKey);

  return schedules
    .filter((item) => {
      const visitValue = getCalendarDateSortValue(item.date);
      // BUG-2 fix: exclude Completed/Cancelled/Missed via the shared
      // predicate so the Upcoming Visits list vocabulary matches the
      // calendar view. Past-date exclusion is enforced by the window
      // bounds below (startValue = today).
      if (
        !Number.isFinite(visitValue) ||
        isInactiveVisitSchedule(item)
      ) {
        return false;
      }

      return (
        visitValue >= startValue &&
        visitValue <= endValue
      );
    })
    .sort(compareScheduleDates)
    .map(mapScheduleToTableRow);
}
// Force rebuild of calendar schedules from all subject visits
export function refreshVisitCalendar() {
  return rebuildSchedulesFromSubjects();
}