import { readJson } from "../utils/storageHelpers";
export const PLANNING_MILESTONES_KEY = "planningMilestonesByStudy";
export const PLANNING_TASKS_KEY = "planningTasksByStudy";
export const STUDY_TEAM_KEY = "studyTeamByStudy";
export const REGULATORY_CHECKLIST_KEY = "regulatoryChecklistByStudy";
export const PROTOCOLS_KEY = "protocolsByStudy";
export const PLANNING_UPDATED_EVENT = "planning-updated";

// A per-study "seeded" flag so we can distinguish "never initialized" from
// "user deleted every item" and only ever seed defaults once.
const REGULATORY_CHECKLIST_SEEDED_KEY = "regulatoryChecklistSeededByStudy";

function hasRegulatoryChecklistBeenSeeded(studyCode) {
  const seededMap = readJson(REGULATORY_CHECKLIST_SEEDED_KEY, {});
  return Boolean(seededMap[String(studyCode || "")]);
}

function markRegulatoryChecklistSeeded(studyCode) {
  const seededMap = readJson(REGULATORY_CHECKLIST_SEEDED_KEY, {});
  seededMap[String(studyCode || "")] = true;
  writeJson(REGULATORY_CHECKLIST_SEEDED_KEY, seededMap);
}

const DEFAULT_REGULATORY_ITEMS = [
  "IRB / Ethics Approval",
  "Investigator Brochure",
  "Protocol Signature Page",
  "Financial Disclosure",
  "Site Initiation Visit Report",
  "Insurance / Indemnity",
];

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function dispatchPlanningUpdated() {
  window.dispatchEvent(new CustomEvent(PLANNING_UPDATED_EVENT));
}

function studyList(key, studyCode) {
  const all = readJson(key, {});
  const code = String(studyCode || "");
  return Array.isArray(all[code]) ? all[code] : [];
}

function saveStudyList(key, studyCode, list) {
  const all = readJson(key, {});
  all[String(studyCode || "")] = list;
  writeJson(key, all);
  dispatchPlanningUpdated();
  return list;
}

export function getPlanningMilestones(studyCode) {
  return studyList(PLANNING_MILESTONES_KEY, studyCode);
}

export function savePlanningMilestone(studyCode, milestone) {
  const list = getPlanningMilestones(studyCode);
  const entry = {
    id: milestone?.id || `pm-${Date.now()}`,
    title: String(milestone?.title ?? "").trim() || "Untitled Milestone",
    dueDate: milestone?.dueDate || "",
    owner: milestone?.owner || "",
    status: milestone?.status || "Not Started",
    notes: milestone?.notes || "",
  };

  const index = list.findIndex((item) => item.id === entry.id);
  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? { ...item, ...entry } : item))
      : [...list, entry];

  return saveStudyList(PLANNING_MILESTONES_KEY, studyCode, next);
}

export function deletePlanningMilestone(studyCode, milestoneId) {
  const next = getPlanningMilestones(studyCode).filter(
    (item) => item.id !== milestoneId
  );
  return saveStudyList(PLANNING_MILESTONES_KEY, studyCode, next);
}

export function getPlanningTasks(studyCode) {
  return studyList(PLANNING_TASKS_KEY, studyCode);
}

export function savePlanningTask(studyCode, task) {
  const list = getPlanningTasks(studyCode);
  const entry = {
    id: task?.id || `pt-${Date.now()}`,
    title: String(task?.title ?? "").trim() || "Untitled Task",
    assignee: task?.assignee || "",
    dueDate: task?.dueDate || "",
    priority: task?.priority || "Medium",
    status: task?.status || "Open",
    milestoneId: task?.milestoneId || "",
  };

  const index = list.findIndex((item) => item.id === entry.id);
  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? { ...item, ...entry } : item))
      : [...list, entry];

  return saveStudyList(PLANNING_TASKS_KEY, studyCode, next);
}

export function deletePlanningTask(studyCode, taskId) {
  const next = getPlanningTasks(studyCode).filter((item) => item.id !== taskId);
  return saveStudyList(PLANNING_TASKS_KEY, studyCode, next);
}

export function getStudyTeam(studyCode) {
  return studyList(STUDY_TEAM_KEY, studyCode);
}

export function saveStudyTeamMember(studyCode, member) {
  const list = getStudyTeam(studyCode);

  const existingMember = list.find((item) => item.id === member?.id);

  const entry = {
    ...(existingMember || {}),
    id: member?.id || `tm-${Date.now()}`,
    name: String(member?.name ?? "").trim(),
    role: member?.role ?? existingMember?.role ?? "",
    email: member?.email ?? existingMember?.email ?? "",
    organization: member?.organization ?? existingMember?.organization ?? "",
    startDate: member?.startDate ?? existingMember?.startDate ?? "",
    phone: member?.phone ?? existingMember?.phone ?? "",
  };

  const index = list.findIndex((item) => item.id === entry.id);

  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? entry : item))
      : [...list, entry];

  return saveStudyList(STUDY_TEAM_KEY, studyCode, next);
}

export function deleteStudyTeamMember(studyCode, memberId) {
  const next = getStudyTeam(studyCode).filter((item) => item.id !== memberId);
  return saveStudyList(STUDY_TEAM_KEY, studyCode, next);
}

export function getRegulatoryChecklist(studyCode) {
  const existing = studyList(REGULATORY_CHECKLIST_KEY, studyCode);
  if (existing.length) return existing;

  // Only seed the defaults the very first time this study is ever viewed.
  // Once seeded (even if the user later deletes every item), never reseed —
  // an empty array after seeding means the user intentionally cleared it.
  if (hasRegulatoryChecklistBeenSeeded(studyCode)) {
    return [];
  }

  const seeded = DEFAULT_REGULATORY_ITEMS.map((label, index) => ({
    id: `rc-${index + 1}`,
    label,
    completed: false,
    dueDate: "",
    notes: "",
  }));

  saveStudyList(REGULATORY_CHECKLIST_KEY, studyCode, seeded);
  markRegulatoryChecklistSeeded(studyCode);

  return seeded;
}

export function saveRegulatoryChecklistItem(studyCode, item) {
  const list = getRegulatoryChecklist(studyCode);
  const entry = {
    id: item?.id || `rc-${Date.now()}`,
    label: String(item?.label ?? "").trim() || "Checklist Item",
    completed: Boolean(item?.completed),
    dueDate: item?.dueDate || "",
    notes: item?.notes || "",
  };

  const index = list.findIndex((row) => row.id === entry.id);
  const next =
    index >= 0
      ? list.map((row, i) => (i === index ? { ...row, ...entry } : row))
      : [...list, entry];

  return saveStudyList(REGULATORY_CHECKLIST_KEY, studyCode, next);
}

export function deleteRegulatoryChecklistItem(studyCode, itemId) {
  const next = getRegulatoryChecklist(studyCode).filter(
    (item) => item.id !== itemId
  );
  return saveStudyList(REGULATORY_CHECKLIST_KEY, studyCode, next);
}

export function getProtocols(studyCode) {
  return studyList(PROTOCOLS_KEY, studyCode);
}

export function saveProtocol(studyCode, protocol) {
  const list = getProtocols(studyCode);
  const versionEntry = {
    version: protocol?.version || "1.0",
    effectiveDate: protocol?.effectiveDate || "",
    summary: protocol?.summary || "",
    status: protocol?.status || "Draft",
    uploadedAt: new Date().toISOString(),
  };

  const entry = {
    id: protocol?.id || `proto-${Date.now()}`,
    title: String(protocol?.title ?? "").trim() || "Protocol",
    protocolNumber: protocol?.protocolNumber || "",
    status: protocol?.status || "Draft",
    currentVersion: versionEntry.version,
    versions: protocol?.versions?.length
      ? protocol.versions
      : [versionEntry],
  };

  if (protocol?.newVersion) {
    entry.versions = [...entry.versions, versionEntry];
    entry.currentVersion = versionEntry.version;
  }

  const index = list.findIndex((item) => item.id === entry.id);
  const next =
    index >= 0
      ? list.map((item, i) => (i === index ? { ...item, ...entry } : item))
      : [...list, entry];

  return saveStudyList(PROTOCOLS_KEY, studyCode, next);
}

export function deleteProtocol(studyCode, protocolId) {
  const next = getProtocols(studyCode).filter((item) => item.id !== protocolId);
  return saveStudyList(PROTOCOLS_KEY, studyCode, next);
}
