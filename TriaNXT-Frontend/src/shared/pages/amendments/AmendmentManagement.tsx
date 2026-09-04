import { Fragment, useEffect, useMemo, useState } from "react";
import { getStudies } from "../../services/studyService";
import {
  createAmendment,
  getAmendment,
  getAllAmendments,
  runImpactAssessment,
  publishAmendment,
  completeSiteTask,
  markSiteCompliant,
  closeAmendment,
  deleteAmendment,
  setAmendmentIrbSubmissionRef,
  getAmendmentComplianceSummary,
  subscribeAmendments,
  AMENDMENT_CLASSIFICATIONS,
} from "../../services/amendmentService";
import "./AmendmentManagement.css";

const STATUS_CLASS = {
  Draft: "am-badge-draft",
  "Under Assessment": "am-badge-assess",
  Published: "am-badge-published",
  "Site Rollout": "am-badge-rollout",
  Compliant: "am-badge-compliant",
  Closed: "am-badge-closed",
};

const EMPTY_FORM = {
  studyCode: "",
  amendmentNumber: "",
  version: "",
  classification: "Non-substantial",
  effectiveDate: "",
  summary: "",
  impactedSiteCodes: "",
  reConsentRequired: false,
  binderUpdateRequired: false,
  trainingRequired: false,
  irbSubmissionRef: "",
};

export default function AmendmentManagement() {
  const studies = useMemo(() => getStudies(), []);
  const [filterStudy, setFilterStudy] = useState("");
  const [amendments, setAmendments] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [irbRefDraft, setIrbRefDraft] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = () => setAmendments(getAllAmendments());

  useEffect(() => {
    refresh();
    return subscribeAmendments(refresh);
  }, []);

  useEffect(() => {
    if (form.studyCode === "" && studies.length > 0) {
      setForm((f) => ({ ...f, studyCode: studies[0].code }));
    }
  }, [studies, form.studyCode]);

  const filtered = filterStudy
    ? amendments.filter((a) => a.studyCode === filterStudy)
    : amendments;

  const openCount = filtered.filter(
    (a) => a.status !== "Closed" && a.status !== "Compliant"
  ).length;
  const compliantCount = filtered.filter((a) => a.status === "Compliant").length;
  const rollingCount = filtered.filter((a) => a.status === "Site Rollout").length;

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
    const impactedSiteCodes = form.impactedSiteCodes
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);

    const created = runGuarded(() =>
      createAmendment({
        studyCode: form.studyCode,
        amendmentNumber: form.amendmentNumber,
        version: form.version,
        classification: form.classification,
        effectiveDate: form.effectiveDate,
        summary: form.summary,
        impactedSiteCodes,
        reConsentRequired: form.reConsentRequired,
        binderUpdateRequired: form.binderUpdateRequired,
        trainingRequired: form.trainingRequired,
        irbSubmissionRef: form.irbSubmissionRef,
      })
    );

    if (created) {
      setShowCreate(false);
      setForm({ ...EMPTY_FORM, studyCode: form.studyCode });
      setExpandedId(created.id);
    }
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleIrbRef(amendmentId) {
    const ref = (irbRefDraft[amendmentId] || "").trim();
    if (!ref) {
      setError("Enter the IRB/IEC submission reference first.");
      return;
    }
    runGuarded(() => setAmendmentIrbSubmissionRef(amendmentId, ref));
    setIrbRefDraft((d) => ({ ...d, [amendmentId]: "" }));
  }

  function statusBadge(status) {
    return <span className={`am-badge ${STATUS_CLASS[status] || "am-badge-draft"}`}>{status}</span>;
  }

  const studyNameOf = (code) => {
    const study = studies.find((s) => s.code === code);
    return study ? `${study.name || study.title || code} (${code})` : code || "(portfolio)";
  };

  return (
    <div className="am-page">
      <div className="am-header">
        <div>
          <h1 className="am-title">Protocol Amendments</h1>
          <p className="am-subtitle">
            Amendment intake, impact assessment and per-site implementation tracking (spec 6.25).
          </p>
        </div>
        <button className="am-btn am-btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ New Amendment"}
        </button>
      </div>

      <div className="am-kpis">
        <div className="am-kpi">
          <span className="am-kpi-value">{filtered.length}</span>
          <span className="am-kpi-label">Amendments</span>
        </div>
        <div className="am-kpi">
          <span className="am-kpi-value">{openCount}</span>
          <span className="am-kpi-label">Open</span>
        </div>
        <div className="am-kpi">
          <span className="am-kpi-value">{rollingCount}</span>
          <span className="am-kpi-label">Site rollout</span>
        </div>
        <div className="am-kpi">
          <span className="am-kpi-value">{compliantCount}</span>
          <span className="am-kpi-label">Compliant / closed</span>
        </div>
      </div>

      {showCreate && (
        <div className="am-create-card">
          <h3>New protocol amendment</h3>
          <div className="am-form-grid">
            <label>
              Study
              <select
                value={form.studyCode}
                onChange={(e) => setField("studyCode", e.target.value)}
              >
                {studies.length === 0 && <option value="">No studies yet — create one first</option>}
                {studies.map((study) => (
                  <option key={study.code} value={study.code}>
                    {study.name || study.title} ({study.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amendment number (sponsor ref)
              <input
                value={form.amendmentNumber}
                onChange={(e) => setField("amendmentNumber", e.target.value)}
                placeholder="AM-2026-XX"
              />
            </label>
            <label>
              Protocol version
              <input
                value={form.version}
                onChange={(e) => setField("version", e.target.value)}
                placeholder="2.0"
              />
            </label>
            <label>
              Classification
              <select
                value={form.classification}
                onChange={(e) => setField("classification", e.target.value)}
              >
                {AMENDMENT_CLASSIFICATIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Effective date
              <input
                type="date"
                value={form.effectiveDate}
                onChange={(e) => setField("effectiveDate", e.target.value)}
              />
            </label>
            <label className="am-full">
              Impacted site codes (comma separated)
              <input
                value={form.impactedSiteCodes}
                onChange={(e) => setField("impactedSiteCodes", e.target.value)}
                placeholder="SITE-01, SITE-02"
              />
            </label>
            <label className="am-full">
              Summary of change
              <textarea
                value={form.summary}
                onChange={(e) => setField("summary", e.target.value)}
                rows={2}
                placeholder="What changed in this protocol version?"
              />
            </label>
          </div>
          <div className="am-checks">
            <label><input type="checkbox" checked={form.binderUpdateRequired} onChange={(e) => setField("binderUpdateRequired", e.target.checked)} /> Binder / document replacement required</label>
            <label><input type="checkbox" checked={form.trainingRequired} onChange={(e) => setField("trainingRequired", e.target.checked)} /> Re-training required</label>
            <label><input type="checkbox" checked={form.reConsentRequired} onChange={(e) => setField("reConsentRequired", e.target.checked)} /> Re-consent required</label>
          </div>
          <button className="am-btn am-btn-primary" onClick={handleCreate}>
            Create amendment (Draft)
          </button>
        </div>
      )}

      {error && <div className="am-error">{error}</div>}
      {notice && <div className="am-notice">{notice}</div>}

      <div className="am-toolbar">
        <select value={filterStudy} onChange={(e) => setFilterStudy(e.target.value)}>
          <option value="">All studies</option>
          {studies.map((study) => (
            <option key={study.code} value={study.code}>
              {study.name || study.title} ({study.code})
            </option>
          ))}
        </select>
      </div>

      <div className="am-table-wrap">
        <table className="am-table">
          <thead>
            <tr>
              <th>Amendment</th>
              <th>Study</th>
              <th>Classification</th>
              <th>Effective</th>
              <th>Status</th>
              <th>Site compliance</th>
              <th className="am-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="am-empty">
                  No protocol amendments yet. Create one to track impact across sites.
                </td>
              </tr>
            )}
            {filtered.map((amendment) => {
              const summary = getAmendmentComplianceSummary(amendment);
              const isExpanded = expandedId === amendment.id;
              const substantial = amendment.classification === "Substantial";
              return (
                <Fragment key={amendment.id}>
                  <tr key={amendment.id} onClick={() => setExpandedId(isExpanded ? null : amendment.id)} className="am-row">
                    <td>
                      <strong>{amendment.amendmentNumber}</strong> v{amendment.version}
                      {amendment.summary && <div className="am-row-sub">{amendment.summary}</div>}
                    </td>
                    <td>{studyNameOf(amendment.studyCode)}</td>
                    <td>{statusBadge(amendment.classification)}</td>
                    <td>{amendment.effectiveDate}</td>
                    <td>{statusBadge(amendment.status)}</td>
                    <td>
                      {summary.total > 0 ? (
                        <>
                          {summary.compliant}/{summary.total} · {summary.percent}%
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="am-actions-col" onClick={(e) => e.stopPropagation()}>
                      {amendment.status === "Draft" && (
                        <>
                          <button className="am-btn" onClick={() => runGuarded(() => runImpactAssessment(amendment.id))}>
                            Assess impact
                          </button>
                          <button className="am-btn am-btn-danger-ghost" onClick={() => runGuarded(() => deleteAmendment(amendment.id))}>
                            Delete
                          </button>
                        </>
                      )}
                      {(amendment.status === "Draft" || amendment.status === "Under Assessment") && (
                        <button className="am-btn am-btn-primary" onClick={() => runGuarded(() => publishAmendment(amendment.id))}>
                          Publish
                        </button>
                      )}
                      {amendment.status === "Compliant" && (
                        <button className="am-btn am-btn-primary" onClick={() => runGuarded(() => closeAmendment(amendment.id))}>
                          Close amendment
                        </button>
                      )}
                      {(amendment.status === "Published" || amendment.status === "Site Rollout") && (
                        <button className="am-btn" onClick={() => setExpandedId(isExpanded ? null : amendment.id)}>
                          {isExpanded ? "Hide rollout" : "Track rollout"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={amendment.id + "-detail"} className="am-detail-row">
                      <td colSpan={7}>
                        <div className="am-detail">
                          <div className="am-detail-header">
                            <h4>Per-site implementation — {amendment.amendmentNumber} v{amendment.version}</h4>
                            {substantial && (
                              <div className="am-irb">
                                <span className="am-irb-label">IRB/IEC submission ref{amendment.irbSubmissionRef ? "" : " (required for Substantial)"}:</span>
                                {amendment.irbSubmissionRef ? (
                                  <strong>{amendment.irbSubmissionRef}</strong>
                                ) : (
                                  <>
                                    <input
                                      value={irbRefDraft[amendment.id] || ""}
                                      onChange={(e) =>
                                        setIrbRefDraft((d) => ({ ...d, [amendment.id]: e.target.value }))
                                      }
                                      placeholder="e.g. IRB-2026-014"
                                    />
                                    <button className="am-btn am-btn-small" onClick={() => handleIrbRef(amendment.id)}>
                                      Link submission
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {Object.keys(amendment.sites).length === 0 && (
                            <div className="am-empty">No impacted sites recorded.</div>
                          )}
                          {Object.keys(amendment.sites).map((siteCode) => {
                            const site = amendment.sites[siteCode];
                            const allDone = (site.tasks || []).every((task) => task.done);
                            return (
                              <div key={siteCode} className="am-site">
                                <div className="am-site-head">
                                  <strong>{siteCode}</strong>
                                  {statusBadge(site.status)}
                                  {site.complianceDate && (
                                    <span className="am-compliant-date">
                                      Compliant {new Date(site.complianceDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <ul className="am-task-list">
                                  {(site.tasks || []).length === 0 && <li className="am-empty">No generated tasks for this site.</li>}
                                  {(site.tasks || []).map((task) => (
                                    <li key={task.id}>
                                      <label className={task.done ? "am-task-done" : ""}>
                                        <input
                                          type="checkbox"
                                          checked={task.done}
                                          disabled={
                                            amendment.status !== "Published" &&
                                            amendment.status !== "Site Rollout"
                                          }
                                          onChange={() =>
                                            runGuarded(() => completeSiteTask(amendment.id, siteCode, task.id))
                                          }
                                        />
                                        {task.label}
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                                {site.status !== "Compliant" && (
                                  <button
                                    className="am-btn am-btn-small"
                                    disabled={
                                      !allDone ||
                                      (amendment.status !== "Published" && amendment.status !== "Site Rollout")
                                    }
                                    onClick={() => runGuarded(() => markSiteCompliant(amendment.id, siteCode))}
                                    title={!allDone ? "Complete all tasks first" : ""}
                                  >
                                    Mark site compliant
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {getAmendment(amendment.id) && (
                            <div className="am-history">
                              <strong>History:</strong>{" "}
                              {(getAmendment(amendment.id).history || [])
                                .map((entry) => `${entry.action} (${entry.by}, ${new Date(entry.at).toLocaleDateString()})`)
                                .join(" → ")}
                            </div>
                          )}
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
