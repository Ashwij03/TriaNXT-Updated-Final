import { useEffect, useRef, useState } from "react";
import { FiMoreVertical } from "react-icons/fi";
import "./FolderOptionsMenu.css";

const MENU_ITEMS = [
  { key: "create", label: "Create New Folder" },
  { key: "rename", label: "Rename Folder" },
  { key: "delete", label: "Delete Folder" },
  { key: "upload", label: "Upload Folder" },
  { key: "download", label: "Download Folder" }
];

export default function FolderOptionsMenu({
  folderId,
  folderName,
  disabled = false,
  onCreate,
  onRename,
  onDelete,
  onUpload,
  onDownload,
  className = ""
}: any) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const runAction = (action) => {
    setOpen(false);

    if (action === "create") {
      onCreate?.(folderId);
    } else if (action === "rename") {
      onRename?.(folderId);
    } else if (action === "delete") {
      onDelete?.(folderId);
    } else if (action === "upload") {
      onUpload?.(folderId);
    } else if (action === "download") {
      onDownload?.(folderId);
    }
  };

  const openMenuAt = (clientX, clientY) => {
    if (disabled) {
      return;
    }

    setMenuPosition({
      top: clientY,
      left: clientX
    });
    setOpen(true);
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    openMenuAt(event.clientX, event.clientY);
  };

  const handleToggleMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    openMenuAt(rect.right - 180, rect.bottom + 4);
  };

  if (disabled) {
    return null;
  }

  return (
    <div
      className={`folder-options-menu ${className}`}
      onContextMenu={handleContextMenu}
      ref={menuRef}
    >
      <button
        type="button"
        className="folder-options-trigger"
        aria-label={`Folder options for ${folderName || "folder"}`}
        onClick={handleToggleMenu}
      >
        <FiMoreVertical />
      </button>

      {open && (
        <div
          className="folder-options-dropdown"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          role="menu"
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                runAction(item.key);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
