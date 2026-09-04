import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MdChevronRight,
  MdPerson,
  MdFolder,
  MdFolderOpen,
  MdLock,
} from "react-icons/md";

import FolderContextMenu from "./FolderContextMenu";

/**
 * Subject Explorer - recursive tree node.
 *
 * Renders one subject/folder row and (when expanded) its children.
 * Selection + expansion state are owned by SubjectExplorer; this
 * component only renders and reports intent upward.
 *
 * Phase 3: each row also carries a three-dot FolderContextMenu. The menu
 * only reports the action (`onNodeAction`) - all folder CRUD is handled by
 * SubjectExplorer through FolderTreeService.
 *
 * Phase 7 (polish only - no behaviour change):
 *   - wrapped in React.memo, so selecting a folder only re-renders the rows
 *     whose props actually changed instead of the whole subtree
 *   - handlers are stable via useCallback
 *   - full arrow-key navigation (Up/Down/Left/Right/Home/End) and the
 *     `is-on-active-path` marker for ancestors of the selected node
 *   - the selected row scrolls itself into view when the selection is
 *     restored from storage on load
 *
 * Phase 10 (visual only - no behaviour change): indentation and row sizing
 * were retuned in SubjectExplorer.css to match the eISF sidebar's visual
 * hierarchy/spacing (base offset + per-level step, flat bordered rows,
 * active blue fill). This component has no eISF import or dependency -
 * only its own class names changed meaning via the stylesheet.
 *
 * Phase 11 (no change in this file): FolderContextMenu now also renders an
 * always-visible "+" action for subject rows (eISF "+" interaction
 * pattern), rendered inline with the existing three-dot trigger below.
 * Nothing here needed to change - this component already forwards
 * `onNodeAction` straight through as FolderContextMenu's `onAction`, which
 * is the same callback the new "+" button uses.
 *
 * Props
 *   node, depth, expandedIds, selectedId
 *   activePathIds  ids of the selected node's ancestors (branch marker)
 *   onToggle, onSelect, onNodeAction
 */

/**
 * Move focus to the previous/next visible row.
 *
 * The rendered rows are already in document order, so a flat query is both
 * simpler and cheaper than walking the tree. Collapsed branches stay in the
 * DOM for the height animation, so they are filtered out by offsetParent.
 */
function focusSiblingRow(fromEl, direction) {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>(".sx-explorer .sx-row")
  ).filter((row) => row.offsetParent !== null);

  const index = rows.indexOf(fromEl);
  if (index === -1) return;

  const next = rows[index + direction];
  if (next) next.focus();
}

function focusEdgeRow(edge) {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>(".sx-explorer .sx-row")
  ).filter((row) => row.offsetParent !== null);

  const target = edge === "first" ? rows[0] : rows[rows.length - 1];
  if (target) target.focus();
}

function SubjectTreeNode({
  node,
  depth = 0,
  expandedIds,
  selectedId,
  activePathIds,
  onToggle,
  onSelect,
  onNodeAction,
  readOnly = false,
}: any) {
  // Keeps the row's action button visible while its menu is open.
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef(null);

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = hasChildren && expandedIds.includes(node.id);
  const isSelected = selectedId === node.id;
  const isSubject = node.type === "subject";
  const isOnActivePath = Boolean(activePathIds?.includes(node.id));
  /* Update 7: the system ICF folder - view/open only, no rename/delete,
     and no context menu at all (nothing in it would ever be actionable). */
  const isLocked = Boolean(node.locked);

  /**
   * Reveal the active row once, when it becomes selected. Guarded on
   * isSelected so scrolling only ever happens for the one active row (this
   * is what makes a folder restored from storage visible on first paint).
   */
  useEffect(() => {
    if (!isSelected) return;

    const row = rowRef.current;
    // Feature-detected: not every host environment implements it.
    if (typeof row?.scrollIntoView !== "function") return;

    row.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [isSelected]);

  const handleRowClick = useCallback(() => {
    onSelect(node);
    if (hasChildren) onToggle(node.id);
  }, [node, hasChildren, onSelect, onToggle]);

  const handleKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          handleRowClick();
          break;

        case "ArrowRight":
          if (hasChildren && !isExpanded) {
            event.preventDefault();
            onToggle(node.id);
          }
          break;

        case "ArrowLeft":
          if (hasChildren && isExpanded) {
            event.preventDefault();
            onToggle(node.id);
          }
          break;

        case "ArrowDown":
          event.preventDefault();
          focusSiblingRow(event.currentTarget, 1);
          break;

        case "ArrowUp":
          event.preventDefault();
          focusSiblingRow(event.currentTarget, -1);
          break;

        case "Home":
          event.preventDefault();
          focusEdgeRow("first");
          break;

        case "End":
          event.preventDefault();
          focusEdgeRow("last");
          break;

        default:
          break;
      }
    },
    [handleRowClick, hasChildren, isExpanded, node.id, onToggle]
  );

  // Indentation is applied via padding so the row background still spans
  // the full row width at every depth. Base offset (18px) and per-level
  // step (32px) mirror the spacing between eISF's top-level module row
  // and its nested section rows (.eisf-menu-label / .eisf-child-item).
  const rowStyle = { paddingLeft: 18 + depth * 32 };

  const NodeIcon = isSubject
    ? MdPerson
    : isExpanded
    ? MdFolderOpen
    : MdFolder;

  const childCountLabel = hasChildren
    ? `${node.children.length} item${node.children.length === 1 ? "" : "s"}`
    : "";

  return (
    <li className="sx-node" role="none">
      <div
        ref={rowRef}
        className={[
          "sx-row",
          isSubject ? "sx-row--subject" : "sx-row--folder",
          isSelected ? "is-selected" : "",
          isOnActivePath ? "is-on-active-path" : "",
          isExpanded ? "is-expanded" : "",
          menuOpen ? "is-menu-open" : "",
          isLocked ? "is-locked" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={rowStyle}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        aria-level={depth + 1}
        aria-label={
          childCountLabel
            ? `${node.name}, ${isSubject ? "subject" : "folder"}, ${childCountLabel}`
            : `${node.name}, ${isSubject ? "subject" : "folder"}`
        }
        /* Only the active row is in the tab order; the arrow keys move
           focus within the tree (standard tree-view pattern). */
        tabIndex={isSelected || (!selectedId && depth === 0) ? 0 : -1}
        title={node.name}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
      >
        {hasChildren ? (
          <span
            className={`sx-caret${isExpanded ? " is-open" : ""}`}
            aria-hidden="true"
          >
            <MdChevronRight size={14} />
          </span>
        ) : (
          <span className="sx-caret sx-caret--empty" aria-hidden="true" />
        )}

        <NodeIcon size={15} className="sx-node-icon" aria-hidden="true" />

        <span className="sx-node-label">{node.name}</span>

        {hasChildren && (
          <span className="sx-node-badge" aria-hidden="true">
            {node.children.length}
          </span>
        )}

        {/* Update (this fix): the lock badge and, for an unlocked folder,
            the "..." trigger both live inside a dedicated actions cluster
            that stops its own clicks here - so a click anywhere in this
            trailing zone (the badge itself, its padding, or the empty
            space next to it) can never bubble up to the row's own
            `onClick` and navigate/select the folder. Folder navigation
            only ever happens through a click on the row's label/icon
            area, or through `FolderContextMenu`'s own explicit actions. */}
        <span
          className="sx-row-actions"
          onClick={(event) => event.stopPropagation()}
        >
          {isLocked && (
            <span
              className="sx-lock-badge"
              title="System folder - view only"
              aria-label="Locked folder"
            >
              <MdLock size={12} />
            </span>
          )}

          {/* Update 7: locked folders (ICF) get no context menu - view/open
              (the row click itself) is the only available action. */}
          {!isLocked && !readOnly && (
            <FolderContextMenu
              node={node}
              onAction={onNodeAction}
              onOpenChange={setMenuOpen}
            />
          )}
        </span>
      </div>

      {/* Children are kept mounted while collapsed so the max-height
          transition can animate in both directions. `hidden` keeps the
          collapsed rows out of the accessibility tree and tab order. */}
      {hasChildren && (
        <div
          className={`sx-children${isExpanded ? " is-open" : ""}`}
          aria-hidden={isExpanded ? undefined : "true"}
        >
          <ul className="sx-node-list" role="group">
            {node.children.map((child) => (
              <SubjectTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                selectedId={selectedId}
                activePathIds={activePathIds}
                onToggle={onToggle}
                onSelect={onSelect}
                onNodeAction={onNodeAction}
                readOnly={readOnly}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/**
 * Memoised so a selection change only re-renders the rows that actually
 * changed. `expandedIds` / `activePathIds` are recreated as new arrays by the
 * parent, so they are compared by content rather than by reference - without
 * this the memo would never hit.
 */
function sameIdList(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export default React.memo(SubjectTreeNode, (prev, next) => {
  return (
    prev.node === next.node &&
    prev.depth === next.depth &&
    prev.selectedId === next.selectedId &&
    prev.onToggle === next.onToggle &&
    prev.onSelect === next.onSelect &&
    prev.onNodeAction === next.onNodeAction &&
    prev.readOnly === next.readOnly &&
    sameIdList(prev.expandedIds, next.expandedIds) &&
    sameIdList(prev.activePathIds, next.activePathIds)
  );
});
