import { useState } from "react";
import { FiFlag, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  addStudyMilestone,
  deleteStudyMilestone,
  updateStudyMilestone,
} from "../../services/studyOverviewService";
import RequestPermissionButton from "../RequestPermissionButton";

function StudyMilestoneTimeline({
  studyCode,
  milestones,
  canEdit,
  onUpdated,
}: any) {
  const [form, setForm] = useState({
    title: "",
    targetDate: "",
    status: "Pending",
  });

  const handleAdd = (event) => {
    event.preventDefault();
    if (!canEdit) return;
    if (!String(form.title).trim()) return;
    addStudyMilestone(studyCode, form);
    setForm({ title: "", targetDate: "", status: "Pending" });
    onUpdated?.();
  };

  const handleUpdate = (milestoneId, field, value) => {
    if (!canEdit) return;
    updateStudyMilestone(studyCode, milestoneId, { [field]: value });
    onUpdated?.();
  };

  const handleDelete = (milestoneId) => {
    if (!canEdit) return;
    deleteStudyMilestone(studyCode, milestoneId);
    onUpdated?.();
  };

  return (
    <div className="study-widget-card study-milestone-card">
      <div className="study-widget-header">
        <FiFlag />
        <h3>Study Milestone Timeline</h3>
        {!canEdit && (
          <RequestPermissionButton
            action="Edit Milestones"
            module="Study Overview"
            studyCode={studyCode}
            label="Request Edit"
            variant="link"
          />
        )}
      </div>

      {!milestones?.length ? (
        <p className="study-widget-empty">No milestones defined yet</p>
      ) : (
        <div className="study-milestone-list">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="study-milestone-row">
              <div className="study-milestone-info">
                <strong>{milestone.title}</strong>
                <span>
                  Target: {milestone.targetDate || "—"} | Actual:{" "}
                  {milestone.actualDate || "—"}
                </span>
              </div>
              {canEdit ? (
                <div className="study-milestone-actions">
                  <select
                    value={milestone.status || "Pending"}
                    onChange={(e) =>
                      handleUpdate(milestone.id, "status", e.target.value)
                    }
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                  <input
                    type="date"
                    value={milestone.targetDate || ""}
                    onChange={(e) =>
                      handleUpdate(milestone.id, "targetDate", e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => handleDelete(milestone.id)}
                    aria-label="Delete milestone"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ) : (
                <span className={`milestone-status status-${String(milestone.status || "pending").toLowerCase().replace(/\s+/g, "-")}`}>
                  {milestone.status || "Pending"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form className="study-milestone-form" onSubmit={handleAdd}>
          <input
            placeholder="Milestone title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
          />
          <button type="submit" className="secondary-btn">
            <FiPlus /> Add
          </button>
        </form>
      )}
    </div>
  );
}

export default StudyMilestoneTimeline;