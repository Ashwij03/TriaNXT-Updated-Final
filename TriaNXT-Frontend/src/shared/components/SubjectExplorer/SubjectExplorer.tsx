import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MdFolderOff, MdPersonAdd } from "react-icons/md";

import SubjectSidebarHeader from "./SubjectSidebarHeader";
import SubjectSearch from "./SubjectSearch";
import SubjectTreeNode from "./SubjectTreeNode";
import CreateFolderModal from "./CreateFolderModal";
import RenameFolderModal from "./RenameFolderModal";
import SubjectFormModal from "./SubjectFormModal";
import ESignatureModal from "../ESignatureModal";
import { recordSignatureLedgerEntry } from "../../services/actionSignatureService";
import DeleteSubjectDialog from "./DeleteSubjectDialog";
import SubjectRecordsService from "./subjectRecordsService";
import { saveSubject } from "../../services/subjectService";
import { getSubjectStudyDefaults } from "../../services/studyService";
import { broadcastSubjectAdded } from "../../services/notificationService";
import {
  filterTree,
  collectExpandableIds,
  countSubjects,
} from "./subjectTreeUtils";
import FolderTreeService from "./folderTreeService";
import "./SubjectExplorer.css";
import "./FolderModals.css";

/**
 * Subject Explorer - file-explorer style sidebar for the Subjects workspace.
 *
 * Owns all explorer state (expansion, selection, filter term) and, from
 * Phase 3, the folder tree itself plus the CRUD dialog state.
 *
 * Phase 1-2 (unchanged): expand/collapse, icons, indentation, active
 * highlight, animation, scrolling, folder filter, responsive behaviour.
 *
 * Phase 3 (unchanged): create folder, create subfolder (unlimited nesting),
 * rename, delete-with-children, three-dot context menu, validation,
 * auto-refresh after every operation, and localStorage persistence.
 *
 * Phase 5 (this task): the selection can now be driven from outside via the
 * optional `selectedId` prop, so the workspace and the sidebar always agree
 * (including after a page refresh, when the id is restored from storage).
 * The prop is optional - with it omitted this component behaves exactly as
 * it did in Phase 3, keeping it usable standalone.
 *
 * Phase 10 (visual/behavioral alignment with eISF - no eISF import): the
 * SUBJECTS panel now follows the eISF sidebar's tree pattern -
 *   - top-level "SUBJECTS" header (title + count), mirroring the eISF
 *     sidebar title treatment
 *   - expand/collapse per node, proper per-depth indentation, and
 *     subject/folder icons (all pre-existing, restyled to match)
 *   - active-selection highlighting using the same flat blue fill/weight
 *     eISF uses for its active module/section rows
 * This component and its children remain fully independent: they read the
 * eISF files only as a reference while building this feature, and do not
 * import from, or share state/selectors with, src/pages/shared/EISF/*.
 *
 * Phase 11 (eISF "+" interaction pattern - no behaviour change here): each
 * subject row now also exposes an always-visible "+" action (rendered by
 * FolderContextMenu) that creates a folder inside that subject in one
 * click. It dispatches through the exact same `handleNodeAction("create-
 * folder", node)` path as the existing dropdown item below, so this file's
 * create/rename/delete flow, storage, and auto-refresh behaviour are
 * unchanged - the "+" is just a second, more discoverable entry point into
 * the same pipeline. This also fixes the SUB-003 case (a subject that
 * starts with zero folders and therefore no caret): the "+" is not gated
 * behind hover the way the three-dot trigger is, so the row always has a
 * visible way to add its first folder.
 *
 * Update 6 (Subject CRUD): subjects are no longer seed-only. A new "Add
 * Subject" action in the sidebar opens SubjectFormModal (mode "create",
 * root-level, mirrors CreateFolderModal); each subject row's context menu
 * now also exposes "Edit Subject" / "Delete Subject" (SubjectFormModal /
 * DeleteSubjectDialog), reusing the existing `rename` / `delete` action
 * keys - handleNodeAction now branches on `node.type` to route a subject
 * to the subject dialogs and a folder to the folder dialogs it already
 * used. All three go through the new FolderTreeService.createSubject /
 * renameSubject / deleteSubject functions, so subjects get the same
 * auto-refresh + localStorage persistence + toast feedback the folder
 * CRUD already had - a new subject appears in the tree immediately, an
 * edit updates the tree and the selected workspace at once (the workspace
 * resolves the selection from the live tree), and a delete removes the
 * subject and everything nested inside it. This also fixes SUB-003 (and
 * every subject): it is no longer a dead end that can only hold folders.
 *
 * All tree reads/writes go through FolderTreeService so the storage layer
 * can be swapped for real APIs later without touching this component.
 *
 * NOT implemented: backend APIs, folder permissions.
 *
 * Props
 *   tree        seed tree used on first run
 *   selectedId  optional controlled selection (node id)
 *   onSelect    (node) => void
 */

/** Dialog state shapes: { mode, parentId, node }. `null` = nothing open. */
const NO_DIALOG = null;

function SubjectExplorer({
  tree: treeProp = [],
  selectedId: controlledSelectedId,
  onSelect,
  onNavigateToAllSubjects,
  /* Study context for the Add/Edit Subject form modal: drives the read-only
     PI/Site fields and writes the clinical metadata through
     `SubjectRecordsService`. Optional - the standalone Subjects page renders
     this explorer without a study, in which case the modal creates/renames
     the tree node but skips metadata (matching its previous behaviour). */
  studyId = "",
  readOnly = false,
  /* Task 4: optional badge node (e.g. the subject consent pill) rendered
     by the sidebar header when the workspace has a subject in scope. */
  sidebarBadge = null,
}: any) {
  /* ---------- folder tree (persisted) ---------- */
  // Bug 4 fix: when tree is passed from parent (via useSubjectWorkspace),
  // use it as the single source of truth. When used standalone (no parent
  // tree prop), load from the service. This prevents the explorer's tree
  // from drifting out of sync with the file manager's tree.
  const [ownTree, setOwnTree] = useState(() =>
    FolderTreeService.loadFolderTree(studyId, treeProp),
  );
  const tree = treeProp.length > 0 ? treeProp : ownTree;

  // When the parent passes a new tree (e.g. after reconciliation or
  // CRUD in useSubjectWorkspace), sync our local state so standalone
  // mode stays up to date.
  useEffect(() => {
    if (treeProp.length > 0 && treeProp !== tree) {
      setOwnTree(treeProp);
    }
  }, [tree, treeProp]);

  // Fixed: subject folders should stay collapsed until the user opens them
  // (or a controlled selection reveals its ancestors below) - previously
  // SUB-001 was hardcoded open here, so its folder auto-expanded on every
  // load of the Subjects page.
  const [expandedIds, setExpandedIds] = useState<any[]>([]);
  const [internalSelectedNode, setInternalSelectedNode] = useState(null);
  const [filterTerm, setFilterTerm] = useState("");

  /**
   * Phase 5: when `selectedId` is supplied the parent owns the selection, so
   * the node is resolved from the live tree on every render (a rename shows
   * immediately, a deleted folder resolves to null). Without the prop the
   * component keeps its own Phase 3 state.
   */
  const isControlled = controlledSelectedId !== undefined;

  const selectedNode = isControlled
    ? FolderTreeService.findNodeById(tree, controlledSelectedId)
    : internalSelectedNode;

  /* Used by the CRUD handlers to update the selection in either mode. */
  const setSelectedNode = useCallback(
    (next) => {
      if (isControlled) return; // parent state is updated through onSelect
      setInternalSelectedNode(next);
    },
    [isControlled],
  );

  /* ---------- CRUD dialog + feedback state ---------- */
  const [dialog, setDialog] = useState(NO_DIALOG);
  /* Mandatory E-Signature gate for folder create/rename/delete. */
  const [signing, setSigning] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [toast, setToast] = useState(null); // { tone, message }

  /**
   * Auto-refresh whenever the tree is written.
   *
   * Phase 6: this now refreshes on EVERY source, not just "storage". The file
   * manager's empty state can create a subfolder, so the sidebar is no longer
   * the only writer - filtering to cross-tab events would leave the tree
   * missing a folder that already exists in storage.
   *
   * Re-reading after this component's own mutation is harmless: it loads back
   * exactly what was just written, so state lands on an equal tree.
   */
  useEffect(
    () =>
      FolderTreeService.subscribeFolderTree(studyId, () => {
        setOwnTree(FolderTreeService.loadFolderTree(studyId, treeProp));
      }),
    [studyId, treeProp],
  );

  /* Transient success/error banner. */
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * Phase 5: reveal a selection that came from outside - on first load the
   * folder restored from localStorage may sit several levels deep, so its
   * ancestors are expanded to make the highlight visible without the user
   * having to re-open the branch.
   *
   * Only ever ADDS ids, so it cannot fight the user's own collapsing.
   */
  useEffect(() => {
    if (!controlledSelectedId) return;

    const ancestors = FolderTreeService.getAncestorIds(
      tree,
      controlledSelectedId,
    );
    if (ancestors.length === 0) return;

    setExpandedIds((prev) => {
      const missing = ancestors.filter((id) => !prev.includes(id));
      return missing.length === 0 ? prev : [...prev, ...missing];
    });
  }, [controlledSelectedId, tree]);

  /* ---------- filtering ---------- */
  const visibleTree = useMemo(
    () => filterTree(tree, filterTerm),
    [tree, filterTerm],
  );

  // While filtering, auto-expand so matches deeper in the tree are visible.
  const matchExpandedIds = useMemo(
    () => collectExpandableIds(visibleTree),
    [visibleTree],
  );
  const isFiltering = filterTerm.trim().length > 0;
  const effectiveExpandedIds = isFiltering ? matchExpandedIds : expandedIds;

  const allExpandableIds = useMemo(() => collectExpandableIds(tree), [tree]);
  const allExpanded =
    allExpandableIds.length > 0 &&
    allExpandableIds.every((id) => expandedIds.includes(id));

  /**
   * Ancestors of the selected node - used to mark the active branch in the
   * tree. Derived, never stored, so it cannot drift from the selection.
   */
  const activePathIds = useMemo(() => {
    const activeId = selectedNode?.id;
    return activeId ? FolderTreeService.getAncestorIds(tree, activeId) : [];
  }, [tree, selectedNode]);

  /* ---------- handlers: expansion / selection ----------
     All memoised: SubjectTreeNode is React.memo'd, so stable handler
     identities are what let unaffected rows skip re-rendering. */
  const handleToggle = useCallback(
    (nodeId) => {
      // Ignore collapse while filtering: open state is derived from matches.
      if (isFiltering) return;
      setExpandedIds((prev) =>
        prev.includes(nodeId)
          ? prev.filter((id) => id !== nodeId)
          : [...prev, nodeId],
      );
    },
    [isFiltering],
  );

  const handleSelect = useCallback(
    (node) => {
      setSelectedNode(node);
      // Phase 5: the parent stores this (and persists it), then feeds it back
      // through `selectedId`, which is what loads the folder's files.
      if (typeof onSelect === "function") onSelect(node);
    },
    [setSelectedNode, onSelect],
  );

  const handleExpandAll = useCallback(
    () => setExpandedIds(allExpandableIds),
    [allExpandableIds],
  );

  const handleCollapseAll = useCallback(() => setExpandedIds([]), []);

  /* ---------- context-menu routing ---------- */
  /**
   * "Create Folder" on a subject row adds a folder INSIDE that subject.
   * On a folder row it adds a SIBLING (same parent), while
   * "Create Subfolder" nests inside the folder itself.
   */
  const handleNodeAction = useCallback(
    (action, node) => {
      if (readOnly) return;
      setSubmitError("");

      // Update 7: defense in depth - the ICF row never renders these menu
      // items in the first place (SubjectTreeNode skips the context menu
      // entirely for a locked node), but guard here too in case anything
      // else ever dispatches these actions directly.
      if (node?.locked && (action === "rename" || action === "delete")) {
        return;
      }

      if (action === "create-folder") {
        const parentId =
          node.type === "subject"
            ? node.id
            : (FolderTreeService.findParentOf(tree, node.id)?.id ?? null);

        setDialog({ mode: "create", variant: "folder", parentId, node });
        return;
      }

      if (action === "create-subfolder") {
        setDialog({
          mode: "create",
          variant: "subfolder",
          parentId: node.id,
          node,
        });
        return;
      }

      if (action === "rename") {
        // Update 6: a subject row sends the same "rename" key as a folder
        // row - route it to the subject dialog instead of the folder one.
        setDialog(
          node.type === "subject"
            ? { mode: "edit-subject", node }
            : { mode: "rename", node },
        );
        return;
      }

      if (action === "delete") {
        if (node.type === "subject") {
          setDialog({ mode: "delete-subject", node });
          return;
        }
        // Folder deletion — ONE combined modal (danger banner + typed
        // DELETE + mandatory E-Signature). No separate confirm dialog.
        openSignature({
          mode: "delete",
          entityType: "folder",
          entityName: node.name,
          actionLabel: "This permanently deletes the folder and everything inside it.",
          onSigned: async (signature) => {
            runDeleteFolder(node, signature);
          },
        });
      }
    },
    [tree, readOnly],
  );

  /** Update 6: "Add Subject" toolbar action - always root-level, no node. */
  const openCreateSubject = useCallback(() => {
    if (readOnly) return;
    setSubmitError("");
    setDialog({ mode: "create-subject" });
  }, [readOnly]);

  const closeDialog = useCallback(() => {
    setDialog(NO_DIALOG);
    setSubmitError("");
  }, []);

  /** Mandatory E-Signature gate — folder mutations run only after signing. */
  const openSignature = (request) => setSigning(request);

  const signFolder = (kind, entityName, signature, details = {}) => {
    recordSignatureLedgerEntry(signature, {
      kind,
      entityType: "folder",
      entityName,
      details,
      scope: { domain: "subjects-folders", studyId },
    });
  };

  /* ---------- derived dialog context ---------- */
  const dialogParentId =
    dialog?.mode === "create"
      ? dialog.parentId
      : dialog?.node
        ? (FolderTreeService.findParentOf(tree, dialog.node.id)?.id ?? null)
        : null;

  const dialogParentName = dialogParentId
    ? (FolderTreeService.findNodeById(tree, dialogParentId)?.name ?? "")
    : "";

  const dialogParentType = dialogParentId
    ? (FolderTreeService.findNodeById(tree, dialogParentId)?.type ?? null)
    : null;

  /* Live validators handed to the modals (single rule set, one source). */
  const validateCreate = useCallback(
    (name) => FolderTreeService.validateFolderName(tree, dialogParentId, name),
    [tree, dialogParentId],
  );

  const validateRename = useCallback(
    (name) =>
      FolderTreeService.validateFolderName(tree, dialogParentId, name, {
        excludeId: dialog?.node?.id,
      }),
    [tree, dialogParentId, dialog],
  );

  /* Update 6: subject validators - uniqueness is root-level, not per-parent. */
  const validateCreateSubject = useCallback(
    (name) => FolderTreeService.validateSubjectName(tree, name),
    [tree],
  );

  const validateEditSubject = useCallback(
    (name) =>
      FolderTreeService.validateSubjectName(tree, name, {
        excludeId: dialog?.node?.id,
      }),
    [tree, dialog],
  );

  /* ---------- CRUD: create ---------- */
  const commitCreateFolder = (parentId, name, signature) => {
    const result = FolderTreeService.createFolder(
      studyId,
      tree,
      parentId,
      name,
    );

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    // Auto-refresh: new tree straight into state, and reveal the new folder
    // by expanding its parent chain.
    setOwnTree(result.tree);

    if (parentId) {
      const reveal = [
        parentId,
        ...FolderTreeService.getAncestorIds(result.tree, parentId),
      ];
      setExpandedIds((prev) => Array.from(new Set<any>([...prev, ...reveal])));
    }

    signFolder("folder:create", name, signature, { parentId });
    setSelectedNode(result.node);
    if (typeof onSelect === "function") onSelect(result.node);

    setToast({ tone: "success", message: `"${result.node.name}" created.` });
    closeDialog();
  };

  const submitCreate = (name) => {
    const parentId = dialog.parentId;
    const trimmed = String(name || "").trim();

    // Mandatory E-Signature BEFORE the folder is created.
    openSignature({
      mode: "create",
      entityType: "folder",
      entityName: trimmed,
      actionLabel: `Create folder "${trimmed}" here.`,
      onSigned: async (signature) => {
        commitCreateFolder(parentId, trimmed, signature);
      },
    });
  };

  /* ---------- CRUD: rename ---------- */
  const commitRenameFolder = (nodeId, name, signature) => {
    const result = FolderTreeService.renameFolder(
      studyId,
      tree,
      nodeId,
      name,
    );

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    setOwnTree(result.tree);

    // Keep the selection pointing at the renamed node's new label.
    setSelectedNode((prev) =>
      prev?.id === result.node.id ? result.node : prev,
    );
    if (typeof onSelect === "function" && selectedNode?.id === result.node.id) {
      onSelect(result.node);
    }

    signFolder("folder:rename", name, signature, { nodeId });
    setToast({ tone: "success", message: `Renamed to "${result.node.name}".` });
    closeDialog();
  };

  const submitRename = (name) => {
    const trimmed = String(name || "").trim();

    // Mandatory E-Signature BEFORE the rename is committed.
    openSignature({
      mode: "edit",
      entityType: "folder",
      entityName: trimmed,
      actionLabel: `Rename folder "${dialog.node?.name}" to "${trimmed}".`,
      onSigned: async (signature) => {
        commitRenameFolder(dialog.node.id, trimmed, signature);
      },
    });
  };

  /* ---------- CRUD: delete (folder + all children) ---------- */
  const runDeleteFolder = (target, signature) => {
    const result = FolderTreeService.deleteFolder(studyId, tree, target.id);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    setOwnTree(result.tree);

    // Drop deleted ids from expansion, and clear the selection when the
    // selected node was inside the removed subtree.
    setExpandedIds((prev) =>
      prev.filter((id) => !result.removedIds.includes(id)),
    );

    if (selectedNode && result.removedIds.includes(selectedNode.id)) {
      setSelectedNode(null);
      if (typeof onSelect === "function") onSelect(null);
    }

    signFolder("folder:delete", target.name, signature, {
      nodeId: target.id,
      removedFolders: result.removedIds?.length || 0,
    });
    setToast({ tone: "success", message: `"${target.name}" deleted.` });
    closeDialog();
  };

  /* ---------- CRUD: create subject (Update 6) ---------- */
  /* `fields` come from the shared SubjectFormModal (mode "create"):
     { id, initials, screeningDate, enrollmentDate, status, currentVisit }.
     The typed Subject ID becomes the tree node's name; the node's generated
     id (SUB-NNN) keys the metadata record, exactly like the existing
     `ensureSubjectRecord` bridge - no second subject store. */
  const submitCreateSubject = (fields) => {
    const result = FolderTreeService.createSubject(studyId, tree, fields.id);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    // Same auto-refresh pattern as submitCreate: new tree into state, and
    // select the new subject so it's immediately visible/active.
    setOwnTree(result.tree);
    setSelectedNode(result.node);
    if (typeof onSelect === "function") onSelect(result.node);

    // Persist the clinical fields through the existing metadata bridge so
    // the KPI cards / All Subjects table show them immediately. Skipped on
    // the standalone Subjects page, which has no study context.
    if (studyId) {
      const defaults = getSubjectStudyDefaults(studyId);
      saveSubject({
        id: result.node.id,
        subjectId: fields.id,
        studyId,
        initials: fields.initials || "",
        principalInvestigator:
          fields.principalInvestigator ||
          defaults.principalInvestigator ||
          defaults.pi ||
          "",
        pi:
          fields.principalInvestigator ||
          defaults.principalInvestigator ||
          defaults.pi ||
          "",
        site: fields.site || defaults.site || "",
        siteName: defaults.siteName || defaults.site || "",
        siteNo: fields.siteNo || defaults.siteNumber || "",
        status: fields.status || "Screened",
        screeningDate:
          fields.screeningDate || new Date().toISOString().split("T")[0],
        enrollmentDate: fields.enrollmentDate || "",
        currentVisit: fields.currentVisit || "Screening",
      });

      // Dispatch multi-role notification for the new subject
      broadcastSubjectAdded({
        subjectId: result.node.id,
        studyId,
        studyCode: studyId,
        status: fields.status || "Screened",
        site: fields.site || defaults.site || "",
        siteName: defaults.siteName || defaults.site || "",
      });
    }

    setToast({ tone: "success", message: `"${result.node.name}" created.` });
    closeDialog();
  };

  /* ---------- CRUD: edit subject (Update 6) ---------- */
  /* `fields` come from the shared SubjectFormModal (mode "edit"): the
     Subject ID text renames the tree node when it changed; the clinical
     fields always go through the metadata bridge. */
  const submitEditSubject = (fields) => {
    const nodeId = dialog.node.id;
    const nameChanged = fields.id.trim() !== (dialog.node.name || "").trim();

    let node = dialog.node;
    if (nameChanged) {
      const result = FolderTreeService.renameSubject(
        studyId,
        tree,
        nodeId,
        fields.id,
      );

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      setOwnTree(result.tree);
      node = result.node;
    }

    if (studyId) {
      const defaults = getSubjectStudyDefaults(studyId);
      SubjectRecordsService.updateSubjectRecord(studyId, nodeId, {
        initials: fields.initials || "",
        principalInvestigator:
          fields.principalInvestigator ||
          defaults.principalInvestigator ||
          defaults.pi ||
          "",
        pi:
          fields.principalInvestigator ||
          defaults.principalInvestigator ||
          defaults.pi ||
          "",
        site: fields.site || defaults.site || "",
        siteName: defaults.siteName || defaults.site || "",
        siteNo: fields.siteNo || defaults.siteNumber || "",
        status: fields.status || "",
        screeningDate: fields.screeningDate || "",
        enrollmentDate: fields.enrollmentDate || "",
        currentVisit: fields.currentVisit || "",
      });
    }

    // Keep the selection - and therefore the open workspace, which resolves
    // the node from this live tree - pointing at the subject's new name.
    setSelectedNode((prev) => (prev?.id === nodeId ? node : prev));
    if (typeof onSelect === "function" && selectedNode?.id === nodeId) {
      onSelect(node);
    }

    setToast({
      tone: "success",
      message: nameChanged
        ? `Renamed to "${node.name}".`
        : `Details for "${node.name}" updated.`,
    });
    closeDialog();
  };

  /* ---------- CRUD: delete subject + all its folders (Update 6) ---------- */
  const submitDeleteSubject = () => {
    const target = dialog.node;
    const result = FolderTreeService.deleteSubject(studyId, tree, target.id);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    setOwnTree(result.tree);

    setExpandedIds((prev) =>
      prev.filter((id) => !result.removedIds.includes(id)),
    );

    if (selectedNode && result.removedIds.includes(selectedNode.id)) {
      setSelectedNode(null);
      if (typeof onSelect === "function") onSelect(null);
    }

    setToast({ tone: "success", message: `"${target.name}" deleted.` });
    closeDialog();
  };

  /* ---------- render ---------- */
  const deleteDescendantCount =
    dialog?.mode === "delete" || dialog?.mode === "delete-subject"
      ? FolderTreeService.countDescendantFolders(
          FolderTreeService.findNodeById(tree, dialog.node.id),
        )
      : 0;

  return (
    <aside className="sx-explorer" aria-label="Subject explorer">
      <SubjectSidebarHeader
        subjectCount={countSubjects(tree)}
        allExpanded={allExpanded}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onTitleClick={onNavigateToAllSubjects}
        badge={sidebarBadge}
      />

      {/* Update 6: root-level "Add Subject" action - not tied to any node,
          so it lives here rather than inside a tree row. */}
      <div className="sx-subject-toolbar">
        <button
          type="button"
          className="sx-add-subject-btn"
          onClick={openCreateSubject}
          disabled={readOnly}
          title={readOnly ? "This completed study is view only." : undefined}
        >
          <MdPersonAdd size={15} aria-hidden="true" />
          <span>Add Subject</span>
        </button>
      </div>

      <SubjectSearch
        value={filterTerm}
        onChange={setFilterTerm}
        onClear={() => setFilterTerm("")}
      />

      {/* Result feedback for the last CRUD operation. */}
      {toast && (
        <div className={`sx-toast sx-toast--${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}

      <div className="sx-tree-scroll">
        {visibleTree.length === 0 ? (
          <div className="sx-empty" role="status">
            <MdFolderOff size={22} aria-hidden="true" />
            <strong>No matches</strong>
            <span>No subject or folder matches “{filterTerm}”.</span>
            <button
              type="button"
              className="sx-empty-action"
              onClick={() => setFilterTerm("")}
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul
            className="sx-node-list sx-node-list--root"
            role="tree"
            aria-label="Subjects and folders"
          >
            {visibleTree.map((node) => (
              <SubjectTreeNode
                key={node.id}
                node={node}
                depth={0}
                expandedIds={effectiveExpandedIds}
                selectedId={selectedNode?.id ?? null}
                activePathIds={activePathIds}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onNodeAction={handleNodeAction}
                readOnly={readOnly}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="sx-footer">
        {selectedNode ? (
          <>
            <span className="sx-footer-label">Selected</span>
            <span className="sx-footer-value" title={selectedNode.id}>
              {selectedNode.name}
            </span>
          </>
        ) : (
          <span className="sx-footer-hint">Select a folder to continue</span>
        )}
      </div>

      {/* ================= FOLDER CRUD DIALOGS ================= */}
      {dialog?.mode === "create" && (
        <CreateFolderModal
          variant={dialog.variant}
          parentName={dialogParentName}
          parentType={dialogParentType}
          validate={validateCreate}
          submitError={submitError}
          onSubmit={submitCreate}
          onClose={closeDialog}
        />
      )}

      {dialog?.mode === "rename" && (
        <RenameFolderModal
          folder={dialog.node}
          parentName={dialogParentName}
          validate={validateRename}
          submitError={submitError}
          onSubmit={submitRename}
          onClose={closeDialog}
        />
      )}

      {/* ================= SUBJECT CRUD DIALOGS (Update 6) =================
          One shared form modal serves both flows: create pre-fills only the
          suggested Subject ID, edit pre-fills every field from the subject's
          metadata record (read through the same `subjectsByStudy` storage
          the rest of the tab uses). */}
      {dialog?.mode === "create-subject" && (
        <SubjectFormModal
          mode="create"
          studyId={studyId}
          suggestedName={FolderTreeService.generateSubjectId(tree)}
          validate={validateCreateSubject}
          submitError={submitError}
          onSubmit={submitCreateSubject}
          onClose={closeDialog}
        />
      )}

      {dialog?.mode === "edit-subject" && (
        <SubjectFormModal
          mode="edit"
          studyId={studyId}
          subject={dialog.node}
          record={
            studyId
              ? SubjectRecordsService.findSubjectRecord(studyId, dialog.node.id)
              : null
          }
          validate={validateEditSubject}
          submitError={submitError}
          onSubmit={submitEditSubject}
          onClose={closeDialog}
        />
      )}

      {dialog?.mode === "delete-subject" && (
        <DeleteSubjectDialog
          subject={dialog.node}
          descendantCount={deleteDescendantCount}
          submitError={submitError}
          onConfirm={submitDeleteSubject}
          onClose={closeDialog}
        />
      )}

      {/* Mandatory E-Signature gate — no folder is created, renamed or
          deleted until the acting user completes the signature step. */}
      <ESignatureModal
        open={Boolean(signing)}
        mode={signing?.mode}
        entityType="folder"
        entityName={signing?.entityName}
        actionLabel={signing?.actionLabel}
        scope={{ domain: "subjects-folders", studyId }}
        onClose={() => setSigning(null)}
        onSigned={async (signature) => {
          const pending = signing;
          setSigning(null);
          if (pending?.onSigned) {
            await pending.onSigned(signature);
          }
        }}
      />
    </aside>
  );
}

export default SubjectExplorer;