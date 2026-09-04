import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdGroups,
  MdHowToReg,
  MdMonitorHeart,
  MdEventAvailable,
  MdPersonOff,
  MdSearch,
  MdClose,
  MdAdd,
  MdFileDownload,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";

import AppLayout from "./AppLayout";
import SubjectExplorer from "../../shared/components/SubjectExplorer/SubjectExplorer";
import SubjectFileManager from "../../shared/components/SubjectExplorer/SubjectFileManager";
import WorkspaceBreadcrumb from "../../shared/components/SubjectExplorer/WorkspaceBreadcrumb";
import SelectedFolderBar from "../../shared/components/SubjectExplorer/SelectedFolderBar";
import FolderStatsBar from "../../shared/components/SubjectExplorer/FolderStatsBar";
import useSubjectWorkspace from "../../shared/components/SubjectExplorer/useSubjectWorkspace";
import FolderStatsService from "../../shared/components/SubjectExplorer/folderStatsService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import { getSubjectsForStudy, getAllSubjects } from "../../shared/services/subjectService";
import "../styles/Subjects.css";
import "../../shared/components/SubjectExplorer/WorkspaceIntegration.css";

/**
 * Read real subject data from subjectsByStudy in localStorage.
 * Returns subjects for the selected study, or all studies if none selected.
 */
function readSubjectsFromStore(studyId) {
  try {
    const mapSubject = (r, sid) => ({
      id: r.id || r.subjectId || "",
      study: r.studyId || sid || "",
      site: r.site || "",
      pi: r.pi || "",
      status: r.status || "Screened",
      screeningDate: r.screeningDate || "-",
      enrollmentDate: r.enrollmentDate || "-",
      visit: r.currentVisit || "Screening",
      visitStatus: r.visitStatus || "Pending",
    });

    if (studyId) {
      return getSubjectsForStudy(studyId).map((r) => mapSubject(r, studyId));
    }
    // All studies
    return getAllSubjects().map((r) => mapSubject(r, r.studyId));
  } catch {
    return [];
  }
}

const STATUS_CLASS = {
  Active: "status-active",
  Enrolled: "status-enrolled",
  Screened: "status-screened",
  Completed: "status-completed",
  Withdrawn: "status-withdrawn",
  "Screen Failed": "status-failed",
};

const VISIT_STATUS_CLASS = {
  Completed: "vs-completed",
  Scheduled: "vs-scheduled",
  Pending: "vs-pending",
  Missed: "vs-missed",
};

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  id: "",
  study: "",
  site: "",
  pi: "",
  status: "Screened",
  screeningDate: "",
};

function Subjects() {
  const navigate = useNavigate();

  /* ---------------- study selector ---------------- */
  const allStudies = useMemo(() => getStudies(), []);
  const [selectedStudyId, setSelectedStudyId] = useState("");

  /* ---------------- state ---------------- */
  const [subjects, setSubjects] = useState(() => readSubjectsFromStore(selectedStudyId));

  // Refresh subjects when the selected study changes or when subjects are
  // created/deleted elsewhere (e.g. from the Study Dashboard).
  useEffect(() => {
    setSubjects(readSubjectsFromStore(selectedStudyId));
    const refresh = () => setSubjects(readSubjectsFromStore(selectedStudyId));
    window.addEventListener("subjects-updated", refresh);
    return () => window.removeEventListener("subjects-updated", refresh);
  }, [selectedStudyId]);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [studyFilter, setStudyFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
  const [page, setPage] = useState(1);
  /**
   * Phase 5 - workspace integration.
   *
   * One hook now owns the folder selection shared by the explorer, the
   * breadcrumb, the context bar and the file manager. It persists the choice
   * to localStorage (so it survives a refresh) and auto-refreshes after any
   * folder or file CRUD operation.
   *
   * The subject table is deliberately still NOT filtered by the selection -
   * that stays exactly as built in Phase 1.
   */
  const {
    tree,
    store,
    selectedFolder,
    selectedId,
    breadcrumb,
    folderPath,
    fileCount,
    totalSize,
    selectFolder,
    clearSelection,
  } = useSubjectWorkspace({ studyId: selectedStudyId });

  /**
   * Phase 6 - workspace-wide document statistics.
   *
   * The hook already re-reads the tree and file store after any CRUD, so
   * deriving from them here keeps these totals current for free.
   */
  const workspaceStats = useMemo(
    () => FolderStatsService.getWorkspaceStats(tree, store),
    [tree, store]
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  /* ---------------- site display (existing logic) ---------------- */
  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value,
        })
      : "—";

  /* ---------------- filter option lists ---------------- */
  const statusOptions = useMemo(
    () => ["All", ...Array.from(new Set<any>(subjects.map((s) => s.status)))],
    [subjects]
  );
  const studyOptions = useMemo(
    () => ["All", ...Array.from(new Set<any>(subjects.map((s) => s.study)))],
    [subjects]
  );
  const siteOptions = useMemo(
    () => ["All", ...Array.from(new Set<any>(subjects.map((s) => s.site)))],
    [subjects]
  );

  /* ---------------- KPI metrics (mock) ---------------- */
  const kpis = useMemo(() => {
    const count = (fn) => subjects.filter(fn).length;
    return [
      {
        key: "total",
        label: "Total Subjects",
        value: subjects.length,
        delta: "+6 this month",
        tone: "primary",
        Icon: MdGroups,
      },
      {
        key: "enrolled",
        label: "Enrolled",
        value: count((s) => s.status === "Enrolled" || s.status === "Active"),
        delta: "72% of target",
        tone: "success",
        Icon: MdHowToReg,
      },
      {
        key: "active",
        label: "Active On Study",
        value: count((s) => s.status === "Active"),
        delta: "Across 4 studies",
        tone: "info",
        Icon: MdMonitorHeart,
      },
      {
        key: "visits",
        label: "Upcoming Visits",
        value: count((s) => s.visitStatus === "Scheduled"),
        delta: "Next 14 days",
        tone: "warning",
        Icon: MdEventAvailable,
      },
      {
        key: "attrition",
        label: "Screen Fail / Withdrawn",
        value: count(
          (s) => s.status === "Screen Failed" || s.status === "Withdrawn"
        ),
        delta: "Attrition 14%",
        tone: "danger",
        Icon: MdPersonOff,
      },
    ];
  }, [subjects]);

  /* ---------------- search + filters ---------------- */
  const filteredSubjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return subjects.filter((subject) => {
      const matchesSearch =
        !term ||
        subject.id.toLowerCase().includes(term) ||
        subject.study.toLowerCase().includes(term) ||
        subject.site.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "All" || subject.status === statusFilter;
      const matchesStudy = studyFilter === "All" || subject.study === studyFilter;
      const matchesSite = siteFilter === "All" || subject.site === siteFilter;

      return matchesSearch && matchesStatus && matchesStudy && matchesSite;
    });
  }, [subjects, searchTerm, statusFilter, studyFilter, siteFilter]);

  /* ---------------- pagination ---------------- */
  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  /* Memoised so the row list is a stable reference between unrelated renders. */
  const pagedSubjects = useMemo(
    () => filteredSubjects.slice(startIndex, startIndex + PAGE_SIZE),
    [filteredSubjects, startIndex]
  );

  const activeFilterCount =
    (statusFilter !== "All" ? 1 : 0) +
    (studyFilter !== "All" ? 1 : 0) +
    (siteFilter !== "All" ? 1 : 0) +
    (searchTerm ? 1 : 0);

  const resetFilters = useCallback(() => {
    setSearch("");
    setSearchTerm("");
    setStatusFilter("All");
    setStudyFilter("All");
    setSiteFilter("All");
    setPage(1);
  }, []);

  /* ---------------- add subject (mock) ---------------- */
  const submitSubject = (event) => {
    event.preventDefault();
    if (!form.id.trim() || !form.study.trim() || !form.site.trim()) {
      setFormError("Subject ID, Study and Site are required.");
      return;
    }
    if (subjects.some((s) => s.id.toLowerCase() === form.id.trim().toLowerCase())) {
      setFormError("A subject with this ID already exists.");
      return;
    }

    setSubjects((prev) => [
      {
        id: form.id.trim(),
        study: form.study.trim(),
        site: form.site.trim(),
        pi: form.pi.trim() || "—",
        status: form.status,
        screeningDate: form.screeningDate.trim() || "-",
        enrollmentDate: "-",
        visit: "Screening",
        visitStatus: "Pending",
      },
      ...prev,
    ]);

    setForm(EMPTY_FORM);
    setFormError("");
    setShowAddModal(false);
    setPage(1);
  };

  return (
    <AppLayout>
      <div className="subjects-workspace tnxt-compact">
        {/* ================= BREADCRUMB ================= */}
        {/* Phase 5: the static crumbs are now followed by one crumb per
            folder in the selected path. Clicking a folder crumb moves the
            workspace back up the tree. */}
        <WorkspaceBreadcrumb
          crumbs={breadcrumb}
          onNavigate={navigate}
          onSelect={selectFolder}
        />

        {/* ================= PAGE HEADER ================= */}
        <header className="sw-header">
          <div className="sw-header-text">
            <div className="sw-header-eyebrow">Subject Management</div>
            <h1>Subjects</h1>
            <p>Manage all subjects across sponsor studies</p>
            <label className="sw-select" style={{ marginTop: '0.5rem' }}>
              <span>Select Study</span>
              <select
                aria-label="Select a study to view its subjects"
                value={selectedStudyId}
                onChange={(e) => {
                  setSelectedStudyId(e.target.value);
                  clearSelection();
                }}
              >
                <option value="">All Studies</option>
                {allStudies.map((study) => (
                  <option key={study.code || study.id} value={study.code || study.id}>
                    {study.name || study.title || study.code || study.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="sw-header-actions">
            <button
              type="button"
              className="sw-btn sw-btn--ghost"
              onClick={() => window.print()}
            >
              <MdFileDownload size={16} />
              <span>Export</span>
            </button>
            <button
              type="button"
              className="sw-btn sw-btn--primary"
              onClick={() => {
                setFormError("");
                setShowAddModal(true);
              }}
            >
              <MdAdd size={18} />
              <span>Add Subject</span>
            </button>
          </div>
        </header>

        {/* ================= KPI CARDS ================= */}
        <section className="sw-kpi-grid" aria-label="Subject metrics">
          {kpis.map(({ key, label, value, delta, tone, Icon }) => (
            <article
              key={key}
              className={`sw-kpi-card sw-kpi--${tone}`}
              aria-label={`${label}: ${value}. ${delta}`}
            >
              <div className="sw-kpi-top">
                <span className="sw-kpi-label">{label}</span>
                <span className="sw-kpi-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
              </div>
              <div className="sw-kpi-value">{value}</div>
              <div className="sw-kpi-delta">{delta}</div>
            </article>
          ))}
        </section>

        {/* ================= WORKSPACE BODY ================= */}
        {/* data-selected-folder exposes the explorer selection for
            inspection; the subject table is deliberately not filtered by it. */}
        <div className="sw-body" data-selected-folder={selectedFolder?.id || ""}>
          {/* -------- LEFT SIDEBAR: SUBJECT EXPLORER -------- */}
          {/* Phase 5: `selectedId` makes this a controlled selection, so the
              sidebar highlight, the breadcrumb and the file list can never
              disagree - including on the first render after a refresh. */}           <SubjectExplorer tree={tree} selectedId={selectedId} onSelect={selectFolder} studyId={selectedStudyId} />

          {/* -------- MAIN CONTENT -------- */}
          <main className="sw-main">
            {/* -------- TOOLBAR: SEARCH + FILTERS -------- */}
            <div className="sw-toolbar" role="search">
              <div className="sw-search">
                <MdSearch
                  size={18}
                  className="sw-search-icon"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search subjects by ID, study or site"
                  placeholder="Search Subject ID, study or site..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearchTerm(search);
                      setPage(1);
                    }
                  }}
                />
                {(search || searchTerm) && (
                  <button
                    type="button"
                    className="sw-search-clear"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearch("");
                      setSearchTerm("");
                      setPage(1);
                    }}
                  >
                    <MdClose size={15} />
                  </button>
                )}
              </div>

              <div className="sw-filters" role="group" aria-label="Subject filters">
                <label className="sw-select">
                  <span>Status</span>
                  <select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sw-select">
                  <span>Study</span>
                  <select
                    aria-label="Filter by study"
                    value={studyFilter}
                    onChange={(e) => {
                      setStudyFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    {studyOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sw-select">
                  <span>Site</span>
                  <select
                    aria-label="Filter by site"
                    value={siteFilter}
                    onChange={(e) => {
                      setSiteFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    {siteOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "All" ? "All" : displaySite(option)}
                      </option>
                    ))}
                  </select>
                </label>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="sw-btn sw-btn--subtle"
                    onClick={resetFilters}
                    aria-label={`Clear ${activeFilterCount} active filters`}
                  >
                    Clear ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>

            {/* -------- TABLE CARD -------- */}
            <section className="sw-card">
              <div className="sw-card-header">
                <div>
                  <h2>Subject List</h2>
                  <p>
                    {filteredSubjects.length}{" "}
                    {filteredSubjects.length === 1 ? "subject" : "subjects"}
                    {activeFilterCount > 0 ? " matching filters" : " in total"}
                  </p>
                </div>
              </div>

              <div className="sw-table-scroll">
                <table className="subjects-table ctms-standard-table">
                  <thead>
                    <tr>
                      <th>Subject ID</th>
                      <th>Study</th>
                      <th>Site</th>
                      <th>PI</th>
                      <th>Status</th>
                      <th>Screening Date</th>
                      <th>Enrollment Date</th>
                      <th>Current Visit</th>
                      <th>Visit Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="sw-empty">
                          <strong>No subjects found</strong>
                          <span>Try adjusting your search or filters.</span>
                        </td>
                      </tr>
                    ) : (
                      pagedSubjects.map((subject) => (
                        <tr key={subject.id}>
                          <td className="sw-cell-id">{subject.id}</td>
                          <td>{subject.study}</td>
                          <td>{displaySite(subject.site)}</td>
                          <td>{subject.pi}</td>
                          <td>
                            <span
                              className={`sw-badge ${
                                STATUS_CLASS[subject.status] || "status-screened"
                              }`}
                            >
                              {subject.status}
                            </span>
                          </td>
                          <td>{subject.screeningDate}</td>
                          <td>{subject.enrollmentDate}</td>
                          <td>{subject.visit}</td>
                          <td>
                            <span
                              className={`sw-visit ${
                                VISIT_STATUS_CLASS[subject.visitStatus] || ""
                              }`}
                            >
                              {subject.visitStatus}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="view-btn"
                              onClick={() =>
                                navigate(`/subject/${subject.id}`, {
                                  state: { from: "/subjects" },
                                })
                              }
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* -------- PAGINATION -------- */}
              <div className="sw-pagination">
                <span className="sw-page-info">
                  {filteredSubjects.length === 0
                    ? "Showing 0 of 0"
                    : `Showing ${startIndex + 1}–${Math.min(
                        startIndex + PAGE_SIZE,
                        filteredSubjects.length
                      )} of ${filteredSubjects.length}`}
                </span>

                <div className="sw-page-controls">
                  <button
                    type="button"
                    className="sw-page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <MdChevronLeft size={18} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`sw-page-btn${
                          pageNumber === currentPage ? " is-active" : ""
                        }`}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    className="sw-page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <MdChevronRight size={18} />
                  </button>
                </div>
              </div>
            </section>

            {/* -------- WORKSPACE DOCUMENT STATISTICS (Phase 6) --------
                Totals across every subject and folder: folder count, file
                count and storage used. Independent of the selection, so it
                gives the whole-workspace picture above the folder context. */}
            <FolderStatsBar stats={workspaceStats} scope="workspace" />

            {/* -------- SELECTED FOLDER CONTEXT (Phase 5) --------
                Shows which folder is active, its path in the tree, and how
                many files it holds. Values come from useSubjectWorkspace, so
                they refresh after any folder or file operation. */}
            <SelectedFolderBar
              folder={selectedFolder}
              path={folderPath}
              fileCount={fileCount}
              totalSize={totalSize}
              onClear={clearSelection}
            />

            {/* -------- SUBJECT FILE MANAGEMENT (Phase 4) --------
                Files for the folder selected in the explorer. Self-contained:
                it owns its own state and persistence, so nothing in the
                subject table or the Phase 1-3 explorer changes. */}
            <SubjectFileManager
              selectedFolder={selectedFolder}
              onSelectFolder={selectFolder}
              tree={tree}
              studyId={selectedStudyId}
            />
          </main>
        </div>
      </div>

      {/* ================= ADD SUBJECT MODAL ================= */}
      {showAddModal && (
        <div
          className="sw-modal-backdrop"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="sw-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add Subject"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sw-modal-header">
              <h3>Add Subject</h3>
              <button
                type="button"
                className="sw-modal-close"
                aria-label="Close"
                onClick={() => setShowAddModal(false)}
              >
                <MdClose size={18} />
              </button>
            </div>

            <form className="sw-modal-body" onSubmit={submitSubject}>
              <div className="sw-field-grid">
                <label className="sw-field">
                  <span>
                    Subject ID <em>*</em>
                  </span>
                  <input
                    type="text"
                    value={form.id}
                    placeholder="SUB-1015"
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                  />
                </label>

                <label className="sw-field">
                  <span>
                    Study <em>*</em>
                  </span>
                  <input
                    type="text"
                    value={form.study}
                    placeholder="Diabetes Study"
                    onChange={(e) => setForm({ ...form, study: e.target.value })}
                  />
                </label>

                <label className="sw-field">
                  <span>
                    Site <em>*</em>
                  </span>
                  <input
                    type="text"
                    value={form.site}
                    placeholder="Apollo Hospital"
                    onChange={(e) => setForm({ ...form, site: e.target.value })}
                  />
                </label>

                <label className="sw-field">
                  <span>Principal Investigator</span>
                  <input
                    type="text"
                    value={form.pi}
                    placeholder="Dr Rao"
                    onChange={(e) => setForm({ ...form, pi: e.target.value })}
                  />
                </label>

                <label className="sw-field">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {["Screened", "Enrolled", "Active"].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sw-field">
                  <span>Screening Date</span>
                  <input
                    type="text"
                    value={form.screeningDate}
                    placeholder="01-Mar-2026"
                    onChange={(e) =>
                      setForm({ ...form, screeningDate: e.target.value })
                    }
                  />
                </label>
              </div>

              {formError && <div className="sw-form-error">{formError}</div>}

              <div className="sw-modal-footer">
                <button
                  type="button"
                  className="sw-btn sw-btn--ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sw-btn sw-btn--primary">
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default Subjects;