import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./DocumentTable.css";
import StatusBadge from "./StatusBadge";
import {
  FiDownload,
  FiEdit2,
  FiEye,
  FiList,
  FiMoreVertical,
  FiTrash2,
} from "react-icons/fi";

const REFERENCE_COLUMNS = [
  { key: "documentName", label: "Document Name" },
  { key: "documentType", label: "Document Type" },
  { key: "version", label: "Version" },
  { key: "status", label: "Status" },
  { key: "modifiedDate", label: "Last Modified" },
];

const ACTION_MENU_WIDTH = 210;
const ACTION_MENU_GAP = 8;

export default function DocumentTable({
  documents = [],
  onView,
  onHistory,
  onAudit,
  onDownload,
  onEdit,
  onDelete,
  onSort,
  sortField = "documentName",
  sortDirection = "asc",
  variant = "default",
  canEdit = true,
  canDelete = true,
  selectedDocumentId = null,
  onSelect,
}: any) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRefs = useRef<Record<string, any>>({});
  const menuRef = useRef(null);
  const isReferenceView = variant === "reference";

  const runAction = (callback, doc) => {
    setOpenMenuId(null);
    callback?.(doc);
  };

  /**
   * Compute menu position from the trigger button's viewport rect.
   * Flips above the button when there isn't room below, and clamps
   * to the viewport edges so the menu is never clipped.
   */
  const updatePosition = useCallback(() => {
    const button = menuButtonRefs.current[openMenuId];
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const hasRoomBelow =
      viewportHeight - rect.bottom >= menuHeight + ACTION_MENU_GAP;
    const hasRoomAbove =
      rect.top >= menuHeight + ACTION_MENU_GAP;

    const top =
      hasRoomBelow || !hasRoomAbove
        ? Math.min(
            rect.bottom + ACTION_MENU_GAP,
            viewportHeight - menuHeight - ACTION_MENU_GAP
          )
        : rect.top - menuHeight - ACTION_MENU_GAP;

    const left = Math.min(
      Math.max(ACTION_MENU_GAP, rect.right - ACTION_MENU_WIDTH),
      viewportWidth - ACTION_MENU_WIDTH - ACTION_MENU_GAP
    );

    setMenuPosition({
      top: Math.max(ACTION_MENU_GAP, top),
      left: Math.max(ACTION_MENU_GAP, left),
    });
  }, [openMenuId]);

  const toggleActionMenu = (documentId) => {
    if (openMenuId === documentId) {
      setOpenMenuId(null);
      return;
    }
    setOpenMenuId(documentId);
    // Position is computed in useLayoutEffect below, after the menu DOM
    // is committed and its real height is measurable.
  };

  /* --- Outside-click dismissal + keyboard (Escape) --- */
  useEffect(() => {
    if (!openMenuId || typeof window === "undefined") return undefined;

    const closeOnOutsideClick = (event) => {
      if (event.target.closest(".document-action-menu, .icon-action-btn.menu"))
        return;
      setOpenMenuId(null);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    window.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  /* --- Reposition after mount, and on scroll / resize --- */
  useLayoutEffect(() => {
    if (!openMenuId) return;

    // Compute once immediately after the menu commits to the DOM.
    updatePosition();

    const reposition = () => updatePosition();

    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [openMenuId, updatePosition]);

  const renderSortLabel = (column) => {
    if (!onSort) return column.label;

    const isActive = sortField === column.key;

    return (
      <button
        type="button"
        className={`table-sort-btn ${isActive ? "active" : ""}`}
        onClick={() => onSort(column.key)}>

        {column.label}
        <span>{isActive ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    );
  };

  return (
    <div className={`document-table-card tnxt-compact ${isReferenceView ? "reference-table-card" : ""}`}>
      <table className="document-table ctms-standard-table">
        <thead>
          <tr>
            {isReferenceView && <th className="select-col"><input type="checkbox" aria-label="Select all documents" /></th>}
            {isReferenceView ? (
              REFERENCE_COLUMNS.map((column) => (
                <th key={column.key}>{renderSortLabel(column)}</th>
              ))
            ) : (
              <>
                <th>Document Name</th>
                <th>Category</th>
                <th>Version</th>
                <th>Status</th>
                <th>Last Modified</th>
                <th>Owner</th>
              </>
            )}
            <th style={{ width: isReferenceView ? "150px" : "170px" }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {documents.length === 0 ? (
            <tr>
              <td colSpan={7} className="no-records">
                No Documents Found
              </td>
            </tr>
          ) : (
            documents.map((doc) => (
              <tr
                key={doc.id}
                className={`${onSelect ? "selectable-row" : ""} ${selectedDocumentId === doc.id ? "row-selected" : ""}`.trim()}
                onClick={onSelect ? () => onSelect(doc) : undefined}
                aria-selected={selectedDocumentId === doc.id}>

                {isReferenceView && (
                  <td className="select-col" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${doc.documentName}`} />
                  </td>
                )}

                <td>
                  {isReferenceView ? (
                    <div className="document-name-cell">
                      <span className="pdf-file-icon">PDF</span>
                      <span>{doc.documentName}</span>
                    </div>
                  ) : (
                    doc.documentName
                  )}
                </td>

                <td>{doc.documentType || doc.category}</td>
                <td>{doc.version}</td>

                <td>
                  <StatusBadge status={doc.status} />
                </td>

                <td>
                  {isReferenceView ? (
                    <span className="modified-cell">
                      <span>{doc.modifiedDate}</span>
                      <small>by {doc.uploadedBy || doc.owner || "Study Staff"}</small>
                    </span>
                  ) : (
                    doc.modifiedDate
                  )}
                </td>

                {!isReferenceView && <td>{doc.uploadedBy}</td>}

                <td onClick={(event) => event.stopPropagation()}>
                  {isReferenceView ? (
                    <div className="icon-actions">
                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() => runAction(onView, doc)}
                        aria-label={`View ${doc.documentName}`}
                        title="View">

                        <FiEye />
                      </button>

                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() => runAction(onDownload, doc)}
                        aria-label={`Download ${doc.documentName}`}
                        title="Download">

                        <FiDownload />
                      </button>

                      <div className="document-row-menu">
                        <button
                          type="button"
                          className="icon-action-btn menu"
                          ref={(button) => {
                            menuButtonRefs.current[doc.id] = button;
                          }}
                          onClick={() => toggleActionMenu(doc.id)}
                          aria-label={`More actions for ${doc.documentName}`}
                          aria-expanded={openMenuId === doc.id}
                          title="More">

                          <FiMoreVertical />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button className="action-btn view-btn" onClick={() => onView(doc)}>View</button>
                      <button className="action-btn history-btn" onClick={() => onHistory(doc)}>History</button>
                      <button className="action-btn audit-btn" onClick={() => onAudit(doc)}>Audit</button>
                      <button className="action-btn download-btn" onClick={() => onDownload(doc)}>Download</button>
                      {canEdit && (
                        <button className="action-btn edit-btn" onClick={() => onEdit(doc)}>Edit</button>
                      )}
                      {canDelete && (
                        <button className="action-btn delete-btn" onClick={() => onDelete(doc)}>Delete</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Portal the action menu to document.body so position: fixed
          coordinates are always relative to the viewport, not any
          containing-block ancestor with transform/filter. */}
      {openMenuId &&
        createPortal(
          <div
            ref={menuRef}
            className="document-action-menu"
            role="menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}>

            {(() => {
              const doc = documents.find((d) => d.id === openMenuId);
              if (!doc) return null;
              return (
                <>
                  <button type="button" role="menuitem" onClick={() => runAction(onView, doc)}>
                    <FiEye /> View
                  </button>
                  <button type="button" role="menuitem" onClick={() => runAction(onDownload, doc)}>
                    <FiDownload /> Download
                  </button>
                  <button type="button" role="menuitem" onClick={() => runAction(onHistory, doc)}>
                    <FiList /> Version History
                  </button>
                  <button type="button" role="menuitem" onClick={() => runAction(onAudit, doc)}>
                    <FiEye /> Audit Trail
                  </button>
                  {canEdit && (
                    <button type="button" role="menuitem" onClick={() => runAction(onEdit, doc)}>
                      <FiEdit2 /> Edit
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" role="menuitem" className="danger" onClick={() => runAction(onDelete, doc)}>
                      <FiTrash2 /> Delete
                    </button>
                  )}
                </>
              );
            })()}
          </div>,
          document.body
        )}
    </div>
  );
}
