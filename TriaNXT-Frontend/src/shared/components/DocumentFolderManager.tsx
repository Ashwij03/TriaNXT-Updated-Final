import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheck,
  FiDownload,
  FiEdit2,
  FiEye,
  FiFile,
  FiFolder,
  FiFolderPlus,
  FiLock,
  FiMessageSquare,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import {
  FOLDER_TREE_EVENT,
  collectFolderSubtree,
  createFolder,
  deleteFolder,
  getDocumentsForFolder,
  getFolderTree,
  importUploadedFolderStructure,
  isICFFolder,
  isProtectedFolder,
  renameFolder,
  saveDocumentsForFolder,
} from "../services/folderService";
import {
  buildFolderZip,
  parseUploadedFolderFiles,
  triggerBlobDownload,
  uploadedTreeToStructure,
} from "../utils/folderZipUtils";
import FolderOptionsMenu from "./FolderOptionsMenu";
import FolderTemplateModal from "./FolderTemplateModal";
import ESignatureModal from "./ESignatureModal";
import { recordSignatureLedgerEntry } from "../services/actionSignatureService";
import {
  addCommentRecord,
  canResolveComments,
  canWriteComments,
  getVisibleComments,
  markCommentsDocumentDeleted,
  resolveCommentRecord,
} from "../services/commentService";
import { getStudyByCode } from "../services/studyService";
import { VISIT_STAGES } from "../services/visitScheduleService";
import { notifyDocumentAdded } from "../services/notificationService";
import { getCurrentUser,
  getAssignedSite,
  getEffectiveRole,
  hasPermission,
  ROLE_LABELS,
} from "../services/roleService";
import { formatDateTimeUTC } from "../utils/dateTime";
import PERMISSIONS from "../constants/permissions";
import "./DocumentFolderManager.css";
import FolderColumnView from "./FolderColumnView";

const SUBJECT_ICF_FOLDER_NAME = "ICF";

// Human-readable label for the notification's "in <section>" clause.
// Falls back to the page's own title prop (e.g. a DOCUMENT_TABS label, or
// "Subjects" for the subject folder view) when sectionId isn't one of the
// known top-level sections.
const SECTION_LABELS = {
  subjects: "Subjects",
  studyFolder: "Study Files",
  regulatory: "Regulatory",
  eISF: "eISF",
  others: "Other Documents",
  logs: "Logs",
};

function getSectionLabel(sectionId, title) {
  if (SECTION_LABELS[sectionId]) {
    return SECTION_LABELS[sectionId];
  }

  // Inside a subject's own folder (title is the subject ID, e.g. "SUB-03"),
  // the meaningful section is still "Subjects".
  if (sectionId === "subjects") {
    return "Subjects";
  }

  return title || "Documents";
}

function findNodeById(nodes, nodeId) {
  for (const node of nodes || []) {
    if (node.id === nodeId) {
      return node;
    }

    if (node.children?.length) {
      const nested = findNodeById(node.children, nodeId);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function buildBreadcrumb(tree, pathIds) {
  return pathIds.map((nodeId) => findNodeById(tree, nodeId)).filter(Boolean);
}

function buildPathToNode(nodes, targetId,path: any = []) {
  for (const node of nodes || []) {
    const nextPath = [...path, node.id];

    if (node.id === targetId) {
      return nextPath;
    }

    if (node.children?.length) {
      const nestedPath = buildPathToNode(node.children, targetId, nextPath);

      if (nestedPath) {
        return nestedPath;
      }
    }
  }

  return null;
}

function getFolderNameMatch(folder, name) {
  return (
    String(folder?.name || "")
      .trim()
      .toLowerCase() ===
    String(name || "")
      .trim()
      .toLowerCase()
  );
}

function FolderTreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onUploadFolder,
  onDownloadFolder,
  canModify,
}: any) {
  const hasChildren = node.children?.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isProtected = isProtectedFolder(node) || isICFFolder(node);

  return (
    <div className="dfm-folder-node">
      <div
        className={`dfm-folder-row${isSelected ? " is-selected" : ""}${
          isICFFolder(node) ? " is-icf" : ""
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="dfm-folder-toggle"
            onClick={() => onToggle(node.id)}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="dfm-folder-spacer" />
        )}

        <div className="dfm-folder-content">
          <button
            type="button"
            className="dfm-folder-label"
            onClick={() => onSelect(node.id)}
          >
            <FiFolder className="dfm-folder-icon" />
            <span>{node.name}</span>
            {isICFFolder(node) && <FiLock className="dfm-icf-lock" />}
          </button>

          <FolderOptionsMenu
            folderId={node.id}
            folderName={node.name}
            disabled={!canModify}
            isProtected={isProtected}
            onCreate={onAddFolder}
            onRename={onRenameFolder}
            onDelete={onDeleteFolder}
            onUpload={onUploadFolder}
            onDownload={onDownloadFolder}
          />
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="dfm-folder-children">
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              canModify={canModify}
              onAddFolder={onAddFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onUploadFolder={onUploadFolder}
              onDownloadFolder={onDownloadFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCommentsPanel({
  documentId,
  documentName,
  studyCode,
  subjectId,
  sectionId,
}: any) {
  const study = getStudyByCode(studyCode);
  const studyStage = study?.status || "Monitoring";
  const currentUser = getCurrentUser();
  const assignedSite = getAssignedSite() || "";
  const [commentText, setCommentText] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Derive module and sourceView from sectionId
  const getModuleAndSourceView = (section) => {
    const mapping = {
      subjects: { module: "DocumentMgmt:Subjects", sourceView: "subjects" },
      studyFolder: { module: "DocumentMgmt:StudyFolder", sourceView: "study-folder" },
      regulatory: { module: "DocumentMgmt:Regulatory", sourceView: "regulatory" },
      eISF: { module: "DocumentMgmt:eISF", sourceView: "eisf" },
      others: { module: "DocumentMgmt:Others", sourceView: "others" },
      logs: { module: "DocumentMgmt:Logs", sourceView: "logs" },
    };
    return mapping[section] || { module: "DocumentMgmt", sourceView: "documents" };
  };

  const { module, sourceView } = getModuleAndSourceView(sectionId);

  const comments = useMemo(() => {
    void refreshKey;

    return getVisibleComments(
      { studyCode, subjectId, documentId, studyStage },
      undefined,
    ).filter(
      (item) =>
        String(item.documentId) === String(documentId) ||
        item.document === documentName,
    );
  }, [studyCode, subjectId, documentId, documentName, studyStage, refreshKey]);

  const handleAdd = () => {
    if (!commentText.trim() || !canWriteComments(currentUser)) {
      return;
    }

    addCommentRecord({
      study: studyCode,
      subjectId,
      documentId,
      documentName,
      description: commentText.trim(),
      stage: studyStage,
      site: assignedSite,
      module,
      sourceView,
      activity: documentName || "Document",
    });

    setCommentText("");
    setRefreshKey((value) => value + 1);
  };

  const handleResolve = (commentId) => {
    if (resolveCommentRecord(commentId)) {
      setRefreshKey((value) => value + 1);
    }
  };

  return (
    <div className="dfm-doc-comments">
      <h5>
        <FiMessageSquare /> Document Comments
      </h5>

      {canWriteComments(currentUser) && (
        <div className="dfm-comment-compose">
          <textarea
            placeholder="Add a comment about this document..."
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            rows={2}
          />
          <button type="button" onClick={handleAdd}>
            Add Comment
          </button>
        </div>
      )}

      <ul className="dfm-comment-list">
        {comments.length === 0 && (
          <li className="dfm-comment-empty">No comments for this document.</li>
        )}

        {comments.map((comment) => (
          <li key={comment.id} className="dfm-comment-item">
            <div>
              <strong>{comment.createdBy}</strong>
              <span>{comment.createdAt}</span>

              {comment.documentDeleted && (
                <em className="dfm-doc-deleted-tag">Document deleted</em>
              )}
            </div>

            <p>{comment.description}</p>

            <div className="dfm-comment-meta">
              <span
                className={`dfm-status dfm-status--${comment.status?.toLowerCase()}`}
              >
                {comment.status}
              </span>

              {comment.status === "Open" && canResolveComments(currentUser) && (
                <button type="button" onClick={() => handleResolve(comment.id)}>
                  Resolve
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocumentFolderManager({
  sectionId,
  contextKey = "default",
  title = "Documents",
  readOnly = false,
  studyCode = "",
  subjectId = "",
  layout = "vertical",
  onVisitStageComplete,
  defaultFolders = [],
  onBackToSubjects,
}: any) {
  const [viewLayout, setViewLayout] = useState(layout);
  const isExplorerLayout = viewLayout === "explorer";
  const isColumnLayout = viewLayout === "column";

  const fileInputRef = useRef(null);
  const folderUploadInputRef = useRef(null);
  const uploadTargetFolderIdRef = useRef("");
  const selectedFolderIdRef = useRef("");
  // Real file bytes are never written to localStorage (that's what caused
  // the B4/B6 quota crashes) — but for a document uploaded or replaced in
  // THIS browser session, we keep a temporary, in-memory object URL here so
  // "View" can show the real content until the page is refreshed/closed.
  // After a refresh only the metadata record survives, so preview correctly
  // reverts to "stored as metadata only" for anything from a prior session.
  const sessionFileUrlsRef = useRef(new Map());
  // Multi-file selection held until the E-Signature authorizes the batch.
  const pendingBulkRef = useRef([]);

  useEffect(() => {
    const urlMap = sessionFileUrlsRef.current;

    return () => {
      urlMap.forEach((url) => URL.revokeObjectURL(url));
      urlMap.clear();
    };
  }, []);

  const defaultFolderNames = useMemo(() => {
    if (!Array.isArray(defaultFolders)) {
      return [];
    }

    return defaultFolders
      .map((folder) => String(folder?.name || "").trim())
      .filter(Boolean)
      .sort();
  }, [defaultFolders]);

  const defaultFolderNamesKey = useMemo(() => {
    return defaultFolderNames.join("|");
  }, [defaultFolderNames]);

  const getPreparedTree = useCallback(() => {
    return getFolderTree(sectionId, contextKey);
  }, [sectionId, contextKey]);

  // Ensures default folders (and the protected ICF folder for subjects)
  // exist. This is the ONLY place folders are auto-created, and it only
  // runs from a controlled effect - never during render or inside a
  // useMemo/useCallback used by render. It depends only on stable,
  // primitive values (sectionId, contextKey, defaultFolderNamesKey) so it
  // cannot re-run just because a parent re-created an array/object prop.
  useEffect(() => {
    const namesToEnsure = defaultFolderNamesKey
      ? defaultFolderNamesKey.split("|").filter(Boolean)
      : [];

    if (
      sectionId === "subjects" &&
      !namesToEnsure.includes(SUBJECT_ICF_FOLDER_NAME)
    ) {
      namesToEnsure.push(SUBJECT_ICF_FOLDER_NAME);
    }

    if (namesToEnsure.length === 0) {
      return;
    }

    const currentTree = getFolderTree(sectionId, contextKey);
    const rootFolder = currentTree?.[0];

    if (!rootFolder?.id) {
      return;
    }

    let workingChildren = rootFolder.children || [];
    let didCreateFolder = false;

    namesToEnsure.forEach((folderName) => {
      const exists = workingChildren.some((child) =>
        getFolderNameMatch(child, folderName),
      );

      if (!exists) {
        const created = createFolder(
          sectionId,
          contextKey,
          rootFolder.id,
          folderName,
        );

        if (created) {
          workingChildren = [...workingChildren, created];
          didCreateFolder = true;
        }
      }
    });

    if (!didCreateFolder) {
      return;
    }

    const refreshedTree = getFolderTree(sectionId, contextKey);

    setTree((previousTree) => {
      const previousValue = JSON.stringify(previousTree);
      const nextValue = JSON.stringify(refreshedTree);

      return previousValue === nextValue ? previousTree : refreshedTree;
    });

    const rootId = refreshedTree?.[0]?.id || "";

    if (!selectedFolderIdRef.current && rootId) {
      selectedFolderIdRef.current = rootId;
      setSelectedFolderId(rootId);
      setNavigationPath([rootId]);
    }
  }, [sectionId, contextKey, defaultFolderNamesKey]);

  const [tree, setTree] = useState(() => getFolderTree(sectionId, contextKey));
  const [selectedFolderId, setSelectedFolderId] = useState(
    () => getFolderTree(sectionId, contextKey)[0]?.id || "",
  );
  const [navigationPath, setNavigationPath] = useState(() => {
    const rootId = getFolderTree(sectionId, contextKey)[0]?.id || "";
    return rootId ? [rootId] : [];
  });
  const [expandedIds, setExpandedIds] = useState(new Set<any>());
  const [documents, setDocuments] = useState<any[]>([]);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  /* Mandatory E-Signature gate — { mode, entityType, entityName,
      actionLabel, onSigned }. While set, the shared E-Signature modal is
      shown and NO folder/document mutation is committed until the user
      completes (or cancels) the signature. */
  const [signing, setSigning] = useState(null);
  const [dragDocIndex, setDragDocIndex] = useState(null);
  const [dragOverEmpty, setDragOverEmpty] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Task 1 — Document review/approval
  const canApproveDocs = useMemo(() => hasPermission(PERMISSIONS.APPROVE_REGULATORY_DOCS), []);

  selectedFolderIdRef.current = selectedFolderId;

  const navigationTailId =
    navigationPath.length > 0 ? navigationPath[navigationPath.length - 1] : "";

  const refreshTree = useCallback(() => {
    const nextTree = getPreparedTree();
    const rootId = nextTree[0]?.id || "";
    const currentSelectedId = selectedFolderIdRef.current;

    const selectedStillExists = Boolean(
      currentSelectedId && findNodeById(nextTree, currentSelectedId),
    );

    setTree((previousTree) => {
      const previousValue = JSON.stringify(previousTree);
      const nextValue = JSON.stringify(nextTree);

      return previousValue === nextValue ? previousTree : nextTree;
    });

    if (!selectedStillExists) {
      if (currentSelectedId !== rootId) {
        selectedFolderIdRef.current = rootId;
        setSelectedFolderId(rootId);
        setNavigationPath(rootId ? [rootId] : []);
      }

      return;
    }

    const selectedPath = buildPathToNode(nextTree, currentSelectedId);

    if (selectedPath) {
      setNavigationPath((previousPath) => {
        const previousValue = JSON.stringify(previousPath);
        const nextValue = JSON.stringify(selectedPath);

        return previousValue === nextValue ? previousPath : selectedPath;
      });
    }
  }, [getPreparedTree]);

  const refreshDocuments = useCallback(() => {
    const folderId = selectedFolderIdRef.current;

    if (!folderId) {
      setDocuments([]);
      return;
    }

    setDocuments(getDocumentsForFolder(sectionId, contextKey, folderId));
  }, [sectionId, contextKey]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments, selectedFolderId]);

  useEffect(() => {
    const handleTreeUpdate = (event) => {
      if (
        event.detail?.sectionId === sectionId &&
        event.detail?.contextKey === contextKey
      ) {
        refreshTree();
      }
    };

    window.addEventListener(FOLDER_TREE_EVENT, handleTreeUpdate);

    return () => {
      window.removeEventListener(FOLDER_TREE_EVENT, handleTreeUpdate);
    };
  }, [sectionId, contextKey, refreshTree]);

  useEffect(() => {
    if (!isExplorerLayout || !navigationTailId) {
      return;
    }

    selectedFolderIdRef.current = navigationTailId;

    setSelectedFolderId((currentId) =>
      currentId === navigationTailId ? currentId : navigationTailId,
    );
  }, [isExplorerLayout, navigationTailId]);

  const selectedFolderNode = useMemo(
    () => findNodeById(tree, selectedFolderId),
    [tree, selectedFolderId],
  );

  const selectedFolderName = selectedFolderNode?.name || title;
  const rootFolderId = tree[0]?.id || "";

  const isSelectedRootFolder = selectedFolderId === rootFolderId;

  const isSelectedICFFolder =
    sectionId === "subjects" && isICFFolder(selectedFolderNode);

  const isSelectedProtected =
    isProtectedFolder(selectedFolderNode) || isICFFolder(selectedFolderNode);

  const canModify = !readOnly;

  const matchedVisitStage = VISIT_STAGES.find(
    (stage) => stage.toLowerCase() === String(selectedFolderName).toLowerCase(),
  );

  const canCompleteVisitStage =
    Boolean(matchedVisitStage) &&
    sectionId === "subjects" &&
    documents.length > 0 &&
    typeof onVisitStageComplete === "function";

  const breadcrumb = useMemo(
    () => buildBreadcrumb(tree, navigationPath),
    [tree, navigationPath],
  );

  const currentFolderChildren = selectedFolderNode?.children || [];

  const enterFolder = (folderId) => {
    const latestTree = getPreparedTree();
    const path = buildPathToNode(latestTree, folderId);

    setTree(latestTree);
    selectedFolderIdRef.current = folderId;
    setSelectedFolderId(folderId);

    if (path) {
      setNavigationPath(path);
    }
  };

  const goUpOneLevel = () => {
    if (navigationPath.length <= 1) {
      return;
    }

    const nextPath = navigationPath.slice(0, -1);
    const parentFolderId = nextPath[nextPath.length - 1] || "";

    selectedFolderIdRef.current = parentFolderId;
    setSelectedFolderId(parentFolderId);
    setNavigationPath(nextPath);
  };

  const goToBreadcrumbIndex = (index) => {
    const nextPath = navigationPath.slice(0, index + 1);
    const targetFolderId = nextPath[nextPath.length - 1] || "";

    selectedFolderIdRef.current = targetFolderId;
    setSelectedFolderId(targetFolderId);
    setNavigationPath(nextPath);
  };

  const handleBackToSubjects = () => {
    if (typeof onBackToSubjects === "function") {
      onBackToSubjects();
      return;
    }

    window.history.back();
  };

  const persistDocuments = (nextDocuments) => {
    try {
      saveDocumentsForFolder(
        sectionId,
        contextKey,
        selectedFolderId,
        nextDocuments,
      );

      setDocuments(nextDocuments);
      return true;
    } catch (error) {
      window.alert(
        error?.message ||
          "Unable to save this change. Storage limit may have been reached.",
      );
      return false;
    }
  };

  /** Signature-ledger scope for every mutation inside this manager. */
  const signatureScope = {
    domain: "documents",
    sectionId,
    contextKey,
    studyCode: studyCode || "",
    subjectId: subjectId || "",
  };

  /**
   * Open the mandatory E-Signature step for an upload/edit/delete. The real
   * mutation (`onSigned`) runs ONLY after the signature completes; closing
   * the modal without signing aborts the action.
   */
  const openSignature = ({ mode, entityType, entityName, actionLabel, onSigned }) => {
    setSigning({ mode, entityType, entityName, actionLabel, onSigned });
  };

  const signEntity = (kind, entityType, entityName, signature) => {
    recordSignatureLedgerEntry(signature, {
      kind,
      entityType,
      entityName,
      scope: signatureScope,
    });
  };

  const commitCreateFolder = (folderId, name, signature) => {
    const latestTree = getPreparedTree();
    const rootId = latestTree[0]?.id || "";
    const parentFolderId = folderId || rootId;

    const created = createFolder(
      sectionId,
      contextKey,
      parentFolderId,
      name,
    );

    if (created) {
      signEntity("folder:create", "folder", name, signature);
      setExpandedIds(
        (previousIds) => new Set<any>([...previousIds, parentFolderId]),
      );
      refreshTree();

      if (isExplorerLayout || isColumnLayout) {
        enterFolder(created.id);
      } else {
        selectedFolderIdRef.current = created.id;
        setSelectedFolderId(created.id);
      }
    }
  };

  const handleAddFolder = (folderId = selectedFolderId) => {
    if (!canModify) {
      return;
    }

    const name = window.prompt("New folder name:");

    if (!name?.trim()) {
      return;
    }

    // Mandatory E-Signature BEFORE the folder is created.
    openSignature({
      mode: "create",
      entityType: "folder",
      entityName: name.trim(),
      actionLabel: `Create folder "${name.trim()}" inside the current location.`,
      onSigned: async (signature) => {
        commitCreateFolder(folderId, name.trim(), signature);
      },
    });
  };

  const commitRenameFolder = (folderId, name, signature) => {
    if (renameFolder(sectionId, contextKey, folderId, name)) {
      signEntity("folder:rename", "folder", name, signature);
      refreshTree();
    }
  };

  const handleRenameFolder = (folderId = selectedFolderId) => {
    if (!canModify) {
      return;
    }

    const node = findNodeById(tree, folderId);

    if (!node || isProtectedFolder(node) || isICFFolder(node)) {
      return;
    }

    const name = window.prompt("Rename folder:", node.name || "");

    if (!name?.trim()) {
      return;
    }

    // Mandatory E-Signature BEFORE the rename is committed.
    openSignature({
      mode: "edit",
      entityType: "folder",
      entityName: name.trim(),
      actionLabel: `Rename folder "${node.name}" to "${name.trim()}".`,
      onSigned: async (signature) => {
        commitRenameFolder(folderId, name.trim(), signature);
      },
    });
  };

  const commitDeleteFolder = (folderId, node, signature) => {
    const rootId = tree[0]?.id;
    const deleted = deleteFolder(sectionId, contextKey, folderId);

    if (deleted) {
      signEntity("folder:delete", "folder", node.name, signature);
      selectedFolderIdRef.current = rootId;
      setSelectedFolderId(rootId);
      setNavigationPath(rootId ? [rootId] : []);
      refreshTree();
      refreshDocuments();
    }
  };

  const handleDeleteFolder = (folderId = selectedFolderId) => {
    if (!canModify) {
      return;
    }

    const rootId = tree[0]?.id;

    if (!folderId || folderId === rootId) {
      window.alert("Cannot delete the root folder.");
      return;
    }

    const node = findNodeById(tree, folderId);

    if (!node || isProtectedFolder(node) || isICFFolder(node)) {
      return;
    }

    // Combined permanent-deletion confirmation + mandatory E-Signature in
    // ONE modal — no separate "are you sure" step.
    openSignature({
      mode: "delete",
      entityType: "folder",
      entityName: node.name,
      actionLabel: "This permanently deletes the folder and all documents inside it.",
      onSigned: async (signature) => {
        commitDeleteFolder(folderId, node, signature);
      },
    });
  };

  const handleUploadFolder = (folderId = selectedFolderId) => {
    if (!canModify || !folderId) {
      return;
    }

    uploadTargetFolderIdRef.current = folderId;
    folderUploadInputRef.current?.click();
  };

  const handleFolderUploadSelect = async (fileList) => {
    const targetFolderId = uploadTargetFolderIdRef.current || selectedFolderId;

    if (!targetFolderId || !fileList?.length) {
      return;
    }

    const parsedTree: any = parseUploadedFolderFiles(fileList);
    const structure = uploadedTreeToStructure(parsedTree);
    const folderName = parsedTree?.name || "uploaded folder";

    // Mandatory E-Signature BEFORE the folder structure is imported.
    openSignature({
      mode: "upload",
      entityType: "folder",
      entityName: folderName,
      actionLabel: `Import the folder structure "${folderName}" (${fileList.length} file${
        fileList.length === 1 ? "" : "s"
      }) into the current location.`,
      onSigned: async (signature) => {
        await importUploadedFolderStructure(
          sectionId,
          contextKey,
          targetFolderId,
          structure,
        );
        signEntity("folder:upload", "folder", folderName, signature);
        refreshTree();
        enterFolder(targetFolderId);
      },
    });
  };

  const handleDownloadFolder = async (folderId = selectedFolderId) => {
    const latestTree = getPreparedTree();
    const subtree = collectFolderSubtree(latestTree, folderId);

    if (!subtree) {
      window.alert("Unable to download folder.");
      return;
    }

    try {
      const blob = await buildFolderZip({
        rootName: subtree.name,
        rootNode: subtree,
        getDocumentsForFolder: (targetFolderId) =>
          getDocumentsForFolder(sectionId, contextKey, targetFolderId),
      });

      triggerBlobDownload(blob, `${subtree.name || "folder"}.zip`);
    } catch (error) {
      window.alert("Folder download failed.");
    }
  };

  // Item 18 — Bulk File Upload.
  // The single-file behavior is preserved: when the user selects exactly one
  // PDF the legacy `pendingUpload` preview + Save flow is used unchanged.
  // When multiple PDFs are selected (via the file input, drag-and-drop of
  // several files, or a folder drop), every valid PDF is added to the
  // existing documents list in one batch. Non-PDF files are skipped so the
  // existing document contract stays intact.
  const isPdfFile = (file) => {
    if (!file) return false;
    return (
      file.type === "application/pdf" ||
      String(file.name || "").toLowerCase().endsWith(".pdf")
    );
  };

  const persistBulkFiles = (pdfFiles, signature = null) => {
    if (!pdfFiles.length || !selectedFolderId) {
      return false;
    }
    // Mandatory E-Signature: bulk uploads never persist without a recorded
    // signature (the caller always gates through the E-Signature modal).
    if (!signature) return false;

    const now = Date.now();
    const uploader = signature?.printedName || localStorage.getItem("currentUserName") || "Current User";
    const role = getEffectiveRole(getCurrentUser());
    const roleLabel = ROLE_LABELS[role] || role;
    const sectionLabel = getSectionLabel(sectionId, title);

    const newDocuments = pdfFiles.map((file, index) => {
      const id = `doc-${now}-${index}`;
      const document = {
        id,
        name:
          file.webkitRelativePath ||
          file.relativePath ||
          file.name ||
          "Untitled Document",
        type: file.type || "application/pdf",
        size: Number(file.size) || 0,
        uploadedAt: new Date(now + index).toISOString(),
        uploadedBy: uploader,
        status: "Pending Review",
        documentType: "General",
        studyCode: studyCode || "",
        subjectId: subjectId || "",
        fileUrl: "",
        // The E-Signature that authorized this upload travels with every
        // record created by the batch.
        signatures: [signature],
        lastSignature: signature,
      };

      try {
        sessionFileUrlsRef.current.set(id, URL.createObjectURL(file));
      } catch (err) {
        /* no-op: some environments block object URLs */
      }

      return document;
    });

    const saved = persistDocuments([...documents, ...newDocuments]);
    if (saved) {
      signEntity("document:upload", "document", `${newDocuments.length} file(s)`, signature);
      newDocuments.forEach((doc) => {
        notifyDocumentAdded({
          ...doc,
          addedByRole: roleLabel,
          sectionLabel
        });
      });
    }
    return saved;
  };

  const handleFileSelect = async (fileList) => {
    const filesArray: any[] = Array.from(fileList || []) as any[];

    if (!filesArray.length) {
      return;
    }

    const pdfFiles = filesArray.filter(isPdfFile);

    if (!pdfFiles.length) {
      window.alert("Only PDF files are allowed.");
      return;
    }

    if (pdfFiles.length < filesArray.length) {
      window.alert(
        `${filesArray.length - pdfFiles.length} non-PDF file(s) were skipped.`
      );
    }

    // Bulk upload path — multiple PDFs go straight into the existing
    // document store, reusing persistDocuments. ONE mandatory E-Signature
    // authorizes the whole batch; until it is completed nothing persists.
    if (pdfFiles.length > 1) {
      pendingBulkRef.current = pdfFiles;
      openSignature({
        mode: "upload",
        entityType: "file",
        entityName: `${pdfFiles.length} files${pdfFiles[0]?.name ? ` — ${pdfFiles[0].name} …` : ""}`,
        actionLabel: `Upload ${pdfFiles.length} PDF file(s) to the selected folder.`,
        onSigned: async (signature) => {
          const filesToPersist = pendingBulkRef.current || pdfFiles;
          pendingBulkRef.current = [];
          persistBulkFiles(filesToPersist, signature);
        },
      });
      return;
    }

    // Legacy single-file path — unchanged behavior (preview + Save).
    const file = pdfFiles[0] as any;
    setUploadProgress(0);
    setPendingUpload({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    });

    const steps = [20, 45, 70, 90, 100];

    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      setUploadProgress(step);
    }
  };

  // Extract every file from a drag-and-drop DataTransfer, including files
  // dragged from nested folders. Falls back gracefully when the browser
  // does not support the webkitGetAsEntry directory-traversal API.
  const collectFilesFromDataTransfer = async (dataTransfer) => {
    if (!dataTransfer) return [];

    const itemList = dataTransfer.items;
    if (!itemList || !itemList.length) {
      return Array.from(dataTransfer.files || []);
    }

    const supportsEntries =
      typeof itemList[0].webkitGetAsEntry === "function";

    if (!supportsEntries) {
      return Array.from(dataTransfer.files || []);
    }

    const readAllEntries = (reader) =>
      new Promise((resolve, reject) => {
        const collected = [];
        const readBatch = () => {
          reader.readEntries((batch) => {
            if (!batch.length) {
              resolve(collected);
              return;
            }
            collected.push(...batch);
            readBatch();
          }, reject);
        };
        readBatch();
      });

    const walkEntry = async (entry, pathPrefix = "") => {
      if (!entry) return [];

      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file(
            (file) => {
              try {
                Object.defineProperty(file, "relativePath", {
                  value: pathPrefix + (entry.name || file.name),
                  configurable: true
                });
              } catch (err) {
                /* some browsers seal File instances */
              }
              resolve([file]);
            },
            () => resolve([])
          );
        });
      }

      if (entry.isDirectory) {
        const reader = entry.createReader();
        try {
          const entries = (await readAllEntries(reader)) as any[];
          const nested = await Promise.all(
            entries.map((child) =>
              walkEntry(child, `${pathPrefix}${entry.name}/`)
            )
          );
          return nested.flat();
        } catch (err) {
          return [];
        }
      }

      return [];
    };

    const topEntries = Array.from(itemList)
      .map((item: any) => item.webkitGetAsEntry && item.webkitGetAsEntry())
      .filter(Boolean);

    if (!topEntries.length) {
      return Array.from(dataTransfer.files || []);
    }

    const filesPerEntry = await Promise.all(
      topEntries.map((entry) => walkEntry(entry))
    );
    return filesPerEntry.flat();
  };

  const commitSaveUpload = (signature) => {
    if (!pendingUpload || !selectedFolderId) {
      return;
    }

    const uploader = signature?.printedName || localStorage.getItem("currentUserName") || "Current User";
    const newDocument = {
      id: `doc-${Date.now()}`,
      name: pendingUpload.name || "Untitled Document",
      type: pendingUpload.type || "application/octet-stream",
      size: Number(pendingUpload.size) || 0,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploader,
      status: "Pending Review",
      documentType: pendingUpload.documentType || "General",
      studyCode: studyCode || "",
      subjectId: subjectId || "",
      fileUrl: pendingUpload.fileUrl || "",
      // The E-Signature that authorized this upload stays on the record.
      signatures: [signature],
      lastSignature: signature,
    };

    const saved = persistDocuments([...documents, newDocument]);

    if (saved) {
      signEntity("document:upload", "document", newDocument.name, signature);
      // In-memory only — never persisted, so this never risks a quota
      // crash. Lets "View" show the real file for the rest of this
      // session; gone (correctly) after a refresh since the bytes were
      // never saved to localStorage.
      if (pendingUpload.file) {
        sessionFileUrlsRef.current.set(
          newDocument.id,
          URL.createObjectURL(pendingUpload.file),
        );
      }

      setPendingUpload(null);
      setUploadProgress(0);

      const role = getEffectiveRole(getCurrentUser());
      notifyDocumentAdded({
        ...newDocument,
        addedByRole: ROLE_LABELS[role] || role,
        sectionLabel: getSectionLabel(sectionId, title),
      });
    }
  };

  const handleSaveUpload = async () => {
    if (!pendingUpload || !selectedFolderId) {
      return;
    }

    // Mandatory E-Signature BEFORE the upload is persisted.
    openSignature({
      mode: "upload",
      entityType: "document",
      entityName: pendingUpload.name || "document upload",
      actionLabel: `Upload "${pendingUpload.name || "document"}" to this folder.`,
      onSigned: async (signature) => {
        commitSaveUpload(signature);
      },
    });
  };

  const handleRenameDoc = (docId) => {
    if (!canModify) {
      return;
    }

    const document = documents.find((item) => item.id === docId);

    if (!document) {
      return;
    }

    const name = window.prompt("Rename document:", document.name);

    if (!name?.trim()) {
      return;
    }

    // Mandatory E-Signature BEFORE the rename is committed.
    openSignature({
      mode: "edit",
      entityType: "document",
      entityName: name.trim(),
      actionLabel: `Rename "${document.name}" to "${name.trim()}".`,
      onSigned: async (signature) => {
        const existingSignatures = Array.isArray(document.signatures)
          ? document.signatures
          : [];
        const saved = persistDocuments(
          documents.map((item) =>
            item.id === docId
              ? {
                  ...item,
                  name: name.trim(),
                  lastSignature: signature,
                  signatures: [...existingSignatures, signature],
                }
              : item,
          ),
        );
        if (saved) {
          signEntity("document:rename", "document", name.trim(), signature);
        }
      },
    });
  };

  const handleReplaceDoc = (docId) => {
    if (!canModify) {
      return;
    }

    const document = documents.find((item) => item.id === docId);
    if (!document) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";

    input.onchange = () => {
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        window.alert("Only PDF files are allowed.");
        return;
      }

      // Mandatory E-Signature BEFORE the version update is committed.
      openSignature({
        mode: "edit",
        entityType: "document",
        entityName: file.name,
        actionLabel: `Replace "${document.name}" with a new version from "${file.name}".`,
        onSigned: async (signature) => {
          const previousUrl = sessionFileUrlsRef.current.get(docId);
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          sessionFileUrlsRef.current.set(docId, URL.createObjectURL(file));

          const existingSignatures = Array.isArray(document.signatures)
            ? document.signatures
            : [];
          const saved = persistDocuments(
            documents.map((item) =>
              item.id === docId
                ? {
                    ...item,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploadedAt: new Date().toISOString(),
                    lastSignature: signature,
                    signatures: [...existingSignatures, signature],
                  }
                : item,
            ),
          );
          if (saved) {
            signEntity("document:replace", "document", file.name, signature);
          }
        },
      });
    };

    input.click();
  };

  const handleDeleteDoc = (docId) => {
    if (!canModify) {
      return;
    }

    const document = documents.find((item) => item.id === docId);
    if (!document) return;

    // Combined permanent-deletion confirmation + mandatory E-Signature in
    // ONE modal (danger banner + type-DELETE + red "Delete & Sign").
    openSignature({
      mode: "delete",
      entityType: "document",
      entityName: document.name,
      actionLabel: "This permanently deletes the document from this folder.",
      onSigned: async (signature) => {
        markCommentsDocumentDeleted(docId, document.name);

        const previousUrl = sessionFileUrlsRef.current.get(docId);
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
          sessionFileUrlsRef.current.delete(docId);
        }

        const saved = persistDocuments(
          documents.filter((item) => item.id !== docId),
        );
        if (saved) {
          signEntity("document:delete", "document", document.name, signature);
        }
      },
    });
  };

  const handleDownloadDoc = (doc) => {
    const downloadUrl = doc.fileUrl || sessionFileUrlsRef.current.get(doc.id);

    if (!downloadUrl) {
      window.alert(
        "No downloadable file is available for this document. Only its metadata is stored.",
      );
      return;
    }

    const link = window.document.createElement("a");
    link.href = downloadUrl;
    link.download = doc.name;
    link.click();
  };

  // Task 1 — Document approval handler
  const handleApproveDoc = (docId) => {
    if (!canApproveDocs) return;

    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    if (
      window.confirm(
        `Approve "${doc.name}"? This will change its status to Approved.`
      )
    ) {
      persistDocuments(
        documents.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: "Approved",
                approvedBy: localStorage.getItem("currentUserName") || "Current User",
                approvedAt: new Date().toISOString(),
              }
            : d
        )
      );
    }
  };

  const handleDragStart = (index) => {
    setDragDocIndex(index);
  };

  const handleDrop = (index) => {
    if (dragDocIndex === null || dragDocIndex === index) {
      setDragDocIndex(null);
      return;
    }

    const reorderedDocuments = [...documents];
    const [movedDocument] = reorderedDocuments.splice(dragDocIndex, 1);

    reorderedDocuments.splice(index, 0, movedDocument);

    persistDocuments(reorderedDocuments);
    setDragDocIndex(null);
  };

  const formatSize = (bytes) => {
    if (!bytes) {
      return "—";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`dfm-container dfm-layout-${viewLayout}${viewDoc ? " dfm-with-viewer" : ""}`}>
      {!isExplorerLayout && !isColumnLayout && (
        <aside className="dfm-sidebar">
          <div className="dfm-sidebar-header">
            <h3>Folders</h3>
          </div>

          <div className="dfm-folder-tree">
            {tree.map((node) => (
              <FolderTreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedFolderId}
                expandedIds={expandedIds}
                onSelect={(folderId) => {
                  selectedFolderIdRef.current = folderId;
                  setSelectedFolderId(folderId);

                  const path = buildPathToNode(tree, folderId);

                  if (path) {
                    setNavigationPath(path);
                  }
                }}
                onToggle={(folderId) => {
                  setExpandedIds((previousIds) => {
                    const nextIds = new Set<any>(previousIds);

                    if (nextIds.has(folderId)) {
                      nextIds.delete(folderId);
                    } else {
                      nextIds.add(folderId);
                    }

                    return nextIds;
                  });
                }}
                canModify={canModify}
                onAddFolder={handleAddFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onUploadFolder={handleUploadFolder}
                onDownloadFolder={handleDownloadFolder}
              />
            ))}
          </div>
        </aside>
      )}

      <section className="dfm-main">
        <div className="dfm-view-toolbar">
          <div
            className="dfm-view-switcher"
            role="tablist"
            aria-label="Folder view"
          >
            <button
              type="button"
              className={viewLayout === "vertical" ? "active" : ""}
              onClick={() => setViewLayout("vertical")}
            >
              Tree View
            </button>

            <button
              type="button"
              className={viewLayout === "explorer" ? "active" : ""}
              onClick={() => setViewLayout("explorer")}
            >
              Explorer View
            </button>

            <button
              type="button"
              className={viewLayout === "column" ? "active" : ""}
              onClick={() => setViewLayout("column")}
            >
              Column View
            </button>
          </div>

          {canModify && (
            <button
              type="button"
              className="dfm-template-btn"
              onClick={() => setShowTemplateModal(true)}
            >
              Folder Templates
            </button>
          )}
        </div>

        {isExplorerLayout && (
          <div className="dfm-explorer-nav">
            <div className="dfm-explorer-nav-row">
              {isSelectedRootFolder && sectionId === "subjects" && (
                <button
                  type="button"
                  className="dfm-back-btn"
                  onClick={handleBackToSubjects}>

                  ← Back to Subjects
                </button>
              )}

              {!isSelectedRootFolder && navigationPath.length > 1 && (
                <button
                  type="button"
                  className="dfm-back-btn"
                  onClick={goUpOneLevel}>

                  ← Back
                </button>
              )}

              <nav className="dfm-breadcrumb" aria-label="Folder path">
                {breadcrumb.map((node, index) => (
                  <span key={node.id} className="dfm-breadcrumb-item">
                    {index > 0 && <span className="dfm-breadcrumb-sep">›</span>}

                    <button
                      type="button"
                      className={
                        index === breadcrumb.length - 1
                          ? "dfm-breadcrumb-current"
                          : "dfm-breadcrumb-link"
                      }
                      onClick={() => goToBreadcrumbIndex(index)}>

                      {node.name}
                    </button>
                  </span>
                ))}
              </nav>
            </div>
          </div>
        )}

        {isSelectedICFFolder && (
          <div className="dfm-icf-protected-notice">
            <FiLock />
            <span>
              ICF is a protected default folder. It cannot be renamed or
              deleted.
            </span>
          </div>
        )}

        <div className="dfm-main-header">
          <h3>{selectedFolderName}</h3>

          <span>
            {currentFolderChildren.length} folder(s) • {documents.length}{" "}
            file(s)
          </span>
        </div>

        <div className="dfm-action-bar">
          {canModify && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="dfm-file-input"
                multiple
                onChange={(event) => {
                  handleFileSelect(event.target.files);
                  event.target.value = "";
                }}
              />

              <input
                ref={folderUploadInputRef}
                type="file"
                className="dfm-file-input"
                {...({ webkitdirectory: "", directory: "" } as any)}
                multiple
                onChange={(event) => {
                  handleFolderUploadSelect(event.target.files);
                  event.target.value = "";
                }}
              />

              <button
                type="button"
                className="dfm-upload-btn"
                onClick={() => fileInputRef.current?.click()}>

                <FiUpload />
                Upload Files
              </button>

              {!isSelectedProtected && (
                <button
                  type="button"
                  className="dfm-add-folder-btn"
                  onClick={() => handleAddFolder()}>

                  <FiFolderPlus />
                  Add Folder
                </button>
              )}

              {canCompleteVisitStage && (
                <button
                  type="button"
                  className="dfm-complete-visit-btn"
                  onClick={() => onVisitStageComplete(matchedVisitStage)}>

                  Complete {matchedVisitStage}
                </button>
              )}
            </>
          )}
        </div>

        {pendingUpload && (
          <div className="dfm-upload-progress">
            <div className="dfm-progress-bar">
              <div
                className="dfm-progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <span>
              {pendingUpload.name} — {uploadProgress}%
            </span>

            {uploadProgress >= 100 && (
              <button
                type="button"
                className="dfm-save-btn"
                onClick={handleSaveUpload}>

                Save
              </button>
            )}
          </div>
        )}

        {isExplorerLayout && currentFolderChildren.length > 0 && (
          <div className="dfm-explorer-folder-grid">
            {currentFolderChildren.map((folder) => {
              const isProtected =
                isProtectedFolder(folder) || isICFFolder(folder);

              return (
                <div
                  key={folder.id}
                  className={`dfm-explorer-folder-wrap${
                    isICFFolder(folder) ? " is-icf" : ""
                  }`}>

                  <button
                    type="button"
                    className="dfm-explorer-folder"
                    onClick={() => enterFolder(folder.id)}>

                    <FiFolder className="dfm-explorer-folder-icon" />
                    <span>{folder.name}</span>

                    {isICFFolder(folder) && (
                      <FiLock className="dfm-explorer-icf-lock" />
                    )}
                  </button>

                  <FolderOptionsMenu
                    folderId={folder.id}
                    folderName={folder.name}
                    disabled={!canModify}
                    isProtected={isProtected}
                    onCreate={handleAddFolder}
                    onRename={handleRenameFolder}
                    onDelete={handleDeleteFolder}
                    onUpload={handleUploadFolder}
                    onDownload={handleDownloadFolder}
                  />
                </div>
              );
            })}
          </div>
        )}

        {isColumnLayout && (
          <FolderColumnView
            tree={tree}
            navigationPath={navigationPath}
            enterFolder={enterFolder}
            goToBreadcrumbIndex={goToBreadcrumbIndex}
            selectedFolderId={selectedFolderId}
            canModify={canModify}
            onAddFolder={handleAddFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onUploadFolder={handleUploadFolder}
            onDownloadFolder={handleDownloadFolder}
          />
        )}

        <ul className="dfm-doc-list">
          {documents.map((document, index) => (
            <li
              key={document.id}
              className="dfm-doc-item"
              draggable={canModify}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}>

              <FiFile className="dfm-doc-icon" />

              <div className="dfm-doc-info">
                <strong>{document.name}</strong>

                <small>
                  PDF • {formatSize(document.size)} •{" "}
                  {formatDateTimeUTC(document.uploadedAt)}
                </small>

                {document.status && (
                  <span className={`dfm-doc-status dfm-status--${(document.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                    {document.status}
                  </span>
                )}
              </div>

              <div className="dfm-doc-actions">
                <button
                  type="button"
                  title="View"
                  onClick={() => setViewDoc(document)}>

                  <FiEye />
                </button>

                <button
                  type="button"
                  title="Download"
                  onClick={() => handleDownloadDoc(document)}>

                  <FiDownload />
                </button>

                {canModify && (
                  <>
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => handleRenameDoc(document.id)}>

                      <FiEdit2 />
                    </button>

                    <button
                      type="button"
                      title="Replace"
                      onClick={() => handleReplaceDoc(document.id)}>

                      <FiUpload />
                    </button>

                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDeleteDoc(document.id)}>

                      <FiTrash2 />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {documents.length === 0 &&
          !pendingUpload &&
          (canModify ? (
            <div
              className={`dfm-drop-zone${dragOverEmpty ? " is-drag-over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverEmpty(true);
              }}
              onDragLeave={() => setDragOverEmpty(false)}
              onDrop={async (event) => {
                event.preventDefault();
                setDragOverEmpty(false);
                // Support drag-and-drop of multiple files and (where
                // browsers expose the entry API) whole folders. Fall
                // back to the raw file list otherwise.
                const collected = await collectFilesFromDataTransfer(
                  event.dataTransfer
                );
                handleFileSelect(
                  collected.length
                    ? collected
                    : event.dataTransfer.files
                );
              }}>

              <FiUpload className="dfm-drop-zone-icon" />
              <p className="dfm-drop-zone-title">
                Drag and drop PDF files here
              </p>
              <p className="dfm-drop-zone-hint">or click to browse</p>
            </div>
          ) : (
            <p className="dfm-empty">No documents in this folder.</p>
          ))}
      </section>      {/* Right-side Document Viewer panel */}
      {viewDoc && (
        <section className="dfm-viewer-panel">
          <div className="dfm-viewer-panel-header">
            <h4>{viewDoc.name}</h4>

            <div className="dfm-viewer-panel-actions">
              <span className={`dfm-doc-status dfm-status--${(viewDoc.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                {viewDoc.status || "Unknown"}
              </span>

              {canApproveDocs && viewDoc.status === "Pending Review" && (
                <button
                  type="button"
                  className="dfm-approve-btn"
                  onClick={() => handleApproveDoc(viewDoc.id)}
                  title="Approve document"
                >
                  <FiCheck /> Approve
                </button>
              )}

              <button type="button" className="dfm-viewer-close" onClick={() => setViewDoc(null)} title="Close preview">
                <FiX />
              </button>
            </div>
          </div>

          <div className="dfm-viewer-panel-meta">
            <div className="dfm-viewer-panel-grid">
              <div>
                <label>Document Name</label>
                <span>{viewDoc.name}</span>
              </div>

              <div>
                <label>Type</label>
                <span>{viewDoc.documentType || "General"}</span>
              </div>

              <div>
                <label>Status</label>
                <span className={`dfm-doc-status dfm-status--${(viewDoc.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                  {viewDoc.status || "Unknown"}
                </span>
              </div>

              <div>
                <label>Uploaded By</label>
                <span>{viewDoc.uploadedBy || "—"}</span>
              </div>

              <div>
                <label>Date</label>
                <span>{viewDoc.uploadedAt ? new Date(viewDoc.uploadedAt).toLocaleDateString() : "—"}</span>
              </div>

              <div>
                <label>Size</label>
                <span>{formatSize(viewDoc.size)}</span>
              </div>

              {viewDoc.approvedBy && (
                <div>
                  <label>Approved By</label>
                  <span>{viewDoc.approvedBy}</span>
                </div>
              )}

              {viewDoc.approvedAt && (
                <div>
                  <label>Approved Date</label>
                  <span>{new Date(viewDoc.approvedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="dfm-viewer-panel-preview">
            {(() => {
              const previewUrl =
                viewDoc.fileUrl || sessionFileUrlsRef.current.get(viewDoc.id);

              return previewUrl ? (
                <iframe
                  title={viewDoc.name}
                  src={previewUrl}
                  className="dfm-viewer-frame"
                />
              ) : (
                <div className="dfm-viewer-placeholder">
                  <span className="dfm-pdf-icon">PDF</span>
                  <h4>PDF Preview</h4>
                  <p>Preview unavailable. Only document metadata is stored.</p>
                </div>
              );
            })()}
          </div>

          <DocumentCommentsPanel
            documentId={viewDoc.id}
            documentName={viewDoc.name}
            studyCode={studyCode || contextKey.split("::")[0]}
            subjectId={subjectId || contextKey.split("::")[1]}
            sectionId={sectionId}
          />
        </section>
      )}

      {showTemplateModal && (
        <FolderTemplateModal
          sectionId={sectionId}
          contextKey={contextKey}
          selectedFolderId={selectedFolderId}
          onClose={() => setShowTemplateModal(false)}
          onApplied={() => {
            refreshTree();
            enterFolder(selectedFolderId);
          }}
        />
      )}

      {/* Mandatory E-Signature gate — no folder/document upload, edit or
          delete is committed until the acting user signs. */}
      <ESignatureModal
        open={Boolean(signing)}
        mode={signing?.mode}
        entityType={signing?.entityType || "document"}
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
    </div>
  );
}

export default DocumentFolderManager;