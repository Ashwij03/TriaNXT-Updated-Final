import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import "../styles/ProgressNoteDetails.css";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { getStudies } from "../../shared/services/studyService";

function ProgressNoteDetails() {

  const { id } = useParams();
  const navigate = useNavigate();

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  // Look up the real note from localStorage by id
  const note = useMemo(() => {
    try {
      const allByStudy = JSON.parse(localStorage.getItem("progressNotesByStudy")) || {};
      for (const notes of Object.values(allByStudy)) {
        if (!Array.isArray(notes)) continue;
        const found = notes.find((n) => n.id === id);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  }, [id]);

  if (!note) {
    return (
      <AppLayout>
        <h2>Progress Note Not Found</h2>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      <button
  className="back-btn"
  onClick={() => navigate("/progress-notes")}
      >
   Back to Progress Notes
</button>

      <div className="details-card">

        <p><strong>Note ID:</strong> {id}</p>
        <p><strong>Study:</strong> {note.study}</p>
        <p><strong>Subject ID:</strong> {note.subjectId}</p>
        <p><strong>Site:</strong> {displaySite(note.site)}</p>
        <p><strong>Visit:</strong> {note.visit}</p>
        <p><strong>Category:</strong> {note.category}</p>
        <p><strong>Created By:</strong> {note.createdBy}</p>
        <p><strong>Date:</strong> {note.date}</p>
        <p><strong>Status:</strong> {note.status}</p>

        <hr />

        <h3>Progress Note</h3>

        <p>{note.note}</p>

      </div>

    </AppLayout>
  );
}

export default ProgressNoteDetails;