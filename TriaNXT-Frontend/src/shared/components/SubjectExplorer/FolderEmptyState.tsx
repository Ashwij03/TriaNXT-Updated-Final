import React from "react";
import {
  MdCloudUpload,
  MdCreateNewFolder,
  MdSearchOff,
  MdFilterAltOff,
  MdTopic,
  MdDescription,
  MdVerifiedUser,
  MdScience,
} from "react-icons/md";

import FileUploadButton from "./FileUploadButton";
import DragDropUpload from "./DragDropUpload";

/**
 * Subject Explorer - EMPTY STATES (Phase 6, requirement 3)
 *
 * One component, three variants, so every empty surface in the file area
 * shares the same spacing, iconography and tone:
 *
 *   "empty"    folder genuinely has no files -> Upload + Create Folder
 *              actions, a drop zone, and hints about what belongs here
 *   "search"   text search excluded everything -> offer to clear the search
 *   "filtered" advanced filters excluded everything -> offer to clear filters
 *
 * Phase 4 shipped a basic "empty" and "search" state inside SubjectFileTable;
 * this supersedes both with the enterprise treatment and adds the filtered
 * case that Phase 6's filters make reachable.
 *
 * Props
 *   variant        "empty" | "search" | "filtered"
 *   folderName     selected folder name
 *   totalInFolder  unfiltered count (shown in the search/filter copy)
 *   onUpload       (FileList) => void
 *   onCreateFolder () => void      omitted -> the button is hidden
 *   onClearSearch  () => void
 *   onClearFilters () => void
 *   uploading      upload in flight
 *   canUpload      a folder is selected
 */

/** Document categories hinted at in the empty state. */
const HINTS = [
  { Icon: MdVerifiedUser, label: "Consent forms" },
  { Icon: MdScience, label: "Lab reports" },
  { Icon: MdDescription, label: "Visit records" },
  { Icon: MdTopic, label: "Source data" },
];

function FolderEmptyState({
  variant = "empty",
  folderName = "",
  totalInFolder = 0,
  onUpload,
  onCreateFolder,
  onClearSearch,
  onClearFilters,
  uploading = false,
  canUpload = true,
}: any) {
  /* ---------- search returned nothing ---------- */
  if (variant === "search") {
    return (
      <div className="sf-empty-state sf-empty-state--search" role="status">
        <span className="sf-empty-icon" aria-hidden="true">
          <MdSearchOff size={26} />
        </span>

        <h3>No matching files</h3>
        <p>
          No file in this folder matches your search. Try a different term, or
          clear the search to see all {totalInFolder}{" "}
          {totalInFolder === 1 ? "file" : "files"}.
        </p>

        <div className="sf-empty-actions">
          <button
            type="button"
            className="sf-btn sf-btn--ghost"
            onClick={onClearSearch}
          >
            <MdSearchOff size={15} aria-hidden="true" />
            <span>Clear Search</span>
          </button>
        </div>
      </div>
    );
  }

  /* ---------- filters excluded everything ---------- */
  if (variant === "filtered") {
    return (
      <div className="sf-empty-state sf-empty-state--filtered" role="status">
        <span className="sf-empty-icon" aria-hidden="true">
          <MdFilterAltOff size={26} />
        </span>

        <h3>No files match these filters</h3>
        <p>
          {totalInFolder} {totalInFolder === 1 ? "file is" : "files are"} in this
          folder, but none match the active type, date and size filters.
        </p>

        <div className="sf-empty-actions">
          <button
            type="button"
            className="sf-btn sf-btn--ghost"
            onClick={onClearFilters}
          >
            <MdFilterAltOff size={15} aria-hidden="true" />
            <span>Clear Filters</span>
          </button>
        </div>
      </div>
    );
  }

  /* ---------- folder genuinely empty (requirement 3) ---------- */
  return (
    <div className="sf-empty-state sf-empty-state--folder">
      <span className="sf-empty-illustration" aria-hidden="true">
        <MdCloudUpload size={30} />
      </span>

      <h3>
        {folderName ? `"${folderName}" is empty` : "No files in this folder"}
      </h3>
      <p>
        Upload subject documents to keep this folder complete and inspection
        ready, or add a subfolder to organise them by visit or category.
      </p>

      <div className="sf-empty-actions">
        <FileUploadButton
          onFiles={onUpload}
          disabled={!canUpload}
          busy={uploading}
          label="Upload Files"
        />

        {typeof onCreateFolder === "function" && (
          <button
            type="button"
            className="sf-btn sf-btn--ghost"
            onClick={onCreateFolder}
            disabled={!canUpload}
          >
            <MdCreateNewFolder size={16} aria-hidden="true" />
            <span>Create Folder</span>
          </button>
        )}
      </div>

      <DragDropUpload
        onFiles={onUpload}
        disabled={!canUpload}
        busy={uploading}
        compact
      />

      <ul className="sf-empty-hints" aria-label="Typical documents">
        {HINTS.map(({ Icon, label }) => (
          <li key={label} className="sf-empty-hint">
            <Icon size={14} aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default React.memo(FolderEmptyState);
