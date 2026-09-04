import { useMemo, useState } from "react";
import {
  getNextVisitStage,
  getVisitProgress,
  saveNextVisitDetails
} from "../services/visitScheduleService";
import "./NextVisitPromptModal.css";

function NextVisitPromptModal({
  studyId,
  subjectId,
  subject = {},
  onClose,
  onSaved
}: any) {
  const progress = getVisitProgress(studyId, subjectId);
  const suggestedVisit = useMemo(
    () => getNextVisitStage(progress.lastCompletedStage),
    [progress.lastCompletedStage]
  );

  const [form, setForm] = useState({
    visitName: suggestedVisit || "",
    date: "",
    time: "09:00 AM",
    status: "Scheduled"
  });
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    if (!form.visitName.trim() || !form.date) {
      setError("Visit name and date are required.");
      return;
    }

    saveNextVisitDetails(studyId, subjectId, form, subject);
    onSaved?.(form);
    onClose?.();
  };

  return (
    <div className="next-visit-modal-overlay" role="presentation">
      <div
        className="next-visit-modal"
        role="dialog"
        aria-labelledby="next-visit-title"
      >
        <div className="next-visit-modal-header">
          <h3 id="next-visit-title">Schedule Next Visit</h3>
          <p>
            {progress.lastCompletedStage
              ? `${progress.lastCompletedStage} is complete. Enter details for the next visit.`
              : "Enter details for the next subject visit."}
          </p>
        </div>

        <form className="next-visit-modal-form" onSubmit={handleSubmit}>
          <label>
            Visit Stage
            <input
              type="text"
              value={form.visitName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  visitName: event.target.value
                }))
              }
              required
            />
          </label>

          <label>
            Visit Date
            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, date: event.target.value }))
              }
              required
            />
          </label>

          <label>
            Visit Time
            <input
              type="text"
              value={form.time}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, time: event.target.value }))
              }
              placeholder="09:00 AM"
            />
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="Scheduled">Scheduled</option>
              <option value="Due">Due</option>
              <option value="Completed">Completed</option>
            </select>
          </label>

          {error && <p className="next-visit-error">{error}</p>}

          <div className="next-visit-modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Later
            </button>
            <button type="submit">Save Visit</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NextVisitPromptModal;
