/**
 * Bulk folder upload - PLANNING + COMMIT LOGIC
 * =============================================
 *
 * Pure, non-React helpers behind SubjectFolderUpload:
 *
 *   1. `collectFilesFromEntries` / `collectFilesFromFileList` normalise the
 *      two browser sources (drag-and-drop folder entry traversal and a
 *      `<input webkitdirectory>` pick) into one list of `{ file, path }`
 *      records whose `path` always starts with the dropped root folder name
 *      (mirroring the `webkitRelativePath` contract).
 *
 *   2. `buildFolderUploadPlan` turns that flat list into a write plan for the
 *      explorer's own tree schema (folderTreeService nodes) plus the
 *      `folderId -> file` bucket assignments for fileService. The plan is a
 *      pure description - nothing touches localStorage until
 *      `commitFolderUploadPlan` runs.
 *
 *   3. `commitFolderUploadPlan` persists the plan through the existing
 *      services in a small number of writes (one tree save, one batched file
 *      save per slice) and emits the same change events the explorer already
 *      listens for, so open views auto-refresh.
 *
 * The ICF guarantee lives in the planner: a dropped folder named "ICF" (or
 * files dropped directly onto an existing locked ICF folder) always merges
 * into the subject's single locked system ICF folder - it is never recreated
 * as a second, unlocked "ICF" folder.
 */

import FolderTreeService, {
  ICF_FOLDER_NAME,
  isLockedFolder,
} from "../SubjectExplorer/folderTreeService";
import {
  MAX_FILE_BYTES,
  createBulkFileRecords,
  formatFileSize,
  loadFileStore,
} from "../SubjectExplorer/fileService";
import {
  getExtension,
  isSupportedExtension,
} from "../SubjectExplorer/fileTypes";

/* ==================================================================
   LIMITS (surfaced as constants, never magic numbers inline)
================================================================== */

export const FOLDER_UPLOAD_LIMITS = {
  /** Hard cap on files per bulk upload so the UI thread stays responsive. */
  maxFiles: 500,
  /** Total bytes across every file in one upload. */
  maxTotalBytes: 100 * 1024 * 1024,
  /** Per-file cap - identical to the single-file upload limit. */
  perFileBytes: MAX_FILE_BYTES,
  /** Rows persisted per write slice while committing (~freeze guard). */
  batchSize: 50,
  /** Yield to the event loop after this many rows inside one slice. */
  yieldEvery: 10,
};

/** Dot-prefixed segments (hidden files/folders) are skipped, never stored. */
export function isHiddenSegment(segment) {
  return String(segment || "").startsWith(".");
}

/* ==================================================================
   WALKERS - normalise picker vs drag-and-drop into { file, path }
================================================================== */

/**
 * Collect files picked via `<input type="file" webkitdirectory>`.
 * `webkitRelativePath` already carries the full path from the picked root
 * folder (e.g. "consent-pack/v1/form.pdf"). Falls back to the bare file name
 * so plain (non-directory) inputs also work.
 */
export function collectFilesFromFileList(fileList) {
  return Array.from(fileList || []).map((file: any) => ({
    file,
    path:
      file.webkitRelativePath ||
      file.relativePath ||
      String(file.name || "file"),
  }));
}

/** Read every entry (recursively) out of a directory reader. */
function readAllEntries(reader: any) {
  return new Promise((resolve, reject) => {
    const collected = [];
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(collected);
            return;
          }
          collected.push(...batch);
          readBatch();
        },
        (error) => reject(error)
      );
    };
    readBatch();
  });
}

/** Walk one entry, prefixing every file's path with the folder spine. */
async function walkEntry(entry: any, pathPrefix) {
  if (!entry) return [];

  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file) => {
          try {
            Object.defineProperty(file, "relativePath", {
              value: pathPrefix + (entry.name || file.name),
              configurable: true,
            });
          } catch {
            /* Some browsers seal File instances - fall through. */
          }
          resolve([file]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    try {
      const children = (await readAllEntries(entry.createReader())) as any[];
      const nested = await Promise.all(
        children.map((child) =>
          walkEntry(child, `${pathPrefix}${entry.name}/`)
        )
      );
      return nested.flat();
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Collect files from a drag-and-drop `DataTransfer`, traversing dropped
 * directories via the FileSystemEntry API (like the document managers do).
 * Files carry the root folder's name in their path.
 */
export async function collectFilesFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return [];

  const items = dataTransfer.items as any[];
  if (!items || !items.length) {
    return collectFilesFromFileList(dataTransfer.files);
  }

  const supportsEntries =
    typeof items[0].webkitGetAsEntry === "function" ||
    typeof items[0].getAsEntry === "function";

  if (!supportsEntries) {
    return collectFilesFromFileList(dataTransfer.files);
  }

  const topEntries = Array.from(items)
    .map((item: any) =>
      item.webkitGetAsEntry
        ? item.webkitGetAsEntry()
        : item.getAsEntry && item.getAsEntry()
    )
    .filter(Boolean);

  if (!topEntries.length) {
    return collectFilesFromFileList(dataTransfer.files);
  }

  const perEntry = await Promise.all(topEntries.map((entry) => walkEntry(entry, "")));
  const files = perEntry.flat();
  return files.map((file) => ({
    file,
    path: file.relativePath || String(file.name || "file"),
  }));
}

/* ==================================================================
   PLANNER
================================================================== */

function createId(prefix = "fld") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSegment(name) {
  return String(name || "").trim();
}

/** Folder-name legality check mirrors folderTreeService.FOLDER_NAME_RULES. */
// eslint-disable-next-line no-useless-escape
const INVALID_NAME_CHARS = /[\\/\\\\:*?\"<>|]/;
const MAX_NAME_LENGTH = 60;

function isValidFolderSegment(name) {
  const trimmed = normalizeSegment(name);
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_NAME_LENGTH &&
    !INVALID_NAME_CHARS.test(trimmed)
  );
}

function hasChildNamed(node, name) {
  return (node.children || []).some(
    (child) =>
      String(child.name || "")
        .trim()
        .toLowerCase() === String(name || "").trim().toLowerCase()
  );
}

/**
 * Describe the write plan for one bulk upload.
 *
 * @param {object}  options
 * @param {Array}   options.tree            live explorer tree for the study
 * @param {string}  options.targetFolderId  node the upload lands in (a
 *   subject node or one of its folders - including the locked ICF folder)
 * @param {Array}   options.collected       [{ file, path }] from a walker
 * @returns {{
 *   entries: Array<{ file: File, folderId: string, name: string }>,
 *   foldersToCreate: Array<{ id, name, parentId }>,
 *   reusedFolderIds: string[],
 *   skipped: Array<{ name, reason }>,
 *   totalBytes: number,
 *   targetParentId: string,
 *   mergeIntoIcf: boolean,
 * }}
 */
export function buildFolderUploadPlan({
  tree = [],
  targetFolderId,
  collected = [],
}) {
  const skipped = [];
  const reusedFolderIds = [];

  if (!targetFolderId) {
    return {
      entries: [],
      foldersToCreate: [],
      reusedFolderIds,
      skipped: [{ name: "(all)", reason: "No target folder selected." }],
      totalBytes: 0,
      targetParentId: null,
      mergeIntoIcf: false,
    };
  }

  const targetNode = FolderTreeService.findNodeById(tree, targetFolderId);
  if (!targetNode) {
    return {
      entries: [],
      foldersToCreate: [],
      reusedFolderIds,
      skipped: [{ name: "(all)", reason: "The target folder no longer exists." }],
      totalBytes: 0,
      targetParentId: null,
      mergeIntoIcf: false,
    };
  }

  const isSubjectTarget = targetNode.type === "subject";
  const targetIsLockedIcf = Boolean(isLockedFolder(targetNode));

  const working = JSON.parse(JSON.stringify(tree));
  /** Node resolver against the working clone (folders planned are visible
     to later files in the same pass). */
  const nodeById = (id) => FolderTreeService.findNodeById(working, id);
  const planFolders = [];

  const firstRootName = normalizeSegment(
    String(collected[0]?.path || "").split("/")[0]
  );
  const droppedIcf =
    firstRootName.toLowerCase() === ICF_FOLDER_NAME.toLowerCase();

  /**
   * Folder to nest under. When the target is the subject node and the drop's
   * root folder is named "ICF", the drop targets the subject's single locked
   * ICF folder instead of creating a second, unlocked one.
   */
  let baseNode = nodeById(targetFolderId);
  let mergeIntoIcf = targetIsLockedIcf;

  if (isSubjectTarget && droppedIcf) {
    const icf = (baseNode.children || []).find(
      (child) => isLockedFolder(child) || child.name === ICF_FOLDER_NAME
    );

    if (icf) {
      baseNode = icf;
      mergeIntoIcf = true;
    } else {
      // A subject must always have exactly one locked ICF folder. If one is
      // genuinely missing (legacy data), create it locked - never as a
      // second, unlocked "ICF" folder.
      const subjectId = baseNode.id;
      const lockedIcf = {
        id: `${subjectId}/icf`,
        name: ICF_FOLDER_NAME,
        type: "folder",
        locked: true,
        children: [],
        createdAt: new Date().toISOString(),
      };
      baseNode.children = baseNode.children || [];
      baseNode.children.unshift(lockedIcf);
      planFolders.push({
        id: lockedIcf.id,
        name: lockedIcf.name,
        parentId: subjectId,
        locked: true,
      });
      baseNode = lockedIcf;
      mergeIntoIcf = true;
    }
  }

  const baseFolderId = baseNode?.id || null;
  if (!baseFolderId) {
    return {
      entries: [],
      foldersToCreate: [],
      reusedFolderIds,
      skipped: [{ name: "(all)", reason: "The target folder no longer exists." }],
      totalBytes: 0,
      targetParentId: null,
      mergeIntoIcf: false,
    };
  }

  /** Map one collected file's path to its final folder id (creating folders
   *  in the plan as needed). Returns null when the path must be skipped. */
  const resolveFile = (path) => {
    const trimmed = String(path || "").trim();
    if (!trimmed) return null;

    let segments = trimmed.split("/").filter(Boolean);
    const fileName = normalizeSegment(segments.pop());

    if (isHiddenSegment(fileName)) {
      skipped.push({ name: path, reason: "Hidden files are skipped." });
      return null;
    }
    if (!fileName) return null;

    // Merging into ICF: a spine that repeats the folder's own name (e.g.
    // dropping an "ICF" folder onto the subject) refers to the base itself,
    // so its leading segment is dropped rather than nested inside itself.
    if (mergeIntoIcf && segments[0]?.toLowerCase() === "icf") {
      segments = segments.slice(1);
    }

    // Files dropped directly onto the target (no folder spine) land in the
    // target node's own bucket - for the locked ICF folder this is exactly
    // the "drop files under an existing ICF node" merge requirement.
    if (segments.length === 0) {
      return { folderId: baseFolderId, fileName };
    }

    let cursorId = baseFolderId;
    let cursorNode = nodeById(baseFolderId);
    if (!cursorNode) {
      skipped.push({ name: path, reason: "The target folder no longer exists." });
      return null;
    }

    for (const segment of segments) {
      const name = normalizeSegment(segment);
      if (!isValidFolderSegment(name)) {
        skipped.push({
          name: path,
          reason: `Folder name "${name}" is not allowed here.`,
        });
        return null;
      }
      if (isHiddenSegment(name)) {
        skipped.push({
          name: path,
          reason: "Hidden folders are skipped.",
        });
        return null;
      }

      // Reuse an existing same-named child (folders merge, never duplicate).
      const existing = (cursorNode.children || []).find(
        (child) =>
          String(child.name || "")
            .trim()
            .toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        reusedFolderIds.push(existing.id);
        cursorId = existing.id;
        cursorNode = existing;
        continue;
      }

      const folderNode = {
        id: createId(),
        name,
        type: "folder",
        children: [],
        createdAt: new Date().toISOString(),
      };
      cursorNode.children = cursorNode.children || [];
      cursorNode.children.push(folderNode);
      planFolders.push({ id: folderNode.id, name, parentId: cursorId });
      cursorId = folderNode.id;
      cursorNode = folderNode;
    }

    return { folderId: cursorId, fileName };
  };

  const entries = [];

  collected.forEach(({ file, path }) => {
    if (!file) return;
    const resolved = resolveFile(path);
    if (!resolved) return;

    const extension = getExtension(resolved.fileName);
    if (!isSupportedExtension(extension)) {
      skipped.push({
        name: resolved.fileName,
        reason: `Unsupported file type (.${extension || "none"}).`,
      });
      return;
    }
    if (!file.size) {
      skipped.push({ name: resolved.fileName, reason: "File is empty (0 bytes)." });
      return;
    }
    if (file.size > FOLDER_UPLOAD_LIMITS.perFileBytes) {
      skipped.push({
        name: resolved.fileName,
        reason: `File exceeds the ${formatFileSize(
          FOLDER_UPLOAD_LIMITS.perFileBytes
        )} upload limit.`,
      });
      return;
    }

    entries.push({
      file,
      folderId: resolved.folderId,
      name: resolved.fileName,
    });
  });

  return {
    entries,
    foldersToCreate: planFolders,
    reusedFolderIds,
    skipped,
    totalBytes: entries.reduce((sum, entry) => sum + (entry.file.size || 0), 0),
    targetParentId: baseFolderId,
    mergeIntoIcf,
  };
}

/* ==================================================================
   COMMIT - persists the plan through the existing services
================================================================== */

/**
 * Persist a plan created by `buildFolderUploadPlan`.
 *
 * - Creates the planned folders in one tree save (deduping against folders
 *   that were created between planning and committing).
 * - Writes file records in slices of `batchSize`, so a ~500-file upload
 *   never blocks the UI thread for one giant synchronous localStorage write.
 *
 * Records are stored as metadata (name/size/type/dates) without inline file
 * bytes - the same policy fileService already applies to anything over its
 * inline-content cap, and the same trade-off the document managers make for
 * bulk folder imports. A real backend removes the limit.
 */
export async function commitFolderUploadPlan({
  studyId,
  tree,
  plan,
  uploadedBy = "Current User",
  onProgress,
}) {
  if (!studyId || !plan || plan.entries.length === 0) {
    return { ok: false, error: "Nothing to upload." };
  }

  /* 1 - Folders (one write). */
  let workingTree = JSON.parse(JSON.stringify(tree || []));
  let createdCount = 0;

  plan.foldersToCreate.forEach((folder) => {
    const parent = FolderTreeService.findNodeById(workingTree, folder.parentId);
    if (!parent) return;
    if (
      (parent.children || []).some(
        (child) =>
          String(child.name || "")
            .trim()
            .toLowerCase() === String(folder.name).toLowerCase()
      )
    ) {
      return; // already created between plan and commit
    }

    parent.children = parent.children || [];
    parent.children.push({
      id: folder.id,
      name: folder.name,
      type: "folder",
      children: [],
      createdAt: new Date().toISOString(),
      ...(folder.locked ? { locked: true } : {}),
    });
    createdCount += 1;
  });

  if (createdCount > 0) {
    FolderTreeService.saveFolderTree(studyId, workingTree, "bulk-folder-upload");
  }

  /* 2 - Files (one store write per slice). */
  const store = loadFileStore(studyId);
  const sliceSize = FOLDER_UPLOAD_LIMITS.batchSize;
  let added = 0;
  let rejected = [];

  for (let i = 0; i < plan.entries.length; i += sliceSize) {
    const slice = plan.entries.slice(i, i + sliceSize);
    const result = createBulkFileRecords(
      studyId,
      store,
      slice.map((entry) => ({ folderId: entry.folderId, file: entry.file })),
      uploadedBy
    );

    added += result.added?.length || 0;
    rejected = rejected.concat(result.rejected || []);

    if (result.store) {
      Object.assign(store, result.store);
    }

    if (typeof onProgress === "function") {
      onProgress({
        done: Math.min(i + sliceSize, plan.entries.length),
        total: plan.entries.length,
      });
    }

    // Yield so the UI thread can paint between slices.
    if (i + sliceSize < plan.entries.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    ok: true,
    foldersCreated: createdCount,
    filesAdded: added,
    rejected,
    totalFiles: plan.entries.length,
  };
}
