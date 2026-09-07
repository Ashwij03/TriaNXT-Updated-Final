/**
 * Subject ICF — CROSS-SURFACE RECONCILIATION SERVICE
 * ===================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * The "ICF" folder concept is defined independently on two surfaces that
 * historically shared no storage:
 *
 *   1. DOCUMENT HUB (DocumentFolderManager / StudySubjects / subject doc
 *      pages). Folders live in folderService's `trianxtFolderTrees` under
 *      `subjects::<contextKey>` and documents live in
 *      `trianxtFolderDocuments` under the same context, bucketed by the
 *      *hub* folder id of the ICF node.
 *
 *   2. SUBJECT EXPLORER (SubjectExplorer / StudySubjectsWorkspace / file
 *      manager). Folders live in folderTreeService's
 *      `trianxtSubjectExplorerTree:<studyId>` and files live in fileService's
 *      `trianxtSubjectFiles:<studyId>`, bucketed by the *explorer* folder id
 *      (`<subjectId>/icf` — the deterministic id of the locked system ICF
 *      folder that every subject node owns).
 *
 * A consent form uploaded from one surface never showed up on the other,
 * because nothing ever reconciled the two localStorage keys. This module is
 * that reconciliation: it mirrors the ICF folder's documents between the two
 * stores in both directions, idempotently.
 *
 * SEMANTICS
 * ---------
 * - `syncHubIcfToExplorer` makes the explorer's `<subjectId>/icf` bucket the
 *   mirror of the hub ICF folders found for the subject (all matching
 *   `subjects::` contexts, e.g. `subject-<studyId>-<subjectId>` and the
 *   legacy bare `<subjectId>`): records the hub no longer lists are pruned,
 *   changed records are patched, new records are appended. Explorer uploads
 *   that did NOT come from the hub (no `hubIcfKey` marker) are left alone.
 * - `syncExplorerIcfToHub` pushes explorer-origin ICF uploads into every hub
 *   ICF folder found for the subject (creating the standard
 *   `subject-<studyId>-<subjectId>` context only when none exists yet, so a
 *   hub view opened later sees them). Hub documents uploaded directly on the
 *   hub are never overwritten or removed — only records carrying the
 *   `sourceExplorer` marker are pruned when they disappear from the explorer.
 *
 * Both directions run synchronously over localStorage — the same mock layer
 * the two stores already use — and only write when something actually
 * changed. When a real backend arrives, the same two entry points become the
 * HTTP seams.
 *
 * BOUNDARY (deliberate)
 * ---------------------
 * The reconciliation is scoped to the subject's ICF folder, matching the
 * reported bug. Subfolders created *inside* the explorer's ICF node are
 * explorer-only today and are not mirrored, because the hub side keys its
 * documents by folder id with no deterministic equivalent.
 */

import { readJson } from "../utils/storageHelpers";
import { getAllSubjects } from "./subjectService";
import {
  createFolder,
  FOLDER_DOCS_KEY,
  FOLDER_TREE_KEY,
  getDocumentsForFolder,
  getFolderTree,
  saveDocumentsForFolder,
} from "./folderService";
import FileService from "../components/SubjectExplorer/fileService";
import FolderTreeService, {
  ICF_FOLDER_NAME,
} from "../components/SubjectExplorer/folderTreeService";

/** Deterministic explorer-side folder id for a subject's locked ICF folder. */
export function explorerIcfFolderId(subjectId) {
  return `${subjectId}/icf`;
}

/** Key used to remember that an explorer file record was mirrored from the hub. */
const HUB_SYNC_KEY_PREFIX = "hubIcf:";

/** Marker written onto hub doc records that were pushed from the explorer. */
const EXPLORER_SOURCE_MARKER = "sourceExplorer";

function hubSyncKey(contextKey, hubFolderId, docId) {
  return `${HUB_SYNC_KEY_PREFIX}${contextKey}::${hubFolderId}::${docId}`;
}

/** Case-insensitive name match used when locating ICF folders in a hub tree. */
function isIcfNodeName(name) {
  return String(name || "").trim().toLowerCase() === "icf";
}

function isIcfHubNode(node) {
  return Boolean(
    node && (node.isICF || node.isProtected || isIcfNodeName(node.name))
  );
}

/** Deep-first search for the first ICF folder node in a hub tree. */
function findIcfNodeInList(nodes) {
  if (!Array.isArray(nodes)) return null;

  for (const node of nodes) {
    if (!node) continue;
    if (isIcfHubNode(node)) return node;
    const nested = findIcfNodeInList(node.children);
    if (nested) return nested;
  }

  return null;
}

/**
 * Every hub `subjects::<contextKey>` storage key that could belong to this
 * subject. DocumentFolderManager writes with either the composite key
 * (`subject-<studyId>-<subjectId>` from StudySubjects) or — in older pages —
 * the bare subject id. Matching both keeps every surface in sync regardless
 * of which entry point created the data.
 */
export function listHubSubjectContextKeys(subjectId) {
  if (!subjectId) return [];

  const trees = readJson(FOLDER_TREE_KEY, {}) || {};
  const normalizedSubject = String(subjectId).trim().toLowerCase();

  return Object.keys(trees)
    .filter((key) => {
      if (!key.startsWith("subjects::")) return false;
      const contextKey = key.slice("subjects::".length);
      const normalized = String(contextKey).trim().toLowerCase();
      return (
        normalized === normalizedSubject ||
        normalized.endsWith(`-${normalizedSubject}`)
      );
    })
    .sort();
}

/** The ICF folder node(s) for a subject across every matching hub context. */
export function getHubIcfFolderNodes(subjectId) {
  const contexts = listHubSubjectContextKeys(subjectId);
  const found = [];

  contexts.forEach((storageKey) => {
    const trees = readJson(FOLDER_TREE_KEY, {}) || {};
    const tree = trees[storageKey];
    const node = findIcfNodeInList(tree);

    if (node) {
      found.push({
        contextKey: storageKey.slice("subjects::".length),
        folderId: node.id,
      });
    }
  });

  return found;
}

/**
 * All ICF documents currently stored on the hub side for this subject, each
 * tagged with the context it came from (used for idempotent reconciliation).
 */
export function getHubIcfRecords(subjectId) {
  const nodes = getHubIcfFolderNodes(subjectId);
  const allDocs = readJson(FOLDER_DOCS_KEY, {}) || {};
  const records = [];

  nodes.forEach(({ contextKey, folderId }) => {
    const docs = allDocs[`subjects::${contextKey}`]?.[folderId];
    if (!Array.isArray(docs)) return;

    docs.forEach((doc) => {
      if (!doc || typeof doc !== "object") return;
      records.push({
        contextKey,
        folderId,
        syncKey: hubSyncKey(contextKey, folderId, doc.id),
        doc,
      });
    });
  });

  return records;
}

/**
 * Best-effort resolution of a subject's study from the roster. Falls back to
 * null so callers can decide whether a sync target can be derived at all.
 */
export function findStudyForSubject(subjectId) {
  try {
    const all = getAllSubjects();
    const match = (all || []).find(
      (record) =>
        record?.id &&
        String(record.id).trim().toLowerCase() ===
          String(subjectId).trim().toLowerCase()
    );
    return match?.studyId || null;
  } catch {
    return null;
  }
}

/** Build an explorer file record from a hub document record. */
function toExplorerFileRecord(record, subjectId) {
  const { doc, syncKey } = record;
  const now = new Date().toISOString();

  return {
    id: doc.id,
    folderId: explorerIcfFolderId(subjectId),
    name: String(doc.name || "Untitled Document"),
    size: Number(doc.size) || 0,
    uploadedAt: doc.uploadedAt || now,
    modifiedAt: doc.modifiedAt || doc.uploadedAt || now,
    uploadedBy: doc.uploadedBy || "Current User",
    modifiedBy: doc.modifiedBy || doc.uploadedBy || "Unknown user",
    status: doc.status || "Pending Review",
    hasContent: false,
    hubIcfKey: syncKey,
  };
}

function getSyncKeyOfExplorerFile(file) {
  return file ? file.hubIcfKey || null : null;
}

/** Patch mutable display fields of an existing explorer mirror. */
function patchExplorerFile(existing, record) {
  const { doc } = record;
  const now = new Date().toISOString();
  let changed = false;

  const patch = {
    name: String(doc.name || "Untitled Document"),
    size: Number(doc.size) || 0,
    uploadedAt: doc.uploadedAt || existing.uploadedAt || now,
    modifiedAt: doc.modifiedAt || doc.uploadedAt || existing.modifiedAt || now,
    uploadedBy: doc.uploadedBy || existing.uploadedBy || "Current User",
    modifiedBy:
      doc.modifiedBy || doc.uploadedBy || existing.modifiedBy || "Unknown user",
    status: doc.status || "Pending Review",
  };

  Object.entries(patch).forEach(([field, value]) => {
    if (String(existing[field] ?? "") !== String(value ?? "")) {
      existing[field] = value;
      changed = true;
    }
  });

  return changed;
}

/**
 * Hub -> Explorer. Makes the subject's explorer ICF bucket match the hub's
 * ICF folders for the subject. Returns per-row counts; only persists when
 * something changed.
 */
export function syncHubIcfToExplorer({ studyId, subjectId }) {
  if (!studyId || !subjectId) {
    return { added: 0, updated: 0, removed: 0, changed: false, error: null };
  }

  const icfFolderId = explorerIcfFolderId(subjectId);
  let tree;
  try {
    tree = FolderTreeService.loadFolderTree(studyId);
  } catch {
    tree = [];
  }

  const icfNode = FolderTreeService.findNodeById(tree, icfFolderId);
  if (!icfNode) {
    // The subject does not exist in this study's explorer tree (not on the
    // roster), so there is no locked ICF folder to mirror into. Leave the
    // hub data untouched — it stays visible on the hub.
    return { added: 0, updated: 0, removed: 0, changed: false, error: null };
  }

  const records = getHubIcfRecords(subjectId);
  const desiredByKey = new Map();
  records.forEach((record) => desiredByKey.set(record.syncKey, record));

  const store = FileService.loadFileStore(studyId);
  const bucket = FileService.listFiles(store, icfFolderId);
  const nextBucket = [];
  let added = 0;
  let updated = 0;
  let removed = 0;

  // Keep explorer-origin files untouched, prune stale hub mirrors.
  bucket.forEach((file) => {
    const syncKey = getSyncKeyOfExplorerFile(file);
    if (!syncKey) {
      nextBucket.push(file);
      return;
    }

    const record = desiredByKey.get(syncKey);
    if (!record) {
      removed += 1; // hub no longer has this document
      return;
    }

    if (patchExplorerFile(file, record)) {
      updated += 1;
    }
    nextBucket.push(file);
    desiredByKey.delete(syncKey);
  });

  // Any remaining desired records are brand new mirrors.
  desiredByKey.forEach((record) => {
    // Guard against an id collision with an existing explorer-origin file.
    const idTaken = nextBucket.some((file) => file.id === record.doc.id);
    if (idTaken) return;

    nextBucket.push(toExplorerFileRecord(record, subjectId));
    added += 1;
  });

  const changed = added > 0 || updated > 0 || removed > 0;
  if (changed) {
    FileService.saveFileStore(
      studyId,
      { ...store, [icfFolderId]: nextBucket },
      "icf-sync-from-hub",
      icfFolderId
    );
  }

  return { added, updated, removed, changed };
}

/** Build a hub document record from an explorer file record. */
function toHubDocRecord(file, studyId, subjectId) {
  const now = new Date().toISOString();
  const isPdf =
    String(file.type || "").toLowerCase() === "application/pdf" ||
    String(file.name || "").toLowerCase().endsWith(".pdf");

  return {
    id: file.id,
    name: String(file.name || "Untitled Document"),
    type: isPdf ? "application/pdf" : "application/octet-stream",
    size: Number(file.size) || 0,
    uploadedAt: file.uploadedAt || now,
    uploadedBy: file.uploadedBy || "Current User",
    status: file.status || "Pending Review",
    documentType: "General",
    studyCode: studyId || "",
    subjectId: subjectId || "",
    fileUrl: file.fileUrl || "",
    [EXPLORER_SOURCE_MARKER]: true,
  };
}

/**
 * Explorer -> Hub. Mirrors explorer-origin files from the subject's explorer
 * ICF bucket into every hub ICF folder found for the subject. When no hub
 * context exists yet, the standard `subject-<studyId>-<subjectId>` context is
 * created so a later hub visit shows the files. Returns per-row counts.
 */
export function syncExplorerIcfToHub({ studyId, subjectId }) {
  if (!studyId || !subjectId) {
    return { added: 0, updated: 0, removed: 0, changed: false, error: null };
  }

  const icfFolderId = explorerIcfFolderId(subjectId);
  const store = FileService.loadFileStore(studyId);
  const bucket = FileService.listFiles(store, icfFolderId);
  // Only explorer-origin uploads are pushed; hub mirrors are already there.
  const originals = bucket.filter((file) => !getSyncKeyOfExplorerFile(file));

  const folderNodes = getHubIcfFolderNodes(subjectId);

  if (folderNodes.length === 0 && originals.length === 0) {
    // Nothing to push and no hub context to push into.
    return { added: 0, updated: 0, removed: 0, changed: false, error: null };
  }

  let targets = folderNodes;
  if (targets.length === 0) {
    // Create the canonical hub context DocumentFolderManager uses for a
    // subject (StudySubjects) so a later visit surfaces these files.
    const contextKey = `subject-${studyId}-${subjectId}`;
    let root = null;
    try {
      const tree = getFolderTree("subjects", contextKey);
      root = Array.isArray(tree) && tree[0] ? tree[0] : null;
    } catch {
      root = null;
    }

    if (!root) {
      return { added: 0, updated: 0, removed: 0, changed: false, error: null };
    }

    let icfNode = findIcfNodeInList(root.children);
    if (!icfNode) {
      icfNode = createFolder("subjects", contextKey, root.id, ICF_FOLDER_NAME);
    }

    if (icfNode?.id) {
      targets = [{ contextKey, folderId: icfNode.id }];
    }
  }

  let added = 0;
  let updated = 0;
  let removed = 0;
  let changed = false;

  targets.forEach(({ contextKey, folderId }) => {
    const existing = getDocumentsForFolder("subjects", contextKey, folderId);
    const byId = new Map(existing.map((doc) => [doc.id, doc]));
    const nextDocs = [];

    // Prune stale explorer-sourced records, keep genuine hub uploads as-is.
    existing.forEach((doc) => {
      if (doc?.[EXPLORER_SOURCE_MARKER] && !originals.some((f) => f.id === doc.id)) {
        removed += 1;
        return;
      }
      nextDocs.push(doc);
      byId.set(doc.id, doc);
    });

    // Add or patch explorer-origin files.
    originals.forEach((file) => {
      const current = byId.get(file.id);
      const desired = toHubDocRecord(file, studyId, subjectId);

      if (!current) {
        nextDocs.push(desired);
        added += 1;
        return;
      }

      const fields = [
        "name",
        "size",
        "uploadedAt",
        "uploadedBy",
        "status",
        "type",
      ];
      let docChanged = false;
      fields.forEach((field) => {
        const next = String(desired[field] ?? "");
        const prev = String(current[field] ?? "");
        if (next !== prev) {
          current[field] = desired[field];
          docChanged = true;
        }
      });

      if (docChanged) {
        current[EXPLORER_SOURCE_MARKER] = true;
        updated += 1;
      }
    });

    if (added > 0 || updated > 0 || removed > 0) {
      saveDocumentsForFolder("subjects", contextKey, folderId, nextDocs);
      changed = true;
    }
  });

  return { added, updated, removed, changed };
}

/** Run both directions — a convenience for callers that just want parity. */
export function syncSubjectIcf({ studyId, subjectId }) {
  const toExplorer = syncHubIcfToExplorer({ studyId, subjectId });
  const toHub = syncExplorerIcfToHub({ studyId, subjectId });

  return {
    toExplorer,
    toHub,
    changed: toExplorer.changed || toHub.changed,
  };
}

const SubjectIcfSyncService = {
  explorerIcfFolderId,
  listHubSubjectContextKeys,
  getHubIcfFolderNodes,
  getHubIcfRecords,
  findStudyForSubject,
  syncHubIcfToExplorer,
  syncExplorerIcfToHub,
  syncSubjectIcf,
};

export default SubjectIcfSyncService;
