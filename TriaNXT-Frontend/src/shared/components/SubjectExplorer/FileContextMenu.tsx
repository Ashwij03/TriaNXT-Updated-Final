import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  MdMoreVert,
  MdDriveFileRenameOutline,
  MdDeleteOutline,
  MdDownload,
  MdHistory,
  MdContentCopy,
  MdPublic,
  MdDriveFileMoveOutline,
  MdLockOutline,
  MdCheckCircle,
} from "react-icons/md";

/**
 * Subject Explorer - file row action menu.
 *
 * Mirrors FolderContextMenu: presentational, reports the chosen action
 * upward, and portals the dropdown with fixed positioning so the table's
 * horizontal scroll container cannot clip it.
 *
 * Full action set: Audit Trail, Download, Duplicate, Global View, Move,
 * Permissions, Rename / Update, Delete. When `locked` is true (the file's
 * folder is a system folder like ICF) there is nothing left for this menu
 * to offer, so it renders nothing at all.
 *
 * Props
 *   file          the file record
 *   onAction      (actionKey, file) => void
 *   onOpenChange  (open) => void - lets the row stay visually active
 *   locked        true to render nothing (view-only folder - no secondary
 *                 actions apply)
 *   canApprove    holder of APPROVE_REGULATORY_DOCS - adds an Approve item
 *                 for files currently in Pending Review
 */

const MENU_WIDTH = 194;
const MENU_MARGIN = 8;

const ALL_ITEMS = [
  { key: "audit-trail", label: "Audit Trail", Icon: MdHistory },
  { key: "download", label: "Download", Icon: MdDownload },
  { key: "duplicate", label: "Duplicate", Icon: MdContentCopy },
  { key: "global-view", label: "Global View", Icon: MdPublic },
  { key: "move", label: "Move", Icon: MdDriveFileMoveOutline },
  { key: "permissions", label: "Permissions", Icon: MdLockOutline },
  { key: "rename", label: "Rename / Update", Icon: MdDriveFileRenameOutline },
  { key: "delete", label: "Delete", Icon: MdDeleteOutline, danger: true },
];

function FileContextMenu({
  file,
  onAction,
  onOpenChange,
  locked = false,
  canApprove = false,
}: any) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Approve only exists for files still in Pending Review and only for a
  // user whose permission set includes APPROVE_REGULATORY_DOCS.
  const approveItem =
    canApprove &&
    String(file?.status || "").trim().toLowerCase() === "pending review"
      ? [{ key: "approve", label: "Approve", Icon: MdCheckCircle }]
      : [];

  const items = locked ? [] : [...approveItem, ...ALL_ITEMS];

  const closeMenu = useCallback(() => setOpen(false), []);

  /** Anchor under the trigger, flipping/clamping to stay in the viewport. */
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;

    const menuHeight = menuRef.current?.offsetHeight ?? 0;

    let top = trigger.bottom + 4;
    if (menuHeight && top + menuHeight > window.innerHeight - MENU_MARGIN) {
      top = Math.max(MENU_MARGIN, trigger.top - menuHeight - 4);
    }

    const left = Math.min(
      Math.max(MENU_MARGIN, trigger.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - MENU_MARGIN
    );

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (typeof onOpenChange === "function") onOpenChange(open);
  }, [open, onOpenChange]);

  /* Outside click / Escape dismissal; scroll+resize repositioning. */
  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;

      event.stopPropagation();
      closeMenu();

      // Restore focus only when it is still inside the menu, so a dialog
      // opened from here keeps its own focus.
      if (menuRef.current?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    // `true` = capture, so scrolling the table container is caught too.
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, closeMenu, updatePosition]);

  /* Measure once mounted so the flip uses the real menu height. */
  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  const runAction = (event, actionKey) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    if (typeof onAction === "function") onAction(actionKey, file);
  };

  /* No items to offer (locked folder) - render nothing. Placed after every
     hook call above, not as an early return before them, so hook order
     never depends on `locked` (see the identical fix in
     FolderContextMenu.js for why this matters). */
  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`sf-menu-trigger${open ? " is-open" : ""}`}
        aria-label={`More actions for ${file?.name || "file"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          // Stop the row handler so opening the menu never opens details.
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (open) {
              event.stopPropagation();
              closeMenu();
            }
            return;
          }
          // Keep the row's Enter/Space handling from firing while the
          // trigger itself is focused.
          event.stopPropagation();
        }}
      >
        <MdMoreVert size={15} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="sf-menu"
            role="menu"
            aria-label={`More actions for ${file?.name || "file"}`}
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            onClick={(event) => event.stopPropagation()}
          >

            <div className="sf-menu-heading" title={file?.name}>
              {file?.name}
            </div>

            {items.map(({ key, label, Icon, danger }: any) => (
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
    </>
  );
}

export default FileContextMenu;
