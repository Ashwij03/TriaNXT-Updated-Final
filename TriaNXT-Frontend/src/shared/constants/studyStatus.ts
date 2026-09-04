/*
  Canonical study status constants for TriaNXT CTMS.
  Item 8 (Stage 5A) — the exact six values in the exact order.
  Item 7 (Stage 5A) — STUDY_STATUS_COMPLETED is the authoritative
  completion sentinel used by transition detection and the
  Completed-study subject creation guard.
*/

export const STUDY_STATUS_OPTIONS = [
  "Startup",
  "Recruitment Phase",
  "Conduct Phase",
  "Hold / Suspension",
  "Completed",
  "Early Termination",
];

export const STUDY_STATUS_DEFAULT = "Startup";

export const STUDY_STATUS_COMPLETED = "Completed";

/*
  Produce a safe CSS class fragment from a canonical status value.
  Slash and space characters cannot be used directly as CSS classes.
    "Startup"           -> "startup"
    "Recruitment Phase" -> "recruitment-phase"
    "Conduct Phase"     -> "conduct-phase"
    "Hold / Suspension" -> "hold-suspension"
    "Completed"         -> "completed"
    "Early Termination" -> "early-termination"
*/
export function getStudyStatusClass(status) {
  const raw = String(status || STUDY_STATUS_DEFAULT).toLowerCase();
  return raw
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "-");
}
