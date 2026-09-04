/**
 * Subject Explorer - FOLDER STATISTICS SERVICE (Phase 6)
 * =====================================================
 *
 * Pure aggregation helpers that turn the Phase 3 folder tree and the Phase 4
 * file store into the numbers shown by the statistics strip:
 *
 *   - total folders
 *   - total files
 *   - storage used (real byte sum of the mock records)
 *
 * Nothing here touches storage or React. Every function is a pure function of
 * the data handed in, so the same helpers serve the whole-workspace summary
 * and the per-folder (subtree) summary without branching.
 *
 * API MIGRATION NOTE
 * ------------------
 * When a backend arrives these totals will most likely come from a single
 * `GET /subjects/stats` call. Replace `getWorkspaceStats` / `getFolderStats`
 * with that fetch and keep the returned shape identical - the components read
 * only the documented keys below, so no view code needs to change.
 *
 * Returned shape (all numbers):
 *   { totalFolders, totalSubjects, totalFiles, storageUsed, quota, usedPercent }
 */

import { listFiles } from "./fileService";

/**
 * Mock storage allowance used only to render the usage bar.
 *
 * A real deployment reports this per sponsor/site; it is a display-only value
 * so nothing in the app gates on it.
 */
export const MOCK_STORAGE_QUOTA = 2 * 1024 * 1024 * 1024; // 2 GB

/** Walk a node list depth-first, invoking `visit(node, depth)` on each. */
export function walkNodes(nodes, visit, depth = 0) {
  (nodes || []).forEach((node) => {
    visit(node, depth);
    walkNodes(node.children, visit, depth + 1);
  });
}

/** Every node id inside `nodes`, including `nodes` themselves. */
export function collectNodeIds(nodes) {
  const ids = [];
  walkNodes(nodes, (node) => ids.push(node.id));
  return ids;
}

/**
 * The selected node plus all of its descendants.
 *
 * Used for the per-folder scope so a subject row reports the totals of every
 * folder beneath it rather than just its own immediate bucket.
 */
export function collectSubtreeIds(node) {
  if (!node) return [];
  return [node.id, ...collectNodeIds(node.children)];
}

/** Sum the byte size of every file stored under `folderIds`. */
export function sumStorage(store, folderIds) {
  return (folderIds || []).reduce(
    (total, folderId) =>
      total +
      listFiles(store, folderId).reduce(
        (sub, file) => sub + (Number(file.size) || 0),
        0
      ),
    0
  );
}

/** Count every file stored under `folderIds`. */
export function countFiles(store, folderIds) {
  return (folderIds || []).reduce(
    (total, folderId) => total + listFiles(store, folderId).length,
    0
  );
}

/**
 * Build the stats payload for an explicit set of folder ids.
 *
 * `nodes` is only used to classify folders vs subjects, so callers that
 * already know their id list (a subtree, a filtered view) can reuse this.
 */
function buildStats(nodes, store, folderIds) {
  let totalFolders = 0;
  let totalSubjects = 0;

  walkNodes(nodes, (node) => {
    if (node.type === "subject") totalSubjects += 1;
    else totalFolders += 1;
  });

  const totalFiles = countFiles(store, folderIds);
  const storageUsed = sumStorage(store, folderIds);

  return {
    totalFolders,
    totalSubjects,
    totalFiles,
    storageUsed,
    quota: MOCK_STORAGE_QUOTA,
    usedPercent:
      MOCK_STORAGE_QUOTA > 0
        ? Math.min(100, (storageUsed / MOCK_STORAGE_QUOTA) * 100)
        : 0,
  };
}

/**
 * Totals across the entire workspace (every subject and folder).
 *
 * Subjects are counted separately from folders: a subject row is a container
 * in the tree but is not a user-created folder, and reporting it as one would
 * overstate the folder count.
 */
export function getWorkspaceStats(tree, store) {
  return buildStats(tree, store, collectNodeIds(tree));
}

/**
 * Totals for one selected node and everything nested inside it.
 *
 * Returns the same shape as `getWorkspaceStats` so a component can swap
 * scopes without special-casing. A null node yields zeroes.
 */
export function getFolderStats(node, store) {
  if (!node) {
    return {
      totalFolders: 0,
      totalSubjects: 0,
      totalFiles: 0,
      storageUsed: 0,
      quota: MOCK_STORAGE_QUOTA,
      usedPercent: 0,
    };
  }

  const children = node.children || [];
  const stats = buildStats(children, store, collectSubtreeIds(node));

  // `node` itself is the scope, not a child of it, so it is not counted.
  return stats;
}

/** Direct (non-recursive) child folder count for a node. */
export function countDirectFolders(node) {
  return (node?.children || []).length;
}

const FolderStatsService = {
  MOCK_STORAGE_QUOTA,
  walkNodes,
  collectNodeIds,
  collectSubtreeIds,
  sumStorage,
  countFiles,
  getWorkspaceStats,
  getFolderStats,
  countDirectFolders,
};

export default FolderStatsService;
