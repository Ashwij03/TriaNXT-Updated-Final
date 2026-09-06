import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MdSearch,
  MdClose,
  MdFolderOff,
  MdFolderOpen,
  MdCheckCircle,
  MdErrorOutline,
  MdWarningAmber,
  MdSwapVert,
  MdTune,
  MdFileDownload,
  MdArrowBack,
  MdFolderZip,
} from "react-icons/md";

import FileUploadButton from "./FileUploadButton";
import DragDropUpload from "./DragDropUpload";
import SubjectFolderUpload from "../subjects/SubjectFolderUpload";
import SubjectFileTable from "./SubjectFileTable";
import FilePreviewModal from "./FilePreviewModal";
import RenameFileModal from "./RenameFileModal";
import CreateFolderModal from "./CreateFolderModal";
import MoveFileDialog from "./MoveFileDialog";
import PermissionsModal from "./PermissionsModal";
import ESignatureModal from "../ESignatureModal";
import { recordSignatureLedgerEntry } from "../../services/actionSignatureService";
import FolderStatsBar from "./FolderStatsBar";
import FileFilterBar from "./FileFilterBar";
import PaginationFooter from "./PaginationFooter";
import FileService from "./fileService";
import FolderTreeService from "./folderTreeService";
import FolderStatsService from "./folderStatsService";
import FileFilterService, { DEFAULT_FILTERS } from "./fileFilterService";
import {
  formatFileSize,
  formatDateTime,
  readFileWithProgress,
} from "./fileService";
import { getExtension } from "./fileTypes";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../services/roleService";
import SubjectIcfSyncService from "../../services/subjectIcfSyncService";
import PERMISSIONS from "../../constants/permissions";
import { downloadCsvReport } from "../../utils/exportReport";
import "./SubjectFiles.css";
import "./DocumentExperience.css";

/**
 * Subject Explorer - SUBJECT FILE MANAGER (Phase 4 container)
 * ==========================================================
 *
 * Owns all file state for the folder currently selected in the explorer:
 * upload, list, search, sort, and the view/rename/download/delete actions.
 *
 * Design notes
 * ------------
 * - Every read/write goes through FileService, so swapping localStorage for
 *   real APIs later needs no changes here (see that module's migration note).
 * - The folder tree is read (never written) through FolderTreeService so the
 *   header can show the full folder path and orphaned file buckets can be
 *   pruned after a Phase 3 folder delete. Phase 1-3 files are untouched.
 * - The node handed down by the explorer is re-resolved by id on every
 *   render, so a folder renamed in Phase 3 shows its new name immediately.
 *
 * NOT in this phase: backend APIs, version history, sharing, permissions,
 * approval workflow.
 *
 * Props
 *   selectedFolder  node selected in the explorer ({ id, name, type }) or null
 */

const SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

/** Default direction per key: newest/largest first feels right for those. */
const DEFAULT_DIRECTION = {
  name: "asc",
  type: "asc",
  date: "desc",
  size: "desc",
};

function SubjectFileManager({
  selectedFolder,
  onSelectFolder,
  tree: treeProp,
  studyId = "",
  readOnly = false,
}: any) {
  const { user } = useAuth();
  const currentUser = user?.displayName || user?.name || "Unknown user";

  /* Document approval is gated on the existing admin permission system:
     only a user holding APPROVE_REGULATORY_DOCS sees/executes Approve. */
  const canApproveDocs = hasPermission(PERMISSIONS.APPROVE_REGULATORY_DOCS);

  /* ---------- persisted stores ---------- */
  const [store, setStore] = useState(() => FileService.loadFileStore(studyId));
  /* Bug 4 fix: receive the tree from the parent (useSubjectWorkspace) via
     the `tree` prop instead of loading our own copy. This eliminates the
     possibility of this component's tree drifting out of sync with the
     explorer sidebar's tree, which was the root cause of the "is empty"/
     0-folders bug when selecting a subject. */
  const tree = useMemo(() => treeProp || [], [treeProp]);

  /* ---------- view state ---------- */
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  /* Phase 6: advanced filters (type / uploaded date / size). */
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  /* Task 1.7/1.9: pagination footer for the file table (rows per page,
     current page, previous/next, "Showing X to Y of Z"). Reset alongside
     the rest of the per-folder view state below. */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------- interaction state ---------- */
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tone, message, details? }
  /* Staged single-file upload (parity with the shared document managers):
     the chosen file is read for real (progress 0-100%), then an explicit
     Save persists it through FileService. Multi-file picks skip the stage
     and keep the existing direct bulk upload behaviour. */
  const [stagedUpload, setStagedUpload] = useState(null); // { file, progress }
  const [savingStaged, setSavingStaged] = useState(false);
  const [dialog, setDialog] = useState(null); // { mode, file }
  const [submitError, setSubmitError] = useState("");
  /* Phase 6: create-subfolder from the empty state. */
  const [creatingFolder, setCreatingFolder] = useState(false);
  /* Phase 7: true while the async folder read is in flight (see note below). */
  const [loadingFiles, setLoadingFiles] = useState(false);
  /* Mandatory E-Signature gate — { mode, entityType, entityName, actionLabel,
      onSigned }. While set the shared E-Signature modal is shown and the
      requested upload/edit/delete is not committed until the user signs. */
  const [signing, setSigning] = useState(null);

  /* Bulk folder upload dialog (drop / pick a whole directory tree). */
  const [showFolderUpload, setShowFolderUpload] = useState(false);

  const folderId = selectedFolder?.id || null;

  /* ==============================================================
     SYNC WITH PERSISTED DATA
  ============================================================== */

  /**
   * Files changed -> reload from the persisted store.
   *
   * Phase 5: this listens to EVERY source, not just "storage". The workspace
   * now has more than one writer (this panel, and anything else driven by
   * `useSubjectWorkspace`), so filtering to cross-tab events alone would let
   * this table drift out of step with the folder bar's file count.
   *
   * Re-reading after a local mutation is harmless: the value being loaded is
   * exactly what was just written, so the state lands on the same store.
   */
  useEffect(
    () =>
      FileService.subscribeFiles(studyId, () => {
        setStore(FileService.loadFileStore(studyId));
      }),
    [studyId],
  );

  /* All folder ids currently present in the tree. */
  const existingFolderIds = useMemo(() => {
    const ids = [];
    const walk = (nodes) =>
      (nodes || []).forEach((node) => {
        ids.push(node.id);
        walk(node.children);
      });
    walk(tree);
    return ids;
  }, [tree]);

  /**
   * Drop file buckets whose folder was deleted in the sidebar.
   *
   * Phase 3's deleteFolder intentionally knows nothing about files, so this
   * keeps the two stores consistent without touching that module.
   *
   * The prune runs outside the state updater because it writes to storage;
   * updater functions must stay pure (StrictMode double-invokes them).
   * `store` is read from the ref so this effect does not re-run on every
   * upload/rename/delete - only when the folder tree itself changes.
   */
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (existingFolderIds.length === 0) return;

    const result = FileService.pruneOrphanFolders(
      studyId,
      storeRef.current,
      existingFolderIds,
    );

    if (result.changed) setStore(result.store);
  }, [existingFolderIds, studyId]);

  /* Reset the per-folder view state when the selection changes. */
  const previousFolderId = useRef(folderId);
  useEffect(() => {
    if (previousFolderId.current === folderId) return;
    previousFolderId.current = folderId;
    setSearch("");
    setFeedback(null);
    setDialog(null);
    setSubmitError("");
    setStagedUpload(null);
    setSavingStaged(false);
    // Phase 6: filters are per-folder too - carrying a PDF filter into a
    // folder with no PDFs would look like an empty folder.
    setFilters(DEFAULT_FILTERS);
    setShowFilters(false);
    setCreatingFolder(false);
    setPage(1);
  }, [folderId]);

  /* ---------- cross-surface ICF reconciliation ----------
     A subject's locked system ICF folder has the deterministic explorer id
     "<subjectId>/icf". Both directions of the mirror live here:
       - OPENING the folder pulls any consent documents uploaded on the
         document hub (folderService store) into this file manager.
       - UPLOADING / duplicating / moving records in the folder pushes
         explorer-origin files back to the hub (see the mutation handlers
         below), so eISF / subject-document surfaces list them too. */
  const subjectOfIcfFolder = useCallback((candidateId) => {
    if (!candidateId) return null;
    const match = String(candidateId).match(/^([^/]+)\/icf$/i);
    return match ? match[1] : null;
  }, []);

  const isIcfFolderOpen = useMemo(
    () => Boolean(subjectOfIcfFolder(folderId)),
    [folderId, subjectOfIcfFolder],
  );

  const icfSubjectId = useMemo(
    () => subjectOfIcfFolder(folderId),
    [folderId, subjectOfIcfFolder],
  );

  /* Reconcile the hub mirror for the subject(s) touched by a write: the
     hub export only writes when the explorer bucket changed, so it is safe
     to call after any successful mutation. */
  const mirrorIcfToHub = useCallback(
    (subjectIds) => {
      if (!studyId) return;
      (subjectIds || []).forEach((subjectId) => {
        if (subjectId) {
          SubjectIcfSyncService.syncExplorerIcfToHub({ studyId, subjectId });
        }
      });
    },
    [studyId],
  );

  useEffect(() => {
    if (!isIcfFolderOpen || !icfSubjectId || !studyId) return undefined;

    const result = SubjectIcfSyncService.syncHubIcfToExplorer({
      studyId,
      subjectId: icfSubjectId,
    });

    // The sync persisted through FileService (emitting its own change
    // event), but reload explicitly so this folder's rows are never one
    // store-read behind the just-imported records.
    if (result.changed) {
      setStore(FileService.loadFileStore(studyId));
    }

    return undefined;
  }, [isIcfFolderOpen, icfSubjectId, studyId]);

  /**
   * Phase 7: drive the table's skeleton from the async read seam.
   *
   * Reads go through `FileService.fetchFolderFiles`, the async counterpart to
   * the synchronous `listFiles` selector. This is a real await, not a timer -
   * nothing is delayed artificially.
   *
   * Measured behaviour: against today's localStorage layer the promise settles
   * on a microtask, so React batches the true -> false transition into a single
   * commit and the skeleton does not paint. That is the correct outcome - the
   * rows are already in hand, so flashing a placeholder over them would only
   * slow the folder switch down. Verified against a latency-injected build,
   * this same code holds the skeleton for the full duration of the request, so
   * a real backend needs no further changes here.
   *
   * Only the folder id is in the dependency list. Keying this on `store` too
   * would flash a skeleton after every upload, rename and delete, which would
   * hide rows the app already has - the case that was rightly rejected before.
   *
   * The rows themselves keep coming from the `folderFiles` memo below, so the
   * persisted store stays the single source of truth and this cannot drift
   * from the folder bar's count. On migration, the resolved array is what you
   * feed into `setStore` here.
   */
  useEffect(() => {
    if (!folderId) {
      setLoadingFiles(false);
      return undefined;
    }

    // Guards against a stale read landing after a fast folder switch.
    const controller = new AbortController();
    let active = true;

    setLoadingFiles(true);

    FileService.fetchFolderFiles(storeRef.current, folderId, {
      signal: controller.signal,
    })
      .catch(() => {
        // Aborted or failed: the store-derived rows remain correct, so there
        // is nothing to surface here. A real backend would set an error state.
      })
      .finally(() => {
        if (active) setLoadingFiles(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [folderId]);

  /* Transient success/error banner. */
  useEffect(() => {
    if (!feedback) return undefined;
    // Multi-file validation summaries stay until dismissed - they render a
    // list the user needs time to read. A single rejection is one sentence
    // in the message itself, so it auto-dismisses like any other alert.
    if (feedback.details?.length > 1) return undefined;

    const timer = setTimeout(() => setFeedback(null), 3200);
    return () => clearTimeout(timer);
  }, [feedback]);

  /* ==============================================================
     DERIVED DATA
  ============================================================== */

  /* Re-resolve the node from the tree so a Phase 3 rename is reflected. */
  const folderNode = useMemo(
    () => (folderId ? FolderTreeService.findNodeById(tree, folderId) : null),
    [tree, folderId],
  );

  const folderName = folderNode?.name || selectedFolder?.name || "";
  const isSubjectNode =
    (folderNode?.type || selectedFolder?.type) === "subject";

  /* One-level-up navigation target for the header's Back button. A subject
     node sits at the root of the tree (no parent), so the button only shows
     for folders/subfolders nested under a subject - clicking it steps up
     exactly one level (e.g. a sub-subfolder of ICF -> ICF -> the subject),
     never further. */
  const parentNode = useMemo(
    () => (folderId ? FolderTreeService.findParentOf(tree, folderId) : null),
    [tree, folderId],
  );

  const handleBackOneLevel = useCallback(() => {
    if (parentNode && typeof onSelectFolder === "function") {
      onSelectFolder(parentNode);
    }
  }, [parentNode, onSelectFolder]);

  /* Child folders of the currently selected node - shown in the workspace
     when the selected node is a subject (or a folder) that has subfolders.
     This bridges the gap between the sidebar (which shows subfolders) and
     the workspace (which only showed files, making subjects with only
     subfolders look empty). */
  const childFolders = useMemo(
    () =>
      (folderNode?.children || []).filter((child) => child.type !== "subject"),
    [folderNode],
  );

  /* Breadcrumb path from the root down to the selected folder. */
  const folderPath = useMemo(() => {
    if (!folderId) return [];

    const ancestors = FolderTreeService.getAncestorIds(tree, folderId)
      .map((id) => FolderTreeService.findNodeById(tree, id)?.name)
      .filter(Boolean)
      .reverse();

    return [...ancestors, folderName].filter(Boolean);
  }, [tree, folderId, folderName]);

  const folderFiles = useMemo(
    () => FileService.listFiles(store, folderId),
    [store, folderId],
  );

  /**
   * Phase 6 pipeline: filters -> search -> sort.
   *
   * Filtering first means the "N of M" counter and the empty-state choice
   * both reason about the same set the user narrowed to.
   */
  const filteredFiles = useMemo(
    () => FileFilterService.applyFilters(folderFiles, filters),
    [folderFiles, filters],
  );

  const visibleFiles = useMemo(
    () =>
      FileService.sortFiles(
        FileService.searchFiles(filteredFiles, search),
        sortKey,
        sortDir,
      ),
    [filteredFiles, search, sortKey, sortDir],
  );

  /* Task 1.7: paginate the already filtered/searched/sorted rows. Reset to
     page 1 whenever the visible set shrinks below the current page (e.g. a
     filter narrows the result set) so the table never renders an empty
     page while later pages still have rows. */
  const totalPages = Math.max(1, Math.ceil(visibleFiles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedFiles = useMemo(
    () => visibleFiles.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visibleFiles, safePage, pageSize],
  );

  const activeFilterCount = useMemo(
    () => FileFilterService.countActiveFilters(filters),
    [filters],
  );

  /* Requirement 2: folders / files / storage for the selected subtree. */
  const stats = useMemo(
    () => FolderStatsService.getFolderStats(folderNode, store),
    [folderNode, store],
  );

  /* ==============================================================
     HANDLERS
  ============================================================== */

  /** Open the mandatory E-Signature step before an action commits. */
  const openSignature = (request) => setSigning(request);

  /** Signature-ledger scope for subject-file mutations. */
  const signatureScope = {
    domain: "subjects",
    studyId,
    folderId,
  };

  const signEntity = (kind, entityType, entityName, signature, details = {}) => {
    recordSignatureLedgerEntry(signature, {
      kind,
      entityType,
      entityName,
      details,
      scope: signatureScope,
    });
  };

  /** Requirement 1 + 8: persist files through FileService + report feedback. */
  const persistFiles = useCallback(
    async (filesArray, signature = null) => {
      const result = await FileService.uploadFiles(
        studyId,
        store,
        folderId,
        filesArray,
        currentUser,
        signature,
      );

      if (!result.ok) {
        setFeedback({
          tone: "error",
          message: result.error,
          details: result.rejected,
        });
        return result;
      }

      setStore(result.store);

      // Explorer -> hub mirror: files uploaded directly into a subject's
      // locked ICF folder are pushed to the document hub's ICF folder so the
      // eISF / subject-document surfaces list them as well (the two surfaces
      // use separate localStorage stores - see subjectIcfSyncService).
      if (icfSubjectId) {
        mirrorIcfToHub([icfSubjectId]);
      }

      const count = result.added.length;
      const base = `${count} ${count === 1 ? "file" : "files"} uploaded to "${folderName}".`;

      setFeedback({
        tone: result.rejected.length > 0 ? "warning" : "success",
        message:
          result.rejected.length > 0
            ? `${base} ${result.rejected.length} ${
                result.rejected.length === 1 ? "file was" : "files were"
              } skipped.`
            : result.warning
              ? `${base} ${result.warning}`
              : base,
        details: result.rejected,
      });

      return result;
    },
    [studyId, store, folderId, folderName, currentUser, icfSubjectId, mirrorIcfToHub],
  );

  /**
   * Stage a single file: validate immediately, then read the real bytes off
   * disk (progress 0-99%). Progress reaches 100% only after the whole file
   * has been read, at which point the Save action appears. Nothing is
   * persisted until Save is clicked.
   */
  const startStagedUpload = useCallback(
    async (file) => {
      if (savingStaged) return;

      const candidate = FileService.validateUploadCandidate(file);
      if (!candidate.valid) {
        setFeedback({ tone: "error", message: candidate.error });
        return;
      }

      const nameCheck = FileService.validateFileName(store, folderId, file.name);
      if (!nameCheck.valid) {
        setFeedback({ tone: "error", message: nameCheck.error });
        return;
      }

      setStagedUpload({ file, progress: 0 });

      try {
        await readFileWithProgress(file, (progress) => {
          setStagedUpload((current) =>
            current && current.file === file
              ? { ...current, progress }
              : current,
          );
        });
      } catch (error) {
        setStagedUpload(null);
        setFeedback({
          tone: "error",
          message:
            (error && error.message) || "The file could not be read.",
        });
        return;
      }

      // Whole file read -> real 100%. The Save button appears only now.
      setStagedUpload((current) =>
        current && current.file === file
          ? { ...current, progress: 100 }
          : current,
      );
    },
    [store, folderId, savingStaged],
  );

  const handleCancelStaged = useCallback(() => {
    if (savingStaged) return;
    setStagedUpload(null);
  }, [savingStaged]);

  const handleSaveStaged = useCallback(async () => {
    if (!stagedUpload || stagedUpload.progress < 100 || savingStaged) return;

    // Mandatory E-Signature BEFORE the file is persisted.
    openSignature({
      mode: "upload",
      entityType: "file",
      entityName: stagedUpload.file?.name || "file upload",
      actionLabel: `Upload "${stagedUpload.file?.name || "file"}" to "${folderName}".`,
      onSigned: async (signature) => {
        setSavingStaged(true);
        try {
          const result = await persistFiles([stagedUpload.file], signature);
          if (result?.ok) setStagedUpload(null);
        } finally {
          setSavingStaged(false);
        }
      },
    });
  }, [stagedUpload, savingStaged, persistFiles, folderName]);

  /**
   * Requirement 1 + 8: upload entry point.
   *
   * A single selected file is staged first (real progress to 100%, then an
   * explicit Save) for parity with the shared document managers' upload UX.
   * Multiple files keep the existing direct bulk upload behaviour.
   */
  const handleUpload = useCallback(
    async (fileList) => {
      if (readOnly) return;
      if (!folderId) {
        setFeedback({
          tone: "error",
          message: "Select a folder in the explorer before uploading files.",
        });
        return;
      }

      const filesArray = Array.from(fileList || []);
      if (filesArray.length === 0) return;

      if (filesArray.length === 1 && filesArray[0]) {
        await startStagedUpload(filesArray[0]);
        return;
      }

      // Bulk upload — ONE mandatory E-Signature authorizes the whole batch.
      const sample = filesArray
        .slice(0, 2)
        .map((file: any) => file?.name || "")
        .filter(Boolean)
        .join(", ");
      openSignature({
        mode: "upload",
        entityType: "file",
        entityName: `${filesArray.length} files${sample ? ` — ${sample}${filesArray.length > 2 ? " …" : ""}` : ""}`,
        actionLabel: `Upload ${filesArray.length} file(s) to "${folderName}".`,
        onSigned: async (signature) => {
          setUploading(true);
          try {
            await persistFiles(filesArray, signature);
          } finally {
            setUploading(false);
          }
        },
      });
    },
    [readOnly, folderId, persistFiles, startStagedUpload, folderName],
  );

  /**
   * Approve a Pending Review file. Gated on the APPROVE_REGULATORY_DOCS
   * permission and on the file actually being in Pending Review - both are
   * enforced here and again in FileService.approveFile.
   */
  const handleApprove = useCallback(
    (file) => {
      if (!file || !canApproveDocs) return;

      if (String(file.status || "").trim().toLowerCase() !== "pending review") {
        return;
      }

      const result = FileService.approveFile(
        studyId,
        store,
        folderId,
        file.id,
        currentUser,
      );

      if (!result.ok) {
        setFeedback({ tone: "error", message: result.error });
        return;
      }

      setStore(result.store);
      setFeedback({
        tone: "success",
        message: `"${result.file.name}" approved.`,
      });

      // Keep the open details panel in sync with the approved record.
      setDialog((current) =>
        current?.mode === "preview" && current.file?.id === file.id
          ? { ...current, file: result.file }
          : current,
      );
    },
    [canApproveDocs, studyId, store, folderId, currentUser],
  );

  /**
   * Requirement 6: clicking the active column flips the direction, a new
   * column adopts its default direction.
   *
   * Both setters are called from the event handler rather than nesting one
   * inside the other's updater - updater functions must stay pure, and React
   * StrictMode double-invokes them (which would toggle the direction twice
   * and appear to do nothing).
   */
  const handleSort = useCallback(
    (key) => {
      if (key === sortKey) {
        setSortDir(sortDir === "asc" ? "desc" : "asc");
        return;
      }
      setSortKey(key);
      setSortDir(DEFAULT_DIRECTION[key] || "asc");
    },
    [sortKey, sortDir],
  );

  /* ---------- Phase 6: advanced filters ---------- */
  const patchFilters = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  /**
   * Drop a filter value whose option no longer exists.
   *
   * The type options are derived from the folder's files, so deleting the last
   * PDF while "PDF" was selected left the `<select>` with a value that matched
   * no option: the browser painted "All types" while the state still filtered
   * on PDF, so the table showed nothing and the control contradicted it.
   *
   * `reconcileFilters` returns the *same* object when nothing is stale, so this
   * is a no-op on almost every render and cannot loop. Uploads are covered too
   * - adding a file only ever widens the option list.
   */
  useEffect(() => {
    setFilters((prev) => FileFilterService.reconcileFilters(prev, folderFiles));
  }, [folderFiles]);

  /* Task 1.7: CSV export of the currently visible (filtered/searched) rows -
     no existing export utility was tied to file tables, so this reuses the
     app's shared `utils/exportReport.js` CSV helper (already used by
     Reports/Logs elsewhere) rather than inventing a new one. */
  const handleExportFiles = useCallback(() => {
    const header = ["Name", "Type", "Size", "Uploaded"];
    const rows = visibleFiles.map((file) => [
      file.name,
      getExtension(file.name).toUpperCase(),
      formatFileSize(file.size || 0),
      formatDateTime(file.uploadedAt || ""),
    ]);
    downloadCsvReport(`${folderName || "files"}-files`, [header, ...rows]);
  }, [visibleFiles, folderName]);

  /* Stable callbacks handed to the memoised table (Phase 7). */
  const clearSearch = useCallback(() => setSearch(""), []);
  const openCreateFolder = useCallback(() => {
    if (readOnly) return;
    setSubmitError("");
    setCreatingFolder(true);
  }, [readOnly]);
  const dismissFeedback = useCallback(() => setFeedback(null), []);
  const toggleFilters = useCallback(() => setShowFilters((prev) => !prev), []);
  const flipSortDir = useCallback(
    () => setSortDir((prev) => (prev === "asc" ? "desc" : "asc")),
    [],
  );

  /* ---------- Phase 6: create a subfolder from the empty state ---------- */
  const validateNewFolder = useCallback(
    (name) => FolderTreeService.validateFolderName(tree, folderId, name),
    [tree, folderId],
  );

  const submitCreateFolder = (name) => {
    if (readOnly) return;
    const trimmed = String(name || "").trim();

    // Mandatory E-Signature BEFORE the folder is created.
    openSignature({
      mode: "create",
      entityType: "folder",
      entityName: trimmed,
      actionLabel: `Create folder "${trimmed}" inside "${folderName}".`,
      onSigned: async (signature) => {
        const result = FolderTreeService.createFolder(
          studyId,
          tree,
          folderId,
          trimmed,
        );

        if (!result.ok) {
          setSubmitError(result.error);
          return;
        }

        // The service persists and emits a SUBJECT_FOLDER_TREE_EVENT, which
        // useSubjectWorkspace picks up and refreshes the tree prop flowing
        // back into this component. No local setTree needed.
        signEntity("folder:create", "folder", trimmed, signature, { folderId });
        setCreatingFolder(false);
        setSubmitError("");
        setFeedback({
          tone: "success",
          message: `Folder "${result.node.name}" created in "${folderName}".`,
        });
      },
    });
  };

  const handleDownload = useCallback((file) => {
    const result = FileService.downloadFile(file);

    setFeedback(
      result.ok
        ? {
            tone: result.placeholder ? "warning" : "success",
            message: result.placeholder
              ? `"${file.name}" has no stored contents - a details summary was downloaded instead.`
              : `"${file.name}" downloaded.`,
          }
        : { tone: "error", message: result.error },
    );
  }, []);

  /** Requirement 4: route row/menu actions to the right dialog. */
  const handleAction = useCallback(
    (action, file) => {
      setSubmitError("");

      if (action === "download") {
        handleDownload(file);
        return;
      }

      // Document approval (Pending Review -> Approved) is permission-gated
      // inside handleApprove / FileService.approveFile.
      if (action === "approve") {
        handleApprove(file);
        return;
      }

      // Root-cause enforcement (not just hiding the menu item): a file
      // inside a locked system folder (ICF) can never be renamed or
      // deleted, regardless of how the action reaches this handler.
      if (
        (action === "rename" || action === "delete") &&
        (readOnly || folderNode?.locked)
      ) {
        return;
      }

      if (action === "view" || action === "rename") {
        setDialog({ mode: action === "view" ? "preview" : action, file });
        return;
      }

      if (action === "delete") {
        // ONE combined modal: permanent-deletion warning + typed DELETE +
        // mandatory E-Signature (no separate "are you sure" dialog).
        openSignature({
          mode: "delete",
          entityType: "file",
          entityName: file.name,
          actionLabel: "This permanently deletes the file from this folder.",
          onSigned: async (signature) => {
            const result = FileService.deleteFile(
              studyId,
              store,
              folderId,
              file.id,
              signature,
            );
            if (!result.ok) {
              setFeedback({ tone: "error", message: result.error });
              return;
            }
            setStore(result.store);
            setFeedback({ tone: "success", message: `"${file.name}" deleted.` });
            closeDialog();
          },
        });
        return;
      }

      if (action === "audit-trail") {
        setDialog({ mode: "audit-trail", file });
        return;
      }

      if (action === "duplicate") {
        const result = FileService.duplicateFile(studyId, store, folderId, file.id, currentUser);
        if (result.ok === false) {
          setFeedback({ tone: "error", message: result.error });
        } else {
          setStore(result.store);
          setFeedback({ tone: "success", message: `"${result.file.name}" created as a duplicate.` });
          // A duplicate inside a subject's ICF folder is a new explorer-origin
          // record the hub mirror should also list.
          if (icfSubjectId) mirrorIcfToHub([icfSubjectId]);
        }
        return;
      }

      if (action === "move") {
        setDialog({ mode: "move", file });
        return;
      }

      if (action === "permissions") {
        setDialog({ mode: "permissions", file });
        return;
      }

      if (action === "global-view") {
        setDialog({ mode: "preview", file });
        return;
      }
    },
    [
      handleDownload,
      handleApprove,
      folderNode,
      readOnly,
      studyId,
      store,
      folderId,
      currentUser,
      icfSubjectId,
      mirrorIcfToHub,
    ],
  );

  const closeDialog = useCallback(() => {
    setDialog(null);
    setSubmitError("");
  }, []);

  /* Live validator handed to the rename modal (one rule set, one source). */
  const validateRename = useCallback(
    (name) =>
      FileService.validateFileName(store, folderId, name, {
        excludeId: dialog?.file?.id,
      }),
    [store, folderId, dialog],
  );

  const submitRename = (name) => {
    // Final root-cause guard: even if a rename dialog were ever opened for
    // a file in a locked folder (ICF) by some path other than the ones
    // already refused above, the actual mutation still cannot happen.
    if (readOnly || folderNode?.locked) {
      setSubmitError("This folder is view-only. Files cannot be renamed.");
      return;
    }

    const targetName = String(name || "").trim();
    const originalName = dialog.file?.name || "this file";

    // Mandatory E-Signature BEFORE the rename is committed.
    openSignature({
      mode: "edit",
      entityType: "file",
      entityName: targetName,
      actionLabel: `Rename "${originalName}" to "${targetName}".`,
      onSigned: async (signature) => {
        const result = FileService.renameFile(
          studyId,
          store,
          folderId,
          dialog.file.id,
          targetName,
          currentUser,
          signature,
        );

        if (!result.ok) {
          setSubmitError(result.error);
          return;
        }

        setStore(result.store);
        setFeedback({
          tone: "success",
          message: `Renamed to "${result.file.name}".`,
        });
        closeDialog();
      },
    });
  };

  /* ==============================================================
     RENDER
  ============================================================== */

  /* No folder chosen yet - mirror the explorer's own empty-state style. */
  if (!folderId) {
    return (
      <section className="sf-panel" aria-label="Subject files">
        <div className="sf-empty-state sf-empty-state--no-folder">
          <span className="sf-empty-icon" aria-hidden="true">
            <MdFolderOff size={30} />
          </span>
          <h3>No folder selected</h3>
          <p>
            Choose a subject or folder in the Subject Explorer to view and
            manage its files.
          </p>
        </div>
      </section>
    );
  }

  const FeedbackIcon =
    feedback?.tone === "success"
      ? MdCheckCircle
      : feedback?.tone === "warning"
        ? MdWarningAmber
        : MdErrorOutline;

  return (
    <section className="sf-panel" aria-label={`Files in ${folderName}`}>
      {/* ================= HEADER =================
          Clean, single-line title header: the "Subject Files" / "Folder
          Files" label (plus the breadcrumb path for nested folders) on the
          left, the 4 KPI tiles beside it, and the Filters / Upload actions
          on the right. The folder name, "N Files" count and size that used
          to be repeated here are gone - that information already lives in
          the folder bar above the panel and in the KPI tiles, so the header
          no longer duplicates it. */}
      <header className="sf-panel-header">
        <div className="sf-panel-heading sf-panel-heading--with-back">
          {parentNode && (
            <button
              type="button"
              className="sf-back-btn"
              onClick={handleBackOneLevel}
              title={`Back to "${parentNode.name}"`}
              aria-label={`Back to "${parentNode.name}"`}
            >
              <MdArrowBack size={16} aria-hidden="true" />
            </button>
          )}

          <div className="sf-panel-heading-text">
            <h3 className="sf-panel-eyebrow">
              {isSubjectNode ? "Subject Files" : "Folder Files"}
            </h3>

            {folderPath.length > 1 && (
              <nav className="sf-path" aria-label="Folder path">
                {folderPath.map((segment, index) => (
                  <React.Fragment key={`${segment}-${index}`}>
                    {index > 0 && <span className="sf-path-sep">/</span>}
                    <span className="sf-path-seg">{segment}</span>
                  </React.Fragment>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* The 4-tile KPI strip sits inside the header, beside the title -
            same "title + cards on one row" pattern as the Subject Documents
            header above the explorer. */}
        <FolderStatsBar stats={stats} scope="folder" label={folderName} />

        <div className="sf-panel-actions">
          {/* Requirement 4: filters live behind a toggle so the toolbar stays
              calm until the user needs them. */}
          <button
            type="button"
            className={`sf-btn sf-btn--ghost sf-filter-toggle${
              showFilters ? " is-open" : ""
            }${activeFilterCount > 0 ? " has-active" : ""}`}
            onClick={toggleFilters}
            aria-expanded={showFilters}
            aria-controls="sf-filterbar"
            title="Advanced filters"
          >
            <MdTune size={16} aria-hidden="true" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="sf-filter-badge"
                aria-label={`${activeFilterCount} active`}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          <FileUploadButton onFiles={handleUpload} busy={uploading} />

          {!readOnly && (
            <button
              type="button"
              className="sf-btn sf-btn--ghost"
              onClick={() => setShowFolderUpload(true)}
              title="Upload an entire folder (its nested structure is recreated here)"
            >
              <MdFolderZip size={16} aria-hidden="true" />
              <span>Upload Folder</span>
            </button>
          )}
        </div>
      </header>

      {/* ================= STAGED SINGLE-FILE UPLOAD =================
          Parity with the shared document managers: the chosen file is read
          for real (progress to 100%), then an explicit Save persists it.
          The Save action only renders once the whole file was read. */}
      {stagedUpload && (
        <div className="sf-upload-stage" role="status" aria-live="polite">
          <div className="sf-upload-stage-head">
            <span
              className="sf-upload-stage-name"
              title={stagedUpload.file?.name || "Uploading…"}
            >
              {stagedUpload.file?.name || "Uploading…"}
            </span>
            <span className="sf-upload-stage-pct">
              {stagedUpload.progress}%
            </span>
          </div>

          <div className="sf-upload-stage-track" aria-hidden="true">
            <div
              className="sf-upload-stage-fill"
              style={{ width: `${stagedUpload.progress}%` }}
            />
          </div>

          <div className="sf-upload-stage-actions">
            {stagedUpload.progress >= 100 ? (
              <button
                type="button"
                className="sf-btn sf-btn--primary"
                onClick={handleSaveStaged}
                disabled={savingStaged}
              >
                {savingStaged ? "Saving…" : "Save"}
              </button>
            ) : (
              <span className="sf-upload-stage-status">
                Uploading… {stagedUpload.progress}%
              </span>
            )}

            <button
              type="button"
              className="sf-btn sf-btn--ghost"
              onClick={handleCancelStaged}
              disabled={savingStaged}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ================= FEEDBACK / VALIDATION ================= */}
      {feedback && (
        <div
          className={`sf-alert sf-alert--${feedback.tone}`}
          role="status"
          aria-live="polite"
        >
          <FeedbackIcon
            size={16}
            className="sf-alert-icon"
            aria-hidden="true"
          />

          <div className="sf-alert-body">
            <span className="sf-alert-message">{feedback.message}</span>

            {/* The per-file list only adds information for a batch. With a
                single rejection the summary message already states that
                file's reason, so listing it again would repeat it. */}
            {feedback.details?.length > 1 && (
              <ul className="sf-alert-list">
                {feedback.details.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <strong>{item.name}</strong> — {item.error}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            className="sf-alert-close"
            aria-label="Dismiss message"
            onClick={dismissFeedback}
          >
            <MdClose size={15} />
          </button>
        </div>
      )}

      {/* ================= BODY: file table + right-side details panel =================
          Update 7: "View Details" no longer opens a popup. Selecting a file
          (row click or the "View Details" menu item, both still routed
          through `handleAction("view", file)` exactly as before) docks a
          details panel to the right instead, matching the eISF split-view
          interaction (`inline` mode of `pages/shared/EISF/components/
          DocumentViewer.js`) - width, spacing and open/close behaviour -
          without importing anything from eISF. The table stays mounted and
          visible in the left pane the entire time. */}
      <div
        className={`sf-body${dialog?.mode === "preview" ? " sf-body--split" : ""}`}>

        <div className="sf-body-list">
          {/* ================= TOOLBAR: SEARCH + SORT ================= */}
          {folderFiles.length > 0 && (
            <div className="sf-toolbar" role="search">
              <div className="sf-search">
                <MdSearch
                  size={17}
                  className="sf-search-icon"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  className="sf-search-input"
                  placeholder="Search files in this folder..."
                  value={search}
                  aria-label="Search files in this folder"
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="sf-search-clear"
                    aria-label="Clear file search"
                    onClick={clearSearch}>

                    <MdClose size={14} />
                  </button>
                )}
              </div>

              <div className="sf-toolbar-right">
                <label className="sf-sort">
                  <span>Sort</span>
                  <select
                    aria-label="Sort files by"
                    value={sortKey}
                    onChange={(event) => {
                      const key = event.target.value;
                      setSortKey(key);
                      setSortDir(DEFAULT_DIRECTION[key] || "asc");
                    }}>

                    {SORT_OPTIONS.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="sf-dir-btn"
                  onClick={flipSortDir}
                  title={sortDir === "asc" ? "Ascending" : "Descending"}
                  aria-label={`Sort direction: ${
                    sortDir === "asc" ? "ascending" : "descending"
                  }`}>

                  <MdSwapVert size={16} aria-hidden="true" />
                  <span>{sortDir === "asc" ? "Asc" : "Desc"}</span>
                </button>

                <span
                  className="sf-result-count"
                  role="status"
                  aria-live="polite">

                  {visibleFiles.length} of {folderFiles.length}
                </span>

                {/* Task 1.7: CSV export of the currently visible rows. No
                    existing export pattern was wired to file tables, so this
                    reuses the app's shared CSV helper. */}
                <button
                  type="button"
                  className="sf-btn sf-btn--ghost sf-export-btn"
                  onClick={handleExportFiles}
                  title="Export visible files to CSV">

                  <MdFileDownload size={16} aria-hidden="true" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= ADVANCED FILTERS (requirement 4) =================
              Also shown whenever a filter is active, even if the bar was toggled
              closed: collapsing it used to hide the only control that could undo
              the narrowing, leaving a short table with no visible cause. */}
          {folderFiles.length > 0 && (showFilters || activeFilterCount > 0) && (
            <FileFilterBar
              files={folderFiles}
              filters={filters}
              onChange={patchFilters}
              onReset={resetFilters}
              /* The counter reports the filtered set before the text search, so
                 "N of M" describes what the filters did rather than conflating
                 the two narrowings. */
              resultCount={filteredFiles.length}
              totalCount={folderFiles.length}
            />
          )}

          {/* ================= DROP ZONE (populated folders) ================= */}
          {folderFiles.length > 0 && (
            <DragDropUpload onFiles={handleUpload} busy={uploading} compact />
          )}

          {/* ================= CHILD FOLDERS (when a subject/folder has subfolders)
              Show clickable folder cards so the workspace matches what the sidebar
              tree shows. The user clicks a folder card to navigate into it (the
              sidebar selection updates, which re-renders this component with the
              child folder as the selected node). */}
          {folderFiles.length === 0 && childFolders.length > 0 && (
            <div className="sf-child-folders">
              <div className="sf-child-folders-header">
                <span className="sf-child-folders-label">
                  {childFolders.length} folder
                  {childFolders.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="sf-child-folders-grid">
                {childFolders.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    className="sf-child-folder-card"
                    onClick={() => {
                      /* Navigate into this child folder by updating the selection
                         in the parent workspace. The SubjectExplorer sidebar will
                         pick up the new selection and highlight the child. */
                      if (typeof onSelectFolder === "function") {
                        onSelectFolder(child);
                      }
                    }}>

                    <span className="sf-child-folder-icon">
                      <MdFolderOpen size={18} aria-hidden="true" />
                    </span>
                    <span className="sf-child-folder-name" title={child.name}>
                      {child.name}
                    </span>
                    {child.locked && (
                      <span className="sf-child-folder-badge">Locked</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================= FILE TABLE / EMPTY STATES =================
              Task 1.7: rows are the paginated slice of `visibleFiles`;
              `totalInFolder` stays the true unfiltered count so the
              existing empty-state selection (folder empty vs. narrowed to
              zero) is unaffected. */}
          <SubjectFileTable
            files={pagedFiles}
            totalInFolder={folderFiles.length}
            folderName={folderName}
            sortKey={sortKey}
            sortDir={sortDir}
            activeFileId={dialog?.file?.id ?? null}
            loading={loadingFiles}
            onSort={handleSort}
            onAction={handleAction}
            onUpload={handleUpload}
            onCreateFolder={openCreateFolder}
            onClearSearch={clearSearch}
            onClearFilters={resetFilters}
            hasSearch={search.trim().length > 0}
            hasFilters={activeFilterCount > 0}
            uploading={uploading}
            canUpload={Boolean(folderId) && !readOnly}
            locked={readOnly || Boolean(folderNode?.locked)}
            canApprove={canApproveDocs}
          />

          {/* Task 1.7/1.9: pagination footer - rows per page, prev/next,
              "Showing X to Y of Z" - scoped to the filtered/searched set. */}
          <PaginationFooter
            page={safePage}
            pageSize={pageSize}
            total={visibleFiles.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>

        {/* ================= RIGHT-SIDE FILE DETAILS PANEL =================
            Replaces the old FilePreviewModal popup. Same component, same
            props - only its own markup/CSS changed from an overlay dialog
            to a docked panel (see FilePreviewModal.js). */}
        {dialog?.mode === "preview" && (
          <div className="sf-body-details">
            <FilePreviewModal
              file={dialog.file}
              folderName={folderPath.join(" / ")}
              locked={readOnly || Boolean(folderNode?.locked)}
              onRename={() => {
                // Root-cause guard (not just hiding the button): this panel
                // can no longer render the Rename button when locked, but
                // refuse the action here too regardless of how it's called.
                if (readOnly || folderNode?.locked) return;
                setDialog({ mode: "rename", file: dialog.file });
              }}
              onDownload={() => handleDownload(dialog.file)}
              onDelete={() => {
                if (readOnly || folderNode?.locked) return;
                // ONE combined modal: warning + typed DELETE + E-Signature.
                const previewFile = dialog.file;
                openSignature({
                  mode: "delete",
                  entityType: "file",
                  entityName: previewFile?.name || "this file",
                  actionLabel: "This permanently deletes the file from this folder.",
                  onSigned: async (signature) => {
                    const result = FileService.deleteFile(
                      studyId,
                      store,
                      folderId,
                      previewFile.id,
                      signature,
                    );
                    if (!result.ok) {
                      setFeedback({ tone: "error", message: result.error });
                      return;
                    }
                    setStore(result.store);
                    setFeedback({ tone: "success", message: `"${previewFile.name}" deleted.` });
                    closeDialog();
                  },
                });
              }}
              canApprove={canApproveDocs}
              onApprove={() => handleApprove(dialog.file)}
              onClose={closeDialog}
            />
          </div>
        )}
      </div>

      {/* ================= FILE DIALOGS (rename / delete stay as modals) ================= */}
      {dialog?.mode === "rename" && (
        <RenameFileModal
          file={dialog.file}
          folderName={folderName}
          validate={validateRename}
          submitError={submitError}
          onSubmit={submitRename}
          onClose={closeDialog}
        />
      )}

      {dialog?.mode === "audit-trail" && (
        <div className="audit-overlay tnxt-compact" onClick={closeDialog}>
          <div className="audit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="audit-header">
              <h3>Audit Trail — {dialog.file?.name}</h3>
              <button type="button" onClick={closeDialog}>✕</button>
            </div>
            <table className="audit-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {(FileService.getFileAuditTrail(dialog.file)).map((item, index) => (
                  <tr key={`${item.action}-${index}`}>
                    <td>{formatDateTime(item.date || "-")}</td>
                    <td>{item.user || "Unknown user"}</td>
                    <td>{item.action || "Updated"}</td>
                    <td>{item.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dialog?.mode === "move" && (
        <MoveFileDialog
          file={dialog.file}
          tree={tree}
          currentFolderId={folderId}
          onSubmit={(targetFolderId) => {
            if (readOnly || folderNode?.locked) return;
            const result = FileService.moveFile(
              studyId, store, folderId, dialog.file.id, targetFolderId, currentUser
            );
            if (!result.ok) {
              setSubmitError(result.error);
              return;
            }
            setStore(result.store);
            setFeedback({ tone: "success", message: `"${dialog.file.name}" moved successfully.` });
            // A move into or out of a subject's ICF folder changes what the
            // hub mirror should contain (additions on entry, prunes on exit).
            const affectedSubjects = [
              subjectOfIcfFolder(folderId),
              subjectOfIcfFolder(targetFolderId),
            ].filter(Boolean);
            mirrorIcfToHub(affectedSubjects);
            closeDialog();
          }}
          submitError={submitError}
          onClose={closeDialog}
        />
      )}

      {dialog?.mode === "permissions" && (
        <PermissionsModal
          file={dialog.file}
          onClose={closeDialog}
        />
      )}

      {/* Phase 6: create a subfolder without leaving the empty state. */}
      {creatingFolder && (
        <CreateFolderModal
          variant="subfolder"
          parentName={folderName}
          parentType={isSubjectNode ? "subject" : "folder"}
          validate={validateNewFolder}
          submitError={submitError}
          onSubmit={submitCreateFolder}
          onClose={() => {
            setCreatingFolder(false);
            setSubmitError("");
          }}
        />
      )}

      {/* Mandatory E-Signature gate — no file/folder upload, edit or delete
          is committed until the acting user completes the signature. */}
      <ESignatureModal
        open={Boolean(signing)}
        mode={signing?.mode}
        entityType={signing?.entityType || "file"}
        entityName={signing?.entityName}
        actionLabel={signing?.actionLabel}
        scope={signatureScope}
        onClose={() => setSigning(null)}
        onSigned={async (signature) => {
          const pending = signing;
          setSigning(null);
          if (pending?.onSigned) {
            await pending.onSigned(signature);
          }
        }}
      />

      {/* Bulk folder upload (drop / pick a directory tree). The selected
          folder is the target; the planner merges an "ICF" drop into the
          subject's locked ICF folder rather than creating a second one. */}
      {showFolderUpload && (
        <SubjectFolderUpload
          studyId={studyId}
          tree={tree}
          targetFolderId={folderId}
          targetLabel={folderPath.join(" / ") || folderName}
          readOnly={readOnly}
          onClose={() => setShowFolderUpload(false)}
        />
      )}
    </section>
  );
}

export default SubjectFileManager;