/**
 * Subject Explorer - useSubjectWorkspace (Phase 5)
 * ================================================
 *
 * The single integration point between the Subject Explorer sidebar, the
 * workspace breadcrumb/header and the Subject File Manager.
 *
 * It owns the *shared* state that Phase 5 introduces - which folder is
 * selected - and exposes everything the workspace needs to render around it:
 * the live folder tree, the resolved node, the breadcrumb trail, and the file
 * count for that folder.
 *
 * Why a hook rather than more state in the page
 * --------------------------------------------
 * Phase 4's SubjectFileManager already subscribes to both services on its
 * own, so it keeps working standalone. Putting the shared wiring in a hook
 * means the page component stays declarative, and any future view (a detail
 * page, a modal) can reuse the exact same behaviour by calling this hook.
 *
 * Responsibilities
 * ----------------
 * 1. Selection state, persisted through workspaceSelectionService so it
 *    survives a page refresh, and restored against the live tree on mount.
 * 2. Auto-refresh after folder OR file CRUD: it subscribes to both service
 *    change events, so a create/rename/delete anywhere updates the
 *    breadcrumb, the folder name and the file count immediately.
 * 3. Self-healing selection: when the selected folder is deleted (or its id
 *    no longer resolves), the selection falls back to the nearest surviving
 *    ancestor, otherwise it clears. A stale id never strands the workspace.
 *
 * All reads/writes go through the three services, so nothing here needs to
 * change when a backend is added.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import FolderTreeService from "./folderTreeService";
import FileService from "./fileService";
import WorkspaceSelectionService from "./workspaceSelectionService";

/**
 * @param {object}  options
 * @param {string}  options.studyId   required for study-scoped tree storage
 * @param {Array}   options.seedTree  seed used on first run
 * @param {boolean} options.persist   persist the selection (default true)
 */
export default function useSubjectWorkspace({
  studyId = "",
  seedTree = [],
  persist = true,
}: any = {}) {
  /* ---------- hard guard: falsy studyId would silently share the "global" bucket */
  useEffect(() => {
    if (!studyId) {
      console.error(
        "[TriaNXT] useSubjectWorkspace: studyId is falsy. " +
          "This would cause subjects to leak across studies via the 'global' bucket. " +
          "Ensure studyId is resolved before mounting the Subject Explorer.",
      );
    }
  }, [studyId]);

  /* ---------- persisted domains ---------- */
  const [tree, setTree] = useState(() =>
    FolderTreeService.loadFolderTree(studyId, seedTree),
  );
  const [store, setStore] = useState(() => FileService.loadFileStore(studyId));

  /**
   * BUG FIX: the two lines above only run their `useState` initializer on
   * the very first mount. When the workspace is reused for a *different*
   * study - e.g. the parent page stays mounted and only its `studyId` prop
   * changes because the user clicked another study in the sidebar - `tree`
   * and `store` kept holding the previous study's data. The subject list
   * then showed the last-opened study's subjects instead of the newly
   * selected study's, until a full page reload re-ran the initializers.
   *
   * Re-load both domains explicitly whenever `studyId` changes so the
   * workspace always reflects the study currently being viewed, with no
   * reload required.
   */
  useEffect(() => {
    setTree(FolderTreeService.loadFolderTree(studyId, seedTree));
    setStore(FileService.loadFileStore(studyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  /* ---------- shared selection ---------- */
  // Restored from storage on the very first render so there is no flash of
  // "no folder selected" before an effect runs.
  const [selectedId, setSelectedId] = useState(() =>
    persist ? WorkspaceSelectionService.loadSelectedFolderId() : null,
  );

  /* ==============================================================
     AUTO-REFRESH AFTER CRUD (requirement 6)
  ============================================================== */

  /**
   * Folder CRUD. Re-read on every source, not just "storage": the explorer
   * writes through the service, so this is how the breadcrumb and header
   * stay in step with a create/rename/delete in the sidebar.
   */
  useEffect(
    () =>
      FolderTreeService.subscribeFolderTree(studyId, () => {
        setTree(FolderTreeService.loadFolderTree(studyId, seedTree));
      }),
    [studyId, seedTree],
  );

  /**
   * Subjects CRUD from StudySubjects.js (the "Add Subject" button in the
   * subject table) writes to `subjectsByStudy` and dispatches
   * `subjects-updated`, but does NOT touch the folder tree directly.
   * Reconcile the tree on that event so new subjects appear in the
   * explorer immediately without requiring a full page reload.
   */
  useEffect(() => {
    const reconcile = () => {
      setTree(FolderTreeService.loadFolderTree(studyId, seedTree));
    };
    window.addEventListener("subjects-updated", reconcile);
    return () => window.removeEventListener("subjects-updated", reconcile);
  }, [studyId, seedTree]);

  /** File CRUD - keeps the header's file count honest after upload/delete. */
  useEffect(
    () =>
      FileService.subscribeFiles(studyId, () => {
        setStore(FileService.loadFileStore(studyId));
      }),
    [studyId],
  );

  /** Selection changed in another tab. */
  useEffect(() => {
    if (!persist) return undefined;

    return WorkspaceSelectionService.subscribeSelection(
      ({ folderId, source }) => {
        if (source === "storage") setSelectedId(folderId || null);
      },
    );
  }, [persist]);

  /* ==============================================================
     DERIVED VALUES
  ============================================================== */

  /* Resolved against the live tree, so a rename is reflected at once and a
     deleted folder resolves to null. */
  const selectedFolder = useMemo(
    () => WorkspaceSelectionService.resolveSelection(tree, selectedId),
    [tree, selectedId],
  );

  const trail = useMemo(
    () => WorkspaceSelectionService.getSelectionTrail(tree, selectedId),
    [tree, selectedId],
  );

  const breadcrumb = useMemo(
    () => WorkspaceSelectionService.buildBreadcrumb(tree, selectedId),
    [tree, selectedId],
  );

  const folderPath = useMemo(
    () => WorkspaceSelectionService.formatSelectionPath(tree, selectedId),
    [tree, selectedId],
  );

  /* Files in the selected folder only (requirement 2). */
  const folderFiles = useMemo(
    () => FileService.listFiles(store, selectedFolder?.id || null),
    [store, selectedFolder],
  );

  const fileCount = folderFiles.length;
  const totalSize = useMemo(
    () => FileService.totalSize(folderFiles),
    [folderFiles],
  );

  /* ==============================================================
     SELF-HEALING SELECTION
  ============================================================== */

  /**
   * The stored id may point at a folder that has since been deleted. When
   * that happens, fall back to the nearest surviving ancestor so the user
   * lands somewhere sensible instead of an empty workspace.
   *
   * `selectedId` is read through a ref inside the effect body only for the
   * ancestor lookup; the effect itself depends on both values so it re-runs
   * whenever either changes.
   */
  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    if (!selectedId) return;
    // Still resolves - nothing to heal.
    if (FolderTreeService.findNodeById(tree, selectedId)) return;

    /* Walk the stored path-style id upward: "SUB-004/consent-forms/icf-v1"
       -> "SUB-004/consent-forms" -> "SUB-004". Ids generated at runtime are
       opaque, so this simply finds nothing and the selection clears. */
    const segments = String(selectedId).split("/");
    let recovered = null;

    for (let i = segments.length - 1; i > 0 && !recovered; i -= 1) {
      const candidateId = segments.slice(0, i).join("/");
      if (FolderTreeService.findNodeById(tree, candidateId)) {
        recovered = candidateId;
      }
    }

    setSelectedId(recovered);

    if (persistRef.current) {
      if (recovered) {
        WorkspaceSelectionService.saveSelectedFolderId(recovered, "heal");
      } else {
        WorkspaceSelectionService.clearSelectedFolderId("heal");
      }
    }
  }, [tree, selectedId]);

  /* ==============================================================
     ACTIONS
  ============================================================== */

  /**
   * Select a folder (accepts a node or a bare id).
   *
   * Writes through the service so the choice is persisted and every other
   * listener - including other tabs - hears about it.
   */
  const selectFolder = useCallback((nodeOrId) => {
    const id =
      typeof nodeOrId === "string" ||
      nodeOrId === null ||
      nodeOrId === undefined
        ? nodeOrId || null
        : nodeOrId.id || null;

    setSelectedId(id);

    if (!persistRef.current) return;

    if (id) WorkspaceSelectionService.saveSelectedFolderId(id, "select");
    else WorkspaceSelectionService.clearSelectedFolderId("select");
  }, []);

  const clearSelection = useCallback(() => selectFolder(null), [selectFolder]);

  return {
    /* live data */
    tree,
    store,

    /* selection */
    selectedId,
    selectedFolder,
    hasSelection: Boolean(selectedFolder),
    isSubjectNode: selectedFolder?.type === "subject",

    /* derived context */
    trail,
    breadcrumb,
    folderPath,

    /* files in the selected folder */
    folderFiles,
    fileCount,
    totalSize,

    /* actions */
    selectFolder,
    clearSelection,
  };
}
