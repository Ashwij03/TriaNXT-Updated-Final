import { Fragment, useEffect, useMemo, useState } from "react";
import { getStudies } from "../../services/studyService";
import { getSubjects } from "../../services/subjectService";
import {
  addVendor,
  setVendorActive,
  offboardVendor,
  isVendorContractExpiring,
  getVendors,
  registerKit,
  advanceKitStatus,
  getAllKits,
  subscribeVendors,
  VENDOR_TYPES,
  KIT_STATUSES,
} from "../../services/vendorService";
import "../gaps/gap-tracker.css";

const STATUS_BADGE = {
  Onboarding: "gt-badge-gray",
  Active: "gt-badge-green",
  Offboarding: "gt-badge-amber",
  Offboarded: "gt-badge-red",
};

const KIT_BADGE = {
  Collected: "gt-badge-gray",
  Shipped: "gt-badge-blue",
  Received: "gt-badge-amber",
  Resulted: "gt-badge-green",
  Archived: "gt-badge-cyan",
};

const EMPTY_VENDOR = {
  name: "",
  type: "Central Lab",
  scope: "",
  contractRef: "",
  contractExpiryDate: "",
  contactName: "",
  contactEmail: "",
  notes: "",
};

const EMPTY_KIT = {
  vendorId: "",
  studyCode: "",
  subjectId: "",
  visitCode: "",
  kitType: "",
  specimenId: "",
};

export default function VendorManagement() {
  const studies = useMemo(() => getStudies(), []);
  const [vendors, setVendors] = useState([]);
  const [kits, setKits] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showVendor, setShowVendor] = useState(false);
  const [showKit, setShowKit] = useState(false);
  const [vendorForm, setVendorForm] = useState({ ...EMPTY_VENDOR });
  const [kitForm, setKitForm] = useState({ ...EMPTY_KIT });
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    setVendors(getVendors());
    setKits(getAllKits());
  };

  useEffect(() => {
    refresh();
    return subscribeVendors(refresh);
  }, []);

  const setVendorField = (key, value) => setVendorForm((f) => ({ ...f, [key]: value }));
  const setKitField = (key, value) => setKitForm((f) => ({ ...f, [key]: value }));
  const setDraft = (id, key, value) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), [key]: value } }));

  const activeVendors = vendors.filter((v) => v.status === "Active");
  const expiring = vendors.filter((v) => v.status !== "Offboarded" && isVendorContractExpiring(v));
  const shippedKits = kits.filter((k) => k.status === "Shipped" || k.status === "Received").length;

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

  function handleAddVendor() {
    const created = runGuarded(() =>
      addVendor({
        name: vendorForm.name.trim(),
        type: vendorForm.type,
        scope: vendorForm.scope.trim(),
        contractRef: vendorForm.contractRef.trim(),
        contractExpiryDate: vendorForm.contractExpiryDate,
        contactName: vendorForm.contactName.trim(),
        contactEmail: vendorForm.contactEmail.trim(),
        notes: vendorForm.notes.trim(),
      })
    );
    if (created) {
      setShowVendor(false);
      setVendorForm({ ...EMPTY_VENDOR });
    }
  }

  function handleOffboard(vendor) {
    const draft = drafts[vendor.id] || {};
    runGuarded(() => offboardVendor(vendor.id, (draft.offboardReason || "").trim()));
  }

  function handleKitStudyChange(studyCode) {
    setKitField("studyCode", studyCode);
    const study = studies.find((s) => s.code === studyCode);
    if (study) {
      setSubjects(getSubjects(study.id));
    } else {
      setSubjects([]);
    }
  }

  function handleRegisterKit() {
    const created = runGuarded(() =>
      registerKit({
        vendorId: kitForm.vendorId,
        studyCode: kitForm.studyCode,
        subjectId: kitForm.subjectId.trim(),
        visitCode: kitForm.visitCode.trim(),
        kitType: kitForm.kitType.trim(),
        specimenId: kitForm.specimenId.trim(),
      })
    );
    if (created) {
      setShowKit(false);
      setKitForm({ ...EMPTY_KIT });
    }
  }

  const nextKitStatus = (kit) => {
    const index = KIT_STATUSES.indexOf(kit.status);
    return index >= 0 && index < KIT_STATUSES.length - 1 ? KIT_STATUSES[index + 1] : null;
  };

  const vendorNameOf = (vendorId) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    return vendor ? vendor.name : vendorId || "—";
  };

  return (
    <div className="gt-page">
      <div className="gt-header">
        <div>
          <h1 className="gt-title">Vendor &amp; Lab Management</h1>
          <p className="gt-subtitle">
            Third-party vendors (central lab, imaging, ECG, translation) with contracts and lab
            kit / specimen chain of custody (spec 6.29).
          </p>
        </div>
        <div className="gt-header-actions">
          <button className="gt-btn gt-btn-primary" onClick={() => setShowVendor(!showVendor)}>
            {showVendor ? "Cancel" : "+ Add vendor"}
          </button>
          <button className="gt-btn" onClick={() => setShowKit(!showKit)}>
            {showKit ? "Cancel" : "+ Register lab kit"}
          </button>
        </div>
      </div>

      <div className="gt-kpis">
        <div className="gt-kpi">
          <span className="gt-kpi-value">{vendors.length}</span>
          <span className="gt-kpi-label">Vendors</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{activeVendors.length}</span>
          <span className="gt-kpi-label">Active</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{expiring.length}</span>
          <span className="gt-kpi-label">Contracts expiring (90d)</span>
        </div>
        <div className="gt-kpi">
          <span className="gt-kpi-value">{kits.length}</span>
          <span className="gt-kpi-label">Kits tracked ({shippedKits} in transit/received)</span>
        </div>
      </div>

      {error && <div className="gt-error">{error}</div>}
      {notice && <div className="gt-notice">{notice}</div>}

      {showVendor && (
        <div className="gt-card">
          <h3>Register vendor</h3>
          <div className="gt-form-grid">
            <label>
              Vendor name
              <input value={vendorForm.name} onChange={(e) => setVendorField("name", e.target.value)} placeholder="Central Lab Inc." />
            </label>
            <label>
              Type
              <select value={vendorForm.type} onChange={(e) => setVendorField("type", e.target.value)}>
                {VENDOR_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Scope
              <input value={vendorForm.scope} onChange={(e) => setVendorField("scope", e.target.value)} placeholder="Hematology & chemistry" />
            </label>
            <label>
              Contract ref
              <input value={vendorForm.contractRef} onChange={(e) => setVendorField("contractRef", e.target.value)} placeholder="CTR-2026-012" />
            </label>
            <label>
              Contract expiry
              <input type="date" value={vendorForm.contractExpiryDate} onChange={(e) => setVendorField("contractExpiryDate", e.target.value)} />
            </label>
            <label>
              Contact name
              <input value={vendorForm.contactName} onChange={(e) => setVendorField("contactName", e.target.value)} />
            </label>
            <label>
              Contact email
              <input value={vendorForm.contactEmail} onChange={(e) => setVendorField("contactEmail", e.target.value)} />
            </label>
            <label className="gt-full">
              Notes
              <input value={vendorForm.notes} onChange={(e) => setVendorField("notes", e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="gt-btn gt-btn-primary" onClick={handleAddVendor}>
              Add vendor (Onboarding)
            </button>
          </div>
        </div>
      )}

      <h3 style={{ margin: "18px 0 10px", fontSize: 15 }}>Vendors</h3>
      <div className="gt-table-wrap" style={{ marginBottom: 20 }}>
        <table className="gt-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Type</th>
              <th>Contract</th>
              <th>Status</th>
              <th className="gt-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 && (
              <tr>
                <td colSpan={5} className="gt-empty">
                  No vendors registered yet.
                </td>
              </tr>
            )}
            {vendors.map((vendor) => {
              const draft = drafts[vendor.id] || {};
              const expiringSoon = vendor.status !== "Offboarded" && isVendorContractExpiring(vendor);
              return (
                <Fragment key={vendor.id}>
                  <tr>
                    <td>
                      <strong>{vendor.name}</strong>
                      {vendor.scope && <div className="gt-row-sub">{vendor.scope}</div>}
                      {vendor.contactEmail && <div className="gt-row-sub">{vendor.contactName || ""} {vendor.contactEmail}</div>}
                    </td>
                    <td>{vendor.type}</td>
                    <td>
                      {vendor.contractRef || "—"}
                      {vendor.contractExpiryDate && (
                        <div className="gt-row-sub">
                          exp {new Date(vendor.contractExpiryDate).toLocaleDateString()}{" "}
                          {expiringSoon && <span className="gt-badge gt-badge-amber" style={{ marginLeft: 4 }}>expiring</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`gt-badge ${STATUS_BADGE[vendor.status] || "gt-badge-gray"}`}>{vendor.status}</span>
                    </td>
                    <td className="gt-actions-col">
                      {vendor.status === "Onboarding" && (
                        <button className="gt-btn gt-btn-primary gt-btn-small" onClick={() => runGuarded(() => setVendorActive(vendor.id))}>
                          Activate
                        </button>
                      )}
                      {vendor.status !== "Offboarded" && (
                        <>
                          <input
                            style={{ width: 150, marginRight: 4 }}
                            value={draft.offboardReason || ""}
                            onChange={(e) => setDraft(vendor.id, "offboardReason", e.target.value)}
                            placeholder="Offboard reason…"
                          />
                          <button className="gt-btn gt-btn-danger-ghost gt-btn-small" onClick={() => handleOffboard(vendor)}>
                            Offboard
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {vendor.offboardReason && (
                    <tr>
                      <td colSpan={5} className="gt-note" style={{ padding: "4px 12px 8px" }}>
                        Offboarded {vendor.offboardedAt ? new Date(vendor.offboardedAt).toLocaleDateString() : ""} — {vendor.offboardReason}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showKit && (
        <div className="gt-card">
          <h3>Register lab kit / specimen</h3>
          <div className="gt-form-grid">
            <label>
              Vendor (lab)
              <select value={kitForm.vendorId} onChange={(e) => setKitField("vendorId", e.target.value)}>
                <option value="">Select active vendor…</option>
                {activeVendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>
            <label>
              Study
              <select value={kitForm.studyCode} onChange={(e) => handleKitStudyChange(e.target.value)}>
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
              <input value={kitForm.subjectId} onChange={(e) => setKitField("subjectId", e.target.value)} list="kit-subject-options" placeholder="SUBJ-001" />
            </label>
            <label>
              Visit code
              <input value={kitForm.visitCode} onChange={(e) => setKitField("visitCode", e.target.value)} placeholder="V2" />
            </label>
            <label>
              Kit / assay type
              <input value={kitForm.kitType} onChange={(e) => setKitField("kitType", e.target.value)} placeholder="Blood sample" />
            </label>
            <label>
              Specimen ID
              <input value={kitForm.specimenId} onChange={(e) => setKitField("specimenId", e.target.value)} placeholder="SP-2026-0001" />
            </label>
          </div>
          <datalist id="kit-subject-options">
            {subjects.map((s) => (
              <option key={s.id || s.subjectId} value={s.id || s.subjectId} />
            ))}
          </datalist>
          <div style={{ marginTop: 12 }}>
            <button className="gt-btn gt-btn-primary" onClick={handleRegisterKit}>
              Register kit (Collected)
            </button>
          </div>
        </div>
      )}

      <h3 style={{ margin: "18px 0 10px", fontSize: 15 }}>Lab kits / specimens</h3>
      <div className="gt-table-wrap">
        <table className="gt-table">
          <thead>
            <tr>
              <th>Kit</th>
              <th>Vendor / lab</th>
              <th>Subject / visit</th>
              <th>Status</th>
              <th className="gt-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {kits.length === 0 && (
              <tr>
                <td colSpan={5} className="gt-empty">
                  No lab kits registered yet.
                </td>
              </tr>
            )}
            {kits.map((kit) => {
              const draft = drafts[kit.id] || {};
              const next = nextKitStatus(kit);
              return (
                <Fragment key={kit.id}>
                  <tr>
                    <td>
                      <strong>{kit.id}</strong>
                      {kit.kitType && <div className="gt-row-sub">{kit.kitType}</div>}
                      {kit.specimenId && <div className="gt-row-sub">specimen {kit.specimenId}</div>}
                    </td>
                    <td>
                      {vendorNameOf(kit.vendorId)}
                      {kit.studyCode && <div className="gt-row-sub">study {kit.studyCode}</div>}
                    </td>
                    <td>
                      {kit.subjectId}
                      {kit.visitCode && <div className="gt-row-sub">{kit.visitCode}</div>}
                    </td>
                    <td>
                      <span className={`gt-badge ${KIT_BADGE[kit.status] || "gt-badge-gray"}`}>{kit.status}</span>
                    </td>
                    <td className="gt-actions-col">
                      {next && (
                        <>
                          <input
                            style={{ width: 110, marginRight: 4 }}
                            value={draft.location || ""}
                            onChange={(e) => setDraft(kit.id, "location", e.target.value)}
                            placeholder="Location / courier"
                          />
                          <button
                            className="gt-btn gt-btn-small"
                            onClick={() => runGuarded(() => advanceKitStatus(kit.id, next, (draft.location || "").trim()))}
                          >
                            Mark {next}
                          </button>
                        </>
                      )}
                      {(kit.chainOfCustody || []).length > 0 && (
                        <button
                          className="gt-btn gt-btn-small"
                          title={(kit.chainOfCustody || []).map((c) => `${c.action} @ ${c.location || "—"} by ${c.handler}`).join("\n")}
                        >
                          COC {(kit.chainOfCustody || []).length}
                        </button>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
