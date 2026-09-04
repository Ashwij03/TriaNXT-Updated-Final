import React from "react";
import {
  MdPerson,
  MdFolderOpen,
  MdInsertDriveFile,
  MdStorage,
  MdClose,
  MdInfoOutline,
} from "react-icons/md";

import { formatFileSize } from "./fileService";

/**
 * Subject Explorer - SELECTED FOLDER BAR (Phase 5)
 *
 * The workspace context strip that sits between the toolbar and the file
 * manager: which folder is active, where it sits in the tree, how many files
 * it holds and how large they are.
 *
 * This is the visible answer to "show the selected folder name and file
 * count". Purely presentational - every value is passed in.
 *
 * Props
 *   folder     selected node ({ id, name, type }) or null
 *   path       "SUB-001 / Screening"
 *   fileCount  files in this folder
 *   totalSize  bytes in this folder
 *   onClear    () => void   clears the selection
 */
function SelectedFolderBar({
  folder,
  path = "",
  fileCount = 0,
  totalSize = 0,
  onClear,
}: any) {
  /* Nothing selected - prompt rather than render an empty strip. */
  if (!folder) {
    return (
      <div className="sw-folderbar sw-folderbar--empty" role="status">
        <span className="sw-folderbar-icon" aria-hidden="true">
          <MdInfoOutline size={16} />
        </span>
        <div className="sw-folderbar-text">
          <strong>No folder selected</strong>
          <span>
            Pick a subject or folder in the Subject Explorer to load its files.
          </span>
        </div>
      </div>
    );
  }

  const isSubject = folder.type === "subject";
  const FolderIcon = isSubject ? MdPerson : MdFolderOpen;

  return (
    <div
      className="sw-folderbar"
      role="status"
      aria-label={`Selected folder: ${folder.name}, ${fileCount} ${
        fileCount === 1 ? "file" : "files"
      }`}
    >
      <span
        className={`sw-folderbar-icon${isSubject ? " is-subject" : ""}`}
        aria-hidden="true"
      >
        <FolderIcon size={16} />
      </span>

      <div className="sw-folderbar-text">
        <div className="sw-folderbar-title">
          <strong title={folder.name}>{folder.name}</strong>
          <span className="sw-folderbar-kind">
            {isSubject ? "Subject" : "Folder"}
          </span>
        </div>

        {path && path !== folder.name && (
          <span className="sw-folderbar-path" title={path}>
            {path}
          </span>
        )}
      </div>

      <div className="sw-folderbar-stats">
        <span className="sw-folderbar-stat">
          <MdInsertDriveFile size={13} aria-hidden="true" />
          <strong>{fileCount}</strong>
          {fileCount === 1 ? "file" : "files"}
        </span>

        <span className="sw-folderbar-stat">
          <MdStorage size={13} aria-hidden="true" />
          <strong>{formatFileSize(totalSize)}</strong>
        </span>
      </div>

      {typeof onClear === "function" && (
        <button
          type="button"
          className="sw-folderbar-clear"
          onClick={onClear}
          aria-label="Clear folder selection"
          title="Clear folder selection"
        >
          <MdClose size={14} />
          <span>Clear</span>
        </button>
      )}
    </div>
  );
}

export default SelectedFolderBar;
