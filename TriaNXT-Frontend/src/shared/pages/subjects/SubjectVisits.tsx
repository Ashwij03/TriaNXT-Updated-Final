// newly added

import { useState } from "react";
import {
  markVisitStageCompleted,
  syncSubjectSchedules
} from "../../services/visitScheduleService";
import "./SubjectVisits.css";

function SubjectVisits({
  subject,
  setActiveTab
}: any) {

  const [visits, setVisits] = useState(
    JSON.parse(
      localStorage.getItem(
        `subject_${subject.id}_visits`
      )
    ) || []
  );

  const [showVisitModal, setShowVisitModal] =
    useState(false);
  
  const [showDeleteModal, setShowDeleteModal] =
    useState(false);

  const [selectedVisit, setSelectedVisit] =
    useState(null);

  const [deleteInfo, setDeleteInfo] =
    useState({
      deletedBy: "",
      reason: ""
    });

  const [newVisit, setNewVisit] =
    useState({
      id: "",
      name: "",
      plannedDate: "",
      actualDate: "",
      status: "Scheduled"
    });

  const persistVisits = (updatedVisits, completedVisitName = "") => {
    setVisits(updatedVisits);

    localStorage.setItem(
      `subject_${subject.id}_visits`,
      JSON.stringify(updatedVisits)
    );

    syncSubjectSchedules(
      subject.studyId || subject.study || subject.studyName,
      subject.id,
      subject
    );

    if (completedVisitName) {
      markVisitStageCompleted(
        subject.studyId || subject.study || subject.studyName,
        subject.id,
        completedVisitName
      );
    }
  };

  const addVisit = () => {

    let updatedVisits;

    if (newVisit.id) {

      updatedVisits =
        visits.map(v =>
          String(v.id) ===
          String(newVisit.id)
            ? newVisit
            : v
        );

    } else {

      updatedVisits = [

        ...visits,

        {
          ...newVisit,
          id: Date.now()
        }

      ];

    }

    const completedVisitName =
      newVisit.status === "Completed" ? newVisit.name : "";

    persistVisits(updatedVisits, completedVisitName);

    setNewVisit({
      id: "",
      name: "",
      plannedDate: "",
      actualDate: "",
      status: "Scheduled"
    });

    setShowVisitModal(false);

  };

  const deleteVisit = (visit) => {

    setSelectedVisit(visit);

    setShowDeleteModal(true);

  };

  const confirmDeleteVisit = () => {

    if (
      !deleteInfo.deletedBy.trim() ||
      !deleteInfo.reason.trim()
    ) {
      alert(
        "Deleted By and Reason are required."
      );
      return;
    }

    const updatedVisits =
      visits.filter(
        visit =>
          String(visit.id) !==
          String(selectedVisit.id)
      );

    persistVisits(updatedVisits);

    const logs =
      JSON.parse(
        localStorage.getItem("auditLogs")
      ) || [];

    logs.push({
      action: "DELETE VISIT",
      subjectId: subject.id,
      visitName: selectedVisit.name,
      deletedBy: deleteInfo.deletedBy,
      reason: deleteInfo.reason,
      deletedAt:
        new Date().toISOString()
    });

    localStorage.setItem(
      "auditLogs",
      JSON.stringify(logs)
    );

    setShowDeleteModal(false);

    setSelectedVisit(null);

    setDeleteInfo({
      deletedBy: "",
      reason: ""
    });

  };

  // eslint-disable-next-line no-unused-vars
  const updateVisit = (
    visitId,
    data
  ) => {
  
    const updatedVisits =
      visits.map(
        visit =>
          visit.id === visitId
            ? {
                ...visit,
                ...data
              }
            : visit
      );
    
    persistVisits(updatedVisits);
  
  };

  const viewVisit = (visit) => {

    localStorage.setItem(
      "selectedVisit",
      JSON.stringify(visit)
    );

    setActiveTab("VisitDetails");

  };

  const editVisit = (visit) => {

    setNewVisit({
      id: visit.id,
      name: visit.name,
      plannedDate: visit.plannedDate,
      actualDate: visit.actualDate || "",
      status: visit.status
    });

    setShowVisitModal(true);

  };

  return (

    <div className="subject-tab-card">

      <div className="visits-header">

        <h2>Subject Visits</h2>

        <button
          className="add-visit-btn"
          onClick={() =>
            setShowVisitModal(true)
          }>

          + Add Visit
        </button>
        
      </div>

      <table>

        <thead>

          <tr>

            <th>Visit Name</th>
            <th>Planned Date</th>
            <th>Status</th>
            <th>Action</th>

          </tr>

        </thead>

        <tbody>

          {visits.length === 0 ? (
          
            <tr>
            
              <td
                colSpan={4}
                className="no-visits">

                No Visits Added Yet
              </td>
          
            </tr>

          ) : (
          
            visits.map((visit) => (
            
              <tr key={visit.id}>
              
                <td>{visit.name}</td>
            
                <td>{visit.plannedDate}</td>
            
                <td>{visit.status}</td>
            
                <td className="visit-actions">
            
                  <button
                    className="view-visit-btn"
                    onClick={() => viewVisit(visit)}>

                    View
                  </button>
            
                  <button
                    className="btn-edit edit-visit-btn"
                    onClick={() => editVisit(visit)}>

                    Edit
                  </button>
            
                  <button
                    className="delete-visit-btn"
                    onClick={() => deleteVisit(visit)}>

                    Delete
                  </button>
            
                </td>
            
              </tr>

            ))
          
          )}

        </tbody>

      </table>

      {
        showVisitModal && (
        
          <div className="visit-modal-overlay">
          
            <div className="visit-modal">
        
              <h3>
                {newVisit.id
                  ? "Edit Visit"
                  : "Add Visit"}
              </h3>
        
              <input
                type="text"
                value={newVisit.name}
                placeholder="Visit Name"
                onChange={(e)=>
                  setNewVisit({
                    ...newVisit,
                    name:e.target.value
                  })
                }
              />

              <input
                type="date"
                value={newVisit.plannedDate}
                onChange={(e)=>
                  setNewVisit({
                    ...newVisit,
                    plannedDate:e.target.value
                  })
                }
              />

              <select
                value={newVisit.status}
                onChange={(e)=>
                  setNewVisit({
                    ...newVisit,
                    status:e.target.value
                  })
                }>

                <option>Scheduled</option>
                <option>Completed</option>
                <option>Missed</option>
              </select>
              
              <div className="visit-modal-actions">
              
                <button
                  onClick={() =>
                    setShowVisitModal(false)
                  }>

                  Cancel
                </button>
                
                <button
                  onClick={addVisit}>

                  {
                    newVisit.id
                      ? "Update Visit"
                      : "Save Visit"
                  }
                </button>
                
              </div>
                
            </div>
                
          </div>

        )
      }

      {
        showDeleteModal && (
        
          <div className="visit-modal-overlay">
          
            <div className="visit-modal">
        
              <h3>
                Delete Visit
              </h3>
        
              <p>
                This action will be
                recorded in Audit Trail.
              </p>
        
              <input
                type="text"
                placeholder="Deleted By"
                value={deleteInfo.deletedBy}
                onChange={(e)=>
                  setDeleteInfo({
                    ...deleteInfo,
                    deletedBy:e.target.value
                  })
                }
                required
              />

              <textarea
                placeholder="Reason For Deletion"
                value={deleteInfo.reason}
                onChange={(e)=>
                  setDeleteInfo({
                    ...deleteInfo,
                    reason:e.target.value
                  })
                }
                required
              />

              <div
                className="visit-modal-actions">

              
                <button
                  className="visit-cancel-btn"
                  onClick={() =>
                    setShowDeleteModal(false)
                  }>

                  Cancel
                </button>
                
                <button
                  className="visit-delete-btn"
                  onClick={confirmDeleteVisit}>

                  Delete Visit
                </button>
                
              </div>
                
            </div>
                
          </div>

        )
      }

    </div>

  );
}

export default SubjectVisits;