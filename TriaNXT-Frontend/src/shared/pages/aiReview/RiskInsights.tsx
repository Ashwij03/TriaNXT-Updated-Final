import { useCallback, useState } from "react";
import { FiCpu, FiSearch, FiShield, FiTrendingUp } from "react-icons/fi";

import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import { aiReviewApi, isApiEnabled } from "../../services/api";

import "./RiskInsights.css";

function ScoreGauge({ score }: any) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const band = pct >= 60 ? "high" : pct >= 25 ? "medium" : "low";
  return (
    <div className={`ri-gauge ri-gauge--${band}`}>
      <div className="ri-gauge-fill" style={{ width: `${pct}%` }} />
      <span className="ri-gauge-label">{pct.toFixed(1)}</span>
    </div>
  );
}

function RiskInsights() {
  const [siteId, setSiteId] = useState("");
  const [siteResult, setSiteResult] = useState(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteError, setSiteError] = useState(null);

  const [query, setQuery] = useState("");
  const [copilotResult, setCopilotResult] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState(null);

  const runSiteRisk = useCallback(async (e) => {
    e.preventDefault();
    if (!siteId) return;
    setSiteLoading(true);
    setSiteError(null);
    setSiteResult(null);
    try {
      const res = await aiReviewApi.getSiteRisk(siteId);
      setSiteResult(res?.data || null);
    } catch (err) {
      setSiteError(err?.message || "Failed to score site risk.");
    } finally {
      setSiteLoading(false);
    }
  }, [siteId]);

  const runCopilot = useCallback(async (e) => {
    e.preventDefault();
    if (!query) return;
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotResult(null);
    try {
      const res = await aiReviewApi.copilotQuery(query);
      setCopilotResult(res?.data || null);
    } catch (err) {
      setCopilotError(err?.message || "Copilot query failed.");
    } finally {
      setCopilotLoading(false);
    }
  }, [query]);

  if (!isApiEnabled()) {
    return (
      <DashboardLayout>
        <div className="ri-page">
          <div className="ri-empty-state">
            <FiCpu size={28} />
            <p>
              AI Review needs the API backend configured (
              <code>REACT_APP_API_URL</code>) to run. See{" "}
              <code>README_PYTHON_SERVICES.md</code> for local setup.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="ri-page">
        <div className="ri-header">
          <h1>
            <FiCpu /> AI Review &amp; Risk Insights
          </h1>
          <p className="ri-subtitle">
            Risk-based monitoring, document QC, and the natural-language study copilot — see
            Architecture Blueprint Section 6. Every AI output here is advisory: a human reviewer must
            accept or reject a finding before it's treated as authoritative.
          </p>
        </div>

        <div className="ri-cards">
          <section className="ri-card">
            <h2>
              <FiTrendingUp /> Site risk score
            </h2>
            <p className="ri-card-desc">
              Continuous risk index from open-query aging and overdue-visit KRIs (Section 6.1).
            </p>
            <form onSubmit={runSiteRisk} className="ri-form">
              <input
                placeholder="Site ID..."
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              />
              <button type="submit" disabled={siteLoading || !siteId}>
                {siteLoading ? "Scoring..." : "Score site"}
              </button>
            </form>
            {siteError && <div className="ri-error">{siteError}</div>}
            {siteResult && (
              <div className="ri-result">
                <ScoreGauge score={siteResult.score} />
                <ul className="ri-reasons">
                  {(siteResult.reasons || []).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  {(!siteResult.reasons || siteResult.reasons.length === 0) && (
                    <li>No elevated risk signals found.</li>
                  )}
                </ul>
                <span className="ri-model-tag">model: {siteResult.model}</span>
              </div>
            )}
          </section>

          <section className="ri-card">
            <h2>
              <FiShield /> Study copilot
            </h2>
            <p className="ri-card-desc">
              Natural-language query over studies — keyword fallback until RAG/Bedrock are
              provisioned (Section 6.2).
            </p>
            <form onSubmit={runCopilot} className="ri-form">
              <input
                placeholder="e.g. oncology phase 2"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit" disabled={copilotLoading || !query}>
                <FiSearch size={14} /> {copilotLoading ? "Searching..." : "Ask"}
              </button>
            </form>
            {copilotError && <div className="ri-error">{copilotError}</div>}
            {copilotResult && (
              <div className="ri-result">
                <span className="ri-model-tag">{copilotResult.answer_mode}</span>
                <ul className="ri-matches">
                  {(copilotResult.matches || []).map((m) => (
                    <li key={m.id}>
                      <strong>{m.code}</strong> — {m.name} ({m.status})
                    </li>
                  ))}
                  {(!copilotResult.matches || copilotResult.matches.length === 0) && (
                    <li>No matching studies found.</li>
                  )}
                </ul>
                {copilotResult.note && <p className="ri-note">{copilotResult.note}</p>}
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default RiskInsights;
