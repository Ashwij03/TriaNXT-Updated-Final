import { Fragment, useEffect, useMemo, useState } from "react";
import { getStudies } from "../../services/studyService";
import {
  createSubmission,
  getAllSubmissions,
  submitSubmission,
  startReview,
  recordDecision,
  resolveCondition,
  addCorrespondence,
  hasOpenConditions,
  isContinuingReviewDue,
  subscribeIrbSubmissions,
  IRB_TYPES,
} from "../../services/irbSubmissionService";
import "../gaps/gap-tracker.css";

const STATUS_BADGE = {
  Preparing: "gt-badge-gray",
  Submitted: "gt-badge-blue",
  "Under Review": "gt-badge-amber",
  Approved: "gt-badge-green",
  Contingent: "gt-badge-violet",
  Rejected: "gt-badge-red",
};

const TYPE_BADGE = {
  Initial: "gt-badge-cyan",
  Amendment: "gt-badge-blue",
  "Continuing Review": "gt-badge-amber",
  "Reportable event": "gt-badge-red",
};

const EMPTY_FORM = {
  studyCode: "",
  siteCode: "",
  type: "Initial",
  title: "",
  committee: "",
  reviewCycleMonths: "12",
  linkedRef: "",
};

export default function IrbSubmissions() {
  const studies = useMemo(() => getStudies(), []);
  const [submissions, setSubmissions] = useState([]);
  const [filterStudy, setFilterStudy] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = () => setSubmissions(getAllSubmissions());

  useEffect(() => {
    refresh();
    return subscribeIrbSubmissions(refresh);
  }, []);

  useEffect(() => {
    if (form.studyCode === "" && studies.length > 0) {
      setForm((f) => ({ ...f, studyCode: studies[0].code }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studies]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setDraft = (id, key, value) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), [key]: value } }));

  const filtered = filterStudy ? submissions.filter((s) => s.studyCode === filterStudy) : submissions;

  const pending = filtered.filter((s) => ["Preparing", "Submitted", "Under Review"].includes(s.status)).length;
  const approved = filtered.filter((s) => s.status === "Approved").length;
  const dueNow = filtered.filter((s) => s.status === "Approved" && isContinuingReviewDue(s)).length;

  function runGuarded(action) {
    setError("");
    setNotice("");
    try {
      const result = action();
      setNotice(result && result.message ? result.message : "");
      refresh();
      return result;
    } catch (err) {
      setError(err.message || String(err));
      return null;
    }
  }

  function handleCreate() {
    const created = runGuarded(() =>
      createSubmission({
        studyCode: form.studyCode,
        siteCode: form.siteCode.trim(),
        type: form.type,
        title: form.title.trim(),
        committee: form.committee.trim(),
        reviewCycleMonths: form.reviewCycleMonths,
        linkedRef: form.linkedRef.trim(),
      })
    );
    if (created) {
      setShowCreate(false);
      setForm({ ...EMPTY_FORM, studyCode: form.studyCode });
      setExpandedId(created.id);
    }
  }

  function handleDecision(submission, outcome) {
    const draft = drafts[submission.id] || {};
    runGuarded(() => recordDecision(submission.id, outcome, (draft.outcomeNote || "").trim()));
  }

  function handleCorrespondence(submission) {
    const draft = drafts[submission.id] || {};
    const message = (draft.message || "").trim();
    if (!message) {
      setError("Enter a correspondence message first.");
      return;
    }
    runGuarded(() => addCorrespondence(submission.id, message));
    setDraft(submission.id, "message", "");
  }

  const studyNameOf = (code) => {
    const study = studies.find((s) => s.code === code);
    return study ? `${study.name || study.title || code} (${code})` : code || "(portfolio)";
  };

  return (
    <div className="gt-page">
      <div className="gt-header">
        <div>
          <h1 className="gt-title">IRB / IEC Submissions</h1>
          <p className="gt-subtitle">
            Ethics-committee lifecycle: initial, amendment, continuing review and reportable-event
            submissions with conditions &amp; correspondence (spec 6.27).
          </p>
        </div>
        <button className="gt-btn gt-btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New submission"}
        </button>
      </div>

      <div className="gt-kpis">
        <div className="gt-kpi">
          <span className="gt-kpi-value">{filtered.length}</span>
          <span className="gt-kpi-label">Submissions</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{pending}</span>
          <span className="gt-kpi-label">In progress</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{approved}</span>
          <span className="gt-kpi-label">Approved</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{dueNow}</span>
          <span className="gt-kpi-label">Continuing review due</span>
        </div>
      </div>

      {showCreate && (
        <div className="gt-card">
          <h3>New IRB / IEC submission</h3>
          <div className="gt-form-grid">
            <label>
              Study
              <select value={form.studyCode} onChange={(e) => setField("studyCode", e.target.value)}>
                {studies.length === 0 && <option value="">No studies yet — create one first</option>}
                {studies.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name || s.title} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Site code
              <input value={form.siteCode} onChange={(e) => setField("siteCode", e.target.value)} placeholder="SITE-01" />
            </label>
            <label>
              Submission type
              <select value={form.type} onChange={(e) => setField("type", e.target.value)}>
                {IRB_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Committee / board
              <input value={form.committee} onChange={(e) => setField("committee", e.target.value)} placeholder="Institutional Review Board" />
            </label>
            <label>
              Review cycle (months)
              <input type="number" min="1" value={form.reviewCycleMonths} onChange={(e) => setField("reviewCycleMonths", e.target.value)} />
            </label>
            {form.type === "Reportable event" && (
              <label className="gt-full">
                Originating Finding / SAE reference
                <input value={form.linkedRef} onChange={(e) => setField("linkedRef", e.target.value)} placeholder="FIND-001 or SAE-002" />
              </label>
            )}
            <label className="gt-full">
              Title / scope
              <input value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="e.g. Initial protocol review — v2.0" />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="gt-btn gt-btn-primary" onClick={handleCreate}>
              Create submission (Preparing)
            </button>
          </div>
        </div>
      )}

      {error && <div className="gt-error">{error}</div>}
      {notice && <div className="gt-notice">{notice}</div>}

      <div className="gt-toolbar">
        <select value={filterStudy} onChange={(e) => setFilterStudy(e.target.value)}>
          <option value="">All studies</option>
          {studies.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name || s.title} ({s.code})
            </option>
          ))}
        </select>
      </div>

      <div className="gt-table-wrap">
        <table className="gt-table">
          <thead>
            <tr>
              <th>Submission</th>
              <th>Type</th>
              <th>Study / site</th>
              <th>Status</th>
              <th>Next review</th>
              <th className="gt-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="gt-empty">
                  No submissions yet. Create one to begin tracking the committee lifecycle.
                </td>
              </tr>
            )}
            {filtered.map((submission) => {
              const isExpanded = expandedId === submission.id;
              const draft = drafts[submission.id] || {};
              const openConditions = (submission.conditions || []).filter((c) => !c.resolved).length;
              return (
                <Fragment key={submission.id}>
                  <tr onClick={() => setExpandedId(isExpanded ? null : submission.id)} className="gt-row">
                    <td>
                      <strong>{submission.title || submission.id}</strong>
                      <div className="gt-row-sub">
                        {submission.id}
                        {submission.linkedRef ? ` · linked: ${submission.linkedRef}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`gt-badge ${TYPE_BADGE[submission.type] || "gt-badge-gray"}`}>{submission.type}</span>
                    </td>
                    <td>
                      {submission.siteCode || "—"}
                      <div className="gt-row-sub">{studyNameOf(submission.studyCode)}</div>
                    </td>
                    <td>
                      <span className={`gt-badge ${STATUS_BADGE[submission.status] || "gt-badge-gray"}`}>{submission.status}</span>
                      {submission.status === "Approved" && isContinuingReviewDue(submission) && (
                        <div style={{ marginTop: 4 }}>
                          <span className="gt-badge gt-badge-red">Review due</span>
                        </div>
                      )}
                      {openConditions > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <span className="gt-badge gt-badge-violet">{openConditions} open condition(s)</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {submission.nextDueDate
                        ? new Date(submission.nextDueDate).toLocaleDateString()
                        : submission.approvedAt
                        ? new Date(submission.approvedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="gt-actions-col" onClick={(e) => e.stopPropagation()}>
                      {submission.status === "Preparing" && (
                        <button className="gt-btn gt-btn-primary gt-btn-small" onClick={() => runGuarded(() => submitSubmission(submission.id))}>
                          Submit
                        </button>
                      )}
                      {submission.status === "Submitted" && (
                        <button className="gt-btn gt-btn-small" onClick={() => runGuarded(() => startReview(submission.id))}>
                          Start review
                        </button>
                      )}
                      {submission.status === "Under Review" && (
                        <>
                          <button className="gt-btn gt-btn-primary gt-btn-small" onClick={() => handleDecision(submission, "Approved")}>
                            Approve
                          </button>
                          <button className="gt-btn gt-btn-small" onClick={() => handleDecision(submission, "Contingent")}>
                            Contingent
                          </button>
                          <button className="gt-btn gt-btn-danger-ghost gt-btn-small" onClick={() => handleDecision(submission, "Rejected")}>
                            Reject
                          </button>
                        </>
                      )}
                      <button className="gt-btn gt-btn-small" onClick={() => setExpandedId(isExpanded ? null : submission.id)}>
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="gt-detail-row">
                        <div className="gt-panel">
                          <h4>Decision note</h4>
                          <div className="gt-inline">
                            <input
                              style={{ minWidth: 320 }}
                              value={draft.outcomeNote || ""}
                              onChange={(e) => setDraft(submission.id, "outcomeNote", e.target.value)}
                              placeholder="Note accompanying the decision (e.g. conditions, rationale)"
                            />
                          </div>
                        </div>

                        <div className="gt-panel">
                          <h4>Conditions{(submission.conditions || []).length > 0 ? ` (${(submission.conditions || []).filter((c) => !c.resolved).length} open)` : ""}</h4>
                          {(submission.conditions || []).length === 0 && (
                            <div className="gt-empty">No conditions recorded.</div>
                          )}
                          {(submission.conditions || []).map((condition, index) => (
                            <div key={index} className="gt-inline" style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                              <span style={{ flex: 1 }}>
                                {condition.text}
                                {condition.resolvedAt && (
                                  <span className="gt-note"> — resolved {new Date(condition.resolvedAt).toLocaleDateString()}</span>
                                )}
                              </span>
                              {!condition.resolved && (
                                <button className="gt-btn gt-btn-small" onClick={() => runGuarded(() => resolveCondition(submission.id, index))}>
                                  Mark resolved
                                </button>
                              )}
                              {condition.resolved && <span className="gt-badge gt-badge-green">Resolved</span>}
                            </div>
                          ))}
                          {hasOpenConditions(submission) && (
                            <div className="gt-callout">
                              Sites cannot be marked activation-ready while IRB conditions are open.
                            </div>
                          )}
                        </div>

                        <div className="gt-panel">
                          <h4>Correspondence</h4>
                          {(submission.correspondence || []).length === 0 && (
                            <div className="gt-empty">No correspondence logged.</div>
                          )}
                          {(submission.correspondence || []).map((entry, index) => (
                            <div key={index} className="gt-note" style={{ padding: "2px 0" }}>
                              <strong>{entry.from || "Committee"}</strong> · {new Date(entry.date).toLocaleString()} — {entry.message}
                            </div>
                          ))}
                          <div className="gt-inline" style={{ marginTop: 8 }}>
                            <input
                              style={{ minWidth: 360 }}
                              value={draft.message || ""}
                              onChange={(e) => setDraft(submission.id, "message", e.target.value)}
                              placeholder="Log a letter / email exchange…"
                            />
                            <button className="gt-btn gt-btn-small" onClick={() => handleCorrespondence(submission)}>
                              Add correspondence
                            </button>
                          </div>
                        </div>

                        <div className="gt-history">
                          <strong>History:</strong>{" "}
                          {(submission.history || [])
                            .map((h) => `${h.action} (${h.by || "Unknown"}, ${new Date(h.at).toLocaleDateString()})`)
                            .join(" → ")}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
