import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  MdSearch,
  MdClose,
  MdFileDownload,
  MdEdit,
  MdDeleteOutline,
  MdFolderOpen,
  MdMoreVert,
  MdHistory,
  MdDownload,
  MdContentCopy,
  MdDriveFileMoveOutline,
  MdLockOutline,
  MdDriveFileRenameOutline,
  MdPublic,
} from "react-icons/md";

import { downloadCsvReport } from "../../utils/exportReport";
import { ROLE_LABELS } from "../../services/roleService";
import { formatDateTimeUTC } from "../../utils/dateTime";
import FileService from "./fileService";
import FolderTreeService from "./folderTreeService";
import PaginationFooter from "./PaginationFooter";
import "./AllSubjectsTable.css";

/**
 * Subject Explorer - ALL SUBJECTS TABLE (Task 1.6, State A).
 *
 * Shown in the Subjects tab whenever nothing is selected in the sidebar.
 * Columns/behaviour follow the eISF DocumentTable pattern (shell, header,
 * row hover, sorting, pagination footer, "Showing X to Y of Z") without
 * importing anything from eISF - this is Subjects' own table, reading the
 * same live folder tree (`SubjectExplorer`/`FolderTreeService`) and the
 * same subject metadata records (`subjectRecordsService`, i.e. the exact
 * `subjectsByStudy` storage `StudySubjects.js` already owns) that back the
 * rest of the tab. No mock/static rows, no second subject store.
 *
 * Props
 *   subjects       [{ id, name, record }]  merged tree + metadata rows
 *   studyId
 *   canModify      show/hide the Actions column
 *   onOpen(subject)    row click / "Open" action -> select in explorer
 *   onEdit(subject)    Edit action -> SubjectFormModal
 *   onDelete(subject)  Delete action -> confirmation dialog
 */

const STATUS_ALL = "__all__";
const PAGE_SIZE_DEFAULT = 10;

/**
 * Fix (earlier update): the table had NO `<colgroup>` at all - header and
 * body column widths were left entirely to the browser's default table
 * layout, which sizes each column from its own row's content. That is the
 * actual structural cause of any header/row drift: two rows with
 * differently-long content can legitimately end up with different column
 * widths under that algorithm. An explicit `<colgroup>` plus
 * `table-layout: fixed` (`AllSubjectsTable.css`) removes that entirely - one
 * set of widths, used for the header row and every body row, exactly like
 * `SubjectFileTable.js` already does for the file table. Two sets because
 * the Actions column only renders when `canModify` is true; each sums to
 * 100%. */
/**
 * Column rework (this update): Principal Investigator, Site, Screening
 * Date, Enrollment Date and Current Visit are dropped from this table (they
 * remain available in the per-subject KPI strip and Edit Subject form -
 * nothing here deletes that data, it's just no longer duplicated in this
 * table). A single "Last Modified" column replaces them, showing when the
 * subject's folder was last touched and which role touched it. */
const COLUMNS_WITH_ACTIONS = [
  { key: "id", width: "24%" },
  { key: "status", width: "18%" },
  { key: "lastModified", width: "33%" },
  { key: "actions", width: "25%" },
];

const COLUMNS_WITHOUT_ACTIONS = [
  { key: "id", width: "32%" },
  { key: "status", width: "24%" },
  { key: "lastModified", width: "44%" },
];

/**
 * Formats the Last Modified cell's two lines: an absolute UTC date/time, and
 * the role of whoever made that change (`updatedBy`, stamped by
 * `subjectService.js` on every create/update using the acting role -
 * respecting Admin/PI preview mode the same way the rest of the app does).
 * Falls back gracefully for legacy records saved before this field existed.
 */
function getLastModifiedDisplay(subject) {
  const record = subject.record || {};
  const isoStamp = record.updatedAt || record.createdAt || subject.updatedAt || subject.createdAt || "";
  const roleCode = record.updatedBy || record.createdBy || subject.updatedBy || "";

  const dateTime = isoStamp ? formatDateTimeUTC(isoStamp) : "—";
  const role = roleCode ? ROLE_LABELS[roleCode] || roleCode : "—";

  return { dateTime, role };
}

/**
 * Inline actions menu for subject rows. Ports the same portal-based
 * dropdown pattern from FileContextMenu/FolderContextMenu so the menu
 * is not clipped by the table's scroll container.
 */
const SAT_MENU_WIDTH = 194;
const SAT_MENU_MARGIN = 8;

const SUBJECT_ACTION_ITEMS = [
  { key: "edit", label: "Rename / Update", Icon: MdDriveFileRenameOutline },
  { key: "audit-trail", label: "Audit Trail", Icon: MdHistory },
  { key: "download", label: "Download All", Icon: MdDownload },
  { key: "duplicate", label: "Duplicate", Icon: MdContentCopy },
  { key: "import-folder-structure", label: "Import Folder Structure", Icon: MdMoreVert },
  { key: "move", label: "Move", Icon: MdDriveFileMoveOutline },
  { key: "permissions", label: "Permissions", Icon: MdLockOutline },
  { key: "global-view", label: "Global View", Icon: MdPublic },
  { key: "delete", label: "Delete", Icon: MdDeleteOutline, danger: true },
];

function SubjectActionsMenu({ subject, onAction }: any) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef(null);
  const menuRef = React.useRef(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    let top = trigger.bottom + 4;
    if (menuHeight && top + menuHeight > window.innerHeight - SAT_MENU_MARGIN) {
      top = Math.max(SAT_MENU_MARGIN, trigger.top - menuHeight - 4);
    }
    const left = Math.min(
      Math.max(SAT_MENU_MARGIN, trigger.right - SAT_MENU_WIDTH),
      window.innerWidth - SAT_MENU_WIDTH - SAT_MENU_MARGIN
    );
    setPosition({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      closeMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeMenu();
        if (menuRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, closeMenu, updatePosition]);

  React.useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  const runAction = (event, actionKey) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    if (typeof onAction === "function") onAction(actionKey);
  };

  return (
    <div className="sat-row-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="sat-action-btn"
        aria-label={`Edit subject ${subject.id}`}
        title="Edit subject details"
        onClick={(event) => {
          event.stopPropagation();
          onAction?.("edit");
        }}
      >
        <MdEdit size={15} />
      </button>
      <button
        type="button"
        ref={triggerRef}
        className={`sat-action-btn sat-menu-trigger${open ? " is-open" : ""}`}
        aria-label={`More actions for subject ${subject.id}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <MdMoreVert size={15} />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="sf-menu"
            role="menu"
            aria-label={`Actions for subject ${subject.id}`}
            style={{ top: position.top, left: position.left, width: SAT_MENU_WIDTH }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-menu-heading" title={subject.record?.subjectId || subject.id}>
              {subject.record?.subjectId || subject.id}
            </div>
            {SUBJECT_ACTION_ITEMS.map(({ key, label, Icon, danger }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                className={`sf-menu-item${danger ? " is-danger" : ""}`}
                onClick={(event) => runAction(event, key)}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="sf-menu-item-label">{label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Audit trail overlay for a subject — shows all audit events related to
 * that subject. Reuses the app's existing audit data via localStorage
 * auditLogs (the same data source as SubjectAuditTrail.js).
 */
function AuditTrailOverlay({ subject, onClose }: any) {
  const subjectId = subject?.id || subject?.record?.subjectId || "";

  const logs = useMemo(() => {
    try {
      const allLogs = JSON.parse(localStorage.getItem("auditLogs")) || [];
      return allLogs.filter((log) => String(log.subjectId) === String(subjectId));
    } catch {
      return [];
    }
  }, [subjectId]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="audit-overlay tnxt-compact" onClick={onClose}>
      <div className="audit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="audit-header">
          <h3>Audit Trail — {subjectId}</h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>
        <table className="audit-table ctms-standard-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>User</th>
              <th>Reason</th>
              <th>Timestamp (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="no-audit-data">No Audit Records Found</td></tr>
            ) : (
              logs.map((log, index) => (
                <tr key={index}>
                  <td>{log.action || "-"}</td>
                  <td>{log.deletedBy || log.updatedBy || log.createdBy || log.performedBy || "-"}</td>
                  <td>{log.reason || "-"}</td>
                  <td>{formatDateTimeUTC(log.updatedAt || log.deletedAt || log.createdAt || "-")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>,
    document.body
  );
}


function AllSubjectsTable({
  subjects = [],
  studyId,
  canModify = false,
  onOpen,
  onEdit,
  onDelete,
  tree = [],
  fileStore = {},
}: any) {
  const [subjectActionDialog, setSubjectActionDialog] = useState(null);
  const [subjectActionError, setSubjectActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  const statusOptions = useMemo(() => {
    const set = new Set<any>();
    subjects.forEach((subject) => {
      const statusVal = subject.record?.status || subject.status;
      if (statusVal) set.add(statusVal);
    });
    return Array.from(set).sort();
  }, [subjects]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return subjects.filter((subject) => {
      const subjectStatus = subject.record?.status || subject.status || "";
      if (statusFilter !== STATUS_ALL && subjectStatus !== statusFilter) {
        return false;
      }
      if (!term) return true;

      const haystack = [
        subject.id,
        subject.subjectId,
        subject.record?.subjectId,
        subject.record?.initials,
        subject.record?.status,
        subject.record?.pi,
        subject.record?.principalInvestigator,
        subject.record?.site,
        subject.record?.siteName,
        subject.record?.screeningDate,
        subject.record?.screening_date,
        subject.record?.enrollmentDate,
        subject.record?.enrollment_date,
        subject.record?.currentVisit,
        subject.record?.current_visit,
        subject.record?.visitStage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [subjects, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const handleReset = () => {
    setSearch("");
    setStatusFilter(STATUS_ALL);
    setPage(1);
  };

  const handleExport = () => {
    const header = ["Subject ID", "Status", "Last Modified", "Last Modified By"];

    const rows = filtered.map((subject) => {
      const { dateTime, role } = getLastModifiedDisplay(subject);
      return [
        subject.record?.subjectId || subject.id || subject.subjectId || "",
        subject.record?.status || subject.status || "",
        dateTime,
        role,
      ];
    });

    downloadCsvReport(`${studyId || "subjects"}-all-subjects`, [header, ...rows]);
  };

  return (
    <section className="sat-panel" aria-label="All subjects">
      <header className="sat-toolbar" role="search">
        <div className="sat-search">
          <MdSearch size={17} className="sat-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="sat-search-input"
            placeholder="Search subjects by ID or status..."
            value={search}
            aria-label="Search subjects"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              type="button"
              className="sat-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              <MdClose size={14} />
            </button>
          )}
        </div>

        <div className="sat-toolbar-right">
          <label className="sat-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value={STATUS_ALL}>All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="sat-btn sat-btn--ghost" onClick={handleReset}>
            Reset
          </button>

          <button type="button" className="sat-btn" onClick={handleExport}>
            <MdFileDownload size={14} aria-hidden="true" />
            <span>Export</span>
          </button>
        </div>
      </header>

      <div className="sat-table-scroll">
        <table className="sat-table">
          <colgroup>
            {(canModify ? COLUMNS_WITH_ACTIONS : COLUMNS_WITHOUT_ACTIONS).map(
              ({ key, width }) => (
                <col key={key} className={`sat-col-${key}`} style={{ width }} />
              )
            )}
          </colgroup>
          <thead>
            <tr>
              <th>Subject ID</th>
              <th>Status</th>
              <th>Last Modified</th>
              {canModify && <th className="sat-th-actions">Actions</th>}
            </tr>
          </thead>

          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={canModify ? 4 : 3} className="sat-empty-cell">
                  No matching subjects found.
                </td>
              </tr>
            ) : (
              pageRows.map((subject) => (
                <tr
                  key={subject.id}
                  className="sat-row"
                  onClick={() => onOpen?.(subject)}
                >
                  <td className="sat-cell-id">
                    <span className="sat-cell-id-inner">
                      <MdFolderOpen size={15} aria-hidden="true" />
                      <span>{subject.record?.subjectId || subject.id || subject.subjectId || "—"}</span>
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const statusVal = subject.record?.status || subject.status || "Screened";
                      const statusSlug = statusVal.toLowerCase().replace(/\s+/g, "-");
                      return (
                        <span className={`sat-status-pill sat-status-${statusSlug}`}>
                          {statusVal}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const { dateTime, role } = getLastModifiedDisplay(subject);
                      return (
                        <span className="sat-modified-cell">
                          <span className="sat-modified-datetime">{dateTime}</span>
                          <span className="sat-modified-role">{role}</span>
                        </span>
                      );
                    })()}
                  </td>
                  {canModify && (
                    <td className="sat-cell-actions">
                      <SubjectActionsMenu
                        subject={subject}
                        onAction={(action) => {
                          if (action === "edit") {
                            onEdit?.(subject);
                          } else if (action === "delete") {
                            onDelete?.(subject);
                          } else if (action === "audit-trail") {
                            setSubjectActionDialog({ mode: "audit-trail", subject });
                          } else if (action === "download") {
                            // Download all files for this subject from fileStore
                            const subjectId = subject.id || subject.record?.subjectId;
                            const filesToDownload = [];
                            Object.values(fileStore).forEach((files) => {
                              ((files || []) as any[]).forEach((file: any) => {
                                if (file.folderId && file.folderId.startsWith(subjectId)) {
                                  filesToDownload.push(file);
                                }
                              });
                            });
                            if (filesToDownload.length === 0) {
                              setSubjectActionDialog({ mode: "no-files", subject });
                            } else {
                              filesToDownload.forEach((file) => FileService.downloadFile(file));
                            }
                          } else if (action === "duplicate") {
                            setSubjectActionDialog({ mode: "duplicate", subject });
                          } else if (action === "import-folder-structure") {
                            setSubjectActionDialog({ mode: "import", subject });
                          } else if (action === "move") {
                            setSubjectActionError("");
                            setSubjectActionDialog({ mode: "move", subject });
                          } else if (action === "permissions") {
                            setSubjectActionDialog({ mode: "permissions", subject });
                          } else if (action === "global-view") {
                            onOpen?.(subject);
                          }
                        }}
                      />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        page={safePage}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* ================= INLINE MODALS for Subject Actions ================= */}
      {subjectActionDialog?.mode === "audit-trail" && (
        <AuditTrailOverlay
          subject={subjectActionDialog.subject}
          onClose={() => setSubjectActionDialog(null)}
        />
      )}

      {subjectActionDialog?.mode === "no-files" && (
        <div className="sxm-overlay" onClick={() => setSubjectActionDialog(null)}>
          <div className="sxm-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="sxm-header">
              <h3>No Files to Download</h3>
              <button type="button" className="sxm-close" onClick={() => setSubjectActionDialog(null)}>✕</button>
            </div>
            <div className="sxm-body">
              <p>This subject has no files stored locally. Files are seeded on upload.</p>
            </div>
            <div className="sxm-footer">
              <button type="button" className="sxm-btn sxm-btn--primary" onClick={() => setSubjectActionDialog(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {subjectActionDialog?.mode === "duplicate" && (
        <div className="sxm-overlay" onClick={() => setSubjectActionDialog(null)}>
          <div className="sxm-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="sxm-header">
              <h3>Duplicate Subject</h3>
              <button type="button" className="sxm-close" onClick={() => setSubjectActionDialog(null)}>✕</button>
            </div>
            <div className="sxm-body">
              <p>Duplicating will create a copy of the folder structure for subject <strong>{subjectActionDialog.subject?.id}</strong>.</p>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
                File contents are not duplicated — only the folder structure and metadata are copied.
              </p>
            </div>
            <div className="sxm-footer">
              <button type="button" className="sxm-btn sxm-btn--ghost" onClick={() => setSubjectActionDialog(null)}>Cancel</button>
              <button
                type="button"
                className="sxm-btn sxm-btn--primary"
                onClick={() => {
                  const srcId = subjectActionDialog.subject?.id;
                  if (!srcId || !studyId) return;
                  // Clone the subject's folder tree into a new subject ID
                  const dstId = `${srcId}-copy`;
                  const srcFolders = (tree || []).find((n) => n.id === srcId);
                  if (srcFolders) {
                    const cloned = JSON.parse(JSON.stringify(srcFolders));
                    cloned.id = dstId;
                    cloned.name = `${srcFolders.name} (copy)`;
                    // Persist via FolderTreeService if available
                    if (FolderTreeService && typeof FolderTreeService.createFolder === "function") {
                      FolderTreeService.createFolder(studyId, tree, null, cloned.name);
                    }
                  }
                  setSubjectActionDialog(null);
                }}>

                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {subjectActionDialog?.mode === "import" && (
        <div className="sxm-overlay" onClick={() => setSubjectActionDialog(null)}>
          <div className="sxm-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="sxm-header">
              <h3>Import Folder Structure</h3>
              <button type="button" className="sxm-close" onClick={() => setSubjectActionDialog(null)}>✕</button>
            </div>
            <div className="sxm-body">
              <p>Import a folder/subfolder structure for subject <strong>{subjectActionDialog.subject?.id}</strong> from a JSON or CSV template.</p>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
                This feature requires a template file. Select a JSON file with the desired folder hierarchy to import.
              </p>
              <label className="sxm-field" style={{ marginTop: "1rem" }}>
                <span>Template file (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      try {
                        const structure = JSON.parse(ev.target.result as string);
                        if (Array.isArray(structure)) {
                          structure.forEach((folderName) => {
                            if (typeof folderName === "string") {
                              FolderTreeService?.createFolder?.(studyId, tree, subjectActionDialog.subject?.id, folderName);
                            }
                          });
                        }
                        setSubjectActionDialog(null);
                      } catch {
                        setSubjectActionError("Invalid JSON template. Must be an array of folder names.");
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
              {subjectActionError && (
                <div className="sf-alert sf-alert--error" style={{ marginTop: "0.5rem" }}>{subjectActionError}</div>
              )}
            </div>
            <div className="sxm-footer">
              <button type="button" className="sxm-btn sxm-btn--ghost" onClick={() => { setSubjectActionDialog(null); setSubjectActionError(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {subjectActionDialog?.mode === "move" && (
        <div className="sxm-overlay" onClick={() => setSubjectActionDialog(null)}>
          <div className="sxm-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="sxm-header">
              <h3>Move Subject</h3>
              <button type="button" className="sxm-close" onClick={() => setSubjectActionDialog(null)}>✕</button>
            </div>
            <div className="sxm-body">
              <p>Moving subject <strong>{subjectActionDialog.subject?.id}</strong> to another study or location is not yet supported in the local storage layer.</p>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
                This feature will be available once a real backend API is connected.
              </p>
            </div>
            <div className="sxm-footer">
              <button type="button" className="sxm-btn sxm-btn--ghost" onClick={() => setSubjectActionDialog(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {subjectActionDialog?.mode === "permissions" && (
        <div className="sxm-overlay" onClick={() => setSubjectActionDialog(null)}>
          <div className="sxm-modal" onClick={(e) => e.stopPropagation()} role="dialog" style={{ maxWidth: "32rem" }}>
            <div className="sxm-header">
              <h3>Permissions — {subjectActionDialog.subject?.id}</h3>
              <button type="button" className="sxm-close" onClick={() => setSubjectActionDialog(null)}>✕</button>
            </div>
            <div className="sxm-body">
              <table className="ctms-standard-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th style={{ textAlign: "center" }}>View</th>
                    <th style={{ textAlign: "center" }}>Edit</th>
                    <th style={{ textAlign: "center" }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "admin", label: "Admin" },
                    { key: "pi", label: "Principal Investigator" },
                    { key: "sponsor", label: "Sponsor" },
                    { key: "cro", label: "CRO" },
                    { key: "site-staff", label: "Site Staff" },
                  ].map(({ key, label }) => (
                    <tr key={key}>
                      <td style={{ fontWeight: 600 }}>{label}</td>
                      <td style={{ textAlign: "center" }}><input type="defaultChecked" readOnly checked disabled /></td>
                      <td style={{ textAlign: "center" }}><input type="checkbox" defaultChecked={key === "admin" || key === "pi"} readOnly /></td>
                      <td style={{ textAlign: "center" }}><input type="checkbox" defaultChecked={key === "admin"} readOnly /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.75rem" }}>
                Permissions are read-only in the local storage layer. Role-based access control will be enforced by the backend.
              </p>
            </div>
            <div className="sxm-footer">
              <button type="button" className="sxm-btn sxm-btn--primary" onClick={() => setSubjectActionDialog(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AllSubjectsTable;
