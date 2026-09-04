import { useState, useMemo, useCallback } from "react";

export default function useSearch(documents: any = []) {
  const [searchTerm, setSearchTerm] = useState("");

  const safeDocuments = useMemo(
    () => (Array.isArray(documents) ? documents : []),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return safeDocuments;
    }

    return safeDocuments.filter((document) =>
      [
        document.documentName,
        document.name,
        document.status,
        document.category,
        document.documentType,
        document.description,
        document.createdBy,
        document.uploadedBy,
        document.fileName,
        document.version?.toString(),
      ]
        .filter(Boolean)
        .some((value) =>
          value.toString().toLowerCase().includes(query)
        )
    );
  }, [safeDocuments, searchTerm]);

  const hasSearch = searchTerm.trim().length > 0;

  const resultCount = filteredDocuments.length;

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  return {
    searchTerm,
    setSearchTerm,

    filteredDocuments,

    hasSearch,
    resultCount,

    clearSearch,
  };
}
