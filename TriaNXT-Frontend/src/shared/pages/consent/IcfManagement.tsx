import { Fragment, useEffect, useMemo, useState } from "react";
import { getStudies } from "../../services/studyService";
import { getSubjects } from "../../services/subjectService";
import {
  createIcfVersion,
  approveIcfVersion,
  activateIcfVersion,
  getIcfVersions,
  getActiveIcfVersion,
  recordConsentEvent,
  getConsentEvents,
  canEnrollSubject,
  createReConsentCampaign,
  completeReConsent,
  getReConsentCampaigns,
  isSubjectProceduresBlocked,
  subscribeConsentIcf,
} from "../../services/icfConsentService";
import "../gaps/gap-tracker.css";

const STATUS_BADGE = {
  Draft: "gt-badge-gray",
  Approved: "gt-badge-blue",
  Active: "gt-badge-green",
  Superseded: "gt-badge-gray",
};

const EMPTY_VERSION = {
  studyCode: "",
  siteCode: "",
  language: "English",
  version: "",
  amendmentId: "",
  witnessRequired: false,
};

const EMPTY_CAMPAIGN = {
  studyCode: "",
  amendmentId: "",
  icfVersionId: "",
  subjectIds: "",
  dueDate: "",
};

export default function IcfManagement() {
  const studies = useMemo(() => getStudies(), []);
  const [versions, setVersions] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [filterStudy, setFilterStudy] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [campaignExpanded, setCampaignExpanded] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_VERSION });
  const [campaignForm, setCampaignForm] = useState({ ...EMPTY_CAMPAIGN });
  const [consent, setConsent] = useState({ studyCode: "", subjectId: "", siteCode: "", witness: "" });
  const [eligibility, setEligibility] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    setVersions(getIcfVersions(""));
    setCampaigns(getReConsentCampaigns(""));
  };

  useEffect(() => {
    refresh();
    return subscribeConsentIcf(refresh);
  }, []);

  useEffect(() => {
    if (filterStudy) {
      const study = studies.find((s) => s.code === filterStudy);
      setSubjects(study ? getSubjects(study.id) : []);
    } else {
      setSubjects([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStudy, studies]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setCampaignField = (key, value) => setCampaignForm((f) => ({ ...f, [key]: value }));
  const setConsentField = (key, value) => setConsent((c) => ({ ...c, [key]: value }));

  const studyNameOf = (code) => {
    const study = studies.find((s) => s.code === code);
    return study ? `${study.name || study.title || code} (${code})` : code || "(portfolio)";
  };

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

  const activeVersions = versions.filter((v) => v.status === "Active");
  const draftCount = versions.filter((v) => v.status === "Draft").length;
  const openCampaigns = campaigns.filter((c) => c.status === "Open").length;

  function handleCreateVersion() {
    const created = runGuarded(() =>
      createIcfVersion({
        studyCode: form.studyCode,
        siteCode: form.siteCode.trim(),
        language: form.language,
        version: form.version.trim(),
        amendmentId: form.amendmentId.trim(),
        witnessRequired: form.witnessRequired,
      })
    );
    if (created) {
      setShowCreate(false);
      setForm({ ...EMPTY_VERSION, studyCode: form.studyCode });
    }
  }

  function handleCreateCampaign() {
    const subjectIds = campaignForm.subjectIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const created = runGuarded(() =>
      createReConsentCampaign({
        studyCode: campaignForm.studyCode,
        amendmentId: campaignForm.amendmentId.trim(),
        icfVersionId: campaignForm.icfVersionId,
        subjectIds,
        dueDate: campaignForm.dueDate,
      })
    );
    if (created) {
      setShowCampaign(false);
      setCampaignForm({ ...EMPTY_CAMPAIGN, studyCode: campaignForm.studyCode });
      setCampaignExpanded(created.id);
    }
  }

  function handleCheckEligibility() {
    setError("");
    setNotice("");
    if (!consent.studyCode || !consent.subjectId) {
      setError("Choose a study and subject first.");
      return;
    }
    const siteCode = consent.siteCode.trim();
    const result = canEnrollSubject(consent.studyCode, siteCode, consent.subjectId.trim());
    setEligibility(result);
    setEvents(getConsentEvents(consent.studyCode, consent.subjectId.trim()));
    if (result && result.ok) setNotice(result.reason);
  }

  function handleRecordConsent() {
    const active = getActiveIcfVersion(consent.studyCode, consent.siteCode.trim());
    if (!active) {
      setError("No ACTIVE ICF version for this site — activate one first.");
      return;
    }
    const recorded = runGuarded(() =>
      recordConsentEvent({
        studyCode: consent.studyCode,
        subjectId: consent.subjectId.trim(),
        icfVersionId: active.id,
        witness: consent.witness.trim(),
      })
    );
    if (recorded) handleCheckEligibility();
  }

  const studySelect = (
    <select
      value={filterStudy}
      onChange={(e) => setFilterStudy(e.target.value)}
      style={{ minWidth: 300 }}
    >
      <option value="">All studies</option>
      {studies.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name || s.title} ({s.code})
        </option>
      ))}
    </select>
  );

  return (
    <div className="gt-page">
      <div className="gt-header">
        <div>
          <h1 className="gt-title">ICF &amp; eConsent Management</h1>
          <p className="gt-subtitle">
            Informed-consent form versions per site/language, subject consent events and re-consent
            campaigns driven by protocol amendments (spec 6.28).
          </p>
        </div>
        <div className="gt-header-actions">
          <button className="gt-btn gt-btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "+ New ICF version"}
          </button>
          <button className="gt-btn" onClick={() => setShowCampaign(!showCampaign)}>
            {showCampaign ? "Cancel" : "+ Re-consent campaign"}
          </button>
        </div>
      </div>

      <div className="gt-kpis">
        <div className="gt-kpi">
          <span className="gt-kpi-value">{versions.length}</span>
          <span className="gt-kpi-label">ICF versions</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{activeVersions.length}</span>
          <span className="gt-kpi-label">Active</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{draftCount}</span>
          <span className="gt-kpi-label">Draft / approved pending</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{openCampaigns}</span>
          <span className="gt-kpi-label">Re-consent campaigns open</span>
        </div>
      </div>

      {error && <div className="gt-error">{error}</div>}
      {notice && <div className="gt-notice">{notice}</div>}

      {showCreate && (
        <div className="gt-card">
          <h3>New ICF version</h3>
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
              Language
              <input value={form.language} onChange={(e) => setField("language", e.target.value)} placeholder="English" />
            </label>
            <label>
              Version
              <input value={form.version} onChange={(e) => setField("version", e.target.value)} placeholder="1.0" />
            </label>
            <label>
              Originating amendment (optional)
              <input value={form.amendmentId} onChange={(e) => setField("amendmentId", e.target.value)} placeholder="AMD-…" />
            </label>
          </div>
          <div className="gt-checks">
            <label>
              <input type="checkbox" checked={form.witnessRequired} onChange={(e) => setField("witnessRequired", e.target.checked)} />
              Witness signature required for this version
            </label>
          </div>
          <button className="gt-btn gt-btn-primary" onClick={handleCreateVersion}>
            Create ICF version (Draft)
          </button>
        </div>
      )}

      {showCampaign && (
        <div className="gt-card">
          <h3>Open re-consent campaign</h3>
          <div className="gt-form-grid">
            <label>
              Study
              <select value={campaignForm.studyCode} onChange={(e) => {
                setCampaignField("studyCode", e.target.value);
                setCampaignField("icfVersionId", "");
              }}>
                {studies.length === 0 && <option value="">No studies yet</option>}
                {studies.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name || s.title} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amendment driving re-consent
              <input value={campaignForm.amendmentId} onChange={(e) => setCampaignField("amendmentId", e.target.value)} placeholder="AMD-…" />
            </label>
            <label>
              New ACTIVE ICF version to re-consent to
              <select value={campaignForm.icfVersionId} onChange={(e) => setCampaignField("icfVersionId", e.target.value)}>
                <option value="">Select active version…</option>
                {versions
                  .filter((v) => !campaignForm.studyCode || v.studyCode === campaignForm.studyCode)
                  .filter((v) => v.status === "Active")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} — {v.siteCode} ({v.language})
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Due date
              <input type="date" value={campaignForm.dueDate} onChange={(e) => setCampaignField("dueDate", e.target.value)} />
            </label>
            <label className="gt-full">
              Affected subject IDs (comma separated)
              <input value={campaignForm.subjectIds} onChange={(e) => setCampaignField("subjectIds", e.target.value)} placeholder="SUBJ-001, SUBJ-002" list="icf-subject-options" />
            </label>
          </div>
          <datalist id="icf-subject-options">
            {subjects.map((s) => (
              <option key={s.id || s.subjectId} value={s.id || s.subjectId} />
            ))}
          </datalist>
          <div style={{ marginTop: 12 }}>
            <button className="gt-btn gt-btn-primary" onClick={handleCreateCampaign}>
              Open campaign
            </button>
          </div>
        </div>
      )}

      <div className="gt-toolbar">
        <label className="gt-note" style={{ marginRight: 2 }}>Filter: </label>
        {studySelect}
      </div>

      <div className="gt-panel" style={{ marginBottom: 16 }}>
        <h4>Consent / enrollment check</h4>
        <div className="gt-inline">
          <label>
            Study
            <select
              value={consent.studyCode}
              onChange={(e) => setConsentField("studyCode", e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="">Select study…</option>
              {studies.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name || s.title} ({s.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input value={consent.subjectId} onChange={(e) => setConsentField("subjectId", e.target.value)} list="consent-subject-options" placeholder="SUBJ-001" />
          </label>
          <label>
            Site code
            <input value={consent.siteCode} onChange={(e) => setConsentField("siteCode", e.target.value)} placeholder="SITE-01" />
          </label>
          <label>
            Witness (if required)
            <input value={consent.witness} onChange={(e) => setConsentField("witness", e.target.value)} />
          </label>
          <button className="gt-btn" onClick={handleCheckEligibility}>
            Check eligibility
          </button>
          <button className="gt-btn gt-btn-primary" onClick={handleRecordConsent}>
            Record consent on active ICF
          </button>
        </div>
        <datalist id="consent-subject-options">
          {subjects.map((s) => (
            <option key={s.id || s.subjectId} value={s.id || s.subjectId} />
          ))}
        </datalist>
        {eligibility && (
          <div className={eligibility.ok ? "gt-notice" : "gt-callout"} style={{ marginTop: 8 }}>
            {eligibility.ok ? "✅ " : "⛔ "}
            {eligibility.reason}
          </div>
        )}
        {events.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <strong className="gt-note">Consent events for this subject:</strong>
            <ul className="gt-facts">
              {events.map((event) => (
                <li key={event.id}>
                  <span>ICF v{event.icfVersion} · {event.date}</span>
                  <span style={{ width: "auto" }}>
                    {event.siteCode} · recorded {new Date(event.createdAt).toLocaleString()} by {event.createdBy || "Unknown"}
                    {event.campaignId ? ` · via re-consent ${event.campaignId}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="gt-table-wrap" style={{ marginBottom: 16 }}>
        <table className="gt-table">
          <thead>
            <tr>
              <th>ICF version</th>
              <th>Study / site</th>
              <th>Language</th>
              <th>Status</th>
              <th className="gt-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 && (
              <tr>
                <td colSpan={5} className="gt-empty">
                  No ICF versions yet. Create the first version for a site, approve, then activate it.
                </td>
              </tr>
            )}
            {versions.map((version) => (
              <tr key={version.id}>
                <td>
                  <strong>v{version.version}</strong>
                  {version.amendmentId && <div className="gt-row-sub">amendment {version.amendmentId}</div>}
                  {version.witnessRequired && (
                    <div className="gt-row-sub">
                      <span className="gt-badge gt-badge-amber">witness required</span>
                    </div>
                  )}
                </td>
                <td>
                  {version.siteCode || "—"}
                  <div className="gt-row-sub">{studyNameOf(version.studyCode)}</div>
                </td>
                <td>{version.language}</td>
                <td>
                  <span className={`gt-badge ${STATUS_BADGE[version.status] || "gt-badge-gray"}`}>
                    {version.status}
                  </span>
                </td>
                <td className="gt-actions-col">
                  {version.status === "Draft" && (
                    <button className="gt-btn gt-btn-small" onClick={() => runGuarded(() => approveIcfVersion(version.id))}>
                      Approve
                    </button>
                  )}
                  {version.status === "Approved" && (
                    <button className="gt-btn gt-btn-primary gt-btn-small" onClick={() => runGuarded(() => activateIcfVersion(version.id))}>
                      Activate for site
                    </button>
                  )}
                  {version.status === "Active" && (
                    <span className="gt-badge gt-badge-green">Current consent version</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: "18px 0 10px", fontSize: 15 }}>Re-consent campaigns</h3>
      <div className="gt-table-wrap">
        <table className="gt-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Study / site</th>
              <th>Target version</th>
              <th>Status</th>
              <th className="gt-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="gt-empty">
                  No re-consent campaigns yet. Open one after publishing an amendment that changes consent.
                </td>
              </tr>
            )}
            {campaigns.map((campaign) => {
              const isExpanded = campaignExpanded === campaign.id;
              const done = campaign.subjects.filter((s) => s.completedAt).length;
              const blockedOpen = campaign.subjects.some(
                (s) => !s.completedAt && isSubjectProceduresBlocked(s.subjectId, campaign.studyCode)
              );
              return (
                <Fragment key={campaign.id}>
                  <tr onClick={() => setCampaignExpanded(isExpanded ? null : campaign.id)} className="gt-row">
                    <td>
                      <strong>{campaign.id}</strong>
                      <div className="gt-row-sub">amendment {campaign.amendmentId || "—"}</div>
                    </td>
                    <td>
                      {campaign.siteCode || "—"}
                      <div className="gt-row-sub">{studyNameOf(campaign.studyCode)}</div>
                    </td>
                    <td>ICF v{campaign.icfVersion}</td>
                    <td>
                      <span className={`gt-badge ${campaign.status === "Open" ? "gt-badge-amber" : "gt-badge-green"}`}>
                        {campaign.status}
                      </span>
                      {campaign.status === "Open" && blockedOpen && (
                        <div style={{ marginTop: 4 }}>
                          <span className="gt-badge gt-badge-red">Procedures blocked until re-consent</span>
                        </div>
                      )}
                    </td>
                    <td className="gt-actions-col">
                      <button className="gt-btn gt-btn-small" onClick={() => setCampaignExpanded(isExpanded ? null : campaign.id)}>
                        {isExpanded ? "Hide" : `Subjects (${done}/${campaign.subjects.length})`}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="gt-detail-row">
                        {campaign.dueDate && (
                          <div className="gt-note" style={{ marginBottom: 8 }}>
                            Due date: {new Date(campaign.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        <ul className="gt-facts">
                          {campaign.subjects.map((entry) => (
                            <li key={entry.subjectId}>
                              <span>{entry.subjectId}</span>
                              <span style={{ width: "auto" }}>
                                {entry.completedAt ? (
                                  <span className="gt-badge gt-badge-green">Re-consented {new Date(entry.completedAt).toLocaleDateString()}</span>
                                ) : (
                                  <button
                                    className="gt-btn gt-btn-small"
                                    onClick={() => runGuarded(() => completeReConsent(campaign.id, entry.subjectId))}
                                  >
                                    Record re-consent
                                  </button>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
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
