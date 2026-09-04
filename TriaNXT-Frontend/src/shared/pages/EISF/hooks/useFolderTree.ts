import { useState, useCallback } from "react";

export default function useFolderTree(initialFolder = null) {
  const [selectedFolder, setSelectedFolder] = useState(initialFolder);
  const [expandedFolders, setExpandedFolders] = useState<any[]>([]);

  const selectFolder = useCallback((folder) => {
    setSelectedFolder(folder);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFolder(null);
  }, []);

  const toggleFolder = useCallback((folderId) => {
    if (!folderId) return;

    setExpandedFolders((previous) =>
      previous.includes(folderId)
        ? previous.filter((id) => id !== folderId)
        : [...previous, folderId]
    );
  }, []);

  const expandFolder = useCallback((folderId) => {
    if (!folderId) return;

    setExpandedFolders((previous) =>
      previous.includes(folderId)
        ? previous
        : [...previous, folderId]
    );
  }, []);

  const collapseFolder = useCallback((folderId) => {
    setExpandedFolders((previous) =>
      previous.filter((id) => id !== folderId)
    );
  }, []);

  const expandAll = useCallback((folderIds = []) => {
    setExpandedFolders([...new Set<any>(folderIds)]);
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedFolders([]);
  }, []);

  const isExpanded = useCallback(
    (folderId) => expandedFolders.includes(folderId),
    [expandedFolders]
  );

  return {
    selectedFolder,
    expandedFolders,

    selectFolder,
    clearSelection,

    toggleFolder,
    expandFolder,
    collapseFolder,

    expandAll,
    collapseAll,

    isExpanded,
  };
}