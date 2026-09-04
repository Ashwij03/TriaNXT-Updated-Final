import { Fragment, useEffect, useMemo, useState } from "react";
import { getStudies } from "../../services/studyService";
import {
  getAllCandidates,
  getCandidate,
  getCandidateStatusCounts,
  getScoringConfig,
  setScoringConfig,
  addCandidate,
  sendQuestionnaire,
  submitQuestionnaireResponse,
  scoreCandidate,
  decideCandidate,
  convertCandidateToSite,
  deleteCandidate,
  seedSampleCandidates,
  subscribeFeasibility,
  FEASIBILITY_STATUSES,
  DEFAULT_SCORING_CRITERIA,
} from "../../services/feasibilityService";
import "./SiteFeasibility.css";

const STATUS_CLASS = {
  Identified: "fs-badge-identified",
  "Questionnaire Sent": "fs-badge-sent",
  Scored: "fs-badge-scored",
  Selected: "fs-badge-selected",
  Rejected: "fs-badge-rejected",
};

const SCORE_KEYS = DEFAULT_SCORING_CRITERIA.map((c) => c.key);

const EMPTY_FORM = {
  studyCode: "",
  institution: "",
  contactName: "",
  email: "",
  phone: "",
  department: "",
  notes: "",
};

const EMPTY_RESPONSE = {
  patientPopulation: "",
  competingTrials: false,
  competingTrialDetails: "",
  infrastructure: "",
  staffAvailability: "",
};

export default function SiteFeasibility() {
  const studies = useMemo(() => getStudies(), []);
  const [filterStudy, setFilterStudy] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [expandedId, setExpandedId] = useState(null);
  const [scores, setScores] = useState({});
  const [responses, setResponses] = useState({});
  const [pendingDecision, setPendingDecision] = useState({});
  const [pendingRationale, setPendingRationale] = useState({});
  const [showConfig, setShowConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = () => setCandidates(getAllCandidates());

  useEffect(() => {
    refresh();
    return subscribeFeasibility(refresh);
  }, []);

  useEffect(() => {
    if (form.studyCode === "" && studies.length > 0) {
      setForm((f) => ({ ...f, studyCode: studies[0].code }));
    }
  }, [studies, form.studyCode]);

  const visible = filterStudy
    ? candidates.filter((c) => c.studyCode === filterStudy)
    : candidates;
  const counts = getCandidateStatusCounts(visible);

  function runGuarded(action) {
    setError("");
    setNotice("");
    try {
      const result = action();
      refresh();
      return result;
    } catch (err) {
      setError(err.message || String(err));
      return null;
    }
  }

  function openConfigEditor(studyCode) {
    const config = getScoringConfig(studyCode);
    setConfigDraft({
      studyCode,
      criteria: config.criteria.map((c) => ({ ...c })),
      minScore: config.minScore,
    });
    setShowConfig(true);
  }

  function saveConfig() {
    const ok = runGuarded(() =>
      setScoringConfig(configDraft.studyCode, {
        criteria: configDraft.criteria.map((c) => ({
          key: c.key,
          label: c.label,
          weight: Number(c.weight || 0),
        })),
        minScore: Number(configDraft.minScore || 0),
      })
    );
    if (ok) setShowConfig(false);
  }

  function handleCreate() {
    const created = runGuarded(() =>
      addCandidate({
        studyCode: form.studyCode,
        institution: form.institution,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        department: form.department,
        notes: form.notes,
      })
    );
    if (created) {
      setShowCreate(false);
      setForm({ ...EMPTY_FORM, studyCode: form.studyCode });
      setExpandedId(created.id);
    }
  }

  function setScoreField(candidateId, key, value) {
    setScores((all) => ({
      ...all,
      [candidateId]: { ...(all[candidateId] || {}), [key]: value },
    }));
  }

  function setResponseField(candidateId, key, value) {
    setResponses((all) => ({
      ...all,
      [candidateId]: { ...(all[candidateId] || {}), [key]: value },
    }));
  }

  function saveResponse(candidate) {
    const draft = responses[candidate.id] || EMPTY_RESPONSE;
    const ok = runGuarded(() =>
      submitQuestionnaireResponse(candidate.id, {
        patientPopulation: Number(draft.patientPopulation || 0),
        competingTrials: Boolean(draft.competingTrials),
        competingTrialDetails: draft.competingTrialDetails || "",
        infrastructure: draft.infrastructure || "",
        staffAvailability: draft.staffAvailability || "",
      })
    );
    if (ok) {
      setResponses((all) => ({ ...all, [candidate.id]: undefined }));
    }
  }

  function saveScore(candidate) {
    const draft = scores[candidate.id] || {};
    const raw = {};
    SCORE_KEYS.forEach((key) => {
      raw[key] = draft[key] == null || draft[key] === "" ? 0 : Number(draft[key]);
    });
    const ok = runGuarded(() => scoreCandidate(candidate.id, raw));
    if (ok) setScores((all) => ({ ...all, [candidate.id]: undefined }));
  }

  function confirmDecision(candidate) {
    const decision = pendingDecision[candidate.id];
    const rationale = (pendingRationale[candidate.id] || "").trim();
    const ok = runGuarded(() => decideCandidate(candidate.id, decision, rationale));
    if (ok) {
      setPendingDecision((all) => ({ ...all, [candidate.id]: undefined }));
      setPendingRationale((all) => ({ ...all, [candidate.id]: "" }));
    }
  }

  function badge(status) {
    return <span className={`fs-badge ${STATUS_CLASS[status] || "fs-badge-identified"}`}>{status}</span>;
  }

  const studyNameOf = (code) => {
    const study = studies.find((s) => s.code === code);
    return study ? `${study.name || study.title} (${code})` : code || "(portfolio)";
  };

  return (
    <div className="fs-page">
      <div className="fs-header">
        <div>
          <h1 className="fs-title">Site Feasibility &amp; Selection</h1>
          <p className="fs-subtitle">
            Candidate site pipeline before formal site activation (spec 6.30).
          </p>
        </div>
        <div className="fs-header-actions">
          <button className="fs-btn" onClick={() => runGuarded(() => seedSampleCandidates(filterStudy || undefined))}>
            Load sample data
          </button>
          <button className="fs-btn fs-btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "+ Add Candidate Site"}
          </button>
        </div>
      </div>

      <div className="fs-kpis">
        {FEASIBILITY_STATUSES.concat("Converted").map((status) => (
          <div className="fs-kpi" key={status}>
            <span className="fs-kpi-value">{counts[status] || 0}</span>
            <span className="fs-kpi-label">{status}</span>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fs-create-card">
          <h3>Add feasibility candidate</h3>
          <div className="fs-form-grid">
            <label>
              Study
              <select value={form.studyCode} onChange={(e) => setForm({ ...form, studyCode: e.target.value })}>
                <option value="">(Portfolio — no study yet)</option>
                {studies.map((study) => (
                  <option key={study.code} value={study.code}>
                    {study.name || study.title} ({study.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Institution
              <input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Hospital / site name" />
            </label>
            <label>
              Contact name
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </label>
            <label>
              Email
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label>
              Department
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </label>
            <label className="fs-full">
              Notes
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <button className="fs-btn fs-btn-primary" onClick={handleCreate}>Add candidate</button>
        </div>
      )}

      {error && <div className="fs-error">{error}</div>}
      {notice && <div className="fs-notice">{notice}</div>}

      <div className="fs-toolbar">
        <select value={filterStudy} onChange={(e) => setFilterStudy(e.target.value)}>
          <option value="">All studies</option>
          {studies.map((study) => (
            <option key={study.code} value={study.code}>
              {study.name || study.title} ({study.code})
            </option>
          ))}
        </select>
        <button className="fs-btn fs-btn-small" onClick={() => openConfigEditor(filterStudy)}>
          Scoring criteria for {filterStudy ? studyNameOf(filterStudy) : "portfolio"}
        </button>
      </div>

      {showConfig && configDraft && (
        <div className="fs-config-card">
          <h3>Scoring criteria — {configDraft.studyCode ? studyNameOf(configDraft.studyCode) : "portfolio (default)"}</h3>
          <p className="fs-config-note">Weights must total 1.0; scores use a 0–100 scale; the selection threshold is the minimum weighted score.</p>
          {configDraft.criteria.map((criterion, index) => (
            <div className="fs-config-row" key={criterion.key}>
              <span className="fs-config-label">{criterion.label}</span>
              <span className="fs-config-edit">weight</span>
              <input
                type="number" step="0.05" min="0" max="1"
                value={criterion.weight}
                onChange={(e) => {
                  const criteria = configDraft.criteria.slice();
                  criteria[index] = { ...criteria[index], weight: Number(e.target.value) };
                  setConfigDraft({ ...configDraft, criteria });
                }}
              />
            </div>
          ))}
          <div className="fs-config-row">
            <span className="fs-config-label">Selection threshold (min score)</span>
            <input
              type="number" min="0" max="100"
              value={configDraft.minScore}
              onChange={(e) => setConfigDraft({ ...configDraft, minScore: Number(e.target.value) })}
            />
          </div>
          <button className="fs-btn fs-btn-primary" onClick={saveConfig}>Save criteria</button>
          <button className="fs-btn" onClick={() => setShowConfig(false)}>Cancel</button>
        </div>
      )}

      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead>
            <tr>
              <th>Candidate site</th>
              <th>Study</th>
              <th>Status</th>
              <th>Score</th>
              <th>Contact</th>
              <th>Decision</th>
              <th className="fs-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="fs-empty">
                  No candidates yet. Add a candidate site or load sample data.
                </td>
              </tr>
            )}
            {visible.map((candidate) => {
              const isExpanded = expandedId === candidate.id;
              const decision = pendingDecision[candidate.id];
              const canDecide = candidate.status === "Scored" || candidate.status === "Questionnaire Sent";
              const config = getScoringConfig(candidate.studyCode);
              return (
                <Fragment key={candidate.id}>
                  <tr className="fs-row" onClick={() => setExpandedId(isExpanded ? null : candidate.id)}>
                    <td>
                      <strong>{candidate.institution}</strong>
                      {candidate.converted && (
                        <span className="fs-converted-tag">→ {candidate.converted.siteCode}</span>
                      )}
                      {candidate.notes && <div className="fs-row-sub">{candidate.notes}</div>}
                    </td>
                    <td>{studyNameOf(candidate.studyCode)}</td>
                    <td>{badge(candidate.status)}</td>
                    <td>
                      {candidate.score == null ? (
                        "—"
                      ) : (
                        <>
                          <strong>{candidate.score}</strong>
                          <span className="fs-threshold"> / {candidate.minScoreRequired} required</span>
                        </>
                      )}
                    </td>
                    <td>
                      {candidate.contactName || "—"}
                      {candidate.email && <div className="fs-row-sub">{candidate.email}</div>}
                    </td>
                    <td>
                      {candidate.status === "Selected" || candidate.status === "Rejected"
                        ? new Date(candidate.decidedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="fs-actions-col" onClick={(e) => e.stopPropagation()}>
                      {candidate.status === "Identified" && (
                        <>
                          <button className="fs-btn fs-btn-small" onClick={() => runGuarded(() => sendQuestionnaire(candidate.id))}>
                            Send questionnaire
                          </button>
                          <button className="fs-btn fs-btn-small fs-btn-danger-ghost" onClick={() => runGuarded(() => deleteCandidate(candidate.id))}>
                            Delete
                          </button>
                        </>
                      )}
                      {(candidate.status === "Questionnaire Sent" || candidate.status === "Scored") && (
                        <button className="fs-btn fs-btn-small" onClick={() => setExpandedId(isExpanded ? null : candidate.id)}>
                          {isExpanded ? "Hide details" : candidate.status === "Questionnaire Sent" ? "Record response & score" : "Score / decide"}
                        </button>
                      )}
                      {candidate.status === "Selected" && !candidate.converted && (
                        <button className="fs-btn fs-btn-small fs-btn-primary" onClick={() => runGuarded(() => convertCandidateToSite(candidate.id))}>
                          Convert to site
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="fs-detail-row">
                      <td colSpan={7}>
                        <div className="fs-detail">
                          {candidate.status === "Questionnaire Sent" && !candidate.response && (
                            <div className="fs-panel">
                              <h4>Record questionnaire response</h4>
                              <div className="fs-form-grid">
                                <label>Patient population
                                  <input type="number" value={(responses[candidate.id] || {}).patientPopulation ?? ""} onChange={(e) => setResponseField(candidate.id, "patientPopulation", e.target.value)} />
                                </label>
                                <label className="fs-checkline">
                                  <input type="checkbox" checked={Boolean((responses[candidate.id] || {}).competingTrials)} onChange={(e) => setResponseField(candidate.id, "competingTrials", e.target.checked)} />
                                  Competing trials
                                </label>
                                <label className="fs-full">Competing trial details
                                  <input value={(responses[candidate.id] || {}).competingTrialDetails ?? ""} onChange={(e) => setResponseField(candidate.id, "competingTrialDetails", e.target.value)} />
                                </label>
                                <label className="fs-full">Infrastructure
                                  <input value={(responses[candidate.id] || {}).infrastructure ?? ""} onChange={(e) => setResponseField(candidate.id, "infrastructure", e.target.value)} />
                                </label>
                                <label className="fs-full">Staff availability
                                  <input value={(responses[candidate.id] || {}).staffAvailability ?? ""} onChange={(e) => setResponseField(candidate.id, "staffAvailability", e.target.value)} />
                                </label>
                              </div>
                              <button className="fs-btn fs-btn-primary" onClick={() => saveResponse(candidate)}>Save response</button>
                            </div>
                          )}

                          {candidate.response && (
                            <div className="fs-panel">
                              <h4>Questionnaire response (received {candidate.responseSubmittedAt ? new Date(candidate.responseSubmittedAt).toLocaleDateString() : "—"})</h4>
                              <ul className="fs-facts">
                                <li><span>Patient population</span><strong>{candidate.response.patientPopulation}</strong></li>
                                <li><span>Competing trials</span><strong>{candidate.response.competingTrials ? "Yes" : "No"}</strong></li>
                                <li><span>Infrastructure</span><strong>{candidate.response.infrastructure || "—"}</strong></li>
                                <li><span>Staff</span><strong>{candidate.response.staffAvailability || "—"}</strong></li>
                              </ul>
                            </div>
                          )}

                          {(candidate.status === "Questionnaire Sent" || candidate.status === "Scored") && (
                            <div className="fs-panel">
                              <h4>Score candidate (0–100 each)</h4>
                              <div className="fs-score-grid">
                                {config.criteria.map((criterion) => {
                                  const draft = scores[candidate.id] || {};
                                  const value = draft[criterion.key] ?? candidate.scores?.[criterion.key] ?? 0;
                                  return (
                                    <label key={criterion.key}>
                                      {criterion.label} <em>({(criterion.weight * 100).toFixed(0)}%)</em>
                                      <input type="number" min="0" max="100" value={value} onChange={(e) => setScoreField(candidate.id, criterion.key, e.target.value)} />
                                    </label>
                                  );
                                })}
                              </div>
                              <button className="fs-btn fs-btn-primary" onClick={() => saveScore(candidate)}>
                                {candidate.score == null ? "Save score" : "Update score"}
                              </button>
                              {candidate.score != null && (
                                <span className="fs-score-current">Current: {candidate.score} (min {candidate.minScoreRequired})</span>
                              )}
                            </div>
                          )}

                          {canDecide && (
                            <div className="fs-panel">
                              <h4>Selection decision</h4>
                              {candidate.status === "Selected" || candidate.status === "Rejected" ? (
                                <p className="fs-rationale">
                                  <strong>Rationale:</strong> {candidate.rationale || "—"}
                                </p>
                              ) : !decision ? (
                                <div className="fs-decision-btns">
                                  {candidate.status === "Scored" && (
                                    <button className="fs-btn fs-btn-primary" onClick={() => setPendingDecision((d) => ({ ...d, [candidate.id]: "Selected" }))}>
                                      Select
                                    </button>
                                  )}
                                  <button className="fs-btn fs-btn-danger-ghost" onClick={() => setPendingDecision((d) => ({ ...d, [candidate.id]: "Rejected" }))}>
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <div className="fs-decision-confirm">
                                  <p>Confirm <strong>{decision}</strong> — rationale is required and is kept in the audit history:</p>
                                  <textarea
                                    rows={2}
                                    placeholder="Decision rationale…"
                                    value={pendingRationale[candidate.id] || ""}
                                    onChange={(e) => setPendingRationale((r) => ({ ...r, [candidate.id]: e.target.value }))}
                                  />
                                  <button className="fs-btn fs-btn-primary" onClick={() => confirmDecision(candidate)}>
                                    Confirm {decision.toLowerCase()}
                                  </button>
                                  <button className="fs-btn" onClick={() => setPendingDecision((d) => ({ ...d, [candidate.id]: undefined }))}>
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {candidate.converted && (
                            <div className="fs-panel fs-converted">
                              <h4>Converted to site {candidate.converted.siteCode}</h4>
                              <p className="fs-rationale">
                                Questionnaire history, score ({candidate.converted.score}) and rationale were carried onto the site record.
                              </p>
                            </div>
                          )}

                          <div className="fs-history">
                            <strong>History:</strong>{" "}
                            {(getCandidate(candidate.id)?.history || [])
                              .slice(-6)
                              .map((entry) => `${entry.action} (${entry.by}, ${new Date(entry.at).toLocaleDateString()})`)
                              .join(" → ")}
                          </div>
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
