// Ambient declarations for legacy globals the migrated JS code attaches to
// `window` (migration helpers, third-party checkout widget). Kept loose on
// purpose — these boundaries are untyped by design.

interface Window {
  // Data-migration helpers installed at startup by study/subject services.
  __trianxtMigrateSubjectsData?: () => void;
  __trianxtCleanupSubjects?: () => void;
  // Razorpay checkout widget loaded at runtime via external script.
  Razorpay?: any;
}
