import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdMoreVert,
  MdCreateNewFolder,
  MdFolderSpecial,
  MdDriveFileRenameOutline,
  MdDeleteOutline,
  MdEdit,
  MdDownload,
  MdHistory,
  MdContentCopy,
  MdDriveFileMoveOutline,
  MdLockOutline,
} from "react-icons/md";

const MENU_WIDTH = 194;
const MENU_MARGIN = 8;

function FolderContextMenu({ node, onAction, onOpenChange }: any) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const isSubject = node?.type === "subject";

  const items = isSubject
    ? [
        {
          key: "create-folder",
          label: "Create Folder",
          Icon: MdCreateNewFolder,
        },
        {
          key: "import-folder-structure",
          label: "Import Folder Structure",
          Icon: MdCreateNewFolder,
        },
        {
          key: "audit-trail",
          label: "Audit Trail",
          Icon: MdHistory,
        },
        {
          key: "permissions",
          label: "Permissions",
          Icon: MdLockOutline,
        },
        {
          key: "rename",
          label: "Edit Subject",
          Icon: MdEdit,
        },
        {
          key: "delete",
          label: "Delete Subject",
          Icon: MdDeleteOutline,
          danger: true,
        },
      ]
    : [
        {
          key: "create-folder",
          label: "Create Folder",
          Icon: MdCreateNewFolder,
          hint: "Same level",
        },
        {
          key: "create-subfolder",
          label: "Create Subfolder",
          Icon: MdFolderSpecial,
          hint: "Inside",
        },
        {
          key: "import-folder-structure",
          label: "Import Folder Structure",
          Icon: MdCreateNewFolder,
        },
        {
          key: "audit-trail",
          label: "Audit Trail",
          Icon: MdHistory,
        },
        {
          key: "download",
          label: "Download (ZIP)",
          Icon: MdDownload,
        },
        {
          key: "duplicate",
          label: "Duplicate",
          Icon: MdContentCopy,
        },
        {
          key: "move",
          label: "Move",
          Icon: MdDriveFileMoveOutline,
        },
        {
          key: "permissions",
          label: "Permissions",
          Icon: MdLockOutline,
        },
        {
          key: "rename",
          label: "Rename / Update",
          Icon: MdDriveFileRenameOutline,
        },
        {
          key: "delete",
          label: "Delete",
          Icon: MdDeleteOutline,
          danger: true,
        },
      ];

  const closeMenu = useCallback(() => setOpen(false), []);

  /**
   * Anchor the menu under the trigger, flipping/clamping it so it always
   * stays inside the viewport.
   *
   * Scrolling repositions instead of closing: focusing the trigger can make
   * the scrollable tree shift by a few pixels, and closing on that would
   * dismiss the menu the instant it opened.
   */
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

  /* Report open state so the row can stay visually active. */
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

      // Return focus to the trigger only if focus is still inside the menu;
      // otherwise a dialog opened from this menu would lose its own focus.
      if (menuRef.current?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    // `true` = capture, so scrolling the tree container is caught too.
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

  const handleTriggerClick = (event) => {
    // Stop the row's click handler so opening the menu never
    // toggles/selects the node underneath.
    event.preventDefault();
    event.stopPropagation();
    setOpen((prev) => !prev);
  };

  const runAction = (event, actionKey) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    if (typeof onAction === "function") onAction(actionKey, node);
  };

  /* Update 7: SubjectTreeNode already skips rendering this component for a
     locked node - this is defense in depth for any other caller/composition
     path that might still mount it directly. Placed after every hook call
     (not as an early return above them) so hook order never depends on
     `node.locked` - returning early before hooks would violate the Rules
     of Hooks the moment a node's locked state ever changed between renders. */
  if (node?.locked) return null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`sx-menu-trigger${open ? " is-open" : ""}`}
        aria-label={`Folder actions for ${node?.name || "folder"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleTriggerClick}
        onKeyDown={(event) => {
          // Escape must still close the menu, so handle it here rather than
          // relying on the document listener: React's stopPropagation below
          // would otherwise prevent the event from ever reaching it.
          if (event.key === "Escape") {
            if (open) {
              event.stopPropagation();
              closeMenu();
            }
            return;
          }
          // Keep the row's Enter/Space/Arrow handling from firing while the
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
            className="sx-menu"
            role="menu"
            aria-label={`Folder actions for ${node?.name || "folder"}`}
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          >
            onClick={((event: any) => event.stopPropagation()) as any}

            <div className="sx-menu-heading" title={node?.name}>
              {node?.name}
            </div>

            {items.map(({ key, label, Icon, hint, danger }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                className={`sx-menu-item${danger ? " is-danger" : ""}`}
                onClick={(event) => runAction(event, key)}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="sx-menu-item-label">{label}</span>
                {hint && <span className="sx-menu-item-hint">{hint}</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

export default FolderContextMenu;
