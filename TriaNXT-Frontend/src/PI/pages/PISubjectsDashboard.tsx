import React, { useEffect, useMemo, useState } from "react";

import "../styles/PISubjectsDashboard.css";
// Phase 7 — IMP-MOD-2: reuse the standardized Subject Modal styles so the PI
// Subject create flow matches the shared standardized modal layout, spacing,
// validation, and button placement.
import "../../shared/pages/studies/StudySubjects.css";import { FaEye, FaFileAlt, FaEllipsisV, FaExclamationTriangle } from "react-icons/fa";
import {
  COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE,
  getStudyByCode,
  getSubjectStudyDefaults,
  getStudies,
  createSubject,
} from "../../shared/services/studyService";
import { STUDY_STATUS_COMPLETED } from "../../shared/constants/studyStatus";
import SubjectService from "../../shared/services/subjectService";import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { useNavigate } from "react-router-dom";
import { subscribeConsentIcf } from "../../shared/services/icfConsentService";
import { getSubjectConsentStatus } from "../../shared/components/SubjectExplorer/subjectConsentStatus";


function normalizeRowValue(value) {
  return String(value ?? "").trim();
}

function rowTodayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/* Compact row alert: count of scheduled-but-past subject visits (same
   "scheduled in the past = overdue" rule the Profile tab uses). */
function readSubjectOverdueVisits(subjectId) {
  if (typeof window === "undefined") return 0;
  try {
    const visits = JSON.parse(
      localStorage.getItem(`subject_${subjectId}_visits`) || "[]",
    );
    if (!Array.isArray(visits)) return 0;
    const today = rowTodayKey();
    return visits.filter(
      (visit) =>
        visit &&
        normalizeRowValue(visit.status).toLowerCase() === "scheduled" &&
        visit.plannedDate &&
        String(visit.plannedDate) < today,
    ).length;
  } catch {
    return 0;
  }
}

function PISubjectsDashboard({ onProfileClick }: any) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [subjectModalError, setSubjectModalError] = useState("");

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value,
        })
      : "—";
  const studyOptions = useMemo(
    () =>
      getStudies().filter(
        (study) => study && study.status !== STUDY_STATUS_COMPLETED,
      ),
    [],
  );

  const [selectedStudyId, setSelectedStudyId] = useState("");
  const isCompletedStudySelected = Boolean(
    selectedStudyId &&
    getStudyByCode(selectedStudyId)?.status === STUDY_STATUS_COMPLETED,
  );
  const [subjects, setSubjects] = useState(() => {
    return selectedStudyId
      ? SubjectService.getSubjectsForStudy(selectedStudyId)
      : SubjectService.getAllSubjects();
  });

  useEffect(() => {
    const refresh = () => {
      setSubjects(
        selectedStudyId
          ? SubjectService.getSubjectsForStudy(selectedStudyId)
          : SubjectService.getAllSubjects(),
      );
    };
    window.addEventListener("subjects-updated", refresh);
    return () => window.removeEventListener("subjects-updated", refresh);
  }, [selectedStudyId]);

  /* Refresh the compact row alerts whenever consent or visit data changes
     elsewhere, so the list never shows a stale Consent/Overdue flag. */
  const [listTick, setListTick] = useState(0);

  useEffect(
    () => subscribeConsentIcf(() => setListTick((value) => value + 1)),
    [],
  );

  useEffect(() => {
    const bump = () => setListTick((value) => value + 1);
    window.addEventListener("visitSchedulesChange", bump);
    return () => window.removeEventListener("visitSchedulesChange", bump);
  }, []);
  const handleAddSubject = (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    setSubjectModalError("");

    if (!newSubject.id || !newSubject.initials || !newSubject.study) {
      setSubjectModalError("Please fill required fields.");
      return;
    }

    // Item 7 (Stage 5A): resolve the authoritative study and refuse subject
    // creation for Completed studies BEFORE any mutation.
    const targetStudy = getStudyByCode(newSubject.study);
    if (targetStudy && targetStudy.status === STUDY_STATUS_COMPLETED) {
      setSubjectModalError(COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE);
      return;
    }

    const studyDerivedFields = getSubjectStudyDefaults(newSubject.study);
    const subjectForCanonicalStore = {
      id: newSubject.id.trim(),
      initials: newSubject.initials.trim(),
      studyId: newSubject.study,
      pi: studyDerivedFields.pi,
      site: studyDerivedFields.site,
      status: newSubject.status,
      enrollmentDate: newSubject.enrollmentDate,
      currentVisit: newSubject.lastVisit,
    };
    try {
      createSubject(newSubject.study, subjectForCanonicalStore);
    } catch (error) {
      setSubjectModalError(
        (error && error.message) || COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE,
      );
      return;
    }

    // Subject was already created in the canonical store via createSubject above.
    // Refresh from the store to get the authoritative record.
    setSubjects(
      selectedStudyId
        ? SubjectService.getSubjectsForStudy(selectedStudyId)
        : SubjectService.getAllSubjects(),
    );

    setShowModal(false);
    setSubjectModalError("");

    setNewSubject({
      id: "",
      initials: "",
      study: "",
      site: "",
      status: "Screening",
      enrollmentDate: "",
      lastVisit: "",

      screening: {
        screeningDate: "",
        eligibility: "Pending",
        notes: "",
      },

      enrollment: {
        enrolledDate: "",
        arm: "",
        consentStatus: "Pending",
      },

      visits: [
        {
          visitName: "Screening",
          visitDate: "",
          status: "Scheduled",
        },
      ],

      documents: [],
      queries: [],

      auditTrail: [
        {
          action: "Subject Created",
          user: "PI",
          date: new Date().toLocaleDateString(),
        },
      ],
    });
  };
  const [selectedStatus, setSelectedStatus] = useState("All");

  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch = subject.id
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      selectedStatus === "All" || subject.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  /* Per-row alert payloads (consent + overdue visits), derived live from
     icfConsentService and the subject-visits store. */
  const rowAlerts = useMemo(
    () => {
      const map = {};
      filteredSubjects.forEach((subject) => {
        const studyKey = normalizeRowValue(
          subject.studyId || subject.studyCode || subject.study || "",
        );
        let consent = null;
        if (studyKey && subject.id) {
          const state = getSubjectConsentStatus(
            studyKey,
            subject.id,
            subject.site,
          );
          if (state.key === "pending" || state.key === "re-consent") {
            consent = state;
          }
        }
        map[subject.id] = {
          consent,
          overdueCount: readSubjectOverdueVisits(subject.id),
        };
      });
      return map;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredSubjects, listTick],
  );

  const enrolledCount = subjects.filter((s) => s.status === "Enrolled").length;

  const screeningCount = subjects.filter(
    (s) => s.status === "Screening",
  ).length;

  const completedCount = subjects.filter(
    (s) => s.status === "Completed",
  ).length;

  const withdrawnCount = subjects.filter(
    (s) => s.status === "Withdrawn",
  ).length;
  const [showModal, setShowModal] = useState(false);

  const [newSubject, setNewSubject] = useState({
    id: "",
    initials: "",
    study: "",
    site: "",
    status: "Screening",
    enrollmentDate: "",
    lastVisit: "",

    screening: {
      screeningDate: "",
      eligibility: "Pending",
      notes: "",
    },

    enrollment: {
      enrolledDate: "",
      arm: "",
      consentStatus: "Pending",
    },

    visits: [
      {
        visitName: "Screening",
        visitDate: "",
        status: "Scheduled",
      },
    ],

    documents: [],

    queries: [],

    auditTrail: [
      {
        action: "Subject Created",
        user: "PI",
        date: new Date().toLocaleDateString(),
      },
    ],
  });

  const selectedStudyDefaults = useMemo(
    () => getSubjectStudyDefaults(newSubject.study),
    [newSubject.study],
  );

  const handleView = (subject) => {
    setSelectedSubject(subject);
    setShowViewModal(true);
  };

  const handleProfile = (subject) => {
    localStorage.setItem("selectedSubject", JSON.stringify(subject));

    // Route the row into the Study Subjects workspace (StudyDashboard's
    // Subjects tab -> Subject Explorer) for this subject's study, where the
    // new Profile tab (timeline + consent + visit checklist) lives.
    const studyKey = normalizeRowValue(
      subject.studyId || subject.studyCode || subject.study || "",
    );
    if (studyKey) {
      navigate(
        `/study-dashboard/${encodeURIComponent(studyKey)}?tab=Subjects&subject=${encodeURIComponent(subject.id)}`,
      );
      return;
    }

    // Fallback for any older host that passed onProfileClick.
    if (onProfileClick) {
      onProfileClick(subject);
    }
  };

  /* Row click opens the same Profile view, unless the click landed on an
     interactive control (View/Profile icons, ellipsis, form fields). */
  const handleRowOpen = (event, subject) => {
    if (!event || typeof event.target?.closest !== "function") return;
    const interactive = event.target.closest(
      "button, a, input, select, textarea, .action-buttons",
    );
    if (interactive) return;
    handleProfile(subject);
  };

  const handleMore = (subject) => {
    // Reserved for future subject detail expansion
  };

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  return (
    <div className="subjects-dashboard tnxt-compact">
      <div className="subjects-header">
        <div>
          <h2>Subjects</h2>
          <p>View and manage all subjects</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={selectedStudyId}
            onChange={(e) => setSelectedStudyId(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: "4px" }}
          >
            <option value="">All Studies</option>
            {studyOptions.map((study) => (
              <option key={study.code} value={study.code}>
                {study.code} — {study.name || study.protocol || "Untitled"}
              </option>
            ))}
          </select>
          <button
            className="add-subject-btn"
            onClick={() => {
              if (!isCompletedStudySelected) {
                setShowModal(true);
              }
            }}
            disabled={studyOptions.length === 0 || isCompletedStudySelected}
            title={
              isCompletedStudySelected
                ? COMPLETED_STUDY_SUBJECT_CREATION_MESSAGE
                : studyOptions.length === 0
                  ? "No non-completed studies are available for subject creation."
                  : undefined
            }
          >
            + Add Subject
          </button>
        </div>
      </div>

      <div className="subjects-filters">
        <input
          type="text"
          placeholder="Search Subject ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option>All</option>
          <option>Screening</option>
          <option>Enrolled</option>
          <option>Completed</option>
          <option>Withdrawn</option>
        </select>
      </div>

      <div className="subjects-kpis">
        <div className="subject-kpi">
          <h4>Total Subjects</h4>
          <h2>{subjects.length}</h2>
        </div>

        <div className="subject-kpi">
          <h4>Enrolled</h4>
          <h2>{enrolledCount}</h2>
        </div>

        <div className="subject-kpi">
          <h4>Screening</h4>
          <h2>{screeningCount}</h2>
        </div>

        <div className="subject-kpi">
          <h4>Completed</h4>
          <h2>{completedCount}</h2>
        </div>

        <div className="subject-kpi">
          <h4>Withdrawn</h4>
          <h2>{withdrawnCount}</h2>
        </div>
      </div>

      <div className="subjects-table-card">
        <table className="subjects-table ctms-standard-table">
          <thead>
            <tr>
              <th>Subject ID</th>
              <th>Initials</th>
              <th>Study</th>
              <th>Site</th>
              <th>Status</th>
              <th>Enrollment Date</th>
              <th>Last Visit</th>
              <th>Alerts</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredSubjects.map((subject) => {
              const alerts = rowAlerts[subject.id] || null;
              return (
              <tr
                key={subject.id}
                className="pi-subject-row"
                onClick={(event) => handleRowOpen(event, subject)}
              >
                <td>{subject.id}</td>
                <td>{subject.initials}</td>
                <td>{subject.study}</td>
                <td>{displaySite(subject.site)}</td>

                <td>
                  <span
                    className={`status-badge ${subject.status.toLowerCase()}`}
                  >
                    {subject.status}
                  </span>
                </td>
                <td>{subject.enrollmentDate}</td>
                <td>{subject.lastVisit}</td>
                <td>
                  <div className="pi-row-alerts">
                    {alerts?.consent && (
                      <span
                        className="pi-row-alert pi-row-alert--consent"
                        title={alerts.consent.detail}
                      >
                        <FaExclamationTriangle size={10} aria-hidden="true" />
                        Consent
                      </span>
                    )}
                    {alerts?.overdueCount > 0 && (
                      <span
                        className="pi-row-alert pi-row-alert--overdue"
                        title={`${alerts.overdueCount} scheduled visit(s) past their planned date`}
                      >
                        {alerts.overdueCount} Overdue
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <FaEye
                      className="action-icon"
                      title="View"
                      onClick={() => handleView(subject)}
                    />

                    <FaFileAlt
                      className="action-icon"
                      title="Profile"
                      onClick={() => handleProfile(subject)}
                    />

                    <FaEllipsisV
                      className="action-icon"
                      title="More"
                      onClick={() => handleMore(subject)}
                    />
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="subject-modal-overlay" role="presentation">
          <div
            className="subject-modal"
            role="dialog"
            aria-labelledby="pi-subject-modal-title"
            aria-modal="true"
          >
            <div className="subject-modal-header">
              <div>
                <h3 id="pi-subject-modal-title">Add Subject</h3>
                <p className="subject-modal-subtitle">
                  Enter the details for the new subject.
                </p>
              </div>
              <button
                type="button"
                className="subject-modal-close"
                onClick={() => {
                  setShowModal(false);
                  setSubjectModalError("");
                }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form
              className="subject-modal-form"
              onSubmit={handleAddSubject}
              noValidate
            >
              <div className="form-group">
                <label htmlFor="pi-subject-id">Subject ID</label>
                <input
                  id="pi-subject-id"
                  type="text"
                  placeholder="Subject ID"
                  value={newSubject.id}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      id: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pi-subject-initials">Initials</label>
                <input
                  id="pi-subject-initials"
                  type="text"
                  placeholder="Initials"
                  value={newSubject.initials}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      initials: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pi-subject-study">Study</label>
                <select
                  id="pi-subject-study"
                  value={newSubject.study}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      study: e.target.value,
                      site: getSubjectStudyDefaults(e.target.value).site,
                    })
                  }
                  required
                >
                  <option value="">Select active study</option>
                  {studyOptions.map((study) => (
                    <option key={study.code} value={study.code}>
                      {study.code} —{" "}
                      {study.name || study.protocol || "Untitled"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pi-subject-pi">Principal Investigator</label>
                <input
                  id="pi-subject-pi"
                  type="text"
                  placeholder="Principal Investigator"
                  value={selectedStudyDefaults.pi || "—"}
                  readOnly
                  aria-readonly="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pi-subject-site">Site</label>
                <input
                  id="pi-subject-site"
                  type="text"
                  placeholder="Site"
                  value={selectedStudyDefaults.siteDisplay || "—"}
                  readOnly
                  aria-readonly="true"
                />
              </div>

              <div className="form-group">
                <label htmlFor="pi-subject-enrollment-date">
                  Enrollment Date
                </label>
                <input
                  id="pi-subject-enrollment-date"
                  type="date"
                  value={newSubject.enrollmentDate}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      enrollmentDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="pi-subject-last-visit">Last Visit</label>
                <input
                  id="pi-subject-last-visit"
                  type="text"
                  placeholder="Last Visit"
                  value={newSubject.lastVisit}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      lastVisit: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="pi-subject-status">Status</label>
                <select
                  id="pi-subject-status"
                  value={newSubject.status}
                  onChange={(e) =>
                    setNewSubject({
                      ...newSubject,
                      status: e.target.value,
                  })
                }
              >
                <option>Screening</option>
                  <option>Enrolled</option>
                  <option>Completed</option>
                  <option>Withdrawn</option>
                </select>
              </div>

              {subjectModalError && (
                <p className="subject-modal-error" role="alert">
                  {subjectModalError}
                </p>
              )}

              <div className="subject-modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowModal(false);
                    setSubjectModalError("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit">Save Subject</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showViewModal && selectedSubject && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Subject Details - {selectedSubject.id}</h3>

            <div className="subject-view-grid">
              <div className="detail-card">
                <span className="detail-label">Subject ID</span>

                <span className="detail-value">{selectedSubject.id}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Initials</span>

                <span className="detail-value">{selectedSubject.initials}</span>
              </div>

              <div className="detail-card">
                <span className="detail-label">Study</span>

                <span className="detail-value">{selectedSubject.study}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Site</span>

                <span className="detail-value">
                  {displaySite(selectedSubject.site)}
                </span>
              </div>

              <div className="detail-card">
                <span className="detail-label">Status</span>

                <span
                  className={`status-badge ${selectedSubject.status.toLowerCase()}`}
                >
                  {selectedSubject.status}
                </span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Enrollment Data</span>

                <span className="detail-value">
                  {selectedSubject.enrollmentDate}
                </span>
              </div>

              <div className="detail-card">
                <span className="detail-label">Last Visit</span>

                <span className="detail-value">
                  {selectedSubject.lastVisit || "Not Available"}
                </span>
              </div>
            </div>

            <div className="modal-buttons">
              <button onClick={() => setShowViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PISubjectsDashboard;
