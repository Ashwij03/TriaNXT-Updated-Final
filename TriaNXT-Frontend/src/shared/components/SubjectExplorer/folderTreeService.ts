/**
 * Subject Explorer - FOLDER TREE SERVICE (mock / local state layer)
 * =================================================================
 *
 * Single source of truth for folder CRUD in the Subject Explorer.
 *
 * STORAGE SCOPING
 * ---------------
 * The folder tree is now study-scoped: every study gets its own localStorage
 * key (`trianxtSubjectExplorerTree:<studyId>`), so different studies never
 * share or bleed into each other's explorer trees.
 *
 * All persistence functions (`loadFolderTree`, `saveFolderTree`,
 * `resetFolderTree`, `subscribeFolderTree`, and every CRUD mutation) require
 * a `studyId` parameter as their first argument. Pure lookup functions
 * (`findNodeById`, `findParentOf`, `getChildren`, etc.) remain unchanged
 * since they operate on an already-loaded tree.
 *
 * API MIGRATION NOTE
 * ------------------
 * The component layer never touches localStorage directly - it only calls
 * the functions below. To move to real APIs later, replace the bodies of
 * `loadFolderTree` / `createFolder` / `renameFolder` / `deleteFolder`
 * with HTTP calls (returning the same `{ ok, tree, node, error }` shape)
 * and nothing in the UI has to change.
 *
 * RECONCILIATION WITH subjectsByStudy
 * ------------------------------------
 * On every load, the folder tree is reconciled against the study's real
 * subject roster from `subjectsByStudy`. Any subject present in
 * `subjectsByStudy[studyId]` that has no tree node gets a default node
 * auto-created (with its ICF folder). This ensures the tree never renders
 * subjects that don't belong to the study, and new subjects created via
 * the "Add Subject" flow in `StudySubjects.js` always appear in the tree.
 *
 * LEGACY MIGRATION
 * ----------------
 * Users with data under the old flat `trianxtSubjectExplorerTree` key will
 * find it ignored going forward. New study-scoped keys start empty. A
 * console warning is logged if the legacy key exists.
 *
 * Node contract (unchanged from Phase 2):
 *   { id: string, name: string, type: "subject" | "folder", children: node[] }
 */

import {
  getAllSubjects,
  getSubjectsForStudy as getSubjectsForStudyFromService
} from "../../services/subjectService";

/** Legacy flat key (pre-study-scoping). Ignored going forward. */

/* ==================================================================
   CONSTANTS
================================================================== */

/** Legacy flat key (pre-study-scoping). Ignored going forward. */
const LEGACY_FLAT_KEY = "trianxtSubjectExplorerTree";

/**
 * Study-scoped localStorage key factory.
 *
 * GUARD: if studyId is falsy (undefined, null, empty string), logs an
 * error and falls back to "global" — but never silently shares the
 * global bucket. Callers must always pass a resolved study code.
 */
export function subjectExplorerTreeKey(studyId) {
  if (!studyId) {
    // eslint-disable-next-line no-console
    console.error(
      "[TriaNXT] subjectExplorerTreeKey called with falsy studyId.",
      "This would cause all studies to share the 'global' bucket."
    );
  }
  return `trianxtSubjectExplorerTree:${studyId || "global"}`;
}

/** Fired after every successful write so open explorers can auto-refresh. */
export const SUBJECT_FOLDER_TREE_EVENT = "trianxt-subject-folder-tree-updated";

const STORAGE_VERSION = 1;

/** Characters that would break path-style ids / look wrong in a tree. */
// eslint-disable-next-line no-useless-escape
const INVALID_NAME_CHARS = /[\\/\\\\:*?\"<>|]/;

const MAX_NAME_LENGTH = 60;

export const FOLDER_NAME_RULES = {
  maxLength: MAX_NAME_LENGTH,
  invalidCharsLabel: '/ \\\\ : * ? " < > |',
};

/**
 * Update 7 - LOCKED ICF FOLDER
 * ----------------------------
 * Every subject automatically gets exactly one system folder, "ICF"
 * (Informed Consent Form), that cannot be renamed or deleted - view/open
 * and its own file management continue to work exactly like any other
 * folder, only the folder's own CRUD is locked. This is expressed as a
 * `locked: true` flag on the node (checked in `renameFolder`/`deleteFolder`
 * below, and by the sidebar UI which hides Edit/Rename/Delete for it).
 */
export const ICF_FOLDER_NAME = "ICF";

/** Deterministic id so a subject's ICF folder is always found the same way. */
function icfFolderId(subjectId) {
  return `${subjectId}/icf`;
}

function makeIcfFolder(subjectId) {
  return {
    id: icfFolderId(subjectId),
    name: ICF_FOLDER_NAME,
    type: "folder",
    locked: true,
    children: [],
    createdAt: new Date().toISOString(),
  };
}

/** True for any node whose own CRUD (rename/delete) is locked. */
export function isLockedFolder(node) {
  return Boolean(node && node.type === "folder" && node.locked);
}

/**
 * Update 8 - REMOVE HARDCODED DEFAULT FOLDERS
 * --------------------------------------------
 * The original mock seed hardcoded folders directly onto SUB-001..SUB-006.
 * A tree already persisted in localStorage from an earlier session would
 * still have them baked in - this is the exact set of ids the old seed
 * produced, used ONLY to strip those specific legacy nodes on load.
 * User-created folders get generated ids and can never collide with this
 * list.
 */

/**
 * Legacy mock subject ids from the deleted subjectExplorerMockData.js.
 * These were hardcoded SUB-001..SUB-006 that appeared in every study
 * regardless of what subjects actually existed. Stripped on load.
 */
const LEGACY_MOCK_SUBJECT_IDS = new Set<any>([
  "SUB-001", "SUB-002", "SUB-003",
  "SUB-004", "SUB-005", "SUB-006",
]);

const LEGACY_DEFAULT_FOLDER_IDS = new Set<any>([
  "SUB-001/screening",
  "SUB-001/visit-1",
  "SUB-001/visit-2",
  "SUB-001/additional-documents",
  "SUB-002/lab-reports",
  "SUB-002/x-ray",
  "SUB-002/insurance",
  "SUB-004/screening",
  "SUB-004/consent-forms",
  "SUB-004/consent-forms/icf-v1",
  "SUB-004/consent-forms/icf-v2",
  "SUB-004/visit-1",
  "SUB-004/adverse-events",
  "SUB-005/screening",
  "SUB-005/visit-1",
  "SUB-005/lab-reports",
  "SUB-005/imaging",
  "SUB-005/additional-documents",
  "SUB-006/screening",
  "SUB-006/insurance",
]);

/**
 * One pass over the tree: strip legacy mock subjects (SUB-001..SUB-006)
 * and their hardcoded default folders, then guarantee every remaining
 * subject has its locked ICF folder. Runs on every `loadFolderTree` call
 * so a tree persisted before this update is cleaned up on next load, and
 * idempotent.
 */
function migrateLegacyDefaults(nodes) {
  let changed = false;

  // Step 1: strip legacy mock subject nodes entirely
  const withoutMockSubjects = (Array.isArray(nodes) ? nodes : []).filter(
    (node) => {
      if (node.type === "subject" && LEGACY_MOCK_SUBJECT_IDS.has(node.id)) {
        changed = true;
        return false;
      }
      return true;
    }
  );

  // Step 2: for remaining subjects, strip legacy default subfolders
  // and guarantee each has a locked ICF folder
  const next = withoutMockSubjects.map((node) => {
    if (node.type !== "subject") return node;

    const children = (node.children || []).filter((child) => {
      if (LEGACY_DEFAULT_FOLDER_IDS.has(child.id)) {
        changed = true;
        return false;
      }
      return true;
    });

    const hasIcf = children.some((child) => isLockedFolder(child));

    if (!hasIcf) {
      changed = true;
      children.unshift(makeIcfFolder(node.id));
    }

    return { ...node, children };
  });

  return { changed, tree: next };
}

/* ==================================================================
   INTERNAL HELPERS
================================================================== */

function createId(prefix = "fld") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Next sequential subject id (SUB-001, SUB-002, ...), derived from the
 * subjects that currently exist in the tree.
 */
function nextSubjectId(nodes) {
  const used = new Set<any>(
    (Array.isArray(nodes) ? nodes : [])
      .filter((node) => node.type === "subject")
      .map((node) => node.id)
  );

  let n = 1;
  let candidate = `SUB-${String(n).padStart(2, "0")}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `SUB-${String(n).padStart(2, "0")}`;
  }
  return candidate;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const hasStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage);

/**
 * Guarantee every node has a `children` array and a `type`, so a folder
 * created inside a former leaf node works without special-casing.
 */
function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];

  return nodes.map((node) => ({
    ...node,
    id: node.id || createId(),
    name: typeof node.name === "string" ? node.name : "Untitled",
    type: node.type === "subject" ? "subject" : "folder",
    children: normalizeNodes(node.children),
  }));
}

function emitTreeUpdate(source) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SUBJECT_FOLDER_TREE_EVENT, { detail: { source } })
  );
}

/* ==================================================================
   LEGACY MIGRATION
================================================================== */

/**
 * Smart one-time migration from the old flat key.
 *
 * The legacy flat key stored a single global tree mixing subjects from all
 * studies. This migration attempts to detect which study each subject
 * belongs to by matching subject IDs against `subjectsByStudy`, then
 * distributes the tree nodes to the correct study-scoped keys.
 *
 * Subjects that can't be matched to any study are discarded (they were
 * the old mock seed data SUB-001..SUB-006, not real user-created subjects).
 * The legacy key is removed after migration so this runs only once.
 */
function checkLegacyMigration() {
  if (!hasStorage()) return;

  try {
    const legacyData = window.localStorage.getItem(LEGACY_FLAT_KEY);
    if (!legacyData) return;

    let legacyTree;
    try {
      const parsed = JSON.parse(legacyData);
      legacyTree = Array.isArray(parsed) ? parsed : parsed?.tree;
    } catch {
      legacyTree = null;
    }

    if (!Array.isArray(legacyTree) || legacyTree.length === 0) {
      window.localStorage.removeItem(LEGACY_FLAT_KEY);
      return;
    }

    // Read subjectsByStudy to figure out which study each subject belongs to
    // Use subjectService.getAllSubjects() to find which study each subject belongs to.
    const allSubjects = getAllSubjects();
    const studySubjectMap = new Map(); // studyId -> [subject tree nodes]

    legacyTree.forEach((node) => {
      if (node.type !== "subject") return;

      // Find which study this subject belongs to via subjectService
      const match = allSubjects.find((s) => s.id === node.id);
      const matchedStudy = match ? match.studyId : null;

      if (matchedStudy) {
        if (!studySubjectMap.has(matchedStudy)) {
          studySubjectMap.set(matchedStudy, []);
        }
        studySubjectMap.get(matchedStudy).push(node);
      }
      // Unmatched subjects (old mock data) are silently discarded
    });

    // Migrate matched subjects to their study-scoped keys
    studySubjectMap.forEach((nodes, studyId) => {
      const key = subjectExplorerTreeKey(studyId);
      const existing = window.localStorage.getItem(key);
      if (existing) return; // Study already has its own tree, don't overwrite

      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: STORAGE_VERSION,
          migratedFrom: LEGACY_FLAT_KEY,
          updatedAt: new Date().toISOString(),
          tree: normalizeNodes(nodes),
        })
      );
    });

    // Remove the legacy key after successful migration
    window.localStorage.removeItem(LEGACY_FLAT_KEY);
  } catch {
    // Best-effort: if anything fails, leave the legacy key in place
    // and let the new study-scoped keys start empty.
  }
}

/**
 * Strip legacy mock subject records (SUB-001..SUB-006) from subjectsByStudy.
 * These were hardcoded in the old seed data and should never appear in the
 * sidebar's subject list. Runs once on module load, idempotent.
 */
function cleanupMockSubjectsFromMetadata() {
  if (!hasStorage()) return;

  try {
    // Mock subject cleanup is now handled centrally by subjectService.js
    // on module load (cleanupMockSubjectsFromMetadata). No need to do it
    // here — this function now only needs to handle legacy tree migration.
  } catch {
    // Best-effort: leave data intact if anything fails.
  }
}

// Run once on module load
checkLegacyMigration();
cleanupMockSubjectsFromMetadata();

/* ==================================================================
   RECONCILIATION WITH subjectsByStudy
================================================================== */

/**
 * Ensure the folder tree stays in sync with the real subject roster.
 *
 * - Any subject in `subjectsByStudy[studyId]` that has no tree node gets
 *   a default node auto-created (with its locked ICF folder).
 * - Any tree node whose id doesn't appear in `subjectsByStudy[studyId]`
 *   is kept in the tree (user may have created it independently), but
 *   a matching metadata record is ensured via SubjectRecordsService.
 *
 * This runs on every `loadFolderTree` call so the tree never shows
 * phantom subjects and never misses real ones.
 *
 * @param {string} studyId
 * @param {Array} tree
 * @returns {{ tree: Array, changed: boolean }}
 */
function reconcileWithSubjectsByStudy(studyId, tree) {
  if (!studyId || !Array.isArray(tree)) return { tree: tree || [], changed: false };

  try {
    // Use subjectService for cross-checked reads
    const records = getSubjectsForStudyFromService(studyId);
    const normalizedRecords = records.length > 0 ? records : null;

    let changed = false;
    let next = [...tree];

    // ALWAYS strip known legacy mock subject IDs (SUB-001..SUB-006) regardless
    // of whether subjectsByStudy exists — these should never appear anywhere.
    const cleaned = next.filter((node) => {
      if (node.type === "subject" && LEGACY_MOCK_SUBJECT_IDS.has(node.id)) {
        changed = true;
        return false;
      }
      return true;
    });
    next = cleaned;

    // When subjectsByStudy has records for this study, also remove tree subjects
    // whose IDs don't appear in the records (phantom subjects from a different
    // study, or subjects deleted via the metadata flow but not yet cleaned
    // from the tree).
    if (normalizedRecords !== null) {
      const recordIds = new Set<any>(
        normalizedRecords.filter((r) => r?.id).map((r) => r.id)
      );
      const realSubjectIds = new Set<any>(recordIds);
      const reconciled = next.filter((node) => {
        if (node.type !== "subject") return true;
        if (realSubjectIds.has(node.id)) return true;
        changed = true;
        return false;
      });
      next = reconciled;
    }

    // ADD tree nodes for subjects in subjectsByStudy that are missing from
    // the tree (e.g. created via StudySubjects.js's Add Subject flow but
    // never appeared in the explorer).
    if (normalizedRecords !== null) {
      normalizedRecords.forEach((record) => {
        if (!record?.id) return;
        const currentIds = new Set<any>(next.filter((n) => n.type === "subject").map((n) => n.id));
        if (!currentIds.has(record.id)) {
          next.push({
            id: record.id,
            name: record.id,
            type: "subject",
            children: [makeIcfFolder(record.id)],
            createdAt: record.createdAt || new Date().toISOString(),
          });
          changed = true;
        }
      });
    }

    return { tree: next, changed };
  } catch {
    return { tree, changed: false };
  }
}

/* ==================================================================
   PERSISTENCE
================================================================== */

/**
 * Read the tree from localStorage for a specific study.
 * A brand-new study starts with an empty tree (no static mock data).
 *
 * Accepts both the wrapped `{ version, tree }` payload and a bare array
 * so older/hand-edited data keeps working.
 */
export function loadFolderTree(studyId,seed: any = []) {
  const fallback = migrateLegacyDefaults(normalizeNodes(seed)).tree;

  if (!hasStorage()) {
    const { tree } = reconcileWithSubjectsByStudy(studyId, fallback);
    return tree;
  }

  try {
    const key = subjectExplorerTreeKey(studyId);
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      const { tree } = reconcileWithSubjectsByStudy(studyId, fallback);
      if (tree.length > 0) persist(studyId, tree);
      return tree;
    }

    const parsed = JSON.parse(raw);
    const stored = Array.isArray(parsed) ? parsed : parsed?.tree;

    if (!Array.isArray(stored)) {
      const { tree } = reconcileWithSubjectsByStudy(studyId, fallback);
      persist(studyId, tree);
      return tree;
    }

    const normalized = normalizeNodes(stored);
    const migrated = migrateLegacyDefaults(normalized);
    const { tree: reconciled, changed: reconChanged } =
      reconcileWithSubjectsByStudy(studyId, migrated.tree);

    // Only re-persist when something actually changed
    if (migrated.changed || reconChanged) persist(studyId, reconciled);

    return reconciled;
  } catch {
    return fallback;
  }
}

function persist(studyId, tree) {
  if (!hasStorage()) return true;

  try {
    const key = subjectExplorerTreeKey(studyId);
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        tree,
      })
    );
    return true;
  } catch (error) {
    if (error?.name === "QuotaExceededError") return false;
    return false;
  }
}

/** Persist an already-built tree and notify listeners. */
export function saveFolderTree(studyId, tree, source = "save") {
  const normalized = normalizeNodes(tree);
  const saved = persist(studyId, normalized);

  if (saved) emitTreeUpdate(source);

  return saved
    ? { ok: true, tree: normalized }
    : {
        ok: false,
        tree: normalized,
        error: "Storage limit reached. Unable to save folder changes.",
      };
}

/** Clear persisted folders for this study and start with an empty tree. */
export function resetFolderTree(studyId,seed: any = []) {
  const fresh = normalizeNodes(seed);
  persist(studyId, fresh);
  emitTreeUpdate("reset");
  return fresh;
}

/**
 * Subscribe to folder-tree changes (same tab via CustomEvent, other tabs
 * via the native `storage` event). Returns an unsubscribe function.
 */
export function subscribeFolderTree(studyId, handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }

  const key = subjectExplorerTreeKey(studyId);
  const onCustom = (event) => handler(event?.detail || {});
  const onStorage = (event) => {
    if (event.key === key) handler({ source: "storage" });
  };

  window.addEventListener(SUBJECT_FOLDER_TREE_EVENT, onCustom);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(SUBJECT_FOLDER_TREE_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/* ==================================================================
   LOOKUPS (pure)
================================================================== */

/** Depth-first search by id. Returns the node or null. */
export function findNodeById(nodes, nodeId) {
  if (!nodeId || !Array.isArray(nodes)) return null;

  for (const node of nodes) {
    if (node.id === nodeId) return node;

    const found = findNodeById(node.children, nodeId);
    if (found) return found;
  }

  return null;
}

/** Parent of `nodeId`, or null when the node is at root level / missing. */
export function findParentOf(nodes, nodeId, parent = null) {
  if (!nodeId || !Array.isArray(nodes)) return null;

  for (const node of nodes) {
    if (node.id === nodeId) return parent;

    const found = findParentOf(node.children, nodeId, node);
    if (found) return found;
  }

  return null;
}

/** Children of `parentId`; the root list when `parentId` is null. */
export function getChildren(nodes, parentId) {
  if (!parentId) return Array.isArray(nodes) ? nodes : [];
  return findNodeById(nodes, parentId)?.children || [];
}

/** Ids from the node down to the root (used to reveal a node). */
export function getAncestorIds(nodes, nodeId) {
  const path = [];
  let current = findParentOf(nodes, nodeId);

  while (current) {
    path.push(current.id);
    current = findParentOf(nodes, current.id);
  }

  return path;
}

/** Folder count inside a subtree, excluding the node itself. */
export function countDescendantFolders(node) {
  if (!node?.children?.length) return 0;

  return node.children.reduce(
    (total, child) => total + 1 + countDescendantFolders(child),
    0
  );
}

/** Total folders (subjects excluded) anywhere in the tree. */
export function countFolders(nodes) {
  if (!Array.isArray(nodes)) return 0;

  return nodes.reduce(
    (total, node) =>
      total + (node.type === "folder" ? 1 : 0) + countFolders(node.children),
    0
  );
}

/* ==================================================================
   VALIDATION
================================================================== */

/**
 * Validate a folder name for a given parent.
 *
 * Rules (Phase 3 requirement 6):
 *   - name is required (no empty / whitespace-only names)
 *   - no duplicate name under the same parent (case-insensitive)
 *   - length + illegal characters guarded so the tree stays readable
 *
 * `excludeId` skips a node during the duplicate check (used by rename,
 * so a folder does not clash with itself).
 *
 * Returns { valid: boolean, error: string }.
 */
export function validateFolderName(nodes, parentId, name,options: any = {}) {
  const { excludeId = null } = options;
  const trimmed = String(name ?? "").trim();

  if (!trimmed) {
    return { valid: false, error: "Folder name is required." };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Folder name cannot exceed ${MAX_NAME_LENGTH} characters.`,
    };
  }

  if (INVALID_NAME_CHARS.test(trimmed)) {
    return {
      valid: false,
      error: `Folder name cannot contain ${FOLDER_NAME_RULES.invalidCharsLabel}`,
    };
  }

  const duplicate = getChildren(nodes, parentId).some(
    (child) =>
      child.id !== excludeId &&
      child.name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  if (duplicate) {
    return {
      valid: false,
      error: `A folder named "${trimmed}" already exists here.`,
    };
  }

  return { valid: true, error: "" };
}

/* ==================================================================
   MUTATIONS
   Each returns { ok, tree, node?, error? } and persists on success,
   so the UI can update from one place after any CRUD operation.

   All mutations accept studyId as the first parameter so they persist
   to the correct study-scoped localStorage key.
================================================================== */

/**
 * Create a folder under `parentId`.
 * `parentId` may be a subject (requirement 1) or a folder (requirement 2 -
 * nesting is unlimited). Passing null creates at root level.
 */
export function createFolder(studyId, tree, parentId, name) {
  const working = clone(normalizeNodes(tree));

  if (parentId && !findNodeById(working, parentId)) {
    return { ok: false, tree, error: "Parent folder no longer exists." };
  }

  const check = validateFolderName(working, parentId, name);
  if (!check.valid) return { ok: false, tree, error: check.error };

  const folder = {
    id: createId(),
    name: String(name).trim(),
    type: "folder",
    children: [],
    createdAt: new Date().toISOString(),
  };

  if (parentId) {
    findNodeById(working, parentId).children.push(folder);
  } else {
    working.push(folder);
  }

  const saved = saveFolderTree(studyId, working, "create");
  if (!saved.ok) return { ok: false, tree, error: saved.error };

  return { ok: true, tree: saved.tree, node: folder };
}

/** Rename a folder. Subjects are not renameable in this phase. */
export function renameFolder(studyId, tree, nodeId, name) {
  const working = clone(normalizeNodes(tree));
  const node = findNodeById(working, nodeId);

  if (!node) return { ok: false, tree, error: "This folder no longer exists." };

  if (node.type === "subject") {
    return { ok: false, tree, error: "Subjects cannot be renamed here." };
  }

  if (isLockedFolder(node)) {
    return {
      ok: false,
      tree,
      error: "ICF is a system folder and cannot be renamed.",
    };
  }

  const parent = findParentOf(working, nodeId);
  const check = validateFolderName(working, parent?.id ?? null, name, {
    excludeId: nodeId,
  });
  if (!check.valid) return { ok: false, tree, error: check.error };

  node.name = String(name).trim();
  node.updatedAt = new Date().toISOString();

  const saved = saveFolderTree(studyId, working, "rename");
  if (!saved.ok) return { ok: false, tree, error: saved.error };

  return { ok: true, tree: saved.tree, node: findNodeById(saved.tree, nodeId) };
}

/**
 * Delete a folder and everything nested inside it (requirement 4).
 * Subjects are never deleted by folder management.
 */
export function deleteFolder(studyId, tree, nodeId) {
  const working = clone(normalizeNodes(tree));
  const target = findNodeById(working, nodeId);

  if (!target) {
    return { ok: false, tree, error: "This folder no longer exists." };
  }

  if (target.type === "subject") {
    return { ok: false, tree, error: "Subjects cannot be deleted here." };
  }

  if (isLockedFolder(target)) {
    return {
      ok: false,
      tree,
      error: "ICF is a system folder and cannot be deleted.",
    };
  }

  const removedIds = [target.id];
  const collect = (node) =>
    (node.children || []).forEach((child) => {
      removedIds.push(child.id);
      collect(child);
    });
  collect(target);

  const prune = (list) =>
    list
      .filter((node) => node.id !== nodeId)
      .map((node) => ({ ...node, children: prune(node.children || []) }));

  const saved = saveFolderTree(studyId, prune(working), "delete");
  if (!saved.ok) return { ok: false, tree, error: saved.error };

  return { ok: true, tree: saved.tree, removedIds };
}

/* ==================================================================
   SUBJECT CRUD (Update 6)
   Dedicated mutations for top-level subject nodes. Kept separate from
   createFolder/renameFolder/deleteFolder above (which continue to refuse
   subjects) so existing folder CRUD behaviour is unchanged.
================================================================== */

/** Suggested next subject id (e.g. "SUB-007") - a default, not a lock-in;
 *  the create dialog lets the user override it before submitting. */
export function generateSubjectId(tree) {
  return nextSubjectId(Array.isArray(tree) ? tree : []);
}

/**
 * Validate a subject name.
 *
 * Subjects live at the tree root, so uniqueness is checked against other
 * top-level subjects only (mirrors validateFolderName's same-parent rule).
 * `excludeId` skips a subject during the duplicate check (used by edit).
 */
export function validateSubjectName(tree, name,options: any = {}) {
  const { excludeId = null } = options;
  const trimmed = String(name ?? "").trim();

  if (!trimmed) {
    return { valid: false, error: "Subject name is required." };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Subject name cannot exceed ${MAX_NAME_LENGTH} characters.`,
    };
  }

  if (INVALID_NAME_CHARS.test(trimmed)) {
    return {
      valid: false,
      error: `Subject name cannot contain ${FOLDER_NAME_RULES.invalidCharsLabel}`,
    };
  }

  const duplicate = (Array.isArray(tree) ? tree : [])
    .filter((node) => node.type === "subject")
    .some(
      (node) =>
        node.id !== excludeId &&
        node.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

  if (duplicate) {
    return {
      valid: false,
      error: `A subject named "${trimmed}" already exists.`,
    };
  }

  return { valid: true, error: "" };
}

/** Create a new top-level subject - seeded with only its locked ICF folder. */
export function createSubject(studyId, tree, name) {
  const working = clone(normalizeNodes(tree));

  const check = validateSubjectName(working, name);
  if (!check.valid) return { ok: false, tree, error: check.error };

  const subjectId = nextSubjectId(working);
  const subject = {
    id: subjectId,
    name: String(name).trim(),
    type: "subject",
    children: [makeIcfFolder(subjectId)],
    createdAt: new Date().toISOString(),
  };

  working.push(subject);

  const saved = saveFolderTree(studyId, working, "create-subject");
  if (!saved.ok) return { ok: false, tree, error: saved.error };

  return { ok: true, tree: saved.tree, node: subject };
}

/** Edit (rename) a subject. Only ever targets a `type: "subject"` node. */
export function renameSubject(studyId, tree, subjectId, name) {
  const working = clone(normalizeNodes(tree));
  const node = findNodeById(working, subjectId);

  if (!node) return { ok: false, tree, error: "This subject no longer exists." };
  if (node.type !== "subject") {
    return { ok: false, tree, error: "Only subjects can be edited here." };
  }

  const check = validateSubjectName(working, name, { excludeId: subjectId });
  if (!check.valid) return { ok: false, tree, error: check.error };

  node.name = String(name).trim();
  node.updatedAt = new Date().toISOString();

  const saved = saveFolderTree(studyId, working, "edit-subject");
  if (!saved.ok) return { ok: false, tree, error: saved.error };

  return {
    ok: true,
    tree: saved.tree,
    node: findNodeById(saved.tree, subjectId),
  };
}

/**
 * Delete a subject and everything nested inside it (its whole folder tree),
 * same semantics as deleteFolder but for a top-level subject.
 */
export function deleteSubject(studyId, tree, subjectId) {
  const working = clone(normalizeNodes(tree));
  const target = findNodeById(working, subjectId);

  if (!target) {
    return { ok: false, tree, error: "This subject no longer exists." };
  }
  if (target.type !== "subject") {
    return { ok: false, tree, error: "Only subjects can be deleted here." };
  }

  const removedIds = [target.id];
  const collect = (node) =>
    (node.children || []).forEach((child) => {
      removedIds.push(child.id);
      collect(child);
    });
  collect(target);

  const remaining = working.filter((node) => node.id !== subjectId);

  const saved = saveFolderTree(studyId, remaining, "delete-subject");
  if (!saved.ok) return { ok: false, tree, error: saved.error };

  return { ok: true, tree: saved.tree, removedIds };
}

const FolderTreeService = {
  subjectExplorerTreeKey,
  loadFolderTree,
  saveFolderTree,
  resetFolderTree,
  subscribeFolderTree,
  findNodeById,
  findParentOf,
  getChildren,
  getAncestorIds,
  countFolders,
  countDescendantFolders,
  validateFolderName,
  createFolder,
  renameFolder,
  deleteFolder,
  generateSubjectId,
  validateSubjectName,
  createSubject,
  renameSubject,
  deleteSubject,
  isLockedFolder,
};

export default FolderTreeService;
