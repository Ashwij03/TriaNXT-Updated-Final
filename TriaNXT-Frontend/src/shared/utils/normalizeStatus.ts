export function normalizeStatus(status,options: any = {}) {
  const value = String(status || "").trim();
  const lowerValue = value.toLowerCase();

  if (options.type === "comment") {
    if (value === "Resolved" || lowerValue === "resolved") {
      return "resolved";
    }

    if (value === "Open" || lowerValue === "open" || lowerValue === "unresolved") {
      return "unresolved";
    }

    return "pending-review";
  }

  // Item 21: canonical normal-lifecycle capitalization is
  // Screened / Enrolled / Ongoing / Completed. Legacy stored values such as
  // "Screening" are normalized to "Screened" for the subject lifecycle
  // domain via the shared subjectLifecycle helper; this normalizer maps the
  // raw token consistently to the same canonical output.
  if (lowerValue.includes("screen")) return "Screened";
  if (
    lowerValue.includes("enroll") ||
    // Legacy CRO/older builds used Randomized/Randomised for on-study
    // subjects — the same funnel stage as Enrolled.
    lowerValue.includes("randomiz") ||
    lowerValue.includes("randomis")
  ) return "Enrolled";
  if (
    lowerValue.includes("ongoing") ||
    lowerValue.includes("active") ||
    lowerValue.includes("in progress") ||
    lowerValue.includes("in-progress")
  ) return "Ongoing";
  if (lowerValue.includes("complete")) return "Completed";
  if (lowerValue.includes("withdraw")) return "Withdrawn";
  if (lowerValue.includes("drop") || lowerValue.includes("discontin") || lowerValue.includes("terminat")) return "Dropout";

  return null;
}

/* ==================================================================
   SINGLE SUBJECT-STATUS CONTRACT
   ==================================================================

   One definition of what "enrolled" / "in screening" / "terminal" means,
   shared by every counting surface (CRO, Sponsor, Site Staff, Admin). Raw
   status tokens are normalized through normalizeStatus() first — so a stored
   "Active" token and a stored "Ongoing" token count identically everywhere
   — and membership is decided against these canonical stages only.

   Stages that represent a subject who has passed screening and is on the
   study roster. Mirrors the funnel semantics every recruitment metric uses
   (Enrolled → Ongoing → Completed). Raw "Active"/"Randomized" tokens
   normalize into Ongoing/Enrolled and therefore count as enrolled here too.
*/
export const SUBJECT_ENROLLED_STAGES = ["Enrolled", "Ongoing", "Completed"];

export function isEnrolledSubjectStatus(status) {
  return SUBJECT_ENROLLED_STAGES.includes(normalizeStatus(status));
}

// Pre-enrollment funnel stage: still being screened / screened but not yet
// enrolled. Covers raw "Screening" and "Screened" tokens alike.
export function isInScreeningSubjectStatus(status) {
  return normalizeStatus(status) === "Screened";
}

// Subjects who left the study before/after enrollment.
export function isTerminalSubjectStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "Withdrawn" || normalized === "Dropout";
}
