import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MdAdd,
  MdCheckCircle,
  MdEvent,
  MdHistory,
  MdInsertDriveFile,
  MdSchedule,
  MdWarning,
} from "react-icons/md";

import { getConsentEvents, subscribeConsentIcf } from "../../services/icfConsentService";
import {
  getVisitProgress,
  isCompletedVisitStatus,
  markVisitStageCompleted,
  syncSubjectSchedules,
  VISIT_STAGES,
} from "../../services/visitScheduleService";
import { listFiles, subscribeFiles } from "./fileService";
import { findNodeById, subscribeFolderTree } from "./folderTreeService";
import ConsentStatusBadge, { useSubjectConsentStatus } from "./ConsentStatusBadge";
import { buildSubjectTimeline, type TimelineEvent } from "./subjectTimeline";
import { SUBJECT_STATUS_ORDER } from "../../utils/subjectStatusAnalytics";
import { api, isApiEnabled } from "../../services/api/client";

/**
 * Subject Explorer - SUBJECT PROFILE PANEL (Profile tab)
 * ======================================================
 *
 * Timeline history + consent status + visit checklist/scheduler for the
 * subject currently selected in `StudySubjectsWorkspace`. Everything is
 * derived from the existing canonical stores (subject records via props,
 * `subject_<id>_visits`, `icfConsentService`, the explorer file store) and
 * re-renders on their change events - no second copy of any of it.
 *
 * Edit actions (add visit / mark complete) are gated by `canModify`, which
 * the workspace computes from the acting role (Admin / Site Staff / PI and
 * CRO / Sponsor with elevated access), so a read-only viewer never sees the
 * controls.
 */

function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function readSubjectVisits(subjectId) {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(`subject_${subjectId}_visits`) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** All folder ids owned by the subject node (subject bucket + descendants). */
function collectSubjectFolderIds(tree, subjectId) {
  const ids: string[] = [];
  const subjectNode = findNodeById(tree, subjectId);
  if (!subjectNode) return [subjectId];

  const walk = (node) => {
    ids.push(node.id);
    (Array.isArray(node.children) ? node.children : []).forEach((child) => {
      if (child && (child.type === "folder" || child.type === "subject")) {
        walk(child);
      }
    });
  };
  walk(subjectNode);
  return ids;
}

/* ------------------------------------------------------------------ */
/*  Visit row model                                                    */
/* ------------------------------------------------------------------ */

function classifyVisit(visit, today = todayKey()) {
  const status = normalizeValue(visit.status).toLowerCase();
  const planned = normalizeValue(visit.plannedDate || visit.date || "");

  if (isCompletedVisitStatus(status) || status === "completed") {
    return { state: "completed" as const };
  }
  if (status === "missed" || status === "cancelled") {
    return { state: "closed" as const };
  }
  if (planned && planned < today) {
    return { state: "overdue" as const };
  }
  return { state: "upcoming" as const };
}

function SubjectProfilePanel({ studyId, subjectId, record, canModify, tree, fileStore }: any) {
  /* Live stores ------------------------------------------------------- */
  const consentStatus = useSubjectConsentStatus(studyId, subjectId, record?.site);
  const [consentTick, setConsentTick] = useState(0);
  const [filesTick, setFilesTick] = useState(0);
  const [schedulesTick, setSchedulesTick] = useState(0);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitForm, setVisitForm] = useState({ name: "", plannedDate: "" });

  /* Authoritative status transitions from the backend history feed when the
     app runs in API mode (GET /subjects/{study::subject}/history). Offline /
     local mode keeps today's derivation from the record + visit stores. */
  const [serverHistoryRows, setServerHistoryRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!isApiEnabled() || !studyId || !subjectId) {
      setServerHistoryRows([]);
      return undefined;
    }
    const code = `${studyId}::${subjectId}`;
    api
      .get(`/api/site/subjects/${encodeURIComponent(code)}/history`)
      .then((body) => {
        if (cancelled) return;
        const events = body?.data?.events || body?.events || [];
        setServerHistoryRows(
          events
            .filter((event) => event?.kind === "status" && event?.title)
            .map((event) => ({
              status: event.title,
              at: event.at || undefined,
              by: event.by || undefined,
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setServerHistoryRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [studyId, subjectId]);

  useEffect(() => subscribeConsentIcf(() => setConsentTick((v) => v + 1)), []);

  useEffect(() => {
    // The standalone Subjects page mounts the workspace without a study;
    // there is no study-scoped file/tree store to subscribe to there.
    if (!studyId) return undefined;
    const unsubscribeFiles = subscribeFiles(studyId, () => setFilesTick((v) => v + 1));
    const unsubscribeTree = subscribeFolderTree(studyId, () => setFilesTick((v) => v + 1));
    const bumpSchedules = () => setSchedulesTick((v) => v + 1);
    window.addEventListener("visitSchedulesChange", bumpSchedules);
    return () => {
      unsubscribeFiles();
      unsubscribeTree();
      window.removeEventListener("visitSchedulesChange", bumpSchedules);
    };
  }, [studyId]);

  /* Consent events (for the timeline + summary) ----------------------- */
  const consentEvents = useMemo(
    () => getConsentEvents(studyId, subjectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studyId, subjectId, consentTick],
  );

  /* Subject visits (checklist) --------------------------------------- */
  const visits = useMemo(
    () => readSubjectVisits(subjectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjectId, schedulesTick, filesTick],
  );

  const visitProgress = useMemo(
    () => getVisitProgress(studyId, subjectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studyId, subjectId, schedulesTick],
  );

  /* Subject documents (timeline) -------------------------------------- */
  const subjectFiles = useMemo(() => {
    if (!tree || !fileStore) return [];
    const folderIds = collectSubjectFolderIds(tree, subjectId);
    const out: any[] = [];
    folderIds.forEach((folderId) => {
      const files = listFiles(fileStore, folderId);
      (Array.isArray(files) ? files : []).forEach((file) => {
        if (file && file.name) out.push(file);
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, fileStore, subjectId, filesTick]);

  const subjectLike = useMemo(
    () => ({ ...(record || {}), id: subjectId, subjectId }),
    [record, subjectId],
  );

  const persistVisits = useCallback(
    (updatedVisits, completedVisitName = "") => {
      localStorage.setItem(`subject_${subjectId}_visits`, JSON.stringify(updatedVisits));
      syncSubjectSchedules(studyId, subjectId, subjectLike);
      if (completedVisitName) {
        markVisitStageCompleted(studyId, subjectId, completedVisitName);
      }
      setSchedulesTick((v) => v + 1);
    },
    [studyId, subjectId, subjectLike],
  );

  /* Visit checklist --------------------------------------------------- */
  const checklist = useMemo(() => {
    const grouped = {
      upcoming: [] as any[],
      overdue: [] as any[],
      completed: [] as any[],
      closed: [] as any[],
    };
    [...visits]
      .sort((a, b) =>
        String(a.plannedDate || a.date || "").localeCompare(
          String(b.plannedDate || b.date || ""),
        ),
      )
      .forEach((visit) => {
        const { state } = classifyVisit(visit);
        if (grouped[state]) grouped[state].push(visit);
      });
    return grouped;
  }, [visits]);

  const overdueCount = checklist.overdue.length;
  const upcomingCount = checklist.upcoming.length;
  const completedCount = checklist.completed.length;

  const addVisit = () => {
    if (!normalizeValue(visitForm.name)) {
      alert("Enter a visit name.");
      return;
    }
    if (!normalizeValue(visitForm.plannedDate)) {
      alert("Choose a planned date.");
      return;
    }
    const updated = [
      ...visits,
      {
        id: Date.now(),
        name: visitForm.name.trim(),
        plannedDate: visitForm.plannedDate,
        actualDate: "",
        status: "Scheduled",
      },
    ];
    persistVisits(updated);
    setVisitForm({ name: "", plannedDate: "" });
    setShowVisitModal(false);
  };

  const markComplete = (visit) => {
    const updated = visits.map((item) =>
      String(item.id) === String(visit.id)
        ? {
            ...item,
            status: "Completed",
            actualDate: item.actualDate || todayKey(),
          }
        : item,
    );
    persistVisits(updated, visit.name);
  };

  /* Timeline ---------------------------------------------------------- */
  const timelineEvents = useMemo<TimelineEvent[]>(
    () =>
      buildSubjectTimeline({
        record,
        visits,
        consentEvents,
        files: subjectFiles,
        extraStatusHistory: serverHistoryRows,
      }),
    [record, visits, consentEvents, subjectFiles, serverHistoryRows],
  );

  const statusIndex = useMemo(() => {
    const status = normalizeValue(record?.status);
    const index = SUBJECT_STATUS_ORDER.findIndex(
      (s) => s.toLowerCase() === status.toLowerCase(),
    );
    return index === -1 ? null : index;
  }, [record?.status]);

  /* ------------------------------------------------------------------ */

  return (
    <div className="sxp-profile-panel tnxt-compact">
      {/* Summary row: consent + subject quick facts -------------------- */}
      <div className="sxp-profile-summary">
        <div className="sxp-consent-summary">
          <span className="sxp-summary-kicker">Informed Consent</span>
          {consentStatus ? (
            <>
              <ConsentStatusBadge status={consentStatus} />
              <span className="sxp-consent-detail">{consentStatus.detail}</span>
            </>
          ) : (
            <span className="sxp-consent-detail">No consent context for this subject yet.</span>
          )}
        </div>

        <div className="sxp-quick-facts">
          {[
            ["Status", record?.status || "—"],
            ["Site", record?.site || "—"],
            ["PI", record?.principalInvestigator || record?.pi || "—"],
            ["Current visit", record?.currentVisit || "—"],
            ["Screening", record?.screeningDate || "—"],
            ["Enrollment", record?.enrollmentDate || "—"],
          ].map(([label, value]) => (
            <span className="sxp-quick-fact" key={label}>
              <span className="sxp-quick-fact-label">{label}</span>
              <span className="sxp-quick-fact-value">{value}</span>
            </span>
          ))}
          {statusIndex !== null && statusIndex < SUBJECT_STATUS_ORDER.length - 1 && (
            <span className="sxp-quick-fact">
              <span className="sxp-quick-fact-label">Next stage</span>
              <span className="sxp-quick-fact-value">
                {SUBJECT_STATUS_ORDER[statusIndex + 1]}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="sxp-profile-columns">
        {/* ================== Visit checklist / scheduler ============= */}
        <section className="sxp-profile-card" aria-label="Visit checklist">
          <div className="sxp-card-heading">
            <MdSchedule size={16} aria-hidden="true" />
            <h3>Visit Checklist</h3>
            <span className="sxp-heading-spacer" />
            {overdueCount > 0 && (
              <span className="sxp-chip sxp-chip--danger" role="status">
                <MdWarning size={12} aria-hidden="true" /> {overdueCount} Overdue
              </span>
            )}
            {upcomingCount > 0 && (
              <span className="sxp-chip sxp-chip--muted" role="status">
                {upcomingCount} Upcoming
              </span>
            )}
            {canModify && (
              <button
                type="button"
                className="sxp-add-visit-btn"
                onClick={() => setShowVisitModal(true)}
              >
                <MdAdd size={14} aria-hidden="true" />
                <span>Schedule Visit</span>
              </button>
            )}
          </div>

          {/* Standard stage pipeline (shared VISIT_STAGES vocabulary) */}
          <div className="sxp-stage-strip" aria-label="Visit stages">
            {VISIT_STAGES.map((stage) => {
              const done = (visitProgress.completedStages || []).includes(stage);
              const isCurrent =
                !done && normalizeValue(record?.currentVisit).toLowerCase() === stage.toLowerCase();
              return (
                <span
                  key={stage}
                  className={`sxp-stage-chip${done ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
                >
                  {done ? (
                    <MdCheckCircle size={13} aria-hidden="true" />
                  ) : (
                    <MdEvent size={12} aria-hidden="true" />
                  )}
                  {stage}
                </span>
              );
            })}
          </div>

          {visits.length === 0 ? (
            <div className="sxp-empty" role="status">
              <MdSchedule size={22} aria-hidden="true" />
              <span>No visits scheduled for this subject yet.</span>
              {canModify && (
                <button
                  type="button"
                  className="sxp-add-visit-btn"
                  onClick={() => setShowVisitModal(true)}
                >
                  <MdAdd size={14} aria-hidden="true" />
                  Schedule the first visit
                </button>
              )}
            </div>
          ) : (
            <div className="sxp-visit-table-wrap">
              <table className="sxp-visit-table">
                <thead>
                  <tr>
                    <th>Visit</th>
                    <th>Planned date</th>
                    <th>Status</th>
                    {canModify && <th aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...checklist.overdue.map((v) => ({ v, state: "overdue" })),
                    ...checklist.upcoming.map((v) => ({ v, state: "upcoming" })),
                    ...checklist.completed.map((v) => ({ v, state: "completed" })),
                    ...checklist.closed.map((v) => ({ v, state: "closed" })),
                  ].map(({ v, state }) => {
                    const isClosed =
                      state === "completed" ||
                      state === "closed" ||
                      normalizeValue(v.status).toLowerCase() === "completed";
                    return (
                      <tr key={`${v.id}-${v.name}`}>
                        <td className="sxp-visit-name">{v.name}</td>
                        <td>{v.plannedDate || v.date || "—"}</td>
                        <td>
                          {state === "overdue" ? (
                            <span className="sxp-status sxp-status--danger" role="status">
                              <MdWarning size={11} aria-hidden="true" /> Overdue
                            </span>
                          ) : state === "upcoming" ? (
                            <span className="sxp-status sxp-status--muted">Scheduled</span>
                          ) : isClosed ? (
                            <span className="sxp-status sxp-status--ok">{v.status}</span>
                          ) : (
                            <span className="sxp-status sxp-status--muted">{v.status}</span>
                          )}
                        </td>
                        {canModify &&
                          (state === "overdue" || state === "upcoming") && (
                            <td className="sxp-visit-actions">
                              <button
                                type="button"
                                className="sxp-complete-btn"
                                onClick={() => markComplete(v)}
                                title={`Mark "${v.name}" complete`}
                              >
                                <MdCheckCircle size={13} aria-hidden="true" />
                                <span>Mark Complete</span>
                              </button>
                            </td>
                          )}
                        {canModify && (state === "completed" || state === "closed") && (
                          <td className="sxp-visit-actions">
                            {state === "completed" && v.actualDate
                              ? `Completed ${v.actualDate}`
                              : ""}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ================== Timeline ================================= */}
        <section className="sxp-profile-card" aria-label="Subject timeline">
          <div className="sxp-card-heading">
            <MdHistory size={16} aria-hidden="true" />
            <h3>Timeline</h3>
          </div>

          {timelineEvents.length === 0 ? (
            <div className="sxp-empty" role="status">
              <MdInsertDriveFile size={22} aria-hidden="true" />
              <span>No timeline events yet — screening, enrollment, visits and
                documents will appear here.</span>
            </div>
          ) : (
            <ol className="sxp-timeline">
              {timelineEvents.map((event) => (
                <li
                  className={`sxp-timeline-item sxp-timeline-item--${event.kind} sxp-timeline-item--${event.tone}`}
                  key={event.id}
                >
                  <span className="sxp-timeline-marker" aria-hidden="true" />
                  <div className="sxp-timeline-body">
                    <div className="sxp-timeline-title">{event.title}</div>
                    {event.detail && (
                      <div className="sxp-timeline-detail">{event.detail}</div>
                    )}
                    <div className="sxp-timeline-meta">
                      {event.date ? <time>{event.date}</time> : null}
                      {event.by ? <span>{event.by}</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Scheduler modal ---------------------------------------------- */}
      {showVisitModal && (
        <div className="sxp-modal-overlay" onClick={() => setShowVisitModal(false)}>
          <div
            className="sxp-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Schedule visit"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Schedule Visit</h3>
            <label className="sxp-field">
              <span>Visit name</span>
              <input
                type="text"
                value={visitForm.name}
                placeholder="e.g. Visit 2"
                onChange={(e) => setVisitForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="sxp-field">
              <span>Planned date</span>
              <input
                type="date"
                value={visitForm.plannedDate}
                onChange={(e) =>
                  setVisitForm((f) => ({ ...f, plannedDate: e.target.value }))
                }
              />
            </label>
            <div className="sxp-modal-actions">
              <button
                type="button"
                className="sxp-btn sxp-btn--ghost"
                onClick={() => setShowVisitModal(false)}
              >
                Cancel
              </button>
              <button type="button" className="sxp-btn sxp-btn--primary" onClick={addVisit}>
                Save Visit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubjectProfilePanel;
