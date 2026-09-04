import React from "react";
import { FiFolder, FiChevronRight } from "react-icons/fi";
import FolderOptionsMenu from "./FolderOptionsMenu";
import "./FolderColumnView.css";

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    if (node.children?.length) {
      const found = findNode(node.children, id);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export default function FolderColumnView({
  tree,
  navigationPath,
  enterFolder,
  goToBreadcrumbIndex,
  selectedFolderId,
  canModify,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onUploadFolder,
  onDownloadFolder
}: any) {
  const root = tree[0];
  const columns = [];

  if (root) {
    columns.push({
      parentId: root.id,
      folders: root.children || []
    });
  }

  for (let index = 1; index < navigationPath.length; index += 1) {
    const node = findNode(tree, navigationPath[index]);

    if (!node) {
      break;
    }

    columns.push({
      parentId: node.id,
      folders: node.children || []
    });
  }

  return (
    <div className="dfm-column-view">
      <div className="dfm-column-breadcrumb">
        {navigationPath.map((id, index) => {
          const node = findNode(tree, id);

          if (!node) {
            return null;
          }

          return (
            <React.Fragment key={id}>
              {index !== 0 && <FiChevronRight />}
              <button type="button" onClick={() => goToBreadcrumbIndex(index)}>
                {node.name}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="dfm-columns">
        {columns.map((column, level) => (
          <div key={`${column.parentId}-${level}`} className="dfm-column">
            {column.folders.length === 0 && (
              <p className="dfm-column-empty">No subfolders</p>
            )}

            {column.folders.map((folder) => {
              const isActive =
                navigationPath[level + 1] === folder.id ||
                (level === columns.length - 1 &&
                  selectedFolderId === folder.id &&
                  !navigationPath[level + 1]);

              return (
                <div
                  key={folder.id}
                  className={`dfm-column-folder${isActive ? " active" : ""}`}
                  onClick={() => enterFolder(folder.id)}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <FiFolder />
                  <span>{folder.name}</span>
                  <FolderOptionsMenu
                    folderId={folder.id}
                    folderName={folder.name}
                    disabled={!canModify}
                    onCreate={onAddFolder}
                    onRename={onRenameFolder}
                    onDelete={onDeleteFolder}
                    onUpload={onUploadFolder}
                    onDownload={onDownloadFolder}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
