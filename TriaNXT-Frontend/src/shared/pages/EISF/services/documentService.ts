import { getEISFModuleDocuments } from "./eisfService";
import DOCUMENT_STATUS from "../Constants/documentStatus";
import { formatFileSize } from "../utils/fileUtils";
import { getStorageItem, setStorageItem } from "../utils/storageUtils";
import { filterDocuments as filterDocumentList, sortDocuments as sortDocumentList } from "../utils/searchUtils";

const DEFAULT_USER = "Current User";
export const EISF_DOCUMENTS_EVENT = "trianxt-eisf-documents-updated";

function formatDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

function safeFileName(value = "Document") {
  const name = value.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  return `${name || "Document"}.pdf`;
}

function getDocumentTitle(document: any = {}) {
  return document.documentName || document.name || "Untitled Document";
}

export function getModuleStorageKey(moduleConfig: any = {}, studyCode) {
  return `eisf:${studyCode || "default-study"}:${moduleConfig.id || "module"}:documents`;
}

export function normalizeDocument(document: any = {},section: any = {},moduleConfig: any = {}, index = 0) {
  const documentName = getDocumentTitle(document) || section.title || moduleConfig.title;
  const uploadedBy = document.uploadedBy || document.owner || document.createdBy || "Study Staff";
  const category = document.category || document.documentType || section.title || moduleConfig.title;
  const modifiedDate = document.modifiedDate || formatDate();
  const status = document.status || DOCUMENT_STATUS.DRAFT;

  const normalized = {
    ...document,
    id: document.id || `${moduleConfig.id || "module"}-${section.id || "section"}-${index + 1}`,
    moduleId: document.moduleId || moduleConfig.id,
    moduleTitle: document.moduleTitle || moduleConfig.title,
    section: document.section || document.sectionId || section.id,
    sectionId: document.sectionId || document.section || section.id,
    folderId: document.folderId || document.section || document.sectionId || section.id,
    folderTitle: document.folderTitle || section.title,
    documentName,
    name: document.name || documentName,
    description: document.description || section.description,
    category,
    documentType: document.documentType || category,
    version: document.version || "1.0",
    status,
    uploadedBy,
    createdBy: document.createdBy || uploadedBy,
    approvedBy: document.approvedBy || (status === DOCUMENT_STATUS.APPROVED ? "Principal Investigator" : "-"),
    modifiedDate,
    expiryDate: document.expiryDate || "-",
    fileName: document.fileName || safeFileName(documentName),
    fileSize: document.fileSize || "-",
  };

  return {
    ...normalized,
    history: document.history || document.versions || buildVersionHistory(normalized),
    versions: document.versions || document.history || buildVersionHistory(normalized),
    auditTrail: document.auditTrail || buildAuditTrail(normalized, "Created", "Mock document loaded."),
  };
}

export function buildVersionHistory(document: any = {}) {
  return [
    {
      version: document.version || "1.0",
      date: document.modifiedDate || formatDate(),
      user: document.uploadedBy || DEFAULT_USER,
      status: document.status || DOCUMENT_STATUS.DRAFT,
    },
  ];
}

export function buildAuditTrail(document: any = {}, action = "Updated", remarks = "Document metadata changed.") {
  return [
    {
      date: document.modifiedDate || formatDate(),
      user: document.uploadedBy || DEFAULT_USER,
      action,
      remarks,
    },
  ];
}
export function isDuplicateVersion(documents: any = [],candidate: any = {},
  studyCode = "",
  moduleId = "",
  sectionId = ""
) {
  const name = (
    candidate.documentName ||
    candidate.name ||
    ""
  )
    .trim()
    .toLowerCase();

  const version = String(candidate.version || "").trim();

  return documents.some((doc) => {
    if (candidate.id && doc.id === candidate.id) {
      return false;
    }

    return (
      (doc.studyCode || "") === studyCode &&
      (doc.moduleId || "") === moduleId &&
      (doc.section || doc.sectionId || "") === sectionId &&
(
        doc.documentName ||
        doc.name ||
        ""
      )
        .trim()
        .toLowerCase() === name &&
      String(doc.version || "").trim() === version
    );
  });
}

export function getModuleMockDocuments(moduleConfig: any = {}, initialDocuments = null) {
  const sections = Array.isArray(moduleConfig.sections) ? moduleConfig.sections : [];

  if (Array.isArray(initialDocuments)) {
    return initialDocuments.map((document, index) => {
      const section =
        sections.find((item) => item.id === document.section || item.id === document.sectionId) ||
        sections[0] ||
        { id: "default", title: moduleConfig.title };

      return normalizeDocument(document, section, moduleConfig, index);
    });
  }

  const moduleDocuments = getEISFModuleDocuments().filter(
    (document) => document.moduleId === moduleConfig.id
  );

  if (moduleDocuments.length) {
    return moduleDocuments.map((document, index) => {
      const section =
        sections.find((item) => item.id === document.section || item.id === document.sectionId) ||
        sections[0] ||
        { id: "default", title: moduleConfig.title };

      return normalizeDocument(document, section, moduleConfig, index);
    });
  }

  return sections.flatMap((section) =>
    (section.documents || []).map((document, index) =>
      normalizeDocument(document, section, moduleConfig, index)
    )
  );
}

export function readStoredModuleDocuments(moduleConfig, studyCode,fallbackDocuments: any = []) {
  const stored = getStorageItem(getModuleStorageKey(moduleConfig, studyCode), null);

  if (!Array.isArray(stored)) {
    return fallbackDocuments;
  }

  return stored.map((document, index) => {
    const section =
      moduleConfig.sections?.find((item) => item.id === document.section || item.id === document.sectionId) ||
      moduleConfig.sections?.[0] ||
      { id: "default", title: moduleConfig.title };

    return normalizeDocument(document, section, moduleConfig, index);
  });
}

export function persistModuleDocuments(moduleConfig, studyCode,documents: any = []) {
  const saved = setStorageItem(getModuleStorageKey(moduleConfig, studyCode), documents);

  if (saved && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(EISF_DOCUMENTS_EVENT, {
        detail: {
          studyCode: studyCode || "default-study",
          moduleId: moduleConfig?.id,
          documentCount: Array.isArray(documents) ? documents.length : 0,
        },
      })
    );
  }

  return saved;
}

export function initializeModuleDocuments(moduleConfig, studyCode, initialDocuments = null) {
  const seedDocuments = getModuleMockDocuments(moduleConfig, initialDocuments);
  return readStoredModuleDocuments(moduleConfig, studyCode, seedDocuments);
}

export function createUploadedDocument(formData: any = {},section: any = {},moduleConfig: any = {}, studyCode = "", user = DEFAULT_USER) {
  const documentName = formData.documentName || formData.file?.name || "Uploaded Document";
  const category = formData.category || section.title || moduleConfig.title;
  const now = formatDate();

  const document = normalizeDocument(
    {
      id: `${moduleConfig.id}-${section.id}-${Date.now()}`,
      moduleId: moduleConfig.id,
      moduleTitle: moduleConfig.title,
      section: section.id,
      sectionId: section.id,
      folderId: section.id,
      folderTitle: section.title,
      documentName,
      name: documentName,
      category,
      documentType: category,
      version: formData.version || "1.0",
      status: DOCUMENT_STATUS.DRAFT,
      uploadedBy: user,
      createdBy: user,
      approvedBy: "-",
      modifiedDate: now,
      expiryDate: "-",
      fileName: formData.file?.name || safeFileName(documentName),
      fileSize: formData.file?.size ? formatFileSize(formData.file.size) : "-",
      comments: formData.comments || "",
    },
    section,
    moduleConfig
  );

  return {
    ...document,

    // Business scope
    studyCode,
    moduleId: moduleConfig.id,
    moduleTitle: moduleConfig.title,
    section: section.id,
    sectionId: section.id,

    history: buildVersionHistory(document),
    versions: buildVersionHistory(document),
    auditTrail: buildAuditTrail(
      document,
      "Uploaded",
      formData.comments || "Document uploaded."
    ),
  };
}

export function updateDocumentRecord(originalDocument: any = {},updatedDocument: any = {},
  user = DEFAULT_USER
) {
  const modifiedDate = formatDate();

  const document = {
    ...originalDocument,
    ...updatedDocument,
    name:
      updatedDocument.documentName ||
      updatedDocument.name ||
      originalDocument.name,

    documentType:
      updatedDocument.documentType ||
      updatedDocument.category ||
      originalDocument.documentType,

    category:
      updatedDocument.category ||
      updatedDocument.documentType ||
      originalDocument.category,

    modifiedDate,

    uploadedBy:
      updatedDocument.uploadedBy ||
      originalDocument.uploadedBy ||
      user,
  };

  const versionEntry = {
    version: document.version || "1.0",
    date: modifiedDate,
    user,
    status: document.status,
  };

  const existingHistory =
    originalDocument.history ||
    originalDocument.versions ||
    [];

  let history = [...existingHistory];

  const existingIndex = history.findIndex(
    (entry) =>
      String(entry.version || "").trim() ===
      String(versionEntry.version || "").trim()
  );

  if (existingIndex !== -1) {
    history[existingIndex] = {
      ...history[existingIndex],
      date: modifiedDate,
      user,
      status: document.status,
    };
  } else {
    history.unshift(versionEntry);
  }

  history.sort((a, b) => {
    const va = parseFloat(a.version || 0);
    const vb = parseFloat(b.version || 0);

    if (!Number.isNaN(va) && !Number.isNaN(vb)) {
      return vb - va;
    }

    return String(b.version).localeCompare(String(a.version));
  });

  const auditEntry = {
    date: modifiedDate,
    user,
    action: "Edited",
    remarks: "Document metadata updated.",
  };

  return {
    ...document,
    history,
    versions: history,
    auditTrail: [
      auditEntry,
      ...(originalDocument.auditTrail || []),
    ],
  };
}

export function getFolderCounts(sections: any = [],documents: any = []) {
  return sections.reduce((counts, section) => {
    counts[section.id] = documents.filter(
      (document) => document.section === section.id || document.sectionId === section.id
    ).length;

    return counts;
  }, {});
}

export function getFilterOptions(documents: any = [], field) {
  return [...new Set<any>(documents.map((document) => document[field]))]
    .filter(Boolean)
    .sort((a, b) => a.toString().localeCompare(b.toString()));
}

export function filterDocuments(filters: any = {}, sourceDocuments = getEISFModuleDocuments()) {
  const { sectionId, folderId, status, documentType, version } = filters;

  return filterDocumentList(sourceDocuments, {
    section: sectionId,
    folderId,
    status,
    documentType,
    version,
  }).filter((document) => {
    if (sectionId && document.sectionId !== sectionId && document.section !== sectionId) return false;
    if (folderId && document.folderId !== folderId) return false;
    return true;
  });
}

export function sortDocuments(documents: any = [], field = "documentName", order = "asc") {
  return sortDocumentList(documents, field, order);
}

export function paginateDocuments(documents: any = [], page = 1, pageSize = 10) {
  const safePageSize = Number(pageSize) || 10;
  const totalItems = documents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;

  return {
    page: currentPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    start: totalItems ? startIndex + 1 : 0,
    end: Math.min(startIndex + safePageSize, totalItems),
    documents: documents.slice(startIndex, startIndex + safePageSize),
  };
}

export function exportDocuments(documents: any = [], fileName = "eisf-documents.csv") {
  const headers = [
    "Document Name",
    "Document Type",
    "Version",
    "Status",
    "Modified Date",
    "Uploaded By",
    "Approved By",
    "Expiry Date",
    "File Name",
  ];

  const rows = documents.map((document) => [
    document.documentName,
    document.documentType || document.category,
    document.version,
    document.status,
    document.modifiedDate,
    document.uploadedBy,
    document.approvedBy,
    document.expiryDate,
    document.fileName,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  triggerBrowserDownload(csv, fileName, "text/csv;charset=utf-8");
  return csv;
}

export function downloadDocument(document: any = {}) {
  const content = [
    `Document: ${document.documentName || document.name}`,
    `Version: ${document.version || "1.0"}`,
    `Status: ${document.status || DOCUMENT_STATUS.DRAFT}`,
    `Uploaded By: ${document.uploadedBy || "Study Staff"}`,
    "",
    "This is mock file content because the backend repository is not connected.",
  ].join("\n");

  triggerBrowserDownload(content, document.fileName || safeFileName(getDocumentTitle(document)), "application/pdf");
  return content;
}

function triggerBrowserDownload(content, fileName, type) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * Returns all documents.
 */
export function getDocuments() {
  return getEISFModuleDocuments();
}

/**
 * Returns documents by section.
 */
export function getDocumentsBySection(sectionId) {
  return getEISFModuleDocuments().filter(
    (document) => document.sectionId === sectionId || document.section === sectionId
  );
}

/**
 * Returns documents by folder.
 */
export function getDocumentsByFolder(folderId) {
  return getEISFModuleDocuments().filter(
    (document) => document.folderId === folderId
  );
}

/**
 * Returns document by id.
 */
export function getDocumentById(documentId) {
  return getEISFModuleDocuments().find(
    (document) => document.id === documentId
  );
}

/**
 * Search by document fields.
 */
export function searchDocuments(searchText = "") {
  const keyword = searchText.trim().toLowerCase();

  if (!keyword) {
    return getEISFModuleDocuments();
  }

  return getEISFModuleDocuments().filter((document) =>
    [
      document.documentName,
      document.name,
      document.description,
      document.documentType,
      document.category,
      document.status,
      document.fileName,
      document.uploadedBy,
    ]
      .filter(Boolean)
      .some((value) => value.toString().toLowerCase().includes(keyword))
  );
}

/**
 * Filter by status.
 */
export function getDocumentsByStatus(status) {
  if (!status) return getEISFModuleDocuments();

  return getEISFModuleDocuments().filter(
    (document) => document.status === status
  );
}

/**
 * Filter by document type.
 */
export function getDocumentsByType(type) {
  if (!type) return getEISFModuleDocuments();

  return getEISFModuleDocuments().filter(
    (document) => document.documentType === type
  );
}

/**
 * Returns unique document types.
 */
export function getAvailableDocumentTypes() {
  return getFilterOptions(getEISFModuleDocuments(), "documentType");
}

/**
 * Returns unique statuses.
 */
export function getAvailableStatuses() {
  return getFilterOptions(getEISFModuleDocuments(), "status");
}

/**
 * Returns document statistics.
 */
export function getDocumentStatistics() {
  const documents = getEISFModuleDocuments();

  return {
    total: documents.length,
    approved: documents.filter((doc) => doc.status === DOCUMENT_STATUS.APPROVED).length,
    pending: documents.filter((doc) => doc.status === DOCUMENT_STATUS.PENDING).length,
    rejected: documents.filter((doc) => doc.status === DOCUMENT_STATUS.REJECTED).length,
    expired: documents.filter((doc) => doc.status === DOCUMENT_STATUS.EXPIRED).length,
  };
}
