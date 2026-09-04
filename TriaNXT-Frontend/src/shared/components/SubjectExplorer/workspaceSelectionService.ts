/**
 * Subject Explorer - WORKSPACE SELECTION SERVICE (mock / local state layer)
 * =========================================================================
 *
 * PHASE 5 SCOPE: workspace integration only. This module owns the one piece
 * of state that ties the explorer and the file manager together - which
 * folder is currently selected - plus the pure helpers that derive the
 * breadcrumb trail from it.
 *
 * Why a separate service
 * ----------------------
 * Phases 3 and 4 each persist their own domain (`folderTreeService` for the
 * tree, `fileService` for files). The selection belongs to neither: it is a
 * per-user view preference. Keeping it here means Phase 3/4 code is not
 * touched, and the components stay free of localStorage calls.
 *
 * API MIGRATION NOTE
 * ------------------
 * Only `loadSelectedFolderId` / `saveSelectedFolderId` / `clearSelectedFolderId`
 * talk to storage. To move the selection server-side (a "last opened folder"
 * user preference), replace those three bodies with HTTP calls; the pure
 * helpers below and every component keep working unchanged.
 *
 * Everything else in this file is a pure function of the tree, so it is
 * trivially testable and safe to call during render.
 */

import { findNodeById, getAncestorIds } from "./folderTreeService";

/* ==================================================================
   CONSTANTS
================================================================== */

/** localStorage key (follows the existing `trianxt*` naming convention). */
export const SUBJECT_SELECTION_KEY = "trianxtSubjectSelectedFolder";

/** Fired after the selection changes so other views can follow along. */
export const SUBJECT_SELECTION_EVENT = "trianxt-subject-selection-updated";

const STORAGE_VERSION = 1;

/** Static crumbs that precede the workspace-specific trail. */
export const BASE_BREADCRUMB = [
  { id: "dashboard", label: "Dashboard", to: "/sponsor-dashboard" },
  { id: "clinops", label: "Clinical Operations", to: null },
  { id: "subjects", label: "Subjects", to: null },
];

const hasStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage);

/* ==================================================================
   PERSISTENCE (requirement: preserve selection across page refresh)
================================================================== */

function emitSelectionUpdate(folderId, source) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(SUBJECT_SELECTION_EVENT, {
      detail: { folderId, source },
    })
  );
}

/**
 * Read the persisted folder id.
 *
 * Accepts the wrapped `{ version, folderId }` payload and a bare string, so
 * hand-edited or older values keep working. Returns null when nothing is
 * stored or the payload is unusable.
 */
export function loadSelectedFolderId() {
  if (!hasStorage()) return null;

  try {
    const raw = window.localStorage.getItem(SUBJECT_SELECTION_KEY);
    if (!raw) return null;

    // A bare id (not JSON) is still valid input.
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return raw || null;
    }

    if (typeof parsed === "string") return parsed || null;

    const id = parsed?.folderId;
    return typeof id === "string" && id ? id : null;
  } catch {
    // Never let a bad preference break the page.
    return null;
  }
}

/** Persist the selected folder id and notify listeners. */
export function saveSelectedFolderId(folderId, source = "select") {
  if (!folderId) return clearSelectedFolderId(source);
  if (!hasStorage()) {
    emitSelectionUpdate(folderId, source);
    return true;
  }

  try {
    window.localStorage.setItem(
      SUBJECT_SELECTION_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        folderId,
      })
    );
    emitSelectionUpdate(folderId, source);
    return true;
  } catch {
    // Quota/private-mode failures must not block the UI - the selection
    // simply will not survive a refresh.
    emitSelectionUpdate(folderId, source);
    return false;
  }
}

/** Forget the stored selection (used when the folder is deleted). */
export function clearSelectedFolderId(source = "clear") {
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(SUBJECT_SELECTION_KEY);
    } catch {
      /* ignore - nothing we can do, and nothing depends on it */
    }
  }

  emitSelectionUpdate(null, source);
  return true;
}

/**
 * Subscribe to selection changes (same tab via CustomEvent, other tabs via
 * the native `storage` event). Returns an unsubscribe function.
 */
export function subscribeSelection(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }

  const onCustom = (event) => handler(event?.detail || {});
  const onStorage = (event) => {
    if (event.key === SUBJECT_SELECTION_KEY) {
      handler({ folderId: loadSelectedFolderId(), source: "storage" });
    }
  };

  window.addEventListener(SUBJECT_SELECTION_EVENT, onCustom);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(SUBJECT_SELECTION_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/* ==================================================================
   DERIVED SELECTION (pure)
================================================================== */

/**
 * Resolve a stored id against the live tree.
 *
 * This is the guard that makes a persisted selection safe: the folder may
 * have been renamed, or deleted in another tab, since the id was written.
 * Returns the current node or null - callers treat null as "no selection".
 */
export function resolveSelection(tree, folderId) {
  if (!folderId) return null;
  return findNodeById(tree, folderId) || null;
}

/**
 * Ancestor chain from the root down to (and including) the selected node.
 *
 * `getAncestorIds` walks child -> root, so the ids are reversed here to read
 * naturally as a path. Returns [] when the node is not in the tree.
 */
export function getSelectionTrail(tree, folderId) {
  const node = resolveSelection(tree, folderId);
  if (!node) return [];

  const ancestors = getAncestorIds(tree, folderId)
    .map((id) => findNodeById(tree, id))
    .filter(Boolean)
    .reverse();

  return [...ancestors, node];
}

/**
 * Full breadcrumb for the page: the static page crumbs plus one crumb per
 * folder in the selection trail.
 *
 * Each crumb is `{ id, label, to, type, isFolder, isCurrent }` so the view
 * can render links, plain text and the active crumb without re-deriving
 * anything. Folder crumbs carry `type` ("subject" | "folder") so the
 * breadcrumb can show the matching icon.
 */
export function buildBreadcrumb(tree, folderId, base = BASE_BREADCRUMB) {
  const trail = getSelectionTrail(tree, folderId);

  const crumbs = [
    ...base.map((crumb) => ({
      ...crumb,
      type: "page",
      isFolder: false,
      isCurrent: false,
    })),
    ...trail.map((node) => ({
      id: node.id,
      label: node.name,
      to: null,
      type: node.type,
      isFolder: true,
      isCurrent: false,
    })),
  ];

  if (crumbs.length > 0) crumbs[crumbs.length - 1].isCurrent = true;

  return crumbs;
}

/** Human-readable path, e.g. `SUB-001 / Screening`. */
export function formatSelectionPath(tree, folderId, separator = " / ") {
  return getSelectionTrail(tree, folderId)
    .map((node) => node.name)
    .join(separator);
}

const WorkspaceSelectionService = {
  SUBJECT_SELECTION_KEY,
  SUBJECT_SELECTION_EVENT,
  BASE_BREADCRUMB,
  loadSelectedFolderId,
  saveSelectedFolderId,
  clearSelectedFolderId,
  subscribeSelection,
  resolveSelection,
  getSelectionTrail,
  buildBreadcrumb,
  formatSelectionPath,
};

export default WorkspaceSelectionService;
