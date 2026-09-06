/**
 * Subject Explorer - SUBJECT TIMELINE (pure builder)
 * ==================================================
 *
 * Builds the chronological event feed shown in the subject Profile tab from
 * the live, canonical sources - never a second "history" copy:
 *
 *   - the subject's metadata record (screening / enrollment dates and the
 *     current status; `statusHistory[]` when the record already carries one),
 *   - completed subject visits (the `subject_<id>_visits` store),
 *   - consent events (the `icfConsentService` store),
 *   - subject documents (files under the subject in the explorer file store,
 *     surfaced through the workspace which already owns tree + store).
 *
 * The reducer is pure so it can be unit-tested without any storage.
 */

import { SUBJECT_STATUS_ORDER } from "../../utils/subjectStatusAnalytics";

export interface TimelineEvent {
  id: string;
  kind: "status" | "visit" | "consent" | "document";
  /** Primary line, e.g. "Enrolled" or "Visit completed". */
  title: string;
  /** Secondary line, e.g. "Visit 1 · Actual 2026-03-04". */
  detail?: string;
  /** Original display date/datetime as stored by the source. */
  date?: string;
  /** Sortable epoch ms (date-only values sort at UTC midnight). */
  ts: number;
  tone: "ok" | "warn" | "danger" | "muted" | "accent";
  /** Optional "at/by" footer, e.g. the acting role that made the change. */
  by?: string;
}

/* Statuses that mark a subject as reaching the end of the journey; these
   appear in the timeline as terminal transitions. */
const TERMINAL_STATUSES = ["Completed", "Withdrawn", "Dropout"];

const MAX_EVENTS = 60;

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function isUsableDate(value) {
  const text = normalizeValue(value);
  return Boolean(text) && text !== "—" && text !== "-";
}

function toTimestamp(value): number {
  if (!isUsableDate(value)) return 0;
  const text = normalizeValue(value);
  /* Date-only "YYYY-MM-DD" sorts at UTC midnight so it compares stably
     against full ISO timestamps of the same day. */
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(text + "T00:00:00Z");
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
  }
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
}

/* Events can arrive with date-only values or ISO timestamps; keep one
   event per logical anchor when multiple sources describe the same step
   (e.g. record history entry AND derived screening date). */
function alreadyHasStatus(events, status) {
  const wanted = normalizeValue(status);
  return events.some(
    (e) =>
      e.kind === "status" &&
      normalizeValue(e.title).toLowerCase() === wanted.toLowerCase(),
  );
}

export interface TimelineInput {
  record?: any;
  visits?: any[];
  consentEvents?: any[];
  files?: any[];
  /**
   * Status transitions fetched from the backend history feed
   * (GET /subjects/{code}/history, API mode). These are authoritative and
   * merge with any `record.statusHistory` without duplicating it.
   */
  extraStatusHistory?: any[];
}

export function buildSubjectTimeline({
  record = {},
  visits = [],
  consentEvents = [],
  files = [],
  extraStatusHistory = [],
}: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let seq = 0;

  const push = (
    kind: TimelineEvent["kind"],
    title: string,
    at: string | undefined,
    opts: Partial<TimelineEvent> = {},
  ) => {
    const ts = toTimestamp(at);
    if (!ts) return;
    events.push({
      id: `${kind}-${seq++}-${ts}`,
      kind,
      title,
      date: isUsableDate(at) ? normalizeValue(at) : undefined,
      ts,
      tone: opts.tone || "accent",
      detail: opts.detail,
      by: opts.by,
    });
  };

  /* 1. Status steps -------------------------------------------------- */
  const statusHistory = [
    ...(Array.isArray(record.statusHistory) ? record.statusHistory : []),
    ...(Array.isArray(extraStatusHistory) ? extraStatusHistory : []),
  ];
  const currentStatus = normalizeValue(record.status);

  statusHistory.forEach((entry) => {
    const step = entry.status || entry.label || "";
    if (!step) return;
    push("status", step, entry.at || entry.date || entry.timestamp, {
      tone: TERMINAL_STATUSES.includes(String(step).trim())
        ? "danger"
        : "accent",
      by: entry.by,
      detail: entry.by ? `Recorded by ${entry.by}` : undefined,
    });
  });

  /* Derive the baseline transitions only when the record has no explicit
     history for that step, so real history is never duplicated. */
  const derived = [
    { status: "Screened", date: record.screeningDate },
    { status: "Enrolled", date: record.enrollmentDate },
  ];
  derived.forEach((step) => {
    if (!isUsableDate(step.date)) return;
    if (alreadyHasStatus(events, step.status)) return;
    push("status", step.status, step.date, { tone: "accent" });
  });

  /* Terminal / ongoing status: only include when the record's current
     status is a real later stage AND we have no recorded history for it,
     anchoring it to the record's last update (the only date the metadata
     store keeps). */
  const laterStage =
    SUBJECT_STATUS_ORDER.findIndex(
      (s) => normalizeValue(s).toLowerCase() === currentStatus.toLowerCase(),
    ) >
    SUBJECT_STATUS_ORDER.findIndex((s) => s === "Enrolled");

  if (
    laterStage &&
    !alreadyHasStatus(events, currentStatus) &&
    isUsableDate(record.updatedAt)
  ) {
    const terminal = TERMINAL_STATUSES.some(
      (s) => normalizeValue(s).toLowerCase() === currentStatus.toLowerCase(),
    );
    push("status", currentStatus, record.updatedAt, {
      tone: terminal ? "danger" : "accent",
      detail: "Status recorded on subject record",
    });
  }

  /* 2. Completed visits ---------------------------------------------- */
  (Array.isArray(visits) ? visits : []).forEach((visit) => {
    if (!visit || !visit.name) return;
    const isCompleted =
      normalizeValue(visit.status).toLowerCase() === "completed";
    const isMissed =
      normalizeValue(visit.status).toLowerCase() === "missed";
    if (isMissed) {
      push("visit", "Visit missed", visit.plannedDate || visit.actualDate, {
        detail: visit.name,
        tone: "warn",
      });
      return;
    }
    if (!isCompleted) return;
    push(
      "visit",
      "Visit completed",
      visit.actualDate || visit.plannedDate || visit.completedAt,
      { detail: visit.name, tone: "ok" },
    );
  });

  /* 3. Consent events ------------------------------------------------ */
  (Array.isArray(consentEvents) ? consentEvents : []).forEach((event) => {
    if (!event) return;
    const version = event.icfVersion ? ` (ICF v${event.icfVersion})` : "";
    push(
      "consent",
      `Consent signed${version}`,
      event.date || event.createdAt,
      { detail: `Subject ${event.subjectId}`, tone: "ok", by: event.createdBy },
    );
  });

  /* 4. Documents added ----------------------------------------------- */
  (Array.isArray(files) ? files : []).forEach((file) => {
    if (!file || !file.name) return;
    push("document", "Document added", file.uploadedAt || file.createdAt, {
      detail: file.name,
      tone: "muted",
      by: file.uploadedBy,
    });
  });

  /* Chronological feed: newest first, stable ties by insertion order. */
  return events
    .sort((a, b) => b.ts - a.ts || 0)
    .slice(0, MAX_EVENTS);
}
