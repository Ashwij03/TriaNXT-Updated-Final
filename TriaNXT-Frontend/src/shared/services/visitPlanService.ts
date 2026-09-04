import { readJson } from "../utils/storageHelpers";
import { getSubjectsForStudy } from "./subjectService";
import {
  addOrUpdateVisitSchedule,
  rebuildSchedulesFromSubjects,
  SCHEDULES_EVENT,
} from "./visitScheduleService";

/**
 * Subject data access via subjectService — the single source of truth.
 */
function getSubjectsForVisitStudy(studyCode) {
  try {
    return getSubjectsForStudy(String(studyCode || ""));
  } catch {
    return [];
  }
}

export const VISIT_PLANS_KEY = "visitPlansByStudy";
export const VISIT_PLAN_VISITS_KEY = "visitPlanVisitsByPlan";
export const VISIT_PLAN_PROCEDURES_KEY = "visitPlanProceduresByPlan";
export const VISIT_PLAN_TASKS_KEY = "visitPlanTasksByPlan";
export const VISIT_PLANS_UPDATED_EVENT = "visit-plans-updated";

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function dispatchVisitPlansUpdated() {
  window.dispatchEvent(new CustomEvent(VISIT_PLANS_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(SCHEDULES_EVENT));
}

export function getVisitPlans(studyCode) {
  const all = readJson(VISIT_PLANS_KEY, {});
  const code = String(studyCode || "");
  return Array.isArray(all[code]) ? all[code] : [];
}

export function saveVisitPlan(studyCode, plan) {
  const code = String(studyCode || "");
  const all = readJson(VISIT_PLANS_KEY, {});
  const list = Array.isArray(all[code]) ? all[code] : [];

  const entry = {
  id: plan?.id || `vp-${Date.now()}`,

  name: String(plan?.name ?? "").trim() || "Visit Plan",

  description: plan?.description || "",

  clinicalStudy: plan?.clinicalStudy || "",

  studyArm: plan?.studyArm || "",

  version: plan?.version || "1.0",

  studyVisitGroup: plan?.studyVisitGroup || "",

  status: plan?.status || "Draft",

  createdAt: plan?.createdAt || new Date().toISOString(),

  updatedAt: new Date().toISOString(),

  screeningWindow: plan?.screeningWindow || "",

  enrollmentWindow: plan?.enrollmentWindow || "",
};

  const index = list.findIndex((item) => item.id === entry.id);
  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? { ...item, ...entry } : item))
      : [...list, entry];

  all[code] = next;
  writeJson(VISIT_PLANS_KEY, all);
  dispatchVisitPlansUpdated();
  return entry;
}

export function deleteVisitPlan(studyCode, planId) {
  const code = String(studyCode || "");
  const all = readJson(VISIT_PLANS_KEY, {});
  all[code] = (Array.isArray(all[code]) ? all[code] : []).filter(
    (item) => item.id !== planId
  );
  writeJson(VISIT_PLANS_KEY, all);

  [VISIT_PLAN_VISITS_KEY, VISIT_PLAN_PROCEDURES_KEY, VISIT_PLAN_TASKS_KEY].forEach(
    (key) => {
      const nested = readJson(key, {});
      delete nested[planId];
      writeJson(key, nested);
    }
  );

  dispatchVisitPlansUpdated();
}

function planList(key, planId) {
  const all = readJson(key, {});
  return Array.isArray(all[planId]) ? all[planId] : [];
}

function savePlanList(key, planId, list) {
  const all = readJson(key, {});
  all[planId] = list;
  writeJson(key, all);
  dispatchVisitPlansUpdated();
  return list;
}

export function getVisitPlanVisits(planId) {
  return planList(VISIT_PLAN_VISITS_KEY, planId);
}

export function saveVisitPlanVisit(planId, visit) {
  const list = getVisitPlanVisits(planId);
const entry = {
  id: visit?.id || `vv-${Date.now()}`,

  visitTemplateId:
    visit?.visitTemplateId || `VT-${Date.now()}`,

  sequence:
    visit?.sequence || 1,

  visitName:
    String(visit?.visitName ?? "").trim() || "Visit",

  visitType:
    visit?.visitType || "Scheduled",

  windowStart:
    visit?.windowStart || "",

  windowStartUnit:
    visit?.windowStartUnit || "Days",

  windowEnd:
    visit?.windowEnd || "",

  windowEndUnit:
    visit?.windowEndUnit || "Days",

  dayOffset:
    visit?.dayOffset ?? "",

  required:
    Boolean(visit?.required ?? true),
};

  const index = list.findIndex((item) => item.id === entry.id);
  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? { ...item, ...entry } : item))
      : [...list, entry];

  return savePlanList(VISIT_PLAN_VISITS_KEY, planId, next);
}

export function deleteVisitPlanVisit(planId, visitId) {
  const next = getVisitPlanVisits(planId).filter((item) => item.id !== visitId);
  return savePlanList(VISIT_PLAN_VISITS_KEY, planId, next);
}

export function getVisitPlanProcedures(planId) {
  return planList(VISIT_PLAN_PROCEDURES_KEY, planId);
}

export function saveVisitPlanProcedure(planId, procedure) {
  const list = getVisitPlanProcedures(planId);
 const entry = {

id:
procedure?.id ||
`vproc-${Date.now()}`,

visitId:
procedure?.visitId || "",

procedureCode:
procedure?.procedureCode ||
`PROC-${Date.now()}`,

procedureName:
String(
procedure?.procedureName ?? ""
).trim() || "Procedure",

taskOrder:
procedure?.taskOrder || 1,

sequence:
procedure?.sequence || 1,

category:
procedure?.category ||
"Assessment",

required:
Boolean(
procedure?.required ?? true
)

};

  const index = list.findIndex((item) => item.id === entry.id);
  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? { ...item, ...entry } : item))
      : [...list, entry];

  return savePlanList(VISIT_PLAN_PROCEDURES_KEY, planId, next);
}

export function deleteVisitPlanProcedure(planId, procedureId) {
  const next = getVisitPlanProcedures(planId).filter(
    (item) => item.id !== procedureId
  );
  return savePlanList(VISIT_PLAN_PROCEDURES_KEY, planId, next);
}

export function getVisitPlanTasks(planId) {
  return planList(VISIT_PLAN_TASKS_KEY, planId);
}

export function saveVisitPlanTask(planId, task) {
  const list = getVisitPlanTasks(planId);
  const entry = {
    id: task?.id || `vtask-${Date.now()}`,
    title: String(task?.title ?? "").trim() || "Task",
    assignee: task?.assignee || "",
    dueDate: task?.dueDate || "",
    status: task?.status || "Open",
  };

  const index = list.findIndex((item) => item.id === entry.id);
  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? { ...item, ...entry } : item))
      : [...list, entry];

  return savePlanList(VISIT_PLAN_TASKS_KEY, planId, next);
}

export function deleteVisitPlanTask(planId, taskId) {
  const next = getVisitPlanTasks(planId).filter((item) => item.id !== taskId);
  return savePlanList(VISIT_PLAN_TASKS_KEY, planId, next);
}

export function getVisitScheduleMatrix(studyCode, planId) {
  const visits = getVisitPlanVisits(planId);
  const procedures = getVisitPlanProcedures(planId);

  const subjects = getSubjectsForVisitStudy(studyCode);

  return {
    visits,
    procedures,
    subjects,
    cells: subjects.map((subject) => ({
      subjectId: subject.subjectId || subject.id,
      visits: visits.map((visit) => ({
        visitId: visit.id,
        visitName: visit.visitName,
        procedures: procedures.filter(
          (proc) => !proc.visitId || proc.visitId === visit.id
        ),
      })),
    })),
  };
}

export function syncVisitPlanToSchedule(studyCode, planId) {
  const visits = getVisitPlanVisits(planId);
  const subjects = getSubjectsForVisitStudy(studyCode);

  subjects.forEach((subject) => {
    const subjectId = String(subject.subjectId || subject.id);
    visits.forEach((visit) => {
      const date = visit.windowStart || visit.windowEnd;
      if (!date) return;

      addOrUpdateVisitSchedule({
        studyId: studyCode,
        subjectId,
        subject,
        visitName: visit.visitName,
        date,
        status: "Scheduled",
      });
    });
  });

  rebuildSchedulesFromSubjects();
  dispatchVisitPlansUpdated();
}
