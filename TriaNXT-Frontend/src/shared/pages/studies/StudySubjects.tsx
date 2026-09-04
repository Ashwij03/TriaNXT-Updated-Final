import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { readStorage } from "../../utils/storageHelpers";
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiFolder,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import DocumentFolderManager from "../../components/DocumentFolderManager";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import SubjectComments from "../subjects/SubjectComments";
import SubjectFormModal from "../../components/SubjectExplorer/SubjectFormModal";
import {
  canAddSubject,
  canEditSubjectContent,
} from "../../utils/contentAccess";
import {
  getCurrentUser,
  getEffectiveRole,
  ROLE_LABELS,
} from "../../services/roleService";
import { notifySubjectCreated } from "../../services/notificationService";
import { syncSubjectSchedules } from "../../services/visitScheduleService";
import {
  getStudyByCode,
  getSubjectStudyDefaults,
  createSubject,
  updateSubject,
  COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE,
  COMPLETED_STUDY_SUBJECT_EDIT_MESSAGE,
  getStudies,
} from "../../services/studyService";
import { getSubjectsForStudy, subscribeSubjects, deleteSubject } from "../../services/subjectService";
import { STUDY_STATUS_COMPLETED } from "../../constants/studyStatus";
import { resolveSiteDisplay } from "../../utils/siteDisplay";
import "./StudySubjects.css";

const SELECTED_SUBJECT_STORAGE_KEY = "selectedSubject";
const SUBJECTS_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getSubjectContextKey(studyId, subjectId) {
  return `subject-${studyId || "unknown-study"}-${subjectId || "unknown-subject"}`;
}

function getSearchableSubjectText(subject) {
  if (!subject || typeof subject !== "object") {
    return "";
  }

  const searchableValues = [];

  const addValue = (value) => {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach(addValue);
      return;
    }

    searchableValues.push(String(value));
  };

  Object.values(subject).forEach(addValue);

  return searchableValues.join(" ").toLowerCase();
}

function getSubjectDetailCards(subject,siteSources: any = []) {
  const latestSite =
    getSubjectStudyDefaults(subject?.studyId).site || subject?.site;

  const siteDisplay = latestSite
    ? resolveSiteDisplay(latestSite, {
        sources: siteSources,
        fallback: latestSite,
      })
    : "—";

  return [
    {
      label: "Initials",
      value: subject?.initials || "—",
    },
    {
      label: "Status",
      value: subject?.status || "—",
    },
    {
      label: "Principal Investigator",
      value:
        getSubjectStudyDefaults(subject?.studyId).pi ||
        subject?.pi ||
        "—",
    },
    {
      label: "Study ID",
      value: subject?.studyId || "—",
    },
    {
      label: "Site",
      value: siteDisplay,
    },
    {
      label: "Screening Date",
      value: subject?.screeningDate || "—",
    },
    {
      label: "Enrollment Date",
      value: subject?.enrollmentDate || "—",
    },
    {
      label: "Current Visit",
      value: subject?.currentVisit || "—",
    },
  ];
}

function StudySubjects({
  setActiveTab,
  showTable = false,
  showBackButton = true,
}: any) {
  const params = useParams();
  const navigate = useNavigate();

  const studyId = String(
    params.id || params.studyId || params.code || ""
  ).trim();

  // Subject data is now sourced from subjectService (single source of truth).
  // The local state is kept for UI reactivity but populated via subjectService.
  const [subjectsVersion, setSubjectsVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [showSubjectCommentsModal, setShowSubjectCommentsModal] = useState(false);
  // Unified Add/Edit Subject modal state (SubjectFormModal)
  const [formModalMode, setFormModalMode] = useState(null); // "create" | "edit" | null
  const [formModalSubject, setFormModalSubject] = useState(null);
  const [formModalRecord, setFormModalRecord] = useState(null);
  const [formModalError, setFormModalError] = useState("");
  const [subjectNotice, setSubjectNotice] = useState(null);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const currentUser = getCurrentUser();
  const showAddSubject = canAddSubject(currentUser);
  const canModifySubjects = canEditSubjectContent(currentUser);

  /*
    Item 7 (Stage 5A): resolve the authoritative study for this page so the
    UI guard can react to study status changes made elsewhere (edit-study
    dialog, other tabs). Refreshed on `studies-updated`.
  */
  const [currentStudy, setCurrentStudy] = useState(() =>
    studyId ? getStudyByCode(studyId) : null
  );

  useEffect(() => {
    setCurrentStudy(studyId ? getStudyByCode(studyId) : null);

    const refreshStudy = () => {
      setCurrentStudy(studyId ? getStudyByCode(studyId) : null);
    };

    window.addEventListener("studies-updated", refreshStudy);
    window.addEventListener("sponsor-data-updated", refreshStudy);

    return () => {
      window.removeEventListener("studies-updated", refreshStudy);
      window.removeEventListener("sponsor-data-updated", refreshStudy);
    };
  }, [studyId]);

  const isStudyCompleted =
    currentStudy?.status === STUDY_STATUS_COMPLETED;

  useEffect(() => {
    const refreshSubjects = () => {
      setSubjectsVersion((v) => v + 1);
    };

    const unsub = subscribeSubjects(refreshSubjects);
    return unsub;
  }, []);

  useEffect(() => {
    const loadSelectedSubject = () => {
      const savedSubject = readStorage(SELECTED_SUBJECT_STORAGE_KEY, null);

      if (
        savedSubject?.id &&
        normalizeValue(savedSubject.studyId) === normalizeValue(studyId)
      ) {
        setSelectedSubjectId(savedSubject.id);
      } else {
        setSelectedSubjectId(null);
      }
    };

    // Load on first render
    loadSelectedSubject();

    // Update whenever the sidebar selects a subject
    window.addEventListener("subject-selected", loadSelectedSubject);

    return () => {
      window.removeEventListener("subject-selected", loadSelectedSubject);
    };
  }, [studyId]);

  const subjectsData = useMemo(() => {
    // subjectService.getSubjectsForStudy() returns cross-checked, study-scoped data
    return getSubjectsForStudy(studyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, subjectsVersion]);

  const filteredSubjects = useMemo(() => {
    const normalizedSearchTerm = normalizeValue(searchTerm);

    if (!normalizedSearchTerm) {
      return subjectsData;
    }

    return subjectsData.filter((subject) => {
      const searchableText = getSearchableSubjectText(subject);

      return searchableText.includes(normalizedSearchTerm);
    });
  }, [searchTerm, subjectsData]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSubjects.length / pageSize)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, studyId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedSubjects = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredSubjects.slice(startIndex, startIndex + pageSize);
  }, [filteredSubjects, currentPage, pageSize]);

  const pageStart =
    filteredSubjects.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(
    currentPage * pageSize,
    filteredSubjects.length
  );

  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) {
      return null;
    }

    return (
      subjectsData.find(
        (subject) =>
          normalizeValue(subject.id) === normalizeValue(selectedSubjectId)
      ) || null
    );
  }, [selectedSubjectId, subjectsData]);

  const saveSubjects = () => {
    // Trigger a re-read from subjectService — the write already happened
    // via studyService.createSubject/updateSubject/deleteSubject.
    setSubjectsVersion((v) => v + 1);
  };

  /** Validate that a subject ID is unique among all subjects. */
  const validateSubjectId = (name) => {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return { valid: false, error: "Subject ID is required." };
    const isDuplicate = subjectsData.some(
      (s) =>
        normalizeValue(s.id) === normalizeValue(trimmed) &&
        (!formModalSubject || normalizeValue(s.id) !== normalizeValue(formModalSubject.id))
    );
    if (isDuplicate) return { valid: false, error: "A subject with this Subject ID already exists." };
    return { valid: true, error: "" };
  };

  /** Handle submit from the unified SubjectFormModal (create or edit). */
  const handleFormModalSubmit = (fields) => {
    setFormModalError("");

    const subjectId = (fields.id || "").trim();
    if (!studyId || !subjectId) {
      setFormModalError("Subject ID is required.");
      return;
    }

    const isEditing = formModalMode === "edit" && formModalSubject;

    // Completed-study guard: block both create and edit when study is Completed.
    const authoritativeStudy = getStudyByCode(studyId);
    if (authoritativeStudy?.status === STUDY_STATUS_COMPLETED) {
      setFormModalError(
        isEditing ? COMPLETED_STUDY_SUBJECT_EDIT_MESSAGE : COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE
      );
      return;
    }

    const now = new Date().toISOString();
    const manualStatus = String(fields.status || "").trim();

    if (isEditing) {
      const editingId = formModalSubject.id;
      const updatedSubjectsForStudy = subjectsData.map((subject) => {
        if (normalizeValue(subject.id) !== normalizeValue(editingId)) return subject;
        const latestDefaults = getSubjectStudyDefaults(studyId);
        return {
          ...subject,
          id: subjectId,
          initials: fields.initials || "",
          pi: latestDefaults.pi,
          site: latestDefaults.site,
          studyId,
          status: manualStatus,
          screeningDate: fields.screeningDate || "",
          enrollmentDate: fields.enrollmentDate || "",
          currentVisit: fields.currentVisit || "",
          updatedAt: now,
        };
      });

      const editedSubject = updatedSubjectsForStudy.find(
        (s) => normalizeValue(s.id) === normalizeValue(subjectId)
      );
      try {
        updateSubject(studyId, editingId, editedSubject);
      } catch (error) {
        setFormModalError((error && error.message) || COMPLETED_STUDY_SUBJECT_EDIT_MESSAGE);
        return;
      }

      saveSubjects();
      syncSubjectSchedules(studyId, subjectId, editedSubject);
    } else {
      const studyDefaults = getSubjectStudyDefaults(studyId);
      const subjectToAdd = {
        id: subjectId,
        initials: (fields.initials || "").trim(),
        pi: studyDefaults.pi || "",
        site: studyDefaults.site || "",
        studyId,
        status: manualStatus,
        screeningDate: fields.screeningDate || "",
        enrollmentDate: fields.enrollmentDate || "",
        currentVisit: fields.currentVisit || "",
        createdAt: now,
        updatedAt: now,
      };

      let createdSubject;
      try {
        createdSubject = createSubject(studyId, subjectToAdd);
      } catch (error) {
        setFormModalError(
          (error && error.message) || COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE
        );
        return;
      }

      saveSubjects();
      syncSubjectSchedules(studyId, subjectId, createdSubject);
      notifySubjectCreated({
        subjectId,
        studyCode: studyId,
        addedByRole: ROLE_LABELS[getEffectiveRole(currentUser)] || getEffectiveRole(currentUser),
      });
    }

    closeFormModal();
  };

  const closeFormModal = () => {
    setFormModalMode(null);
    setFormModalSubject(null);
    setFormModalRecord(null);
    setFormModalError("");
  };

  const openAddSubjectModal = () => {
    if (isStudyCompleted) {
      setSubjectNotice({
        title: "Add Subject Unavailable",
        message: COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE,
      });
      return;
    }
    setFormModalError("");
    setFormModalSubject(null);
    setFormModalRecord(null);
    setFormModalMode("create");
  };

  const openEditSubjectModal = (subject) => {
    if (!subject) return;
    if (isStudyCompleted) {
      setSubjectNotice({
        title: "Edit Subject Unavailable",
        message: COMPLETED_STUDY_SUBJECT_EDIT_MESSAGE,
      });
      return;
    }
    setFormModalError("");
    setFormModalSubject({ id: subject.id, name: subject.id });
    setFormModalRecord(subject);
    setFormModalMode("edit");
  };

  const handleDeleteSubject = (subject) => {
    if (!subject) {
      return;
    }

    // Phase-7 IMP-MOD-2: open the shared DeleteConfirmationModal instead of
    // window.confirm. The actual delete happens in confirmDeleteSubject.
    setSubjectToDelete(subject);
  };

  const confirmDeleteSubject = () => {
    if (!subjectToDelete) {
      return;
    }

    const subject = subjectToDelete;

    // Delete through subjectService — the single owner of subjectsByStudy —
    // so the sidebar, Subject Explorer and every other consumer refresh
    // from one place. The service guards completed studies; surface that
    // through the existing notice modal instead of failing silently.
    try {
      deleteSubject(studyId, subject.id);
    } catch (error) {
      setSubjectNotice({
        title: "Delete Subject Unavailable",
        message: (error && error.message) || COMPLETED_STUDY_SUBJECT_EDIT_MESSAGE,
      });
      setSubjectToDelete(null);
      return;
    }

    saveSubjects();

    if (
      selectedSubjectId &&
      normalizeValue(selectedSubjectId) === normalizeValue(subject.id)
    ) {
      localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
      setSelectedSubjectId(null);
    }

    setSubjectToDelete(null);
  };

  const openSubjectFolder = (subject, shouldNavigate = false) => {
    localStorage.setItem(
      SELECTED_SUBJECT_STORAGE_KEY,
      JSON.stringify({
        ...subject,
        studyId,
      })
    );

    setSelectedSubjectId(subject.id);

    if (shouldNavigate && studyId) {
      navigate(
        `/study-dashboard/${encodeURIComponent(
          studyId
        )}?tab=Subjects&subject=${encodeURIComponent(subject.id)}`
      );
    }
  };

  const closeSubjectFolder = () => {
    localStorage.removeItem(SELECTED_SUBJECT_STORAGE_KEY);
    setSelectedSubjectId(null);
    setSearchTerm("");
  };

  if (selectedSubject) {
    const subjectContextKey = getSubjectContextKey(
      studyId,
      selectedSubject.id
    );

    const subjectDetailCards = getSubjectDetailCards(
      selectedSubject,
      getStudies()
    );

    return (
      <div className="subjects-module tnxt-compact">
        <div className="subject-details-header">
          <div className="subject-details-title-row">
            <h2>{selectedSubject.id}</h2>
            <div className="subject-details-actions">
              <button
                type="button"
                className="back-btn"
                onClick={closeSubjectFolder}
              >
                <FiArrowLeft />
                Back to Subjects
              </button>
              {/* Phase-7: opens the shared Subject Comments modal.
                  We deliberately don't add another Subject Comments
                  component — the existing SubjectComments.js is rendered
                  in modal mode. */}
              <button
                type="button"
                className="subject-details-comments-btn"
                onClick={() => setShowSubjectCommentsModal(true)}
              >
                Comments
              </button>
            </div>
          </div>

          <div className="subject-details-grid">
            {subjectDetailCards.map((detail) => (
              <div
                key={detail.label}
                className="subject-details-card"
              >
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="subjects-document-manager">
          <DocumentFolderManager
            key={subjectContextKey}
            sectionId="subjects"
            contextKey={subjectContextKey}
            title={selectedSubject.id}
            studyCode={studyId}
            subjectId={selectedSubject.id}
            layout="explorer"
            onBackToSubjects={closeSubjectFolder}
          />
        </div>

        {showSubjectCommentsModal && (
          <SubjectComments
            asModal
            subjectId={selectedSubject.id}
            studyId={studyId}
            onClose={() => setShowSubjectCommentsModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="subjects-module tnxt-compact">
      {showBackButton && typeof setActiveTab === "function" && (
        <button
          type="button"
          className="back-btn"
          onClick={() => setActiveTab("Overview")}
        >
          <FiArrowLeft />
          Back
        </button>
      )}

      <div className="subjects-header">
        <div>
          <h2>Subjects</h2>

          <p className="subject-details-subtitle">
            Manage subjects for the selected study.
          </p>
        </div>

        {showAddSubject && (
          <button
            type="button"
            className="add-subject-btn"
            onClick={openAddSubjectModal}
            disabled={isStudyCompleted}
            aria-disabled={isStudyCompleted}
            title={
              isStudyCompleted
                ? COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE
                : undefined
            }
          >
            <FiPlus />
            Add Subject
          </button>
        )}
      </div>

      <div className="subject-search-bar">
        <input
          id="subject-search"
          name="subjectSearch"
          type="search"
          placeholder="Search by Subject ID, initials, PI, site, status, visit, date..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search subjects"
          autoComplete="off"
        />
      </div>

      {showTable ? (
        <div className="subject-table-card">
          <table>
            <thead>
              <tr>
                <th>Subject ID</th>
                <th>Initials</th>
                <th>Status</th>
                <th>PI</th>
                <th>Site</th>
                <th>Screening</th>
                <th>Enrollment</th>
                <th>Current Visit</th>
                {canModifySubjects && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {paginatedSubjects.length > 0 ? (
                paginatedSubjects.map((subject) => (
                  <tr key={subject.id}>
                    <td>{subject.id || "—"}</td>
                    <td>{subject.initials || "—"}</td>
                    <td>{subject.status || "—"}</td>
                    <td>{getSubjectStudyDefaults(studyId).pi || subject.pi || "—"}</td>
                    <td>
                      {(() => {
                        const latestSite =
                          getSubjectStudyDefaults(studyId).site || subject.site;

                        return latestSite
                          ? resolveSiteDisplay(latestSite, {
                              sources: getStudies(),
                              fallback: latestSite,
                            })
                          : "—";
                      })()}
                    </td>
                    <td>{subject.screeningDate || "—"}</td>
                    <td>{subject.enrollmentDate || "—"}</td>
                    <td>{subject.currentVisit || "—"}</td>
                    {canModifySubjects && (
                      <td>
                        <div className="subject-row-actions">
                          <button
                            type="button"
                            className="subject-action-btn subject-action-edit"
                            onClick={() => openEditSubjectModal(subject)}
                            disabled={isStudyCompleted}
                            aria-disabled={isStudyCompleted}
                            aria-label={`Edit subject ${subject.id}`}
                            title={
                              isStudyCompleted
                                ? COMPLETED_STUDY_SUBJECT_EDIT_MESSAGE
                                : "Edit subject"
                            }
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            className="subject-action-btn subject-action-delete"
                            onClick={() => handleDeleteSubject(subject)}
                            aria-label={`Delete subject ${subject.id}`}
                            title="Delete subject"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={canModifySubjects ? 9 : 8}
                    style={{
                      textAlign: "center",
                      padding: "1.875rem",
                      color: "#64748b",
                    }}
                  >
                    No matching subjects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="subjects-explorer">
          <div className="subjects-explorer-toolbar">
            <span className="subjects-explorer-path">Subjects</span>

            <span className="subjects-explorer-count">
              {filteredSubjects.length} item(s)
            </span>
          </div>

          {filteredSubjects.length > 0 ? (
            <div className="subjects-folder-grid">
              {paginatedSubjects.map((subject) => (
                <div key={subject.id} className="subjects-folder-card">
                  <button
                    type="button"
                    className="subjects-folder-item"
                    onClick={() => openSubjectFolder(subject)}
                  >
                    <FiFolder className="subjects-folder-icon" />

                    <span className="subjects-folder-name">
                      {subject.id || "Unnamed Subject"}
                    </span>

                    <small>{subject.status || "No status"}</small>
                  </button>

                  {canModifySubjects && (
                    <div className="subjects-folder-actions">
                      <button
                        type="button"
                        className="subject-action-btn subject-action-edit"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditSubjectModal(subject);
                        }}
                        disabled={isStudyCompleted}
                        aria-disabled={isStudyCompleted}
                        aria-label={`Edit subject ${subject.id}`}
                        title={
                          isStudyCompleted
                            ? COMPLETED_STUDY_SUBJECT_EDIT_MESSAGE
                            : "Edit subject"
                        }
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        className="subject-action-btn subject-action-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteSubject(subject);
                        }}
                        aria-label={`Delete subject ${subject.id}`}
                        title="Delete subject"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="subjects-explorer-empty">
              No matching subjects found.
            </p>
          )}
        </div>
      )}

      {filteredSubjects.length > 0 && (
        <div className="subjects-pagination">
          <div className="subjects-pagination-info">
            Showing {pageStart}-{pageEnd} of {filteredSubjects.length} subjects
          </div>

          <div className="subjects-pagination-controls">
            <label className="subjects-page-size">
              Rows
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="Rows per page"
              >
                {SUBJECTS_PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="subjects-pagination-btn"
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <FiChevronLeft />
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={`subjects-pagination-btn ${
                    currentPage === pageNumber ? "active" : ""
                  }`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              )
            )}

            <button
              type="button"
              className="subjects-pagination-btn"
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {formModalMode && (
        <SubjectFormModal
          mode={formModalMode}
          studyId={studyId}
          subject={formModalSubject}
          record={formModalRecord}
          suggestedName=""
          validate={validateSubjectId}
          submitError={formModalError}
          onSubmit={handleFormModalSubmit}
          onClose={closeFormModal}
        />
      )}

      {/* Phase-7 IMP-MOD-2: standardized notice modal replaces window.alert()
          for the completed-study guards. Uses the same subject-modal shell
          for header/spacing/button consistency. */}
      {subjectNotice && (
        <div className="subject-modal-overlay" role="presentation">
          <div
            className="subject-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-notice-title"
          >
            <div className="subject-modal-header">
              <div>
                <h3 id="subject-notice-title">{subjectNotice.title}</h3>
                <p className="subject-modal-subtitle">
                  This action is not allowed for the current study state.
                </p>
              </div>
              <button
                type="button"
                className="subject-modal-close"
                onClick={() => setSubjectNotice(null)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <p className="subject-modal-error" role="alert">
              {subjectNotice.message}
            </p>

            <div className="subject-modal-actions">
              <button type="button" onClick={() => setSubjectNotice(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase-7 IMP-MOD-2: reuse shared DeleteConfirmationModal instead of
          window.confirm(). Preserves existing subject delete behavior. */}
      {subjectToDelete && (
        <DeleteConfirmationModal
          title="Delete Subject"
          itemType="subject"
          message={`Are you sure you want to delete subject ${subjectToDelete.id}? This action cannot be undone.`}
          onClose={() => setSubjectToDelete(null)}
          onConfirm={confirmDeleteSubject}
        />
      )}
    </div>
  );
}

export default StudySubjects;