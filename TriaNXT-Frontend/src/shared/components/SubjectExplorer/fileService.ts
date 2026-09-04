/**
 * Subject Explorer - FILE SERVICE (mock / localStorage layer, Phase 4)
 * ====================================================================
 *
 * Single source of truth for subject file management. Mirrors the structure
 * of `folderTreeService.js` so both layers behave the same way.
 *
 * PHASE 4 SCOPE: no backend. Files live in localStorage under one key,
 * bucketed by folder id, seeded from `subjectFileMockData.js` on first run.
 *
 * API MIGRATION NOTE
 * ------------------
 * The component layer never touches localStorage directly - it only calls
 * the functions below, and every mutation returns the same
 * `{ ok, files, file?, error?, ... }` shape. To move to real APIs later,
 * replace the bodies of `uploadFiles` / `renameFile` / `deleteFile` with HTTP
 * calls and the UI does not change.
 *
 * For reads, use `fetchFolderFiles` (async) as the network seam - NOT
 * `listFiles`. `listFiles` is a synchronous pure selector used inside
 * `useMemo` hooks, `reduce` callbacks in `folderStatsService`, and four
 * mutations in this file; giving it a promise return type would break all of
 * them. See the note on `fetchFolderFiles` for the full reasoning.
 *
 * NOT in this phase (by design): version history, sharing, permissions,
 * approval workflow.
 */

import {
  getExtension,
  isSupportedExtension,
  SUPPORTED_EXTENSIONS_LABEL,
} from "./fileTypes";
import { formatDateUTC, formatDateTimeUTC } from "../../utils/dateTime";
import { getAllSubjects } from "../../services/subjectService";

/* ==================================================================
   CONSTANTS
================================================================== */

/** Legacy flat key (pre-study-scoping). */
const LEGACY_FILES_KEY = "trianxtSubjectFiles";/**
 * Study-scoped localStorage key factory.
 *
 * GUARD: if studyId is falsy, logs an error to catch silent leaks.
 */
export function subjectFilesKey(studyId) {
  if (!studyId) {
    // eslint-disable-next-line no-console
    console.error(
      "[TriaNXT] subjectFilesKey called with falsy studyId.",
      "This would cause all studies to share the 'global' bucket."
    );
  }
  return `trianxtSubjectFiles:${studyId || "global"}`;
}

/** Fired after every successful write so open views can auto-refresh. */
export const SUBJECT_FILES_EVENT = "trianxt-subject-files-updated";

const STORAGE_VERSION = 1;

/**
 * Per-file cap for keeping the actual bytes in localStorage.
 *
 * localStorage is a ~5 MB string store, so persisting real payloads is only
 * viable for small files. Larger uploads are still recorded (name, size,
 * type, dates) but without content - `hasContent: false` - and the UI
 * degrades gracefully: preview shows a placeholder and download emits a
 * metadata stub. A real backend removes this limit entirely.
 */
export const MAX_INLINE_CONTENT_BYTES = 384 * 1024;

/** Hard cap per upload, so a huge file cannot stall the page. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Characters that would break a filename. */
// eslint-disable-next-line no-useless-escape
const INVALID_NAME_CHARS = /[\/\\:*?"<>|]/;

const MAX_NAME_LENGTH = 120;

export const FILE_NAME_RULES = {
  maxLength: MAX_NAME_LENGTH,
  invalidCharsLabel: '/ \\ : * ? " < > |',
};

/** Sort keys exposed to the table header (requirement 6). */
export const FILE_SORT_KEYS = ["name", "date", "size", "type"];

/* ==================================================================
   INTERNAL HELPERS
================================================================== */

function createId(prefix = "file") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const hasStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage);

/** Guarantee every stored record has the fields the UI reads. */
function normalizeFile(file, folderId) {
  const now = new Date().toISOString();

  return {
    id: file.id || createId(),
    folderId: file.folderId || folderId,
    name: typeof file.name === "string" && file.name ? file.name : "Untitled",
    size: Number.isFinite(file.size) ? file.size : 0,
    uploadedAt: file.uploadedAt || now,
    modifiedAt: file.modifiedAt || file.uploadedAt || now,
    uploadedBy: file.uploadedBy || "Unknown user",
    modifiedBy: file.modifiedBy || file.uploadedBy || "Unknown user",
    status: file.status || "Final",
    hasContent: Boolean(file.hasContent && file.dataUrl),
    ...(file.dataUrl ? { dataUrl: file.dataUrl } : {}),
    ...(Array.isArray(file.auditTrail) ? { auditTrail: file.auditTrail } : {}),
    // Approval metadata survives the normalize round-trip so "Approved"
    // records keep who approved and when (Subject File Manager approve flow).
    ...(file.approvedBy ? { approvedBy: file.approvedBy } : {}),
    ...(file.approvedAt ? { approvedAt: file.approvedAt } : {}),
  };
}

/** Normalize the whole `{ folderId: File[] }` map. */
function normalizeStore(store) {
  if (!store || typeof store !== "object") return {};

  return Object.entries(store).reduce((acc, [folderId, files]) => {
    if (!Array.isArray(files)) return acc;
    acc[folderId] = files
      .filter((file) => file && typeof file === "object")
      .map((file) => normalizeFile(file, folderId));
    return acc;
  }, {});
}

function emitFilesUpdate(source, folderId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SUBJECT_FILES_EVENT, { detail: { source, folderId } })
  );
}

/* ==================================================================
   PERSISTENCE
================================================================== */

/**
 * Read the whole file store, seeding it from mock data on first run.
 * Accepts both the wrapped `{ version, files }` payload and a bare map so
 * older/hand-edited data keeps working.
 */
/**
 * One-time migration from the old global key to per-study keys.
 * Attempts to re-bucket files by matching folder ids to studies via
 * subjectsByStudy. Unmatched data (old mock SUB-004/icf) is discarded.
 */
function migrateLegacyFiles() {
  if (!hasStorage()) return;

  try {
    const legacyData = window.localStorage.getItem(LEGACY_FILES_KEY);
    if (!legacyData) return;

    let legacyStore;
    try {
      const parsed = JSON.parse(legacyData);
      legacyStore = parsed?.files ?? parsed;
    } catch {
      legacyStore = null;
    }

    if (!legacyStore || typeof legacyStore !== "object") {
      window.localStorage.removeItem(LEGACY_FILES_KEY);
      return;
    }

    // Use subjectService to figure out which study each folder belongs to.
    // subjectService is the single source of truth for subjectsByStudy.
    let allByStudy: Record<string, any> = {};;
    try {
      const allSubjects = getAllSubjects();
      // Rebuild the bucket map from getAllSubjects() for the legacy migration
      allSubjects.forEach((subject) => {
        const studyId = subject.studyId;
        if (!studyId) return;
        if (!allByStudy[studyId]) allByStudy[studyId] = [];
        allByStudy[studyId].push(subject);
      });
    } catch {
      // ignore
    }

    // Build a map of known subject ids -> study id
    const subjectToStudy = new Map();
    for (const [studyId, records] of Object.entries(allByStudy)) {
      if (!Array.isArray(records)) continue;
      records.forEach((r) => {
        if (r?.id) subjectToStudy.set(r.id, studyId);
      });
    }

    // Re-bucket files by study
    const buckets = new Map(); // studyId -> { folderId: files[] }
    Object.entries(legacyStore).forEach(([folderId, files]) => {
      // Extract subject id from folder id (e.g. "SUB-004/icf" -> "SUB-004")
      const subjectId = folderId.split("/")[0];
      const studyId = subjectToStudy.get(subjectId);

      if (studyId) {
        if (!buckets.has(studyId)) buckets.set(studyId, {});
        buckets.get(studyId)[folderId] = files;
      }
      // Unmatched files (old mock data) are silently discarded
    });

    // Write to per-study keys
    buckets.forEach((files, studyId) => {
      const key = subjectFilesKey(studyId);
      const existing = window.localStorage.getItem(key);
      if (existing) return; // Study already has its own files, don't overwrite

      window.localStorage.setItem(
        key,
        JSON.stringify({ version: STORAGE_VERSION, updatedAt: new Date().toISOString(), files })
      );
    });

    window.localStorage.removeItem(LEGACY_FILES_KEY);
  } catch {
    // Best-effort: leave legacy key if anything fails.
  }
}

// Run once on module load
migrateLegacyFiles();

/**
 * Read the file store for a specific study.
 * A brand-new study starts with an empty file store (no mock seed).
 *
 * @param {string} studyId  required — the study whose files to load
 * @param {object} seed     fallback (default: empty)
 */
export function loadFileStore(studyId,seed: any = {}) {
  const fallback = normalizeStore(seed);

  if (!hasStorage()) return fallback;

  try {
    const key = subjectFilesKey(studyId);
    const raw = window.localStorage.getItem(key);

    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const stored = parsed?.files ?? parsed;

    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return fallback;
    }

    return normalizeStore(stored);
  } catch {
    return fallback;
  }
}

function persist(studyId, store) {
  if (!hasStorage()) return true;

  try {
    const key = subjectFilesKey(studyId);
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: STORAGE_VERSION,
        updatedAt: new Date().toISOString(),
        files: store,
      })
    );
    return true;
  } catch {
    // QuotaExceededError: retry once with all payloads stripped.
    const stripped = stripAllContent(store);

    try {
      const key = subjectFilesKey(studyId);
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: STORAGE_VERSION,
          updatedAt: new Date().toISOString(),
          files: stripped,
        })
      );
      return "stripped";
    } catch {
      return false;
    }
  }
}

/** Remove every inline payload (used as the quota fallback). */
function stripAllContent(store) {
  return Object.entries(store).reduce((acc: any, [folderId, files]: [string, any]) => {
    acc[folderId] = (files as any[]).map(
      // Destructuring `dataUrl` out is how the key is dropped; the binding
      // is deliberately unused.
      // eslint-disable-next-line no-unused-vars
      ({ dataUrl, ...rest }) => ({
        ...rest,
        hasContent: false,
      })
    );
    return acc;
  }, {});
}

/** Persist an already-built store and notify listeners. */
export function saveFileStore(studyId, store, source = "save", folderId = null) {
  const normalized = normalizeStore(store);
  const saved = persist(studyId, normalized);

  if (saved) emitFilesUpdate(source, folderId);

  if (saved === "stripped") {
    return {
      ok: true,
      store: normalizeStore(stripAllContent(normalized)),
      warning:
        "Storage limit reached. File details were saved, but file contents were released.",
    };
  }

  return saved
    ? { ok: true, store: normalized }
    : {
        ok: false,
        store: normalized,
        error: "Storage limit reached. Unable to save file changes.",
      };
}

/** Clear persisted files for this study and start empty. */
export function resetFileStore(studyId,seed: any = {}) {
  const fresh = normalizeStore(seed);
  persist(studyId, fresh);
  emitFilesUpdate("reset", null);
  return fresh;
}

/**
 * Subscribe to file changes (same tab via CustomEvent, other tabs via the
 * native `storage` event). Returns an unsubscribe function.
 */
export function subscribeFiles(studyId, handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }

  const key = subjectFilesKey(studyId);
  const onCustom = (event) => handler(event?.detail || {});
  const onStorage = (event) => {
    if (event.key === key) handler({ source: "storage" });
  };

  window.addEventListener(SUBJECT_FILES_EVENT, onCustom);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(SUBJECT_FILES_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/* ==================================================================
   READS (pure)
================================================================== */

/** Files inside one folder; always a new array. */
export function listFiles(store, folderId) {
  if (!folderId) return [];
  return Array.isArray(store?.[folderId]) ? [...store[folderId]] : [];
}

/**
 * Async counterpart to `listFiles` - the seam a real backend plugs into.
 *
 * WHY THIS EXISTS ALONGSIDE THE SYNC VERSION
 * ------------------------------------------
 * `listFiles` is a pure selector with call sites that cannot await: it runs
 * inside `useMemo` in the file manager and the workspace hook, inside `reduce`
 * callbacks in `folderStatsService`, and inside four mutations in this very
 * module (`validateFileName`, `uploadFiles`, `renameFile`, `deleteFile`).
 * Making it return a promise would break every one of those - the reducers
 * would sum promises and the memos would hand components a thenable instead of
 * an array. So the sync selector stays exactly as it is, and asynchrony is
 * added here as a separate, additive entry point.
 *
 * Today this resolves from the already-loaded store on a microtask, so the
 * skeleton appears for one frame on a folder switch rather than being dead
 * markup. Nothing is delayed artificially - there is no timer here.
 *
 * API MIGRATION: replace the body with the real request
 * (`const res = await fetch(...)`) and keep the resolved shape - an array of
 * file records. `SubjectFileManager` already handles the pending, success and
 * failure branches, so no component has to change.
 *
 * @param {object} store    current file store (ignored once a backend exists)
 * @param {string} folderId folder whose files to read
 * @param {{ signal?: AbortSignal }} [options] abort support for stale requests
 * @returns {Promise<Array>} files in that folder
 */
export async function fetchFolderFiles(store, folderId,options: any = {}) {
  const { signal } = options;

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  // Yields to the microtask queue so callers observe a real pending state.
  const files = await Promise.resolve(listFiles(store, folderId));

  // The folder may have changed while this was in flight.
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return files;
}

/** Total file count across every folder. */
export function countAllFiles(store) {
  if (!store) return 0;
  return Object.values(store).reduce(
    (total: number, files) => total + (Array.isArray(files) ? files.length : 0),
    0
  );
}

/** Combined byte size of a file list. */
export function totalSize(files) {
  if (!Array.isArray(files)) return 0;
  return files.reduce((total, file) => total + (file.size || 0), 0);
}

/** Look up a single record by id inside a folder. */
export function findFileById(store, folderId, fileId) {
  return listFiles(store, folderId).find((file) => file.id === fileId) || null;
}

/**
 * Drop buckets whose folder no longer exists in the folder tree.
 *
 * Phase 3's `deleteFolder` intentionally knows nothing about files, so this
 * keeps the two stores consistent without changing that module. Returns
 * `{ changed, store }` and only writes when something was actually removed.
 */
export function pruneOrphanFolders(studyId, store, existingFolderIds) {
  const keep = new Set<any>(existingFolderIds || []);
  const next: Record<string, any> = {};;
  let changed = false;

  Object.entries(store || {}).forEach(([folderId, files]) => {
    if (keep.has(folderId)) {
      next[folderId] = files;
    } else {
      changed = true;
    }
  });

  if (!changed) return { changed: false, store };

  persist(studyId, normalizeStore(next));

  return { changed: true, store: normalizeStore(next) };
}

/* ==================================================================
   SEARCH + SORT (pure, requirements 5 & 6)
================================================================== */

/** Case-insensitive match on file name, type, uploader or status. */
export function searchFiles(files, term) {
  const query = String(term ?? "").trim().toLowerCase();
  if (!query) return files;

  return files.filter((file) => {
    const haystack = [
      file.name,
      getExtension(file.name),
      file.uploadedBy,
      file.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

/**
 * Sort by name / date / size / type.
 *
 * `date` uses `modifiedAt` so the most recently touched file surfaces first,
 * falling back to `uploadedAt` for records that were never modified.
 * Ties break on name so the order is stable and predictable.
 */
export function sortFiles(files, key = "name", direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  const byName = (a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  const compare = {
    name: byName,
    size: (a, b) => (a.size || 0) - (b.size || 0) || byName(a, b),
    type: (a, b) =>
      getExtension(a.name).localeCompare(getExtension(b.name)) || byName(a, b),
    date: (a, b) => {
      const at = new Date(a.modifiedAt || a.uploadedAt).getTime() || 0;
      const bt = new Date(b.modifiedAt || b.uploadedAt).getTime() || 0;
      return at - bt || byName(a, b);
    },
  }[key] || byName;

  return [...files].sort((a, b) => compare(a, b) * factor);
}

/* ==================================================================
   VALIDATION (requirement 8)
================================================================== */

/**
 * Validate one incoming filename for a folder.
 *
 * Rules:
 *   - name required, length + illegal characters guarded
 *   - extension must be one of the supported document formats
 *   - no duplicate name in the same folder (case-insensitive)
 *
 * `excludeId` skips a record during the duplicate check (used by rename so
 * a file does not clash with itself).
 */
export function validateFileName(store, folderId, name,options: any = {}) {
  const { excludeId = null } = options;
  const trimmed = String(name ?? "").trim();

  if (!trimmed) {
    return { valid: false, error: "File name is required." };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `File name cannot exceed ${MAX_NAME_LENGTH} characters.`,
    };
  }

  if (INVALID_NAME_CHARS.test(trimmed)) {
    return {
      valid: false,
      error: `File name cannot contain ${FILE_NAME_RULES.invalidCharsLabel}`,
    };
  }

  const extension = getExtension(trimmed);

  if (!extension) {
    return {
      valid: false,
      error: "File name must include an extension (e.g. .pdf).",
    };
  }

  if (!isSupportedExtension(extension)) {
    return {
      valid: false,
      error: `"${extension.toUpperCase()}" is not a supported file type. Allowed: ${SUPPORTED_EXTENSIONS_LABEL}.`,
    };
  }

  const duplicate = listFiles(store, folderId).some(
    (file) =>
      file.id !== excludeId &&
      file.name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  if (duplicate) {
    return {
      valid: false,
      error: `A file named "${trimmed}" already exists in this folder.`,
    };
  }

  return { valid: true, error: "" };
}

/**
 * Validate a browser `File` before upload: type, emptiness and hard size
 * cap. Duplicate checking is handled by `validateFileName`.
 */
export function validateUploadCandidate(file) {
  if (!file) return { valid: false, error: "No file selected." };

  const extension = getExtension(file.name);

  if (!extension || !isSupportedExtension(extension)) {
    return {
      valid: false,
      error: `Unsupported file type${
        extension ? ` (.${extension})` : ""
      }. Allowed: ${SUPPORTED_EXTENSIONS_LABEL}.`,
    };
  }

  if (!file.size) {
    return { valid: false, error: "File is empty (0 bytes)." };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      valid: false,
      error: `File exceeds the ${formatFileSize(MAX_FILE_BYTES)} upload limit.`,
    };
  }

  return { valid: true, error: "" };
}

/* ==================================================================
   MUTATIONS
   Each returns { ok, store, ... } and persists on success, so the UI can
   refresh from one place after any operation.
================================================================== */

/** Read a File as a data URL, resolving to null when it is too large. */
function readFileContent(file) {
  if (file.size > MAX_INLINE_CONTENT_BYTES) return Promise.resolve(null);
  if (typeof FileReader === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload one or many files into `folderId` (requirement 1).
 *
 * Async because file contents are read off disk. Validation runs per file
 * so a single bad file never blocks the rest of the batch, and duplicates
 * are checked against both the store and the current batch.
 *
 * Resolves with:
 *   { ok, store, added: File[], rejected: [{ name, error }], warning? }
 */
export async function uploadFiles(studyId, store, folderId, fileList, uploadedBy) {
  const incoming = Array.from(fileList || []) as any[];

  if (!folderId) {
    return {
      ok: false,
      store,
      added: [],
      rejected: [],
      error: "Select a folder before uploading files.",
    };
  }

  if (incoming.length === 0) {
    return {
      ok: false,
      store,
      added: [],
      rejected: [],
      error: "No files selected. Choose at least one file to upload.",
    };
  }

  const working = { ...store, [folderId]: listFiles(store, folderId) };
  const added = [];
  const rejected = [];

  for (const raw of incoming as any[]) {
    const candidate = validateUploadCandidate(raw);

    if (!candidate.valid) {
      rejected.push({ name: raw?.name || "Unknown file", error: candidate.error });
      continue;
    }

    // Duplicate check runs against `working`, so two identically named
    // files inside one batch are caught too.
    const nameCheck = validateFileName(working, folderId, raw.name);

    if (!nameCheck.valid) {
      rejected.push({ name: raw.name, error: nameCheck.error });
      continue;
    }

    /* eslint-disable no-await-in-loop -- sequential keeps memory flat and
       preserves the order files were chosen in. */
    const dataUrl = await readFileContent(raw);
    /* eslint-enable no-await-in-loop */

    const now = new Date().toISOString();
    const record = normalizeFile(
      {
        id: createId(),
        folderId,
        name: raw.name.trim(),
        size: raw.size,
        uploadedAt: now,
        modifiedAt: raw.lastModified
          ? new Date(raw.lastModified).toISOString()
          : now,
        uploadedBy: uploadedBy || "Unknown user",
        status: "Pending Review",
        hasContent: Boolean(dataUrl),
        ...(dataUrl ? { dataUrl } : {}),
        auditTrail: [
          {
            date: now,
            user: uploadedBy || "Unknown user",
            action: "Uploaded",
            remarks: `File uploaded: ${raw.name.trim()}`,
          },
        ],
      },
      folderId
    );

    working[folderId] = [record, ...working[folderId]];
    added.push(record);
  }

  if (added.length === 0) {
    return {
      ok: false,
      store,
      added: [],
      rejected,
      error: rejected.length === 1 ? rejected[0].error : "No files could be uploaded.",
    };
  }

  const saved = saveFileStore(studyId, working, "upload", folderId);

  if (!saved.ok) {
    return { ok: false, store, added: [], rejected, error: saved.error };
  }

  return {
    ok: true,
    store: saved.store,
    added,
    rejected,
    warning: saved.warning,
  };
}

// Staged single-file upload progress (Subject File Manager). The reader
// lives in shared/utils so the eISF upload modal reuses the same one - a
// single implementation for real byte-progress, never a timer.
export { readFileWithProgress } from "../../utils/fileReadProgress";

/** Rename a file inside its folder (requirement 4). */
export function renameFile(studyId, store, folderId, fileId, name, modifiedBy) {
  const files = listFiles(store, folderId);
  const target = files.find((file) => file.id === fileId);

  if (!target) {
    return { ok: false, store, error: "This file no longer exists." };
  }

  const check = validateFileName(store, folderId, name, { excludeId: fileId });
  if (!check.valid) return { ok: false, store, error: check.error };

  const now = new Date().toISOString();
  const renamed = {
    ...target,
    name: String(name).trim(),
    modifiedAt: now,
    modifiedBy: modifiedBy || target.modifiedBy || "Unknown user",
    auditTrail: [
      ...(Array.isArray(target.auditTrail) ? target.auditTrail : []),
      {
        date: now,
        user: modifiedBy || "Unknown user",
        action: "Renamed",
        remarks: `Renamed from "${target.name}" to "${String(name).trim()}"`,
      },
    ],
  };

  const working = {
    ...store,
    [folderId]: files.map((file) => (file.id === fileId ? renamed : file)),
  };

  const saved = saveFileStore(studyId, working, "rename", folderId);
  if (!saved.ok) return { ok: false, store, error: saved.error };

  return { ok: true, store: saved.store, file: renamed };
}

/** Delete a file from its folder (requirement 4). */
export function deleteFile(studyId, store, folderId, fileId) {
  const files = listFiles(store, folderId);
  const target = files.find((file) => file.id === fileId);

  if (!target) {
    return { ok: false, store, error: "This file no longer exists." };
  }

  const working = {
    ...store,
    [folderId]: files.filter((file) => file.id !== fileId),
  };

  const saved = saveFileStore(studyId, working, "delete", folderId);
  if (!saved.ok) return { ok: false, store, error: saved.error };

  return { ok: true, store: saved.store, file: target };
}

/**
 * Approve a file whose status is "Pending Review" (document approval flow).
 *
 * Approval is recorded through the existing persistence + audit machinery:
 * the record keeps who approved and when, an audit-trail entry is appended,
 * and listeners are notified so every open view refreshes from one place.
 *
 * Only files currently in "Pending Review" can be approved - anything else
 * returns an error so the caller (and any UI reachable by another path)
 * cannot silently change a non-pending document.
 */
export function approveFile(studyId, store, folderId, fileId, approver) {
  const files = listFiles(store, folderId);
  const target = files.find((file) => file.id === fileId);

  if (!target) {
    return { ok: false, store, error: "This file no longer exists." };
  }

  if (String(target.status || "").trim().toLowerCase() !== "pending review") {
    return {
      ok: false,
      store,
      error:
        "Only files in Pending Review status can be approved. This file is not pending review.",
    };
  }

  const now = new Date().toISOString();
  const approved = {
    ...target,
    status: "Approved",
    approvedBy: approver || target.approvedBy || target.uploadedBy || "Unknown user",
    approvedAt: now,
    modifiedAt: now,
    modifiedBy: approver || target.modifiedBy || "Unknown user",
    auditTrail: [
      ...(Array.isArray(target.auditTrail) ? target.auditTrail : []),
      {
        date: now,
        user: approver || "Unknown user",
        action: "Approved",
        remarks: `Status changed from "Pending Review" to "Approved"`,
      },
    ],
  };

  const working = {
    ...store,
    [folderId]: files.map((file) => (file.id === fileId ? approved : file)),
  };

  const saved = saveFileStore(studyId, working, "approve", folderId);
  if (!saved.ok) return { ok: false, store, error: saved.error };

  return { ok: true, store: saved.store, file: approved };
}

/**
 * Trigger a browser download (requirement 4).
 *
 * Files uploaded in this session carry their bytes as a data URL and
 * download for real. Seeded/oversized records have no payload, so a small
 * text stub describing the file is generated instead - the same call site
 * will work unchanged once a backend serves real URLs.
 */
export function downloadFile(file) {
  if (!file || typeof document === "undefined") {
    return { ok: false, error: "Unable to download this file." };
  }

  const href =
    file.hasContent && file.dataUrl
      ? file.dataUrl
      : URL.createObjectURL(
          new Blob(
            [
              `TriaNXT - subject file placeholder\n\n` +
                `File: ${file.name}\n` +
                `Size: ${formatFileSize(file.size)}\n` +
                `Uploaded: ${formatDateTime(file.uploadedAt)}\n` +
                `Uploaded By: ${file.uploadedBy}\n` +
                `Status: ${file.status}\n\n` +
                `Contents are not stored locally for this record. ` +
                `The real file will be served once the backend is connected.\n`,
            ],
            { type: "text/plain" }
          )
        );

  const isObjectUrl = !(file.hasContent && file.dataUrl);
  const link = document.createElement("a");

  link.href = href;
  link.download = isObjectUrl ? `${file.name}.txt` : file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isObjectUrl) URL.revokeObjectURL(href);

  return {
    ok: true,
    placeholder: isObjectUrl,
  };
}

/**
 * Duplicate a file within the same folder, appending " (copy)" to the name.
 * Respects the same validation rules as renameFile.
 */
export function duplicateFile(studyId, store, folderId, fileId, user): { ok: true; store: any; file: any } | { ok: false; store: any; error: string } {
  const files = listFiles(store, folderId);
  const target = files.find((f) => f.id === fileId);

  if (!target) {
    return { ok: false, store, error: "This file no longer exists." };
  }

  // Build candidate name with " (copy)" suffix
  const ext = getExtension(target.name);
  const baseName = ext ? target.name.slice(0, -(ext.length + 1)) : target.name;
  const copyName = ext ? `${baseName} (copy).${ext}` : `${baseName} (copy)`;

  const nameCheck = validateFileName(store, folderId, copyName);
  if (!nameCheck.valid) {
    // If " (copy)" already exists, try " (copy 2)", etc.
    let attempt = 2;
    let candidateName;
    do {
      candidateName = ext
        ? `${baseName} (copy ${attempt}).${ext}`
        : `${baseName} (copy ${attempt})`;
      attempt++;
    } while (
      attempt < 20 &&
      !validateFileName(store, folderId, candidateName).valid
    );
    if (!validateFileName(store, folderId, candidateName).valid) {
      return { ok: false, store, error: "Unable to create a unique copy name." };
    }
    return duplicateFileWith(studyId, store, folderId, target, candidateName, user);
  }

  return duplicateFileWith(studyId, store, folderId, target, copyName, user);
}

function duplicateFileWith(studyId, store, folderId, target, newName, user): { ok: true; store: any; file: any } | { ok: false; store: any; error: string } {
  const now = new Date().toISOString();
  const copy = normalizeFile(
    {
      ...target,
      id: createId(),
      name: newName,
      uploadedAt: now,
      modifiedAt: now,
      uploadedBy: user || "Unknown user",
      modifiedBy: user || "Unknown user",
      auditTrail: [
        ...(Array.isArray(target.auditTrail) ? target.auditTrail : []),
        {
          date: now,
          user: user || "Unknown user",
          action: "Duplicated",
          remarks: `Duplicated from "${target.name}"`,
        },
      ],
    },
    folderId
  );

  const working = {
    ...store,
    [folderId]: [copy, ...(store[folderId] || [])],
  };

  const saved = saveFileStore(studyId, working, "duplicate", folderId);
  if (!saved.ok) return { ok: false, store, error: saved.error };

  return { ok: true, store: saved.store, file: copy };
}

/**
 * Move a file to a different folder within the same study.
 */
export function moveFile(studyId, store, sourceFolderId, fileId, targetFolderId, user) {
  const sourceFiles = listFiles(store, sourceFolderId);
  const target = sourceFiles.find((f) => f.id === fileId);

  if (!target) {
    return { ok: false, store, error: "This file no longer exists." };
  }

  if (sourceFolderId === targetFolderId) {
    return { ok: false, store, error: "File is already in that folder." };
  }

  // Check for name conflict in target folder
  const targetFiles = listFiles(store, targetFolderId);
  const conflict = targetFiles.find(
    (f) => f.name.toLowerCase() === target.name.toLowerCase()
  );
  if (conflict) {
    return { ok: false, store, error: `A file named "${target.name}" already exists in the destination folder.` };
  }

  const now = new Date().toISOString();
  const moved = {
    ...target,
    folderId: targetFolderId,
    modifiedAt: now,
    modifiedBy: user || "Unknown user",
    auditTrail: [
      ...(Array.isArray(target.auditTrail) ? target.auditTrail : []),
      {
        date: now,
        user: user || "Unknown user",
        action: "Moved",
        remarks: `Moved from "${sourceFolderId}" to "${targetFolderId}"`,
      },
    ],
  };

  const working = {
    ...store,
    [sourceFolderId]: sourceFiles.filter((f) => f.id !== fileId),
    [targetFolderId]: [moved, ...targetFiles],
  };

  const saved = saveFileStore(studyId, working, "move", targetFolderId);
  if (!saved.ok) return { ok: false, store, error: saved.error };

  return { ok: true, store: saved.store, file: moved };
}

/**
 * Retrieve the audit trail for a file. Falls back to a single-entry
 * trail for legacy records that have no auditTrail array.
 */
export function getFileAuditTrail(file) {
  if (!file) return [];
  if (Array.isArray(file.auditTrail) && file.auditTrail.length > 0) {
    return file.auditTrail;
  }
  return [
    {
      date: file.uploadedAt || "",
      user: file.uploadedBy || "Unknown user",
      action: "Uploaded",
      remarks: `Status: ${file.status || "Final"}`,
    },
  ];
}

/* ==================================================================
   FORMATTERS (shared by table, preview and messages)
================================================================== */

/** Bytes -> "1.2 MB". */
export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(value) / Math.log(1024))
  );
  const scaled = value / 1024 ** index;
  const decimals = scaled >= 100 || index === 0 ? 0 : 1;

  return `${scaled.toFixed(decimals)} ${units[index]}`;
}

/** ISO -> "12-Jan-2026" in UTC (delegates to shared utility). */
export function formatDate(iso) {
  return formatDateUTC(iso);
}

/** ISO -> "12-Jan-2026, 14:05 UTC" in UTC (delegates to shared utility). */
export function formatDateTime(iso) {
  return formatDateTimeUTC(iso);
}

const FileService = {
  subjectFilesKey,
  loadFileStore,
  saveFileStore,
  resetFileStore,
  subscribeFiles,
  listFiles,
  fetchFolderFiles,
  countAllFiles,
  totalSize,
  findFileById,
  pruneOrphanFolders,
  searchFiles,
  sortFiles,
  validateFileName,
  validateUploadCandidate,
  uploadFiles,
  renameFile,
  deleteFile,
  approveFile,
  downloadFile,
  duplicateFile,
  moveFile,
  getFileAuditTrail,
  formatFileSize,
  formatDate,
  formatDateTime,
};

export default FileService;
