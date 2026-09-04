import React, { useMemo, useState } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";
import SubjectService from "../../shared/services/subjectService";
import "../styles/PIStudySubjectProfile.css";

function PIStudySubjectProfile({ subject }: any) {
  const siteSources = useMemo(() => getStudies(), []);
  const siteDisplayValue = subject?.site
    ? resolveSiteDisplay(subject.site, {
        sources: siteSources,
        fallback: subject.site,
      })
    : "—";
  const [editIndex, setEditIndex] = useState(null);
  const [documentForm, setDocumentForm] = useState({
    name: "",
    type: "",
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [visitList, setVisitList] = useState(subject.visits || []);
  const [screeningList, setScreeningList] = useState(subject.screenings || []);
  const [enrollmentData, setEnrollmentData] = useState(
    subject.enrollment || {},
  );

  const [enrollmentForm, setEnrollmentForm] = useState({
    enrolledDate: "",
    arm: "",
    consentStatus: "",
  });
  const [queryForm, setQueryForm] = useState({
    id: "",
    description: "",
    status: "Open",
  });
  const [queryEditIndex, setQueryEditIndex] = useState(null);
  const handleEditScreening = (screening, index) => {
    setScreeningForm(screening);

    setEditIndex(index);

    setShowScreeningModal(true);
  };

  const [documentList, setDocumentList] = useState(subject.documents || []);
  const [queryList, setQueryList] = useState(subject.queries || []);
  const [auditList, setAuditList] = useState(subject.auditTrail || []);
  const addAuditLog = (action, updatedSubjectData?) => {
    if (!updatedSubjectData) {
      return;
    }
    const newLog = {
      action,
      user: "PI User",
      date: new Date().toLocaleString(),
    };

    const updatedAudit = [...(updatedSubjectData.auditTrail || []), newLog];

    const finalSubject = {
      ...updatedSubjectData,
      auditTrail: updatedAudit,
    };

    setAuditList(updatedAudit);

    localStorage.setItem("selectedSubject", JSON.stringify(finalSubject));

    SubjectService.updateSubjectRecord(
      subject.study || subject.studyId,
      subject.id,
      finalSubject || {},
    );
  };
  const [showScreeningModal, setShowScreeningModal] = useState(false);

  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);

  const [showDocumentModal, setShowDocumentModal] = useState(false);

  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);

  const [newVisit, setNewVisit] = useState({
    visitName: "",
    visitDate: "",
    status: "Scheduled",
  });
  const [screeningForm, setScreeningForm] = useState({
    screeningDate: "",
    eligibility: "",
    notes: "",
  });

  const handleAddVisit = () => {
    if (!newVisit.visitName) {
      alert("Enter Visit Name");
      return;
    }

    let updatedVisits = [...visitList];

    if (editIndex !== null) {
      updatedVisits[editIndex] = newVisit;
    } else {
      updatedVisits.push(newVisit);
    }
    setVisitList(updatedVisits);
    const newAudit = {
      action: editIndex !== null ? "Updated Visit" : "Created Visit",
      user: "PI User",
      date: new Date().toLocaleString(),
    };

    const updatedAudit = [...auditList, newAudit];

    setAuditList(updatedAudit);

    const updatedSubject = {
      ...subject,
      visits: updatedVisits,
    };

    addAuditLog("Deleted Visit", updatedSubject);

    SubjectService.updateSubjectRecord(
      subject.study || subject.studyId,
      subject.id,
      updatedSubject || {},
    );

    setShowVisitModal(false);

    setNewVisit({
      visitName: "",
      visitDate: "",
      status: "Scheduled",
    });
    setEditIndex(null);
  };

  const handleEditEnrollment = () => {
    setEnrollmentForm({
      enrolledDate: enrollmentData.enrolledDate || "",

      arm: enrollmentData.arm || "",

      consentStatus: enrollmentData.consentStatus || "",
    });

    setShowEnrollmentModal(true);
  };
  const saveEnrollment = () => {
    setEnrollmentData(enrollmentForm);

    const updatedSubject = {
      ...subject,
      enrollment: enrollmentForm,
    };

    localStorage.setItem("selectedSubject", JSON.stringify(updatedSubject));

    SubjectService.updateSubjectRecord(
      subject.study || subject.studyId,
      subject.id,
      updatedSubject || {},
    );

    setShowEnrollmentModal(false);
  };

  const saveDocument = () => {
    if (!documentForm.name) {
      alert("Enter Document Name");
      return;
    }

    let updatedDocuments = [...documentList];

    if (editIndex !== null) {
      updatedDocuments[editIndex] = documentForm;
    } else {
      updatedDocuments.push(documentForm);
    }
    setDocumentList(updatedDocuments);

    const updatedSubject = {
      ...subject,
      documents: updatedDocuments,
    };

    addAuditLog(
      editIndex !== null ? "Updated Document" : "Created Document",
      updatedSubject,
    );

    SubjectService.updateSubjectRecord(
      subject.study || subject.studyId,
      subject.id,
      updatedSubject || {},
    );

    setShowDocumentModal(false);

    setDocumentForm({
      name: "",
      type: "",
    });
    setEditIndex(null);
  };
  const saveQuery = () => {
    if (!queryForm.description) {
      alert("Enter Query Description");
      return;
    }

    let updatedQueries = [...queryList];

    if (queryEditIndex !== null) {
      updatedQueries[queryEditIndex] = queryForm;
    } else {
      updatedQueries.push(queryForm);
    }

    setQueryList(updatedQueries);

    const updatedSubject = {
      ...subject,
      queries: updatedQueries,
    };

    addAuditLog(
      queryEditIndex !== null ? "Updated Query" : "Created Query",
      updatedSubject,
    );
    SubjectService.updateSubjectRecord(
      subject.study || subject.studyId,
      subject.id,
      updatedSubject || {},
    );

    setShowQueryModal(false);
    setQueryEditIndex(null);

    setQueryForm({
      id: "",
      description: "",
      status: "Open",
    });
  };

  const saveScreening = () => {
    let updatedScreenings = [...screeningList];

    if (editIndex !== null) {
      updatedScreenings[editIndex] = screeningForm;
    } else {
      updatedScreenings.push(screeningForm);
    }

    setScreeningList(updatedScreenings);

    const updatedSubject = {
      ...subject,
      screenings: updatedScreenings,
    };

    addAuditLog(
      editIndex !== null ? "Updated Screening" : "Created Screening",
      updatedSubject,
    );
    SubjectService.updateSubjectRecord(
      subject.study || subject.studyId,
      subject.id,
      updatedSubject || {},
    );

    setShowScreeningModal(false);

    setEditIndex(null);
  };
  if (!subject) {
    return <div className="profile-empty">No Subject Selected</div>;
  }
  // Edit Visit
  const handleEditVisit = (visit, index) => {
    setNewVisit(visit); // Modal lo data prefill
    setEditIndex(index); // Edit row track
    setShowVisitModal(true); // Modal open
  };
  const handleDeleteScreening = (index) => {
    const updatedScreenings = [...screeningList];

    updatedScreenings.splice(index, 1);

    setScreeningList(updatedScreenings);

    const updatedSubject = {
      ...subject,
      screenings: updatedScreenings,
    };

    addAuditLog(
      editIndex !== null ? "Updated Screening" : "Created Screening",
      updatedSubject,
    );
    SubjectService.updateSubjectRecord(
      subject.study || subject.studyId,
      subject.id,
      updatedSubject || {},
    );
  };
  // Delete Visit
  const handleDeleteVisit = (index) => {
    const updatedVisits = [...visitList];
    updatedVisits.splice(index, 1); // Remove row
    setVisitList(updatedVisits);

    // Update localStorage
    const updatedSubject = { ...subject, visits: updatedVisits };
    SubjectService.updateSubjectRecord(
      subject.studyId || subject.study,
      subject.id,
      updatedSubject,
    );
  };

  return (
    <div className="subject-profile-page tnxt-compact">
      <div className="profile-header">
        <div>
          <h2>Subject Profile - {subject.id}</h2>

          <p>Complete participant overview</p>
        </div>

        <span className={`status-badge ${subject.status.toLowerCase()}`}>
          {subject.status}
        </span>
      </div>

      <div className="profile-summary">
        <div className="summary-card">
          <h5>Initials</h5>
          <p>{subject.initials}</p>
        </div>

        <div className="summary-card">
          <h5>Study</h5>
          <p>{subject.study}</p>
        </div>

        <div className="summary-card">
          <h5>Site</h5>
          <p>{siteDisplayValue}</p>
        </div>

        <div className="summary-card">
          <h5>Enrollment Date</h5>
          <p>{subject.enrollmentDate}</p>
        </div>
      </div>
      <div className="profile-kpis">
        <div className="kpi-card">
          <h5>Visits</h5>
          <h2>{visitList?.length || 0}</h2>
        </div>

        <div className="kpi-card">
          <h5>Documents</h5>
          <h2>{documentList.length}</h2>
        </div>

        <div className="kpi-card">
          <h5>Open Queries</h5>
          <h2>{queryList.length}</h2>
        </div>

        <div className="kpi-card">
          <h5>Audit Events</h5>
          <h2>{auditList.length}</h2>
        </div>
      </div>
      <div className="subject-timeline">
        <div className="timeline-step active">Screening</div>

        <div className="timeline-step">Enrollment</div>

        <div className="timeline-step">Visit 1</div>

        <div className="timeline-step">Visit 2</div>

        <div className="timeline-step">Completed</div>
      </div>

      <div className="profile-tabs">
        <button
          className={activeTab === "overview" ? "active-tab" : ""}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>

        <button
          className={activeTab === "screening" ? "active-tab" : ""}
          onClick={() => setActiveTab("screening")}
        >
          Screening
        </button>

        <button
          className={activeTab === "enrollment" ? "active-tab" : ""}
          onClick={() => setActiveTab("enrollment")}
        >
          Enrollment
        </button>

        <button
          className={activeTab === "visits" ? "active-tab" : ""}
          onClick={() => setActiveTab("visits")}
        >
          Visits
        </button>

        <button
          className={activeTab === "documents" ? "active-tab" : ""}
          onClick={() => setActiveTab("documents")}
        >
          Documents
        </button>

        <button
          className={activeTab === "queries" ? "active-tab" : ""}
          onClick={() => setActiveTab("queries")}
        >
          Queries
        </button>

        <button
          className={activeTab === "audit" ? "active-tab" : ""}
          onClick={() => setActiveTab("audit")}
        >
          Audit Trail
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "overview" && (
          <div>
            <h3>Overview</h3>

            <div className="overview-grid">
              <div className="overview-card">
                <h5>Subject ID</h5>

                <p>{subject.id}</p>

                <small>Active Participant</small>
              </div>

              <div className="overview-card">
                <h5>Status</h5>

                <span
                  className={`status-badge ${subject.status.toLowerCase()}`}
                >
                  {subject.status}
                </span>
              </div>

              <div className="overview-card">
                <h5>Last Visit</h5>

                <p>{subject.lastVisit || "N/A"}</p>

                <small>Most recent study visit</small>
              </div>
            </div>
          </div>
        )}

        {activeTab === "screening" && (
          <div className="tab-content-card">
            <div className="visit-header">
              <h3>Screening History</h3>

              <button
                className="add-visit-btn"
                onClick={() => {
                  setScreeningForm({
                    screeningDate: "",
                    eligibility: "",
                    notes: "",
                  });

                  setEditIndex(null);
                  setShowScreeningModal(true);
                }}
              >
                + Add Screening
              </button>
            </div>

            <table className="profile-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Eligibility</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {screeningList.map((screening, index) => (
                  <tr key={index}>
                    <td>{screening.screeningDate}</td>

                    <td>{screening.eligibility}</td>

                    <td>{screening.notes}</td>

                    <td>
                      <FaEdit
                        className="table-action edit"
                        onClick={() => handleEditScreening(screening, index)}
                      />

                      <FaTrash
                        className="table-action delete"
                        onClick={() => handleDeleteScreening(index)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === "enrollment" && (
          <div className="tab-content-card">
            <div className="section-header">
              <h3>Enrollment Details</h3>

              <button className="add-visit-btn" onClick={handleEditEnrollment}>
                Edit Enrollment
              </button>
            </div>

            <div className="overview-grid">
              <div className="overview-card">
                <h5>Enrollment Date</h5>
                <p>{enrollmentData?.enrolledDate || "Not Available"}</p>
              </div>

              <div className="overview-card">
                <h5>Treatment Arm</h5>
                <p>{enrollmentData?.arm || "Not Assigned"}</p>
              </div>

              <div className="overview-card">
                <h5>Consent Status</h5>
                <p>{enrollmentData?.consentStatus || "Pending"}</p>
              </div>
            </div>
          </div>
        )}
        {activeTab === "documents" && (
          <div className="tab-content-card">
            <div className="section-header">
              <h3>Documents</h3>

              <button
                className="add-visit-btn"
                onClick={() => setShowDocumentModal(true)}
              >
                + Add Document
              </button>
            </div>
            <table className="subjects-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {documentList.map((doc, index) => (
                  <tr key={index}>
                    <td>{doc.name}</td>

                    <td>{doc.type}</td>

                    <td>
                      <FaEdit
                        className="table-action edit"
                        onClick={() => {
                          setDocumentForm(doc);

                          setEditIndex(index);

                          setShowDocumentModal(true);
                        }}
                      />

                      <FaTrash
                        className="table-action delete"
                        onClick={() => {
                          const updatedDocuments = [...documentList];

                          updatedDocuments.splice(index, 1);

                          setDocumentList(updatedDocuments);
                          addAuditLog("Deleted Document");

                          const updatedSubject = {
                            ...subject,
                            documents: updatedDocuments,
                          };

                          localStorage.setItem(
                            "selectedSubject",
                            JSON.stringify(updatedSubject),
                          );

                          SubjectService.updateSubjectRecord(
                            subject.study || subject.studyId,
                            subject.id,
                            updatedSubject || {},
                          );
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === "visits" && (
          <div>
            <div className="visit-header">
              <h3>Visit History</h3>

              <button
                className="add-visit-btn"
                onClick={() => setShowVisitModal(true)}
              >
                + Add Visit
              </button>
            </div>

            <table className="profile-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Visit Name</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visitList.map((visit, index) => (
                  <tr key={index}>
                    <td>{visit.visitName}</td>
                    <td>{visit.visitDate || "-"}</td>

                    <td>
                      <span
                        className={`visit-status ${visit.status.toLowerCase()}`}
                      >
                        {visit.status}
                      </span>
                    </td>
                    <td>
                      <FaEdit
                        className="table-action edit"
                        onClick={() => handleEditVisit(visit, index)}
                      />

                      <FaTrash
                        className="table-action delete"
                        onClick={() => handleDeleteVisit(index)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "queries" && (
          <div className="tab-content-card">
            <div className="section-header">
              <h3>Queries</h3>

              <button
                className="add-visit-btn"
                onClick={() => setShowQueryModal(true)}
              >
                + Create Query
              </button>
            </div>
            <table className="subjects-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Query ID</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {queryList.map((query, index) => (
                  <tr key={index}>
                    <td>{query.id}</td>

                    <td>{query.description}</td>

                    <td>{query.status}</td>

                    <td>
                      <FaEdit
                        className="table-action edit"
                        onClick={() => {
                          setQueryForm(query);

                          setQueryEditIndex(index);

                          setShowQueryModal(true);
                        }}
                      />

                      <FaTrash
                        className="table-action delete"
                        onClick={() => {
                          const updatedQueries = [...queryList];

                          updatedQueries.splice(index, 1);

                          setQueryList(updatedQueries);

                          const updatedSubject = {
                            ...subject,
                            queries: updatedQueries,
                          };

                          localStorage.setItem(
                            "selectedSubject",
                            JSON.stringify(updatedSubject),
                          );

                          SubjectService.updateSubjectRecord(
                            subject.study || subject.studyId,
                            subject.id,
                            updatedSubject || {},
                          );

                          addAuditLog("Deleted Query");
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="tab-content-card">
            <h3>Audit Trail</h3>

            <table className="subjects-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>User</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {auditList.map((audit, index) => (
                  <tr key={index}>
                    <td>{audit.action}</td>
                    <td>{audit.user}</td>
                    <td>{audit.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showVisitModal && (
          <div className="modal-overlay">
            <div className="modal-box">
              <h3>{editIndex !== null ? "Edit Visit" : "Add Visit"}</h3>

              <input
                placeholder="Visit Name"
                value={newVisit.visitName}
                onChange={(e) =>
                  setNewVisit({
                    ...newVisit,
                    visitName: e.target.value,
                  })
                }
              />

              <input
                type="date"
                value={newVisit.visitDate}
                onChange={(e) =>
                  setNewVisit({
                    ...newVisit,
                    visitDate: e.target.value,
                  })
                }
              />

              <select
                value={newVisit.status}
                onChange={(e) =>
                  setNewVisit({
                    ...newVisit,
                    status: e.target.value,
                  })
                }
              >
                <option>Scheduled</option>
                <option>Completed</option>
                <option>Missed</option>
              </select>

              <div className="modal-buttons">
                <button
                  className="cancel-btn"
                  onClick={() => setShowVisitModal(false)}
                >
                  Cancel
                </button>

                <button className="save-btn" onClick={handleAddVisit}>
                  Save Visit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showScreeningModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editIndex !== null ? "Edit Screening" : "Add Screening"}</h3>

            <input
              type="date"
              value={screeningForm.screeningDate}
              onChange={(e) =>
                setScreeningForm({
                  ...screeningForm,
                  screeningDate: e.target.value,
                })
              }
            />

            <select
              value={screeningForm.eligibility}
              onChange={(e) =>
                setScreeningForm({
                  ...screeningForm,
                  eligibility: e.target.value,
                })
              }
            >
              <option value="">Select</option>
              <option value="Eligible">Eligible</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>

            <textarea
              value={screeningForm.notes}
              onChange={(e) =>
                setScreeningForm({
                  ...screeningForm,
                  notes: e.target.value,
                })
              }
            />

            <button className="save-btn" type="button" onClick={saveScreening}>
              Save
            </button>

            <button
              className="cancel-btn"
              type="button"
              onClick={() => setShowScreeningModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {showEnrollmentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Enrollment</h3>

            <input
              type="date"
              value={enrollmentForm.enrolledDate}
              onChange={(e) =>
                setEnrollmentForm({
                  ...enrollmentForm,
                  enrolledDate: e.target.value,
                })
              }
            />

            <input
              placeholder="Treatment Arm"
              value={enrollmentForm.arm}
              onChange={(e) =>
                setEnrollmentForm({
                  ...enrollmentForm,
                  arm: e.target.value,
                })
              }
            />

            <select
              value={enrollmentForm.consentStatus}
              onChange={(e) =>
                setEnrollmentForm({
                  ...enrollmentForm,
                  consentStatus: e.target.value,
                })
              }
            >
              <option value="">Select Consent</option>

              <option value="Pending">Pending</option>

              <option value="Signed">Signed</option>

              <option value="Rejected">Rejected</option>
            </select>

            <div className="modal-buttons">
              <button
                className="save-btn"
                type="button"
                onClick={saveEnrollment}
              >
                Save
              </button>

              <button
                className="cancel-btn"
                type="button"
                onClick={() => setShowEnrollmentModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showDocumentModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editIndex !== null ? "Edit Document" : "Add Document"}</h3>

            <input
              placeholder="Document Name"
              value={documentForm.name}
              onChange={(e) =>
                setDocumentForm({
                  ...documentForm,
                  name: e.target.value,
                })
              }
            />

            <select
              value={documentForm.type}
              onChange={(e) =>
                setDocumentForm({
                  ...documentForm,
                  type: e.target.value,
                })
              }
            >
              <option value="">Select Type</option>

              <option value="ICF">ICF</option>

              <option value="Lab Report">Lab Report</option>

              <option value="Medical Record">Medical Record</option>
            </select>

            <div className="modal-buttons">
              <button className="save-btn" onClick={saveDocument}>
                Save
              </button>

              <button
                className="cancel-btn"
                onClick={() => setShowDocumentModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showQueryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{queryEditIndex !== null ? "Edit Query" : "Create Query"}</h3>

            <input
              placeholder="Query ID"
              value={queryForm.id}
              onChange={(e) =>
                setQueryForm({
                  ...queryForm,
                  id: e.target.value,
                })
              }
            />

            <textarea
              placeholder="Description"
              value={queryForm.description}
              onChange={(e) =>
                setQueryForm({
                  ...queryForm,
                  description: e.target.value,
                })
              }
            />

            <select
              value={queryForm.status}
              onChange={(e) =>
                setQueryForm({
                  ...queryForm,
                  status: e.target.value,
                })
              }
            >
              <option>Open</option>
              <option>Closed</option>
              <option>Pending</option>
            </select>

            <div className="modal-buttons">
              <button className="save-btn" onClick={saveQuery}>
                Save
              </button>

              <button
                className="cancel-btn"
                onClick={() => setShowQueryModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PIStudySubjectProfile;
