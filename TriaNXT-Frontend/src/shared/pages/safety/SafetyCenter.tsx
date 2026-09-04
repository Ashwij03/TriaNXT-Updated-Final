import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiPlus, FiRefreshCw, FiShield } from "react-icons/fi";

import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import KPICard from "../../components/dashboard/shared/KPICard";
import DataTable from "../../components/dashboard/shared/DataTable";
import { isApiEnabled, safetyApi } from "../../services/api";

import "./SafetyCenter.css";

const STATUS_OPTIONS = ["Open", "UnderReview", "Reconciled", "Closed"];

const initialForm = {
  studyId: "",
  subjectRef: "",
  description: "",
  isSerious: false,
};

function SafetyCenter() {
  const [cases, setCases] = useState<any[]>([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studyFilter, setStudyFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = studyFilter ? { studyId: studyFilter } : undefined;
      const [caseRows, summaryData] = await Promise.all([
        safetyApi.listAeCases(params),
        safetyApi.getSummary(params),
      ]);
      setCases(Array.isArray(caseRows) ? caseRows : []);
      setSummary(summaryData?.data || null);
    } catch (err) {
      setError(err?.message || "Failed to load safety cases.");
    } finally {
      setLoading(false);
    }
  }, [studyFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReconcile = useCallback(
    async (aeCase) => {
      const pvReference = window.prompt(
        `Enter the PV system case reference for ${aeCase.subject_ref || aeCase.subjectRef}:`
      );
      if (!pvReference) return;
      try {
        await safetyApi.reconcileAeCase(aeCase.id, pvReference);
        await load();
      } catch (err) {
        setError(err?.message || "Failed to reconcile case.");
      }
    },
    [load]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!form.studyId || !form.subjectRef || !form.description) {
        setError("Study ID, subject reference, and description are required.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await safetyApi.createAeCase({
          study_id: form.studyId,
          subject_ref: form.subjectRef,
          description: form.description,
          is_serious: form.isSerious,
        });
        setShowModal(false);
        setForm(initialForm);
        await load();
      } catch (err) {
        setError(err?.message || "Failed to create case.");
      } finally {
        setSaving(false);
      }
    },
    [form, load]
  );

  const columns = useMemo(
    () => [
      { key: "subject_ref", label: "Subject", render: (v, row) => v || row.subjectRef || "—" },
      {
        key: "is_serious",
        label: "Severity",
        render: (v, row) => {
          const serious = v ?? row.isSerious;
          return (
            <span className={`safety-badge ${serious ? "safety-badge--serious" : "safety-badge--mild"}`}>
              {serious ? "SAE" : "AE"}
            </span>
          );
        },
      },
      { key: "description", label: "Description" },
      { key: "causality", label: "Causality" },
      { key: "outcome", label: "Outcome" },
      { key: "status", label: "Status" },
      {
        key: "pv_case_reference",
        label: "PV Reference",
        render: (v, row) => v || row.pvCaseReference || "—",
      },
      {
        key: "_actions",
        label: "Actions",
        render: (_v, row) =>
          row.status !== "Reconciled" ? (
            <button
              type="button"
              className="safety-action-btn"
              onClick={() => handleReconcile(row)}
              title="Mark reconciled against the external PV system">

              <FiRefreshCw size={14} /> Reconcile
            </button>
          ) : (
            <span className="safety-reconciled-label">Reconciled</span>
          ),
      },
    ],
    [handleReconcile]
  );

  if (!isApiEnabled()) {
    return (
      <DashboardLayout>
        <div className="safety-center">
          <div className="safety-empty-state">
            <FiShield size={28} />
            <p>
              The Safety module needs the API backend configured (
              <code>REACT_APP_API_URL</code>) to load AE/SAE cases. See{" "}
              <code>README_PYTHON_SERVICES.md</code> for local setup.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="safety-center">
        <div className="safety-header">
          <div>
            <h1>Safety Center</h1>
            <p className="safety-subtitle">Adverse event and serious adverse event tracking</p>
          </div>
          <div className="safety-header-actions">
            <input
              className="safety-study-filter"
              placeholder="Filter by study ID..."
              value={studyFilter}
              onChange={(e) => setStudyFilter(e.target.value)}
            />
            <button type="button" className="safety-primary-btn" onClick={() => setShowModal(true)}>
              <FiPlus size={16} /> Report case
            </button>
          </div>
        </div>

        {error && <div className="safety-error-banner">{error}</div>}

        {summary && (
          <div className="safety-kpi-row">
            <KPICard title="Total cases" value={summary.total ?? 0} icon={<FiShield />} variant="blue" />
            <KPICard title="Serious (SAE)" value={summary.serious ?? 0} icon={<FiAlertTriangle />} variant="red" />
            <KPICard title="Open" value={summary.open ?? 0} icon={<FiShield />} variant="amber" />
            <KPICard title="Reconciled" value={summary.reconciled ?? 0} icon={<FiShield />} variant="green" />
          </div>
        )}

        <DataTable
          title="AE / SAE Cases"
          columns={columns}
          data={cases}
          searchable
          searchPlaceholder="Search by subject, description..."
          filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS.map((s) => ({ value: s, label: s })) }]}
          pagination
          emptyMessage={loading ? "Loading..." : "No AE/SAE cases reported yet."}
        />

        {showModal && (
          <div className="safety-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="safety-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Report AE/SAE</h2>
              <form onSubmit={handleSubmit}>
                <label>
                  Study ID
                  <input
                    value={form.studyId}
                    onChange={(e) => setForm((f) => ({ ...f, studyId: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Subject reference
                  <input
                    value={form.subjectRef}
                    onChange={(e) => setForm((f) => ({ ...f, subjectRef: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    required
                  />
                </label>
                <label className="safety-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.isSerious}
                    onChange={(e) => setForm((f) => ({ ...f, isSerious: e.target.checked }))}
                  />
                  This is a Serious Adverse Event (SAE)
                </label>
                <div className="safety-modal-actions">
                  <button type="button" onClick={() => setShowModal(false)} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="safety-primary-btn" disabled={saving}>
                    {saving ? "Saving..." : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default SafetyCenter;
