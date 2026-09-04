import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  MdFolderCopy,
  MdInsertDriveFile,
  MdCloudQueue,
  MdPeopleOutline,
  MdBadge,
  MdFlag,
  MdMedicalServices,
  MdTag,
  MdPlace,
  MdEventAvailable,
  MdEventNote,
  MdEvent,
  MdMenuOpen,
  MdClose,
  MdArrowBack,
  MdChatBubbleOutline,
} from "react-icons/md";

import { getSubjectStudyDefaults as getStudyDefaults } from "../../services/studyService";
import SubjectExplorer from "./SubjectExplorer";
import SubjectFileManager from "./SubjectFileManager";
import AllSubjectsTable from "./AllSubjectsTable";
import SubjectFormModal from "./SubjectFormModal";
import DeleteSubjectDialog from "./DeleteSubjectDialog";
import useSubjectWorkspace from "./useSubjectWorkspace";
import FolderStatsService from "./folderStatsService";
import FolderTreeService from "./folderTreeService";
import SubjectRecordsService from "./subjectRecordsService";
import { syncSubjectSchedules } from "../../services/visitScheduleService";
import { formatFileSize } from "./fileService";
import { getCurrentUser } from "../../services/roleService";
import { canEditSubjectContent } from "../../utils/contentAccess";
import SubjectComments from "../../pages/subjects/SubjectComments";

/* `SelectedFolderBar` renders `.sw-folderbar*`, but those rules live in
   `WorkspaceIntegration.css` (co-located here in the shared SubjectExplorer
   directory). That component imports no stylesheet of its own, so importing
   the sheet here makes the requirement explicit. The sheet is entirely
   class-scoped (`sw-folderbar*` / `sw-crumb--folder`) and contains no
   `!important`, so this is cascade-neutral: it adds no rule that was not
   already being served. */
import "./WorkspaceIntegration.css";
import "./StudySubjectsWorkspace.css";

/**
 * KPI CARD - Subjects tab's own implementation
 * =============================================
 * A small, self-contained card renderer scoped entirely to this file/
 * stylesheet (`.ssw-kpi-card*`). It intentionally mirrors the *look* of the
 * eISF `DashboardCards` "reference" variant (icon-left layout, 84px min
 * height, 38px icon, 12/22/11px type steps) because the brief asks the two
 * workspaces to match visually - but it shares no import, no component and
 * no class name with `pages/shared/EISF/components/DashboardCards`. Subjects
 * owns this markup and can change it independently of eISF from now on.
 */
function SubjectsKpiCard({ card }: any) {
  const Icon = card.Icon;
  return (
    <div className="ssw-kpi-card">
      <div className="ssw-kpi-card-body">
        <div
          className="ssw-kpi-card-icon"
          style={{ "--card-color": card.color || "#2563eb" }}
        >
          <Icon aria-hidden="true" focusable="false" />
        </div>
        <div className="ssw-kpi-card-text">
          <div className="ssw-kpi-card-title">{card.title}</div>
          <div className="ssw-kpi-card-value">{card.value}</div>
          {card.detail && (
            <div className="ssw-kpi-card-detail">{card.detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * STUDY WORKSPACE -> SUBJECTS TAB (integration point only)
 * ========================================================
 *
 * Mounts the completed Phase 1-7 Subject Explorer workspace inside the Study
 * Workspace's Subjects tab.
 *
 * WHAT THIS IS
 * ------------
 * An integration seam - nearly every visible piece is an existing,
 * already-polished component (`SubjectExplorer`, `SubjectFileManager`,
 * `SelectedFolderBar`) driven by the existing `useSubjectWorkspace` hook. The
 * header and its KPI strip are this tab's own layout, styled to match eISF's
 * header but owned entirely by Subjects (see `SubjectsKpiCard` above).
 *
 * HEADER LAYOUT
 * -------------
 * The header is two columns on one row:
 *   LEFT   a compact "SUBJECTS / <selected section>" wayfinder, stacked on
 *          two lines, so the tab always shows where the explorer selection
 *          currently sits.
 *   RIGHT  the panel title ("Subject Documents", or the selected section's
 *          own name once a folder/subject is picked) beside its KPI cards,
 *          on the same row - never a separate row underneath.
 *
 * KPI STRIP
 * ---------
 * Cards are Subjects' own (`SubjectsKpiCard`), fed by `FolderStatsService`,
 * which already exposes both a workspace-wide scope and a per-node scope:
 *   - no selection   `getWorkspaceStats` - totals across every subject.
 *   - folder selected `getFolderStats(selectedFolder, store)` - totals
 *     scoped to that selection, so the strip is subject/section-specific
 *     rather than a static workspace summary.
 * No eISF component or stylesheet is imported to build this.
 *
 * WHY IT IS NOT `Subjects.js`
 * ---------------------------
 * `pages/Sponsor/Subjects.js` is a *page*: it renders `AppLayout`, a page
 * `<h1>`, KPI cards, a breadcrumb and its own subject table. Inside a tab all
 * of that is wrong - the study dashboard already supplies the chrome, and a
 * second layout/breadcrumb would nest one page inside another. So this
 * composes the same workspace parts without the page shell.
 *
 * WHAT IS DELIBERATELY LEFT OUT
 * -----------------------------
 * - `AppLayout`      the dashboard already provides it.
 * - `WorkspaceBreadcrumb` the dashboard owns the breadcrumb trail.
 * - the page `<h1>`  the tab heading is an `<h2>` under the dashboard's title.
 * - the subject table and Add Subject modal  those stay the responsibility of
 *   `StudySubjects.js`, which is untouched by this change.
 *
 * STYLING ISOLATION
 * -----------------
 * All layout lives in `StudySubjectsWorkspace.css`, scoped under
 * `.study-subjects-workspace`. `pages/shared/studies/StudySubjects.css` is NOT
 * modified, so `pages/PI/PISubjectsDashboard.js` - which imports that
 * stylesheet - is completely unaffected.
 *
 * SELECTION SCOPE
 * ---------------
 * `persist` is passed straight through to the hook. The tab defaults to
 * `persist={false}` so a folder chosen while reviewing one study is not
 * restored when a different study is opened; the standalone `/subjects` page
 * keeps its persisted selection. Both read the same folder/file stores, so no
 * data is duplicated.
 *
 * NOT IMPLEMENTED (unchanged across all phases): backend APIs, authentication,
 * version history, approval workflow, permissions, sharing, new CRUD.
 *
 * Props
 *   studyId  study whose subjects are being reviewed; used for labelling and
 *            to reset the selection when the study changes. Optional.
 *   persist  persist the folder selection across mounts (default false)
 */
/**
 * Icon per subject-detail field (Task 1.5's 8 required KPI/detail values).
 * Purely cosmetic - matched to eISF's icon-left card language, no eISF import.
 */
/**
 * Update 3 (Subjects — Additional Updates): the subject-detail KPI strip
 * shows exactly these 6 fields, in this order. `SubjectRecordsService`
 * still resolves all 8 (Screening/Enrollment Date included) for the All
 * Subjects table and the details modal - this list only trims what the KPI
 * cards themselves display, per the updated spec.
 */
const KPI_CARD_FIELD_ORDER = ["initials", "pi", "studyId", "site", "status", "currentVisit"];

const DETAIL_FIELD_ICONS = {
  initials: MdBadge,
  status: MdFlag,
  pi: MdMedicalServices,
  studyId: MdTag,
  site: MdPlace,
  screeningDate: MdEventAvailable,
  enrollmentDate: MdEventNote,
  currentVisit: MdEvent,
};

function StudySubjectsWorkspace({ studyId = "", persist = false, readOnly = false }: any) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectParam = searchParams.get("subject");

  const {
    tree,
    store,
    selectedId,
    selectedFolder,
    selectFolder,
    clearSelection,
  } = useSubjectWorkspace({ studyId, persist });

  const currentUser = getCurrentUser();
  const canModify = canEditSubjectContent(currentUser) && !readOnly;

  /* ==============================================================
     SUBJECT METADATA (Task 1.5/1.6) - bridged from `subjectsByStudy`,
     the SAME storage/service `StudySubjects.js` already owns. Read-only
     here except through the paired create/edit/delete helpers below, so
     no second subject store is introduced.
  ============================================================== */
  const [subjectRecords, setSubjectRecords] = useState(() =>
    studyId ? SubjectRecordsService.getSubjectsForStudy(studyId) : []
  );

  useEffect(() => {
    setSubjectRecords(studyId ? SubjectRecordsService.getSubjectsForStudy(studyId) : []);
    return SubjectRecordsService.subscribeSubjects(() => {
      setSubjectRecords(
        studyId ? SubjectRecordsService.getSubjectsForStudy(studyId) : []
      );
    });
  }, [studyId]);

  /* Bug 2 fix: read the `subject` query parameter (set by the sidebar's
     handleSubjectClick) and auto-select the matching node in the explorer.
     This wires the sidebar's subject click to the workspace's selection,
     so clicking a subject in the left Study Binder immediately opens that
     subject's folder/file view inside the Subjects tab.

     - Resolves on mount AND when the param changes (sidebar click while
       already on the Subjects tab).
     - If the subject id doesn't exist in the tree (stale link, or a
       subject deleted since the link was created), falls back gracefully
       to the All Subjects table.
     - Once the user manually navigates elsewhere (Back to Subjects, or
       picks a different subject in the explorer), the subject param is
       removed from the URL to prevent stale overrides. */
  const hasResolvedSubjectRef = useRef(false);

  useEffect(() => {
    if (!subjectParam || !tree || tree.length === 0) return;

    const node = FolderTreeService.findNodeById(tree, subjectParam);
    if (node) {
      selectFolder(node);
      hasResolvedSubjectRef.current = true;
    }
    // If the subject id doesn't exist, don't select anything -
    // the workspace stays on the All Subjects table.
  }, [subjectParam, tree, selectFolder]);

  /* Top-level subject nodes from the live tree (the existing Add/Edit/Delete
     Subject flow in the sidebar is the only writer of these). */
  const subjectNodes = useMemo(
    () => (Array.isArray(tree) ? tree.filter((node) => node.type === "subject") : []),
    [tree]
  );

  /* Rows for the "All Subjects" table (Task 1.6, State A): every top-level
     subject in the live tree, merged with its metadata record if one
     exists. */
  const allSubjectsRows = useMemo(
    () =>
      subjectNodes.map((node) => ({
        id: node.id,
        node,
        record:
          subjectRecords.find(
            (record) => String(record.id).toLowerCase() === String(node.id).toLowerCase()
          ) || null,
      })),
    [subjectNodes, subjectRecords]
  );

  /* The subject that owns the current selection - the root segment of a
     path-style id ("SUB-004/consent-forms/icf-v1" -> "SUB-004"), or the
     selected node itself when a subject row is selected directly. */
  const activeSubjectId = selectedFolder
    ? String(selectedFolder.id).split("/")[0]
    : null;

  /* ---------- Subject metadata dialogs (Edit / Delete) ---------- */
  const [subjectDialog, setSubjectDialog] = useState(null); // { mode, subject }
  const [subjectDialogError, setSubjectDialogError] = useState("");

  /* Task 1.9: sidebar collapse/toggle on narrow screens. Only meaningful at
     the <=992px breakpoint where `.ssw-body` already stacks the explorer
     above the file manager (see StudySubjectsWorkspace.css) - the toggle
     button itself is hidden above that width via CSS, so desktop layout is
     completely unaffected and the sidebar is never permanently removed,
     only collapsed/expanded. Defaults open so nothing changes on first
     render at any width. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* Update 6: Comments - reuses the existing SubjectComments component/
     CommentsContext/commentService as-is (asModal mode). Available
     whenever a subject or any of its folders (including custom folders
     and ICF) is selected, scoped to the owning subject. */
  const [showComments, setShowComments] = useState(false);

  const closeSubjectDialog = useCallback(() => {
    setSubjectDialog(null);
    setSubjectDialogError("");
  }, []);

  const openEditSubjectDetails = useCallback((row) => {
    setSubjectDialogError("");
    setSubjectDialog({ mode: "edit", subject: row });
  }, []);

  const openDeleteSubject = useCallback((row) => {
    setSubjectDialogError("");
    setSubjectDialog({ mode: "delete", subject: row });
  }, []);

  /* Validate subject name for the unified form modal: uniqueness across all
     subjects in the live tree. */
  const validateSubjectName = useCallback(
    (name) => {
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return { valid: false, error: "Subject name is required." };
      const excludeId = subjectDialog?.subject?.id;
      const isDuplicate = subjectNodes.some(
        (node) =>
          node.id !== excludeId &&
          node.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (isDuplicate) return { valid: false, error: `A subject named "${trimmed}" already exists.` };
      return { valid: true, error: "" };
    },
    [subjectNodes, subjectDialog]
  );

  const submitEditSubjectDetails = useCallback(
    (fields) => {
      if (!subjectDialog?.subject) return;
      const nodeId = subjectDialog.subject.id;
      const nameChanged = fields.id && fields.id.trim() !== (subjectDialog.subject.id || "").trim();

      /* If the subject name/ID changed, rename the tree node. */
      if (nameChanged) {
        const result = FolderTreeService.renameSubject(studyId, tree, nodeId, fields.id);
        if (!result.ok) {
          setSubjectDialogError(result.error);
          return;
        }
      }

      /* Update the clinical metadata record (same service StudySubjects uses). */
      const defaults = getStudyDefaults(studyId);
      const finalSubjectId = nameChanged ? fields.id.trim() : nodeId;
      const updatedRecord = {
        initials: fields.initials || "",
        principalInvestigator: fields.principalInvestigator || defaults.principalInvestigator || defaults.pi || "",
        pi: fields.principalInvestigator || defaults.principalInvestigator || defaults.pi || "",
        site: fields.site || defaults.site || "",
        siteName: defaults.siteName || defaults.site || "",
        siteNo: fields.siteNo || defaults.siteNumber || "",
        status: fields.status || "",
        screeningDate: fields.screeningDate || "",
        enrollmentDate: fields.enrollmentDate || "",
        currentVisit: fields.currentVisit || "",
      };
      SubjectRecordsService.updateSubjectRecord(studyId, nodeId, updatedRecord);

      /* BUG FIX: this form is the only place the Subjects tab lets a user
         set Screening Date / Enrollment Date / Current Visit, but it never
         pushed those dates into the visit-schedule store. Calendar and
         Upcoming Visits both read exclusively from that store (via
         `useVisitSchedules`), so anything entered here silently never
         appeared there. `syncSubjectSchedules` is the same call
         `StudySubjects.js` already makes after its own edits - it
         regenerates this subject's Screening/Enrollment/visit entries and
         dispatches the change event the calendar listens for. */
      syncSubjectSchedules(studyId, finalSubjectId, {
        ...updatedRecord,
        id: finalSubjectId,
        subjectId: finalSubjectId,
      });

      closeSubjectDialog();
    },
    [studyId, subjectDialog, tree, closeSubjectDialog]
  );

  /* Deleting a subject removes BOTH the folder-tree node (and everything
     nested inside it) AND its metadata record, so the two stay in sync -
     the same pairing `ensureSubjectRecord` establishes on create. Writes
     through the same services the sidebar's own delete flow uses, so
     `SubjectExplorer`'s tree subscription picks this up automatically. */
  const submitDeleteSubject = useCallback(() => {
    const target = subjectDialog?.subject;
    if (!target) return;

    const result = FolderTreeService.deleteSubject(studyId, tree, target.id);
    if (!result.ok) {
      setSubjectDialogError(result.error);
      return;
    }

    SubjectRecordsService.deleteSubjectRecord(studyId, target.id);

    if (activeSubjectId === target.id) clearSelection();
    closeSubjectDialog();
  }, [subjectDialog, tree, studyId, activeSubjectId, clearSelection, closeSubjectDialog]);

  const deleteDescendantCount = useMemo(() => {
    if (subjectDialog?.mode !== "delete") return 0;
    return FolderTreeService.countDescendantFolders(subjectDialog.subject?.node);
  }, [subjectDialog]);

  /* Whole-workspace totals: folders, files and storage across every subject.
     Used whenever nothing is selected, so the tab has numbers to show before
     a folder is picked. Memoised on the same inputs the hook already
     tracks. */
  const workspaceStats = useMemo(
    () => FolderStatsService.getWorkspaceStats(tree, store),
    [tree, store]
  );

  /* Once a folder/subject is selected, the strip switches to that node's own
     scope (`getFolderStats`) so the KPI cards describe the selected section
     rather than the whole workspace. */
  const selectedStats = useMemo(
    () => FolderStatsService.getFolderStats(selectedFolder, store),
    [selectedFolder, store]
  );

  const activeStats = selectedFolder ? selectedStats : workspaceStats;

  /**
   * Task 1.5, trimmed by Update 3: once a subject (or a folder inside one)
   * is selected, the KPI strip switches from workspace/folder totals to
   * that subject's own detail values - Initials, Principal Investigator,
   * Study ID, Site, Status, Current Visit - real record, no hardcoding.
   * When nothing is selected, no subject-detail cards are shown at all;
   * the strip falls back to the pre-existing workspace-totals cards below.
   */
  const subjectDetailCards = useMemo(() => {
    if (!activeSubjectId) return null;

    const fields = SubjectRecordsService.getSubjectDetailFields(studyId, activeSubjectId);
    const byKey = new Map(fields.map((field) => [field.key, field]));

    return KPI_CARD_FIELD_ORDER.map((key) => {
      const field = byKey.get(key);
      return {
        key,
        title: field?.label || key,
        value: field?.value ?? "—",
        Icon: DETAIL_FIELD_ICONS[key] || MdBadge,
        color: "#2f80ed",
      };
    });
  }, [activeSubjectId, studyId]);

  /**
   * The active scope's numbers mapped onto this tab's own card contract
   * (`{ key, title, value, detail, color, Icon }`). Rendered by
   * `SubjectsKpiCard` above - Subjects' own component, not eISF's.
   */
  const kpiCards = useMemo(() => {
    const {
      totalSubjects = 0,
      totalFolders = 0,
      totalFiles = 0,
      storageUsed = 0,
      quota = 0,
      usedPercent = 0,
    } = activeStats || {};

    return [
      {
        key: "subjects",
        title: selectedFolder ? "Nested Subjects" : "Total Subjects",
        value: totalSubjects,
        detail: selectedFolder
          ? "Within selected section"
          : "With document folders",
        Icon: MdPeopleOutline,
        color: "#2f80ed",
      },
      {
        key: "folders",
        title: "Folders",
        value: totalFolders,
        detail: selectedFolder ? "Within selection" : "Across all subjects",
        Icon: MdFolderCopy,
        color: "#2bb673",
      },
      {
        key: "files",
        title: "Documents",
        value: totalFiles,
        detail: selectedFolder ? "Within selection" : "Across the workspace",
        Icon: MdInsertDriveFile,
        color: "#f5a524",
      },
      {
        key: "storage",
        title: "Storage Used",
        value: formatFileSize(storageUsed),
        detail: quota
          ? `${Math.round(usedPercent)}% of ${formatFileSize(quota)}`
          : "Total size",
        Icon: MdCloudQueue,
        color: "#ef5b65",
      },
    ];
  }, [activeStats, selectedFolder]);

  /* Stable so the memoised explorer does not re-render on unrelated updates. */
  const handleSelect = useCallback((node) => selectFolder(node), [selectFolder]);

  /* Update 1/4: both the new "Back to Subjects" button and the sidebar's
     "Subjects" header (Update 4) return to the same All Subjects view via
     the same `clearSelection` the explorer's own folder bar already uses -
     one navigation path, not a duplicate. Also closes the Comments modal,
     since its subject context goes away with the selection. */
  const handleBackToSubjects = useCallback(() => {
    setShowComments(false);
    clearSelection();
    // Clear the subject query param from the URL so a stale param
    // doesn't force the same subject back open on re-render.
    searchParams.delete("subject");
    setSearchParams(searchParams, { replace: true });
  }, [clearSelection, searchParams, setSearchParams]);

  /* Panel title tracks the current selection so the header always reads
     as one coherent statement. */
  const panelTitle = selectedFolder ? selectedFolder.name : "Subject Documents";

  return (
    <section
      className="study-subjects-workspace tnxt-compact"
      aria-label={
        studyId ? `Subject documents for study ${studyId}` : "Subject documents"
      }
      data-study-id={studyId || ""}
      data-selected-folder={selectedFolder?.id || ""}
    >
      {/* Two-column header, one row:
            LEFT  "SUBJECTS / <selected section>" wayfinder.
            RIGHT panel title + KPI cards, side by side on the same row. */}
      <header className="ssw-header">
        <div className="ssw-header-right">
          <div className="ssw-header-text">
            <div className="ssw-title-row">
              <h2 className="ssw-title">{panelTitle}</h2>
              <span className="ssw-title-count">
                {activeStats?.totalSubjects ?? 0}
              </span>

              {/* Update 6: Comments - available for the selected subject and
                  every folder inside it (custom folders and ICF alike). */}
              {activeSubjectId && (
                <button
                  type="button"
                  className="ssw-comments-btn"
                  onClick={() => setShowComments(true)}
                >
                  <MdChatBubbleOutline size={14} aria-hidden="true" />
                  <span>Comments</span>
                </button>
              )}

              {selectedFolder && (
                <button
                  type="button"
                  className="ssw-back-btn"
                  onClick={handleBackToSubjects}
                >
                  <MdArrowBack size={15} aria-hidden="true" />
                  <span>Back to Subjects</span>
                </button>
              )}
              {/* Task 1.5: subject-detail cards (8, single row, never wraps)
                  once a subject is in scope; otherwise the pre-existing
                  workspace/folder totals (4 cards). */}
              {subjectDetailCards ? (
                <div className="ssw-kpi-cards ssw-kpi-cards--subject">
                  {subjectDetailCards.map((card) => (
                    <SubjectsKpiCard card={card} key={card.key} />
                  ))}
                </div>
              ) : (
                <div className="ssw-kpi-cards">
                  {kpiCards.map((card) => (
                    <SubjectsKpiCard card={card} key={card.key} />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      <div className="ssw-body">
        {/* Task 1.9: mobile-only toggle for the internal Subjects sidebar
            (hidden entirely above 992px via CSS - see
            `.ssw-sidebar-toggle` in StudySubjectsWorkspace.css). Collapses/
            expands the explorer in place; it is never unmounted, so
            selection, expansion state and scroll position all survive a
            toggle. */}
        <button
          type="button"
          className="ssw-sidebar-toggle"
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          aria-expanded={!sidebarCollapsed}>

          {sidebarCollapsed ? (
            <MdMenuOpen size={16} aria-hidden="true" />
          ) : (
            <MdClose size={16} aria-hidden="true" />
          )}
          <span>{sidebarCollapsed ? "Show subjects list" : "Hide subjects list"}</span>
        </button>

        {/* Controlled selection: sidebar, folder bar and file list can never
            disagree, including on the first render after a tab switch. */}
        <div
          className={
            sidebarCollapsed
              ? "ssw-sidebar-wrap ssw-sidebar-wrap--collapsed"
              : "ssw-sidebar-wrap"
          }>

          <SubjectExplorer
            tree={tree}
            selectedId={selectedId}
            onSelect={handleSelect}
            onNavigateToAllSubjects={handleBackToSubjects}
            studyId={studyId}
            readOnly={readOnly}
          />
        </div>

        <div className="ssw-main">
          {selectedFolder ? (
            /* STATE B (Task 1.6): a subject or one of its folders is
               selected - untouched existing folder bar + file manager. */
            <>
              {/* Receives the shared tree from useSubjectWorkspace so it can
                  never drift out of sync with the explorer sidebar. */}
              <SubjectFileManager
                selectedFolder={selectedFolder}
                onSelectFolder={handleSelect}
                tree={tree}
                studyId={studyId}
                readOnly={readOnly}
              />
            </>
          ) : (
            /* STATE A (Task 1.6): nothing selected - the "All Subjects"
               table, built from the same live tree + metadata records used
               everywhere else in this tab. */
            <AllSubjectsTable
              subjects={allSubjectsRows}
              studyId={studyId}
              canModify={canModify}
              onOpen={(row) => handleSelect(row.node)}
              onEdit={openEditSubjectDetails}
              onDelete={openDeleteSubject}
              tree={tree}
              fileStore={store}
            />
          )}
        </div>
      </div>

      {subjectDialog?.mode === "edit" && (
        <SubjectFormModal
          mode="edit"
          studyId={studyId}
          subject={{ id: subjectDialog.subject.id, name: subjectDialog.subject.id }}
          record={subjectDialog.subject.record}
          validate={validateSubjectName}
          submitError={subjectDialogError}
          onSubmit={submitEditSubjectDetails}
          onClose={closeSubjectDialog}
        />
      )}

      {subjectDialog?.mode === "delete" && (
        <DeleteSubjectDialog
          subject={{ id: subjectDialog.subject.id, name: subjectDialog.subject.id }}
          descendantCount={deleteDescendantCount}
          submitError={subjectDialogError}
          onConfirm={submitDeleteSubject}
          onClose={closeSubjectDialog}
        />
      )}

      {showComments && activeSubjectId && (
        <SubjectComments
          subjectId={activeSubjectId}
          studyId={studyId}
          asModal
          onClose={() => setShowComments(false)}
        />
      )}
    </section>
  );
}

export default StudySubjectsWorkspace;
