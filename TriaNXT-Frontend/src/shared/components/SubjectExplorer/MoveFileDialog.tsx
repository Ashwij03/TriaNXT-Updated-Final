import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Move File Dialog — picks a destination folder from the folder tree.
 *
 * Props
 *   file             file record being moved
 *   tree             full folder tree (array of nodes with children)
 *   currentFolderId  the folder the file is currently in (excluded from choices)
 *   onSubmit         (targetFolderId) => void
 *   submitError      string error to display
 *   onClose          () => void
 */

function flattenFolders(nodes, excludeId, depth = 0) {
  const result = [];
  for (const node of nodes || []) {
    if (node.type === "subject") {
      // For subject nodes, list the subject itself as a target and recurse
      if (node.id !== excludeId) {
        result.push({ id: node.id, name: node.name, depth });
      }
      if (node.children) {
        result.push(...flattenFolders(node.children, excludeId, depth + 1));
      }
    } else if (node.type === "folder") {
      if (node.id !== excludeId) {
        result.push({ id: node.id, name: node.name, depth });
      }
      if (node.children) {
        result.push(...flattenFolders(node.children, excludeId, depth + 1));
      }
    }
  }
  return result;
}

export default function MoveFileDialog({
  file,
  tree,
  currentFolderId,
  onSubmit,
  submitError,
  onClose,
}: any) {
  const [selectedId, setSelectedId] = useState(null);
  const overlayRef = useRef(null);

  const folders = flattenFolders(tree, currentFolderId);

  const handleSubmit = useCallback(() => {
    if (!selectedId) return;
    onSubmit(selectedId);
  }, [selectedId, onSubmit]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      ref={overlayRef}
      className="sxm-overlay"
      onClick={onClose}
    >
      <div
        className="sxm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Move file"
      >
        <div className="sxm-header">
          <h3>Move "{file?.name}"</h3>
          <button type="button" className="sxm-close" onClick={onClose}>✕</button>
        </div>

        <div className="sxm-body">
          <label className="sxm-field">
            <span>Select destination folder</span>
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              aria-label="Destination folder"
            >
              <option value="">— Choose a folder —</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"  ".repeat(folder.depth)}{folder.name}
                </option>
              ))}
            </select>
          </label>

          {submitError && (
            <div className="sf-alert sf-alert--error" role="alert">
              <span className="sf-alert-message">{submitError}</span>
            </div>
          )}
        </div>

        <div className="sxm-footer">
          <button type="button" className="sxm-btn sxm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="sxm-btn sxm-btn--primary"
            disabled={!selectedId}
            onClick={handleSubmit}
          >
            Move
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
