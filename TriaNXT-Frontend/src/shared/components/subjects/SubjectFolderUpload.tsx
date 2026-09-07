import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MdClose,
  MdCloudUpload,
  MdFolderZip,
  MdCheckCircle,
  MdErrorOutline,
  MdInsertDriveFile,
  MdFolderCopy,
} from "react-icons/md";

import { formatFileSize } from "../SubjectExplorer/fileService";
import {
  FOLDER_UPLOAD_LIMITS,
  buildFolderUploadPlan,
  collectFilesFromDataTransfer,
  collectFilesFromFileList,
  commitFolderUploadPlan,
} from "./folderUploadUtils";
import "./SubjectFolderUpload.css";

/**
 * Subject Explorer - BULK FOLDER UPLOAD
 * =====================================
 *
 * Lets a user drop (or pick via `webkitdirectory`) an entire local directory
 * tree and recreates it as nested folders/files under the currently selected
 * subject folder. The walk + plan + commit live in `folderUploadUtils` (pure
 * and unit-tested); this component owns only the UX states:
 *
 *   pick  ->  review (summary + skipped reasons)  ->  committing (progress)
 *        ->  done
 *
 * The ICF guarantee comes from the planner: a dropped folder named "ICF"
 * (or files dropped straight onto the existing locked ICF folder) merges
 * into the subject's single locked ICF folder and never creates a second,
 * unlocked one.
 *
 * Props
 *   studyId        study whose tree/files the upload targets
 *   tree           live explorer tree (folderTreeService) for the study
 *   targetFolderId node the upload lands in (a subject or one of its folders)
 *   readOnly       disables the whole flow
 *   onClose        called when the user dismisses the dialog
 */

function formatBytes(bytes) {
  return formatFileSize(bytes);
}

function SubjectFolderUpload({
  studyId,
  tree = [],
  targetFolderId,
  targetLabel = "",
  readOnly = false,
  onClose,
}: any) {
  const inputRef = useRef(null);
  const [collected, setCollected] = useState([]); // [{ file, path }]
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null); // { ok, error?, foldersCreated, filesAdded, rejected, totalFiles }
  const [error, setError] = useState("");

  /* ---------- reset on open ---------- */
  useEffect(() => {
    if (studyId && targetFolderId) {
      setCollected([]);
      setCommitting(false);
      setProgress({ done: 0, total: 0 });
      setResult(null);
      setError("");
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }, [studyId, targetFolderId]);

  const resetDrag = useCallback(() => {
    dragDepth.current = 0;
    setIsDragging(false);
  }, []);

  /* ---------- drag events (depth counter prevents flicker) ---------- */
  const handleDragEnter = (event) => {
    event.preventDefault();
    if (readOnly || committing) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (readOnly || committing) return;
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    if (readOnly || committing) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    resetDrag();
    if (readOnly || committing) return;

    const files = await collectFilesFromDataTransfer(event.dataTransfer);
    if (files.length > 0) setCollected(files);
  };

  const handlePick = (event) => {
    const { files } = event.target;
    if (files && files.length > 0) {
      setCollected(collectFilesFromFileList(files));
    }
    event.target.value = "";
  };

  /* ---------- review data (pure, computed from the live tree) ---------- */
  const plan = useMemo(
    () =>
      studyId && targetFolderId
        ? buildFolderUploadPlan({ tree, targetFolderId, collected })
        : null,
    [studyId, targetFolderId, tree, collected]
  );

  const overFileLimit = (plan?.entries.length || 0) > FOLDER_UPLOAD_LIMITS.maxFiles;
  const overByteLimit = (plan?.totalBytes || 0) > FOLDER_UPLOAD_LIMITS.maxTotalBytes;

  const blockReason = overFileLimit
    ? `Too many files: this upload has ${plan.entries.length}, the limit is ${FOLDER_UPLOAD_LIMITS.maxFiles}.`
    : overByteLimit
      ? `Total size ${formatBytes(plan.totalBytes)} exceeds the ${formatBytes(
          FOLDER_UPLOAD_LIMITS.maxTotalBytes
        )} limit for one upload.`
      : "";

  const resetAll = () => {
    setCollected([]);
    setResult(null);
    setError("");
    setProgress({ done: 0, total: 0 });
  };

  /* ---------- commit ---------- */
  const handleCommit = async () => {
    if (!plan || plan.entries.length === 0 || blockReason) return;

    setCommitting(true);
    setError("");

    const currentTree = Array.isArray(tree) && tree.length ? tree : [];
    const freshPlan = buildFolderUploadPlan({
      tree: currentTree,
      targetFolderId,
      collected,
    });

    const outcome = await commitFolderUploadPlan({
      studyId,
      tree: currentTree,
      plan: freshPlan,
      uploadedBy:
        localStorage.getItem("currentUserName") ||
        localStorage.getItem("currentUserFullName") ||
        "Current User",
      onProgress: (next) => setProgress(next),
    });

    setCommitting(false);

    if (!outcome.ok) {
      setError(outcome.error || "The folder upload failed.");
      return;
    }

    setResult(outcome);
  };

  const hasFiles = (collected || []).length > 0;
  const canCommit = Boolean(
    plan && plan.entries.length > 0 && !committing && !blockReason && !readOnly
  );

  const close = () => {
    if (committing) return;
    if (typeof onClose === "function") onClose();
  };

  return (
    <div
      className="sfu-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="sfu-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Upload a folder into the selected subject folder"
      >
        <div className="sfu-header">
          <div className="sfu-header-text">
            <h3>Upload Folder</h3>
            <p>
              Into {targetLabel || "the selected folder"} — folders and files
              are recreated with the same structure.
            </p>
          </div>
          <button
            type="button"
            className="sfu-close"
            onClick={close}
            disabled={committing}
            aria-label="Close folder upload"
          >
            <MdClose size={18} />
          </button>
        </div>

        {!result ? (
          <>
            {/* ================= DROP / PICK ================= */}
            <div
              className={`sfu-dropzone${isDragging ? " is-dragging" : ""}${
                readOnly || committing ? " is-disabled" : ""
              }`}
              role="button"
              tabIndex={readOnly || committing ? -1 : 0}
              aria-disabled={readOnly || committing}
              aria-label="Drop a folder here, or click to browse folders"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!readOnly && !committing) inputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (
                  (event.key === "Enter" || event.key === " ") &&
                  !readOnly &&
                  !committing
                ) {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
            >
              <span className="sfu-dropzone-icon" aria-hidden="true">
                <MdCloudUpload size={30} />
              </span>
              <strong>
                {committing
                  ? "Uploading…"
                  : isDragging
                    ? "Drop the folder here"
                    : "Drag & drop a folder here"}
              </strong>
              <span>
                or click to browse · hidden files are skipped · nested folders
                are preserved
              </span>
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              className="sfu-file-input"
              {...({ webkitdirectory: "", directory: "" } as any)}
              onChange={handlePick}
            />

            {/* ================= REVIEW SUMMARY ================= */}
            {hasFiles && plan && (
              <div className="sfu-review">
                <div className="sfu-review-stats">
                  <span className="sfu-stat">
                    <MdFolderZip size={15} aria-hidden="true" />
                    <strong>{plan.entries.length}</strong> files
                  </span>
                  <span className="sfu-stat">
                    <MdFolderCopy size={15} aria-hidden="true" />
                    <strong>
                      {plan.foldersToCreate.length + plan.reusedFolderIds.length}
                    </strong>{" "}
                    folders
                    {plan.foldersToCreate.length > 0 &&
                      ` (${plan.foldersToCreate.length} new)`}
                  </span>
                  <span className="sfu-stat">
                    <MdInsertDriveFile size={15} aria-hidden="true" />
                    <strong>{formatBytes(plan.totalBytes)}</strong> total
                  </span>
                  {plan.mergeIntoIcf && (
                    <span className="sfu-stat sfu-stat--icf">
                      Merging into the subject’s locked ICF folder
                    </span>
                  )}
                </div>

                {plan.skipped.length > 0 && (
                  <details className="sfu-skipped">
                    <summary>
                      <span>
                        {plan.skipped.length} file
                        {plan.skipped.length === 1 ? "" : "s"} skipped
                      </span>
                    </summary>
                    <ul>
                      {plan.skipped.slice(0, 50).map((item, index) => (
                        <li key={`${item.name}-${index}`}>
                          <strong>{item.name}</strong> — {item.reason}
                        </li>
                      ))}
                      {plan.skipped.length > 50 && (
                        <li>… and {plan.skipped.length - 50} more</li>
                      )}
                    </ul>
                  </details>
                )}

                {blockReason && (
                  <p className="sfu-block-reason" role="alert">
                    <MdErrorOutline size={15} aria-hidden="true" />
                    {blockReason}
                  </p>
                )}

                {error && (
                  <p className="sfu-error" role="alert">
                    <MdErrorOutline size={15} aria-hidden="true" />
                    {error}
                  </p>
                )}

                {committing && (
                  <div className="sfu-progress" role="status" aria-live="polite">
                    <div className="sfu-progress-track" aria-hidden="true">
                      <div
                        className="sfu-progress-fill"
                        style={{
                          width: `${
                            progress.total
                              ? Math.round((progress.done / progress.total) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span>
                      {progress.done} of {progress.total} files saved
                    </span>
                  </div>
                )}

                <div className="sfu-actions">
                  <button
                    type="button"
                    className="sf-btn sf-btn--ghost"
                    onClick={resetAll}
                    disabled={committing}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="sf-btn sf-btn--primary"
                    onClick={handleCommit}
                    disabled={!canCommit}
                  >
                    {committing ? "Uploading…" : "Upload Folder"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ================= DONE ================= */
          <div className="sfu-done">
            <span
              className={`sfu-done-icon${
                result.ok ? " is-success" : " is-error"
              }`}
              aria-hidden="true"
            >
              {result.ok ? <MdCheckCircle size={34} /> : <MdErrorOutline size={34} />}
            </span>

            <h4>{result.ok ? "Folder uploaded" : "Upload failed"}</h4>
            <p>
              {result.ok
                ? `${result.foldersCreated} folder${
                    result.foldersCreated === 1 ? "" : "s"
                  } and ${result.filesAdded} file${
                    result.filesAdded === 1 ? "" : "s"
                  } added${
                    result.rejected?.length
                      ? ` · ${result.rejected.length} skipped`
                      : ""
                  }.`
                : result.error || "Something went wrong."}
            </p>

            {result.rejected?.length > 0 && (
              <details className="sfu-skipped">
                <summary>
                  {result.rejected.length} file
                  {result.rejected.length === 1 ? "" : "s"} skipped
                </summary>
                <ul>
                  {result.rejected.slice(0, 20).map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      <strong>{item.name}</strong> — {item.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="sfu-actions">
              <button
                type="button"
                className="sf-btn sf-btn--ghost"
                onClick={resetAll}
              >
                Upload another folder
              </button>
              <button
                type="button"
                className="sf-btn sf-btn--primary"
                onClick={close}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SubjectFolderUpload;
