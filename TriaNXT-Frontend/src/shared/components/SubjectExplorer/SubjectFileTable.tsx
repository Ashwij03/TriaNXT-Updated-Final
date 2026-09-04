import React from "react";
import { MdArrowUpward, MdArrowDownward } from "react-icons/md";

import SubjectFileRow from "./SubjectFileRow";
import FolderEmptyState from "./FolderEmptyState";

/**
 * Subject Explorer - file table (Phase 4, requirements 3, 6, 7).
 *
 * Renders the sortable header, the rows, and the two distinct empty states:
 *
 *   1. folder genuinely has no files -> professional empty state with an
 *      upload button + drop zone (requirement 7)
 *   2. folder has files but the search/filter excluded them all -> a
 *      "no matches" state that offers to clear the search instead
 *
 * Sorting is presentational here: the header reports the key and the parent
 * re-sorts through FileService.sortFiles.
 *
 * Phase 6: the three empty states are delegated to FolderEmptyState so the
 * table no longer owns that markup, and a third case is distinguished -
 * "filters excluded everything" is now separate from "search found nothing",
 * because the two need different recovery actions.
 *
 * Phase 7 (polish only): skeleton rows while a folder's files are loading,
 * an accessible <caption>, and the active-row flag passed to each row.
 *
 * Props
 *   files          rows to render (already filtered + searched + sorted)
 *   totalInFolder  unfiltered count, used to pick the empty state
 *   folderName     selected folder name (empty-state heading)
 *   sortKey        "name" | "date" | "size" | "type"
 *   sortDir        "asc" | "desc"
 *   activeFileId   id of the file whose dialog is open
 *   loading        show skeleton rows instead of content
 *   onSort         (key) => void
 *   onAction       (actionKey, file) => void
 *   onUpload       (FileList) => void
 *   onCreateFolder () => void
 *   onClearSearch  () => void
 *   onClearFilters () => void
 *   hasSearch      a search term is active
 *   hasFilters     at least one advanced filter is active
 *   uploading      upload in flight
 *   canUpload      a folder is selected
 */

/**
 * `width` drives a `<colgroup>` rendered identically above both the
 * skeleton and the populated `<tbody>` (below). With `table-layout: fixed`
 * (`SubjectFiles.css`), the `<col>` widths - not each row's own content -
 * decide every column's width, so the header and every body row are
 * guaranteed to share the exact same grid instead of drifting apart when a
 * cell's content is unusually long or short. Percentages sum to 100.
 */
/* Fix (this update): back to percentage widths that fill the table's own
   100% width (see `.sf-panel .sf-table` in SubjectFiles.css) - the
   previous fixed-px version kept the table from stretching, but left it
   noticeably narrower than the card around it. These percentages instead
   distribute the full width evenly across all 8 columns: File Name gets a
   little extra room since it is the column people scan first and its
   values are the longest, Actions stays the narrowest since it only ever
   holds one icon-sized trigger. */
/* Fix (this update): Actions widened (10% -> 14%) now that it holds
   View + Download as visible icon buttons plus the "more" trigger instead
   of a single icon - three 26px buttons need more than 10% comfortably
   gave them. Last Modified and Uploaded By each give up 2% to cover it;
   File Name is untouched. Percentages still sum to 100. */
/**
 * Fix (this update): Actions widened again (17% -> 20%) so the
 * View + Download + "more" button group always fits entirely inside its own
 * column - including at the table's reduced 560px min-width floor, where
 * 17% (~95px) left only ~70px of content width once this cell's padding
 * was subtracted, a few px short of the ~82px the three 26px buttons
 * need. Because `.sf-cell-actions` uses `overflow: visible` (so the
 * dropdown menu isn't clipped), any shortfall would spill left into the
 * Status column and make the buttons look like they live there. 20%
 * (~112px at the floor) gives the button group comfortable room. Last
 * Modified and Uploaded By each give up the difference; File Name is
 * untouched. Percentages still sum to 100. */
const COLUMNS = [
  { key: "name", label: "File Name", sortKey: "name", width: "20%" },
  { key: "type", label: "Type", sortKey: "type", width: "7%" },
  { key: "size", label: "Size", sortKey: "size", width: "8%" },
  { key: "uploaded", label: "Uploaded", sortKey: "date", width: "14%" },
  { key: "modified", label: "Last Modified", sortKey: null, width: "14%" },
  { key: "uploadedBy", label: "Uploaded By", sortKey: null, width: "10%" },
  { key: "status", label: "Status", sortKey: null, width: "7%" },
  { key: "actions", label: "Actions", sortKey: null, width: "20%" },
];

/** Shared column grid for both the skeleton table and the populated one, so
    a loading table and its resolved table never shift width. */
function SubjectFileTableColumns() {
  return (
    <colgroup>
      {COLUMNS.map(({ key, width }) => (
        <col key={key} className={`sf-col-${key}`} style={{ width }} />
      ))}
    </colgroup>
  );
}

/** Placeholder rows shown while a folder's files are being read. */
const SKELETON_ROWS = [0, 1, 2, 3, 4];

function SubjectFileTable({
  files = [],
  totalInFolder = 0,
  folderName = "",
  sortKey = "name",
  sortDir = "asc",
  activeFileId = null,
  loading = false,
  onSort,
  onAction,
  onUpload,
  onCreateFolder,
  onClearSearch,
  onClearFilters,
  hasSearch = false,
  hasFilters = false,
  uploading = false,
  canUpload = true,
  locked = false,
  canApprove = false,
}: any) {
  const isFolderEmpty = totalInFolder === 0;
  const isNarrowedEmpty = totalInFolder > 0 && files.length === 0;

  /* ---------- loading: skeleton rows keep the layout stable ---------- */
  if (loading) {
    return (
      <div className="sf-table-scroll">
        <table className="sf-table">
          <caption className="sf-sr-only">Loading files…</caption>
          <SubjectFileTableColumns />
          <thead>
            <tr>
              {COLUMNS.map(({ key, label }) => (
                <th key={key} className={`sf-th-${key}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody aria-busy="true">
            {SKELETON_ROWS.map((index) => (
              <tr className="sf-row sf-skeleton-row" key={index}>
                <td className="sf-cell-name">
                  <div className="sf-skeleton-name">
                    <span className="sf-skeleton sf-skeleton--icon" />
                    <span className="sf-skeleton sf-skeleton--text" />
                  </div>
                </td>
                {COLUMNS.slice(1).map(({ key }) => (
                  <td key={key}>
                    <span className="sf-skeleton sf-skeleton--text" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ---------- nothing in the folder at all (requirement 3) ---------- */
  if (isFolderEmpty) {
    return (
      <FolderEmptyState
        variant="empty"
        folderName={folderName}
        onUpload={onUpload}
        onCreateFolder={onCreateFolder}
        uploading={uploading}
        canUpload={canUpload}
      />
    );
  }

  /**
   * Something is in the folder but nothing survived the narrowing.
   *
   * Search is checked first: when both are active, clearing the search is the
   * smaller, more likely correction.
   */
  if (isNarrowedEmpty) {
    return (
      <FolderEmptyState
        variant={hasSearch ? "search" : hasFilters ? "filtered" : "search"}
        folderName={folderName}
        totalInFolder={totalInFolder}
        onClearSearch={onClearSearch}
        onClearFilters={onClearFilters}
      />
    );
  }

  /* ---------- populated table ---------- */
  return (
    <div className="sf-table-scroll" tabIndex={-1}>
      <table className="sf-table">
        <caption className="sf-sr-only">
          {`${files.length} of ${totalInFolder} files in ${folderName || "this folder"}`}
        </caption>
        <SubjectFileTableColumns />
        <thead>
          <tr>
            {COLUMNS.map(({ key, label, sortKey: columnSortKey }) => {
              const isActive = columnSortKey && columnSortKey === sortKey;
              const SortIcon = sortDir === "asc" ? MdArrowUpward : MdArrowDownward;

              return (
                <th
                  key={key}
                  className={[
                    `sf-th-${key}`,
                    columnSortKey ? "is-sortable" : "",
                    isActive ? "is-sorted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-sort={
                    isActive
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {columnSortKey ? (
                    <button
                      type="button"
                      className="sf-sort-btn"
                      onClick={() => onSort?.(columnSortKey)}
                      title={`Sort by ${label.toLowerCase()}`}
                      aria-label={
                        isActive
                          ? `${label}, sorted ${
                              sortDir === "asc" ? "ascending" : "descending"
                            }. Activate to reverse.`
                          : `Sort by ${label.toLowerCase()}`
                      }
                    >
                      <span>{label}</span>
                      {isActive && <SortIcon size={13} aria-hidden="true" />}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {files.map((file) => (
            <SubjectFileRow
              key={file.id}
              file={file}
              isActive={file.id === activeFileId}
              onAction={onAction}
              locked={locked}
              canApprove={canApprove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(SubjectFileTable);
