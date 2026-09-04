import { Fragment, useEffect, useMemo, useState } from "react";
import { getStudies } from "../../services/studyService";
import {
  recordShipment,
  receiveShipment,
  dispenseToSubject,
  resolveExcursion,
  returnLot,
  destroyLot,
  runReconciliation,
  getAllLots,
  getExpectedOnHand,
  subscribeIpAccountability,
  IP_EXCURSION_DISPOSITIONS,
} from "../../services/ipAccountabilityService";
import "../gaps/gap-tracker.css";

const STATUS_BADGE = {
  Shipped: "gt-badge-amber",
  Received: "gt-badge-blue",
  "In Use": "gt-badge-violet",
  Reconciled: "gt-badge-green",
  Returned: "gt-badge-cyan",
  Destroyed: "gt-badge-red",
};

const CONDITION_BADGE = {
  Acceptable: "gt-badge-green",
  Excursion: "gt-badge-amber",
  Rejected: "gt-badge-red",
};

const EMPTY_SHIPMENT = {
  studyCode: "",
  siteCode: "",
  lotNumber: "",
  kitNumber: "",
  quantity: "",
};

export default function IpAccountability() {
  const studies = useMemo(() => getStudies(), []);
  const [lots, setLots] = useState([]);
  const [filterStudy, setFilterStudy] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_SHIPMENT });
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = () => setLots(getAllLots());

  useEffect(() => {
    refresh();
    return subscribeIpAccountability(refresh);
  }, []);

  useEffect(() => {
    if (form.studyCode === "" && studies.length > 0) {
      setForm((f) => ({ ...f, studyCode: studies[0].code }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studies]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setDraft = (lotId, key, value) =>
    setDrafts((d) => ({ ...d, [lotId]: { ...(d[lotId] || {}), [key]: value } }));

  const filtered = filterStudy ? lots.filter((l) => l.studyCode === filterStudy) : lots;

  const onHandUnits = filtered.reduce((sum, l) => sum + Number(l.quantityOnHand || 0), 0);
  const openExcursions = filtered.reduce(
    (sum, l) => sum + (l.excursions || []).filter((e) => !e.disposition || e.disposition === "Quarantine").length,
    0
  );
  const reconciling = filtered.filter((l) => l.reconciliationStatus && l.reconciliationStatus !== "Balanced").length;

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

  function handleShip() {
    const created = runGuarded(() =>
      recordShipment({
        studyCode: form.studyCode,
        siteCode: form.siteCode.trim(),
        lotNumber: form.lotNumber.trim(),
        kitNumber: form.kitNumber.trim(),
        quantity: form.quantity,
      })
    );
    if (created) {
      setShowCreate(false);
      setForm({ ...EMPTY_SHIPMENT, studyCode: form.studyCode });
      setExpandedId(created.id);
    }
  }

  function handleReceive(lot) {
    const draft = drafts[lot.id] || {};
    const received = runGuarded(() =>
      receiveShipment(lot.id, {
        condition: draft.receiveCondition || "Acceptable",
        temperature: draft.temperature || null,
      })
    );
    if (received) setDrafts((d) => ({ ...d, [lot.id]: {} }));
  }

  function handleDispense(lot) {
    const draft = drafts[lot.id] || {};
    const done = runGuarded(() =>
      dispenseToSubject(lot.id, (draft.subjectId || "").trim(), draft.quantity, (draft.visitCode || "").trim())
    );
    if (done) setDraft(lot.id, "subjectId", "");
  }

  function handleResolve(lot, excursion) {
    const draft = drafts[lot.id] || {};
    const disposition = draft.excursionDisposition || "Quarantine";
    runGuarded(() =>
      resolveExcursion(lot.id, excursion.id, disposition, (draft.witness || "").trim())
    );
  }

  function handleReturn(lot) {
    const draft = drafts[lot.id] || {};
    runGuarded(() => returnLot(lot.id, draft.returnQty, (draft.returnReason || "").trim()));
  }

  function handleDestroy(lot) {
    const draft = drafts[lot.id] || {};
    runGuarded(() => destroyLot(lot.id, (draft.destroyWitness || "").trim()));
  }

  const studyNameOf = (code) => {
    const study = studies.find((s) => s.code === code);
    return study ? `${study.name || study.title || code} (${code})` : code || "(portfolio)";
  };

  return (
    <div className="gt-page">
      <div className="gt-header">
        <div>
          <h1 className="gt-title">IP / Supply Accountability</h1>
          <p className="gt-subtitle">
            Investigational product chain of custody — shipment, receipt, dispensation, excursions,
            reconciliation (spec 6.26).
          </p>
        </div>
        <button className="gt-btn gt-btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "+ Record shipment"}
        </button>
      </div>

      <div className="gt-kpis">
        <div className="gt-kpi">
          <span className="gt-kpi-value">{filtered.length}</span>
          <span className="gt-kpi-label">Lots tracked</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{onHandUnits}</span>
          <span className="gt-kpi-label">Units on hand</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{openExcursions}</span>
          <span className="gt-kpi-label">Open excursions</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{reconciling}</span>
          <span className="gt-kpi-label">Awaiting reconciliation</span>
        </div>
      </div>

      {showCreate && (
        <div className="gt-card">
          <h3>Record shipment dispatch</h3>
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
              Lot / batch number
              <input value={form.lotNumber} onChange={(e) => setField("lotNumber", e.target.value)} placeholder="LOT-2026-001" />
            </label>
            <label>
              Kit number (optional)
              <input value={form.kitNumber} onChange={(e) => setField("kitNumber", e.target.value)} placeholder="KT-0001" />
            </label>
            <label>
              Quantity shipped
              <input type="number" min="1" value={form.quantity} onChange={(e) => setField("quantity", e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="gt-btn gt-btn-primary" onClick={handleShip}>
              Dispatch shipment (Shipped)
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
              <th>Lot</th>
              <th>Site</th>
              <th>Received / on hand</th>
              <th>Status</th>
              <th>Reconciliation</th>
              <th className="gt-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="gt-empty">
                  No lots tracked yet. Record a shipment to start the accountability chain.
                </td>
              </tr>
            )}
            {filtered.map((lot) => {
              const isExpanded = expandedId === lot.id;
              const draft = drafts[lot.id] || {};
              const expected = getExpectedOnHand(lot);
              const excursions = lot.excursions || [];
              const openExc = excursions.some((e) => !e.disposition || e.disposition === "Quarantine");
              return (
                <Fragment key={lot.id}>
                  <tr onClick={() => setExpandedId(isExpanded ? null : lot.id)} className="gt-row">
                    <td>
                      <strong>{lot.lotNumber}</strong>
                      {lot.kitNumber && <div className="gt-row-sub">{lot.kitNumber}</div>}
                      {lot.condition && (
                        <span className={`gt-badge ${CONDITION_BADGE[lot.condition] || "gt-badge-gray"}`} style={{ marginTop: 4 }}>
                          {lot.condition}
                        </span>
                      )}
                      {openExc && (
                        <span className="gt-badge gt-badge-red" style={{ marginLeft: 6 }}>
                          Excursion open
                        </span>
                      )}
                    </td>
                    <td>
                      {lot.siteCode}
                      <div className="gt-row-sub">{studyNameOf(lot.studyCode)}</div>
                    </td>
                    <td>
                      {lot.quantityOnHand} / {lot.quantityReceived}
                      <div className="gt-row-sub">expected on hand: {expected}</div>
                    </td>
                    <td>
                      <span className={`gt-badge ${STATUS_BADGE[lot.status] || "gt-badge-gray"}`}>{lot.status}</span>
                    </td>
                    <td>{lot.reconciliationStatus || "—"}</td>
                    <td className="gt-actions-col" onClick={(e) => e.stopPropagation()}>
                      {lot.status === "Shipped" && (
                        <button
                          className="gt-btn gt-btn-primary gt-btn-small"
                          onClick={() => {
                            setExpandedId(lot.id);
                          }}
                        >
                          Receive
                        </button>
                      )}
                      {(lot.status === "Received" || lot.status === "In Use") && !openExc && (
                        <button
                          className="gt-btn gt-btn-small"
                          onClick={() => setExpandedId(isExpanded ? null : lot.id)}
                        >
                          {isExpanded ? "Hide" : "Dispense"}
                        </button>
                      )}
                      {lot.status !== "Reconciled" &&
                        lot.status !== "Returned" &&
                        lot.status !== "Destroyed" && (
                          <button
                            className="gt-btn gt-btn-small"
                            onClick={() => runGuarded(() => runReconciliation(lot.id))}
                            title="Compare expected vs on-hand"
                          >
                            Reconcile
                          </button>
                        )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="gt-detail-row">
                        <div className="gt-panel">
                          <h4>Receipt</h4>
                          <div className="gt-inline">
                            <label>
                              Condition
                              <select
                                value={draft.receiveCondition || "Acceptable"}
                                onChange={(e) => setDraft(lot.id, "receiveCondition", e.target.value)}
                              >
                                <option>Acceptable</option>
                                <option>Excursion</option>
                                <option>Rejected</option>
                              </select>
                            </label>
                            {(draft.receiveCondition === "Excursion" || draft.receiveCondition === "Rejected") && (
                              <label>
                                Temperature (°C)
                                <input value={draft.temperature || ""} onChange={(e) => setDraft(lot.id, "temperature", e.target.value)} />
                              </label>
                            )}
                            <button className="gt-btn gt-btn-primary gt-btn-small" onClick={() => handleReceive(lot)}>
                              Confirm receipt
                            </button>
                          </div>
                        </div>

                        {(lot.status === "Received" || lot.status === "In Use") && (
                          <div className="gt-panel">
                            <h4>Dispense to subject</h4>
                            <div className="gt-inline">
                              <label>
                                Subject
                                <input value={draft.subjectId || ""} onChange={(e) => setDraft(lot.id, "subjectId", e.target.value)} placeholder="SUBJ-001" />
                              </label>
                              <label>
                                Quantity
                                <input type="number" min="1" value={draft.quantity || ""} onChange={(e) => setDraft(lot.id, "quantity", e.target.value)} />
                              </label>
                              <label>
                                Visit code
                                <input value={draft.visitCode || ""} onChange={(e) => setDraft(lot.id, "visitCode", e.target.value)} placeholder="V1" />
                              </label>
                              <button className="gt-btn gt-btn-primary gt-btn-small" onClick={() => handleDispense(lot)}>
                                Dispense
                              </button>
                            </div>
                          </div>
                        )}

                        {excursions.length > 0 && (
                          <div className="gt-panel">
                            <h4>Temperature excursions</h4>
                            {excursions.map((exc) => (
                              <div key={exc.id} className="gt-inline" style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                                <span className="gt-note">
                                  {exc.reportedAt ? new Date(exc.reportedAt).toLocaleString() : ""}
                                  {exc.temperature ? ` · ${exc.temperature} °C` : ""} · reported by {exc.reportedBy || "Unknown"}
                                </span>
                                {exc.disposition ? (
                                  <span className={`gt-badge ${exc.disposition === "Use" ? "gt-badge-green" : exc.disposition === "Discard" ? "gt-badge-red" : "gt-badge-amber"}`}>
                                    {exc.disposition}
                                  </span>
                                ) : (
                                  <>
                                    <select
                                      value={draft.excursionDisposition || "Quarantine"}
                                      onChange={(e) => setDraft(lot.id, "excursionDisposition", e.target.value)}
                                    >
                                      {IP_EXCURSION_DISPOSITIONS.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                      ))}
                                    </select>
                                    <input
                                      value={draft.witness || ""}
                                      onChange={(e) => setDraft(lot.id, "witness", e.target.value)}
                                      placeholder="Witness (required for Discard)"
                                    />
                                    <button className="gt-btn gt-btn-small" onClick={() => handleResolve(lot, exc)}>
                                      Resolve
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {(lot.status === "In Use" || lot.status === "Received") && (
                          <div className="gt-panel">
                            <h4>Return / destroy</h4>
                            <div className="gt-inline">
                              <label>
                                Return qty
                                <input type="number" min="1" value={draft.returnQty || ""} onChange={(e) => setDraft(lot.id, "returnQty", e.target.value)} />
                              </label>
                              <label>
                                Reason
                                <input value={draft.returnReason || ""} onChange={(e) => setDraft(lot.id, "returnReason", e.target.value)} />
                              </label>
                              <button className="gt-btn gt-btn-small" onClick={() => handleReturn(lot)}>
                                Return to sponsor
                              </button>
                            </div>
                            <div className="gt-inline">
                              <label>
                                Destruction witness
                                <input value={draft.destroyWitness || ""} onChange={(e) => setDraft(lot.id, "destroyWitness", e.target.value)} />
                              </label>
                              <button className="gt-btn gt-btn-danger-ghost gt-btn-small" onClick={() => handleDestroy(lot)}>
                                Destroy lot
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="gt-panel">
                          <h4>Transaction trail</h4>
                          {(lot.transactions || []).length === 0 && <div className="gt-empty">No transactions.</div>}
                          <ul className="gt-facts">
                            {(lot.transactions || []).map((tx) => (
                              <li key={tx.id}>
                                <span>
                                  {tx.type} · {tx.quantity}
                                </span>
                                <span style={{ width: "auto" }}>
                                  {tx.subjectId ? `subject ${tx.subjectId}` : ""}
                                  {tx.visitCode ? ` · ${tx.visitCode}` : ""}
                                  {tx.note ? ` · ${tx.note}` : ""} — {new Date(tx.date).toLocaleString()} by {tx.by}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="gt-history" style={{ marginTop: 6 }}>
                            <strong>History:</strong>{" "}
                            {(lot.history || []).map((h) => `${h.action} (${h.by || "Unknown"})`).join(" → ")}
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
