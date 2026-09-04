// SubjectsTab.js
import { useState } from "react";
import "./SubjectsTab.css";
import { Link, useParams } from "react-router-dom";
import DeleteConfirmationModal from "../../components/DeleteConfirmationModal";
import { deleteSubject } from "../../services/studyService";
import { FiTrash2 } from "react-icons/fi";

export default function SubjectsTab() {
  const { code } = useParams();
  const [openPopup, setOpenPopup] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState(null);

  const handleDeleteClick = (e, subjectId) => {
    e.stopPropagation();
    setSubjectToDelete(subjectId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = (deletionDetails) => {
    if (subjectToDelete) {
      try {
        deleteSubject(code, subjectToDelete, deletionDetails);
        setShowDeleteModal(false);
        setSubjectToDelete(null);
        alert(`Subject "${subjectToDelete}" has been deleted successfully.`);
      } catch (error) {
        alert("Error deleting subject: " + error.message);
      }
    }
  };

  return (
    <div className="subjects-wrapper tnxt-compact">

      {/* LEGEND */}
      <div className="legend-row">
        <span className="lg scheduled">Scheduled</span>
        <span className="lg partial">Partial</span>
        <span className="lg fail">Screen Fail</span>
        <span className="lg completed">Completed</span>
        <span className="lg paused">Paused</span>
        <span className="lg progress">In Progress</span>
        <span className="lg cancelled">Cancelled</span>
      </div>

      {/* TIMELINE */}
      <div className="timeline-scroll">
        <table className="timeline-table ctms-standard-table">

          <colgroup>
            <col className="col-subject" />
            <col className="col-status" />
            <col className="col-prescreen" />
            <col className="col-screening" />
            <col className="col-screening" />
            <col className="col-day" />
            <col className="col-month" />
            <col className="col-month" />
            <col className="col-month" />
            <col className="col-month" />
            <col className="col-month" />
            <col className="col-month" />
          </colgroup>

          <thead>
            <tr className="group-header">
              <th rowSpan={2} className="subject-col">Subject ID</th>
              <th rowSpan={2} className="status-col">Status</th>
              <th className="pre">Pre</th>
              <th colSpan={2} className="screening">Screening</th>
              <th className="day">Day</th>
              <th colSpan={6} className="followup">Follow-up</th>
            </tr>

            <tr className="column-header">
              <th><span>Prescreen</span></th>
              <th><span>Screening 1</span></th>
              <th><span>Screening 2</span></th>
              <th><span>Day 1</span></th>
              <th><span>Month 1</span></th>
              <th><span>Month 3</span></th>
              <th><span>Month 6</span></th>
              <th><span>Month 9</span></th>
              <th><span>Month 12</span></th>
              <th><span>Month 15</span></th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td className="subject-col">
                <div className="subject-cell-wrapper">
                  <span>B-B</span>
                  <button
                    className="subject-delete-btn"
                    onClick={(e) => handleDeleteClick(e, "B-B")}
                    title="Delete subject"
                    aria-label="Delete subject">

                    <FiTrash2 />
                  </button>
                </div>
              </td>
              <td className="status-text fail-text">Screen Fail</td>

              <td className="cell">✔</td>
              <td className="cell">✖</td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
            </tr>

            <tr>
              <td className="subject-col">
                <div className="subject-cell-wrapper">
                  <span>A-T</span>
                  <button
                    className="subject-delete-btn"
                    onClick={(e) => handleDeleteClick(e, "A-T")}
                    title="Delete subject"
                    aria-label="Delete subject">

                    <FiTrash2 />
                  </button>
                </div>
              </td>
              <td className="status-text progress-text">In Screening</td>

              <td className="cell">✔</td>

              {/* Visit History */}

<div className="visit-history">

  <h3>Visit History</h3>

  <table className="history-table ctms-standard-table">

    <thead>

      <tr>

        <th>Visit</th>

        <th>Date</th>

        <th>Status</th>

      </tr>

    </thead>

    <tbody>

      <tr>

        <td>Screening 1</td>

        <td>24-FEB-2022</td>

        <td>Completed</td>

      </tr>

      <tr>

        <td>Day 1</td>

        <td>28-FEB-2022</td>

        <td>Scheduled</td>

      </tr>

    </tbody>

  </table>

</div>

{/* Activity Log */}

<div className="activity-log">

  <h3>Activity Log</h3>

  <ul>

    <li>Subject Created</li>

    <li>Screening Visit Completed</li>

    <li>Subject Enrolled</li>

  </ul>

</div>

              {/* CLICK POPUP CELL */}
              <td className="cell">
                <div
                  className="visit-cell"
                  onClick={() =>
                    setOpenPopup(openPopup === "screening1" ? null : "screening1")
                  }>

                  ✔

                  {openPopup === "screening1" && (
                    <div className="visit-popup">
                      <div className="popup-title">
                        Visit 1 – Screening 1
                      </div>

                      <div className="popup-date">
                        Partially completed on<br />
                        <strong>24-FEB-2022</strong>
                      </div>

					 <Link
  to="/visit/1"
  className="popup-link"
  onClick={(e) => e.stopPropagation()}>

  View Visit Details
</Link>

                    </div>
                  )}
                </div>
              </td>

              <td className="cell">✔</td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
              <td className="cell"></td>
            </tr>
          </tbody>

        </table>
      </div>
    </div>
  );
}
