import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardCards from "./components/DashboardCards";
import DocumentTable from "./components/DocumentTable";
import UploadDocumentModal from "./components/UploadDocumentModal";
import DocumentViewer from "./components/DocumentViewer";
import EditDocumentModal from "./components/EditDocumentModal";
import VersionHistoryModal from "./components/VersionHistoryModal";
import AuditTrailModal from "./components/AuditTrailModal";
import FilingGuidelineModal from "./components/FilingGuidelineModal";
import { DOCUMENT_PAGE_SIZE_OPTIONS } from "./Constants/dashboardConstants";
import {
  createUploadedDocument,
  downloadDocument,
  exportDocuments,
  getFilterOptions,
  getFolderCounts,
  initializeModuleDocuments,
  paginateDocuments,
  persistModuleDocuments,
  updateDocumentRecord,
} from "./services/documentService";
import { buildReferenceDashboardCards } from "./utils/dashboardUtils";
import { processDocuments } from "./utils/searchUtils";
import { getSubModuleEnabledMap, setSubModuleEnabled } from "./utils/subModuleStateUtils";
import { hasPermission } from "../../services/roleService";
import PERMISSIONS from "../../constants/permissions";
import "./EISFModuleWorkspace.css";

export default function EISFModuleWorkspace({
  moduleConfig,
  activeSectionId,
  studyCode,
  initialDocuments = null,
  moduleOptions = [],
  selectedModuleId,
  onModuleChange,
  onSectionChange,
}: any) {
  const [documents, setDocuments] = useState(() =>
    initializeModuleDocuments(moduleConfig, studyCode, initialDocuments)
  );
  // [Phase 11–13] Role Based Permission – eISF Module. Reuses the existing
  // RBAC system (roleService.hasPermission + rolePermissions) — no new
  // permission service. Monitor maps to the existing CRO role already
  // defined in rolePermissions.js, so no per-role branching is needed here.
  const canUploadDocs = useMemo(() => hasPermission(PERMISSIONS.UPLOAD_REGULATORY_DOCS), []);
  const canEditDocs = useMemo(() => hasPermission(PERMISSIONS.EDIT_REGULATORY_DOCS), []);
  const canDeleteDocs = useMemo(() => hasPermission(PERMISSIONS.DELETE_REGULATORY_DOCS), []);
  const [selectedSectionId, setSelectedSectionId] = useState(
    activeSectionId || moduleConfig.sections[0]?.id
  );
  // Sub-module Enable/Disable state (Item 9) — persisted via localStorage.
  const [enabledMap, setEnabledMap] = useState(() =>
    getSubModuleEnabledMap(studyCode)
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [sortField, setSortField] = useState("documentName");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFilters, setShowFilters] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  // Split-view: the document rendered in the right-hand preview panel.
  // Kept separate from `selectedDocument` (used by the edit/history/audit
  // modals) so the preview never closes while another action is performed.
  const [previewDocument, setPreviewDocument] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [guidelineOpen, setGuidelineOpen] = useState(false);

  useEffect(() => {
    setDocuments(initializeModuleDocuments(moduleConfig, studyCode, initialDocuments));
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setVersionFilter("");
    setSortField("documentName");
    setSortDirection("asc");
    setPage(1);
    setPreviewDocument(null);
    setEnabledMap(getSubModuleEnabledMap(studyCode));
  }, [moduleConfig, initialDocuments, studyCode]);

  const isSectionEnabled = useCallback(
    (sectionId) => {
      if (!sectionId) return true;
      // Default to enabled (backwards compatible) when never toggled.
      return enabledMap[sectionId] !== false;
    },
    [enabledMap]
  );

  const handleToggleSectionEnabled = useCallback(
    (sectionId, event) => {
      if (event) {
        event.stopPropagation();
      }
      if (!sectionId) return;

      const nextEnabled = !isSectionEnabled(sectionId);
      setSubModuleEnabled(studyCode, sectionId, nextEnabled);
      setEnabledMap((prev) => ({ ...prev, [sectionId]: nextEnabled }));
    },
    [isSectionEnabled, studyCode]
  );

  useEffect(() => {
    persistModuleDocuments(moduleConfig, studyCode, documents);
  }, [documents, moduleConfig, studyCode]);

  useEffect(() => {
    const requestedSection = moduleConfig.sections.find(
      (section) => section.id === activeSectionId
    );

    setSelectedSectionId(requestedSection?.id || moduleConfig.sections[0]?.id);
    setPage(1);
    setPreviewDocument(null);
  }, [activeSectionId, moduleConfig]);

  // Keep the preview panel in sync after edits/deletes without closing it.
  useEffect(() => {
    setPreviewDocument((current) => {
      if (!current) return current;
      const latest = documents.find((document) => document.id === current.id);
      return latest || null;
    });
  }, [documents]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, versionFilter, sortField, sortDirection, selectedSectionId, pageSize]);

  const activeSection = useMemo(
    () =>
      moduleConfig.sections.find((section) => section.id === selectedSectionId) ||
      null,
    [moduleConfig.sections, selectedSectionId]
  );

  const activeSectionEnabled = useMemo(
    () => (activeSection ? isSectionEnabled(activeSection.id) : false),
    [activeSection, isSectionEnabled]
  );

  const folderCounts = useMemo(
    () => getFolderCounts(moduleConfig.sections, documents),
    [moduleConfig.sections, documents]
  );

  const processedSectionDocuments = useMemo(() => {
    // Item 9: never expose documents when the active sub-module is disabled.
    if (!activeSection || !activeSectionEnabled) return [];

    const sectionDocuments = documents.filter(
      (document) => document.section === activeSection?.id || document.sectionId === activeSection?.id
    );

    return processDocuments(sectionDocuments, {
      keyword: search,
      filters: {
        status: statusFilter,
        documentType: typeFilter,
        version: versionFilter,
      },
      sortField,
      sortDirection,
    });
  }, [activeSection, activeSectionEnabled, documents, search, statusFilter, typeFilter, versionFilter, sortField, sortDirection]);

  const pagination = useMemo(
    () => paginateDocuments(processedSectionDocuments, page, pageSize),
    [processedSectionDocuments, page, pageSize]
  );

  const statusOptions = useMemo(
    () => getFilterOptions(documents, "status"),
    [documents]
  );

  const categoryOptions = useMemo(
    () => moduleConfig.sections.map((section) => section.title),
    [moduleConfig.sections]
  );

  const typeOptions = useMemo(
    () => getFilterOptions(documents, "documentType"),
    [documents]
  );

  const versionOptions = useMemo(
    () => getFilterOptions(documents, "version"),
    [documents]
  );

  const dashboardCards = useMemo(
    () => buildReferenceDashboardCards(documents, moduleConfig.sections),
    [documents, moduleConfig.sections]
  );

  const selectSection = (sectionId) => {
    if (!sectionId) return;
    setSelectedSectionId(sectionId);
    onSectionChange?.(sectionId);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setVersionFilter("");
    setSortField("documentName");
    setSortDirection("asc");
    setPage(1);
  };

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const handleUpload = (formData) => {
    if (!activeSectionEnabled) return;
    // RBAC guard: block upload even if the modal was reachable by some
    // other path — the Upload button itself is also hidden below.
    if (!canUploadDocs) return;

    const incomingName = (
      formData.documentName ||
      formData.name ||
      ""
    )
      .trim()
      .toLowerCase();

    const incomingVersion = String(formData.version || "").trim();

    const duplicate = documents.some((doc) => {
      const existingName = (
        doc.documentName ||
        doc.name ||
        ""
      )
        .trim()
        .toLowerCase();

      const existingVersion = String(doc.version || "").trim();

      const sameStudy =
        (doc.studyCode || studyCode) === studyCode;

      const sameModule =
        (doc.moduleId || moduleConfig.id) === moduleConfig.id;

      const sameSection =
        (doc.section || doc.sectionId || "") === activeSection.id;

      return (
        sameStudy &&
        sameModule &&
        sameSection &&
        existingName === incomingName &&
        existingVersion === incomingVersion
      );
    });

    if (duplicate) {
      window.alert(
        `Version ${incomingVersion} already exists for "${formData.documentName}". Please upload a higher version.`
      );
      return;
    }

    const newDocument = createUploadedDocument(
      formData,
      activeSection,
      moduleConfig,
      studyCode,
      "Current User"
    );

    setDocuments((prev) => [newDocument, ...prev]);

    setShowUpload(false);
  };

  const handleSaveDocument = (updatedDocument) => {
    // Item 9 guard: disabled sub-modules must not allow edits.
    if (!activeSectionEnabled) {
      setEditOpen(false);
      setSelectedDocument(null);
      return;
    }

    // RBAC guard: block save even if the Edit modal was reachable by some
    // other path — the Edit action itself is also hidden in DocumentTable.
    if (!canEditDocs) {
      setEditOpen(false);
      setSelectedDocument(null);
      return;
    }

    const version = String(updatedDocument.version || "").trim();

    const duplicate = documents.some((doc) => {
      if (doc.id === updatedDocument.id) {
        return false;
      }

      const existingName = (
        doc.documentName ||
        doc.name ||
        ""
      )
        .trim()
        .toLowerCase();

      const updatedName = (
        updatedDocument.documentName ||
        updatedDocument.name ||
        ""
      )
        .trim()
        .toLowerCase();

      return (
        (doc.studyCode || studyCode) === studyCode &&
        (doc.moduleId || moduleConfig.id) === moduleConfig.id &&
        (doc.section || doc.sectionId || "") ===
        activeSection.id &&
        existingName === updatedName &&
        String(doc.version || "").trim() ===
        String(updatedDocument.version || "").trim()
      );
    });

    if (duplicate) {
      window.alert(
        `Version ${version} already exists for "${updatedDocument.documentName}".`
      );
      return;
    }

    setDocuments((prev) =>
      prev.map((document) =>
        document.id === updatedDocument.id
          ? updateDocumentRecord(document, updatedDocument, "Current User")
          : document
      )
    );

    setEditOpen(false);
    setSelectedDocument(null);
  };

  const handleDelete = (document) => {
    // Item 9 guard: disabled sub-modules must not expose delete actions.
    if (!activeSectionEnabled) return;
    // RBAC guard: block delete even if the action was reachable by some
    // other path — the Delete action itself is also hidden in DocumentTable.
    if (!canDeleteDocs) return;

    if (window.confirm(`Delete ${document.documentName}?`)) {
      setDocuments((prev) => prev.filter((item) => item.id !== document.id));
    }
  };

  const handleDownload = (document) => {
    // Item 9 guard: no downloads from disabled sub-modules.
    if (!activeSectionEnabled) return;
    return downloadDocument(document);
  };

  // Clicking a document renders it in the right-hand preview panel (no popup).
  const handlePreview = (document) => {
    if (!activeSectionEnabled) return;
    setPreviewDocument(document);
  };

  const openModal = (document, setter) => {
    setSelectedDocument(document);
    setter(true);
  };

  const closeDocumentModal = (setter) => {
    setter(false);
    setSelectedDocument(null);
  };

  const handleExport = () => {
    // Item 9 guard: no export from disabled sub-modules.
    if (!activeSection || !activeSectionEnabled) return null;

    const sectionName = activeSection?.title || moduleConfig.title;
    const fileName = `${moduleConfig.id}-${activeSection?.id || "all"}-documents.csv`.replace(/\s+/g, "_");

    exportDocuments(processedSectionDocuments, fileName);
    return sectionName;
  };

  const totalLabel = `${processedSectionDocuments.length} Document${processedSectionDocuments.length === 1 ? "" : "s"}`;

  return (
    <div className="eisf-module-workspace">
      <div className="eisf-module-header">
        <div className="eisf-module-header-main">
          <div className="eisf-breadcrumb">
            <span>Studies</span>
            <span>›</span>
            <span>{studyCode || "P-2024-001"}</span>
            <span>›</span>
            <span>eISF</span>
            <span>›</span>
            <strong>{moduleConfig.title}</strong>
          </div>

          <div className="eisf-module-title-row">
            <div className="eisf-module-heading">
              <h2>{moduleConfig.title}</h2>
              <DashboardCards documents={documents} cards={dashboardCards} variant="reference" />
            </div>

          </div>
        </div>

        {moduleOptions.length > 0 && (
          <label className="eisf-module-select">
            <span>Module</span>
            <select
              value={selectedModuleId || moduleConfig.id}
              onChange={(event) => onModuleChange?.(event.target.value)}>

              {moduleOptions.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.id} {module.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className={`eisf-module-grid${previewDocument ? " eisf-split-view" : ""}`}>
        <section className="eisf-module-documents-card">
          {!activeSection ? (
            <div className="eisf-submodule-disabled-panel">
              <span className="disabled-icon" aria-hidden="true">▤</span>
              <h4>No sub-module selected</h4>
              <p>Select a sub-module from the list to view its documents.</p>
            </div>
          ) : !activeSectionEnabled ? (
            <div className="eisf-submodule-disabled-panel">
              <span className="disabled-icon" aria-hidden="true">🚫</span>
              <h4>{activeSection.id} {activeSection.title}</h4>
              <p>This eISF sub-module is disabled.</p>
              <p style={{ marginTop: 6, fontSize: 12 }}>
                Existing documents are preserved and will reappear when the sub-module is enabled.
              </p>
            </div>
          ) : (
            <>
          <div className="eisf-documents-header">
            <div>
              <h3>{activeSection?.id} {activeSection?.title}</h3>
              <span>{totalLabel}</span>
            </div>

            <div className="eisf-documents-actions">
              <button type="button" onClick={handleExport}>⇩ Export</button>
              {canUploadDocs && (
                <button type="button" className="primary" onClick={() => setShowUpload(true)}>Upload</button>
              )}
              <button
                type="button"
                className="more-action"
                onClick={() => setShowFilters((current) => !current)}
                aria-label="Toggle filters"
                title="Toggle filters">

                ⋯
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="eisf-documents-toolbar">
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Status: All</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Document Type: All</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select value={versionFilter} onChange={(event) => setVersionFilter(event.target.value)}>
                <option value="">Version: All</option>
                {versionOptions.map((version) => (
                  <option key={version} value={version}>{version}</option>
                ))}
              </select>

              <button type="button" className="filter-action" onClick={clearFilters}>Reset</button>
            </div>
          )}

          <DocumentTable
            documents={pagination.documents}
            variant="reference"
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            selectedDocumentId={previewDocument?.id || null}
            onSelect={handlePreview}
            onView={handlePreview}
            onHistory={(document) => openModal(document, setHistoryOpen)}
            onAudit={(document) => openModal(document, setAuditOpen)}
            onDownload={handleDownload}
            onEdit={(document) => openModal(document, setEditOpen)}
            onDelete={handleDelete}
            canEdit={canEditDocs}
            canDelete={canDeleteDocs}
          />

          <div className="eisf-table-footer">
            <span>
              Showing {pagination.start} to {pagination.end} of {pagination.totalItems} documents
            </span>
            <div className="eisf-pagination-controls">
              <label>
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}>

                  {DOCUMENT_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <div className="eisf-pagination">
                <button
                  type="button"
                  disabled={pagination.page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}>

                  ‹
                </button>
                {Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className={pagination.page === pageNumber ? "active" : ""}
                    onClick={() => setPage(pageNumber)}>

                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>

                  ›
                </button>
              </div>
            </div>
          </div>
            </>
          )}
        </section>

        {previewDocument && (
          <section className="eisf-module-documents-card eisf-split-preview">
            <DocumentViewer
              inline
              document={previewDocument}
              onClose={() => setPreviewDocument(null)}
              onDownload={handleDownload}
              onHistory={(document) => openModal(document, setHistoryOpen)}
              onAudit={(document) => openModal(document, setAuditOpen)}
            />
          </section>
        )}
      </div>

      <UploadDocumentModal
        open={showUpload && activeSectionEnabled && canUploadDocs}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
        categoryOptions={categoryOptions}
        defaultCategory={activeSection?.title}
      />

      <EditDocumentModal
        open={editOpen && activeSectionEnabled}
        document={selectedDocument}
        onClose={() => closeDocumentModal(setEditOpen)}
        onSave={handleSaveDocument}
      />

      <VersionHistoryModal
        open={historyOpen && activeSectionEnabled}
        document={selectedDocument}
        onClose={() => closeDocumentModal(setHistoryOpen)}
      />

      <AuditTrailModal
        open={auditOpen && activeSectionEnabled}
        document={selectedDocument}
        onClose={() => closeDocumentModal(setAuditOpen)}
      />

      <FilingGuidelineModal
        open={guidelineOpen}
        moduleConfig={moduleConfig}
        section={activeSection}
        onClose={() => setGuidelineOpen(false)}
      />
    </div>
  );
}