import React from "react";
import {
  MdFolderCopy,
  MdInsertDriveFile,
  MdCloudQueue,
  MdPeopleOutline,
} from "react-icons/md";

import { formatFileSize } from "./fileService";

/**
 * Subject Explorer - FOLDER STATISTICS (Phase 6, requirement 2)
 *
 * Four-tile summary strip: total folders, total files, storage used (with a
 * usage bar against the mock quota) and total subjects.
 *
 * Purely presentational - every number is computed by folderStatsService and
 * passed in, so this renders identically for the whole-workspace scope and
 * for a single selected folder's subtree.
 *
 * Props
 *   stats  { totalFolders, totalSubjects, totalFiles, storageUsed, quota, usedPercent }
 *   scope  "workspace" | "folder"   drives the tile captions
 *   label  folder name, shown when scope === "folder"
 *   loading  render skeleton tiles instead of values
 */
function FolderStatsBar({ stats, scope = "workspace", label = "", loading = false }: any) {
  const {
    totalFolders = 0,
    totalSubjects = 0,
    totalFiles = 0,
    storageUsed = 0,
    quota = 0,
    usedPercent = 0,
  } = stats || {};

  const inFolder = scope === "folder";

  const tiles = [
    {
      key: "folders",
      Icon: MdFolderCopy,
      tone: "folders",
      value: totalFolders,
      label: totalFolders === 1 ? "Folder" : "Folders",
      caption: inFolder ? "Inside this folder" : "Across all subjects",
    },
    {
      key: "files",
      Icon: MdInsertDriveFile,
      tone: "files",
      value: totalFiles,
      label: totalFiles === 1 ? "File" : "Files",
      caption: inFolder ? "In this folder tree" : "Across the workspace",
    },
    {
      key: "storage",
      Icon: MdCloudQueue,
      tone: "storage",
      value: formatFileSize(storageUsed),
      label: "Storage Used",
      caption: quota ? `of ${formatFileSize(quota)} allowance` : "Total size",
      bar: Math.max(storageUsed > 0 ? 2 : 0, usedPercent),
    },
    {
      key: "subjects",
      Icon: MdPeopleOutline,
      tone: "subjects",
      value: totalSubjects,
      label: totalSubjects === 1 ? "Subject" : "Subjects",
      caption: inFolder ? "Nested subjects" : "With document folders",
    },
  ];

  return (
    <section
      className="sf-stats"
      aria-label={
        inFolder && label
          ? `Document statistics for ${label}`
          : "Workspace document statistics"
      }
    >
      {tiles.map(({ key, Icon, tone, value, label: tileLabel, caption, bar }) => (
        <article
          key={key}
          className={`sf-stat-tile sf-stat-tile--${tone}${
            loading ? " is-loading" : ""
          }`}
          /* One label per tile: screen readers announce "12 Files" rather
             than reading the value and label as two unrelated fragments. */
          aria-label={loading ? `${tileLabel}, loading` : `${value} ${tileLabel}`}
          aria-busy={loading ? "true" : undefined}
        >
          <span className="sf-stat-icon" aria-hidden="true">
            <Icon size={17} />
          </span>

          <div className="sf-stat-body" aria-hidden={loading ? "true" : undefined}>
            <div className="sf-stat-value">
              {loading ? <span className="sf-skeleton sf-skeleton--value" /> : value}
            </div>
            <div className="sf-stat-label">{tileLabel}</div>

            {typeof bar === "number" && !loading ? (
              <div
                className="sf-stat-bar"
                role="progressbar"
                aria-valuenow={Math.round(usedPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Storage used"
              >
                <span
                  className="sf-stat-bar-fill"
                  style={{ width: `${Math.min(100, bar)}%` }}
                />
              </div>
            ) : (
              <div className="sf-stat-caption">{caption}</div>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

export default React.memo(FolderStatsBar);
