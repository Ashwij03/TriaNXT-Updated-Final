import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArrowDownCircle,
  FiCheckCircle,
  FiDollarSign,
  FiFlag,
  FiPlus,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";

import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import KPICard from "../../components/dashboard/shared/KPICard";
import DataTable from "../../components/dashboard/shared/DataTable";
import { isApiEnabled, reportingApi } from "../../services/api";
import { getAccessibleStudies, getCurrentUser } from "../../services/roleService";
import ROLES from "../../constants/roles";

import "./reports.css";

const CURRENCY_FORMATTER = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const STATUS_BADGES: Record<string, string> = {
  Draft: "rpt-badge--gray",
  Issued: "rpt-badge--blue",
  Paid: "rpt-badge--green",
  Cancelled: "rpt-badge--red",
  Pending: "rpt-badge--amber",
  Approved: "rpt-badge--blue",
  Rejected: "rpt-badge--red",
  "Not Started": "rpt-badge--gray",
  "In Progress": "rpt-badge--blue",
  Delayed: "rpt-badge--amber",
  Completed: "rpt-badge--green",
};

function badgeClass(status: string) {
  return STATUS_BADGES[status] || "rpt-badge--gray";
}

function money(value: any) {
  const num = Number(value ?? 0);
  return Number.isFinite(num)
    ? num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : String(value ?? "—");
}

function pctValue(value: any) {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

function progressVariant(value: any) {
  const num = Number(value ?? 0);
  if (num >= 100) return "green";
  if (num >= 60) return "blue";
  if (num >= 40) return "amber";
  return "red";
}

function ProgressCell({ value }: any) {
  const num = Number(value ?? 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div className="rpt-progress-track">
        <div
          className={`rpt-progress-fill ${progressVariant(value)}`}
          style={{ width: `${Math.max(0, Math.min(100, num))}%` }}
        />
      </div>
      <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{pctValue(value)}</span>
    </div>
  );
}

function StatusBadge({ status }: any) {
  return <span className={`rpt-badge ${badgeClass(status)}`}>{status}</span>;
}

/* =========================================================================
   Finance & Milestones dashboard.
   `initialTab` lets /finance (default) and /milestones share one component.
   ========================================================================= */

function FinanceDashboard({ initialTab = "finance" }: any) {
  const [tab, setTab] = useState(initialTab === "milestones" ? "milestones" : "finance");

  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studyFilter, setStudyFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");

  // modals
  const [showBudget, setShowBudget] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [busy, setBusy] = useState(false);

  // form state
  const [budgetForm, setBudgetForm] = useState<any>({});
  const [invoiceForm, setInvoiceForm] = useState<any>({});
  const [payoutForm, setPayoutForm] = useState<any>({});
  const [milestoneForm, setMilestoneForm] = useState<any>({});

  const user = getCurrentUser();
  const role = user?.role;
  const isAdmin = role === ROLES.ADMIN;

  const canManageBudgets = isAdmin || role === ROLES.SPONSOR; // baseline edits
  const canCreateBudget = isAdmin || [ROLES.SPONSOR, ROLES.SITE_STAFF].includes(role);
  const canApprovePayouts = isAdmin || role === ROLES.SPONSOR;
  const canCreateInvoice = isAdmin || [ROLES.SPONSOR, ROLES.SITE_STAFF].includes(role);
  const canCreatePayout = isAdmin || [ROLES.SPONSOR, ROLES.SITE_STAFF].includes(role);
  const canCreateMilestone = isAdmin || [ROLES.SPONSOR, ROLES.SITE_STAFF].includes(role);

  const studies = useMemo(() => getAccessibleStudies(user), [user]);
  const studyOptions = useMemo(
    () =>
      studies.map((study) => ({
        value: String(study?.code || study?.studyId || study?.id || ""),
        label:
          study?.name || study?.title || study?.protocolTitle || study?.code,
      })),
    [studies],
  );

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (studyFilter) params.studyId = studyFilter;
      if (siteFilter) params.siteId = siteFilter;
      const res = await reportingApi.getFinanceSummary(params);
      setSnapshot(res || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load financials.");
    } finally {
      setLoading(false);
    }
  }, [studyFilter, siteFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (action: () => Promise<any>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await load();
      } catch (err: any) {
        setError(err?.message || "The action failed.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const summary = snapshot?.summary || {};

  const handleSubmitBudget = (event: any) => {
    event.preventDefault();
    if (!budgetForm.name || budgetForm.baselineAmount === undefined) return;
    runAction(async () => {
      await reportingApi.createBudget({
        name: budgetForm.name,
        studyId: budgetForm.studyId || null,
        siteId: budgetForm.siteId || null,
        siteName: budgetForm.siteName || "",
        baselineAmount: Number(budgetForm.baselineAmount),
        currency: budgetForm.currency || "USD",
        periodLabel: budgetForm.periodLabel || "",
      });
      setShowBudget(false);
      setBudgetForm({});
    });
  };

  const handleSubmitInvoice = (event: any) => {
    event.preventDefault();
    if (!invoiceForm.amount) return;
    runAction(async () => {
      await reportingApi.createInvoice({
        studyId: invoiceForm.studyId || null,
        siteId: invoiceForm.siteId || null,
        budgetCode: invoiceForm.budgetCode || "",
        description: invoiceForm.description || "",
        amount: Number(invoiceForm.amount),
        currency: invoiceForm.currency || "USD",
        periodLabel: invoiceForm.periodLabel || "",
      });
      setShowInvoice(false);
      setInvoiceForm({});
    });
  };

  const handleSubmitPayout = (event: any) => {
    event.preventDefault();
    if (!payoutForm.amount) return;
    runAction(async () => {
      await reportingApi.createPayout({
        budgetCode: payoutForm.budgetCode || "",
        invoiceCode: payoutForm.invoiceCode || "",
        studyId: payoutForm.studyId || null,
        siteId: payoutForm.siteId || null,
        reason: payoutForm.reason || "",
        amount: Number(payoutForm.amount),
        currency: payoutForm.currency || "USD",
      });
      setShowPayout(false);
      setPayoutForm({});
    });
  };

  const handleSubmitMilestone = (event: any) => {
    event.preventDefault();
    if (!milestoneForm.name) return;
    runAction(async () => {
      await reportingApi.createMilestone({
        name: milestoneForm.name,
        studyId: milestoneForm.studyId || null,
        siteId: milestoneForm.siteId || null,
        category: milestoneForm.category || "Contractual",
        weight: Number(milestoneForm.weight || 1),
        status: milestoneForm.status || "Not Started",
      });
      setShowMilestone(false);
      setMilestoneForm({});
    });
  };

  const budgetColumns = useMemo(
    () => [
      { key: "name", label: "Budget line" },
      { key: "studyId", label: "Study", render: (v: any) => v || "—" },
      { key: "siteName", label: "Site", render: (v: any, row: any) => v || row.siteId || "—" },
      {
        key: "baselineAmount",
        label: "Baseline",
        render: (v: any) => `$${money(v)}`,
      },
      { key: "actualSpend", label: "Actual", render: (v: any) => `$${money(v)}` },
      { key: "committedPending", label: "Pending", render: (v: any) => `$${money(v)}` },
      {
        key: "variance",
        label: "Variance",
        render: (v: any) => (
          <span style={{ color: Number(v) > 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
            {Number(v) > 0 ? "+" : ""}${money(v)}
          </span>
        ),
      },
      {
        key: "variancePct",
        label: "Variance %",
        render: (v: any) => `${Number(v) > 0 ? "+" : ""}${pctValue(v)}`,
      },
      { key: "status", label: "Status", render: (v: any) => <StatusBadge status={v} /> },
    ],
    [],
  );

  const invoiceColumns = useMemo(
    () => [
      { key: "number", label: "Invoice" },
      { key: "studyId", label: "Study", render: (v: any) => v || "—" },
      { key: "siteId", label: "Site", render: (v: any) => v || "—" },
      { key: "description", label: "Description", render: (v: any) => v || "—" },
      { key: "amount", label: "Amount", render: (v: any) => `$${money(v)}` },
      { key: "status", label: "Status", render: (v: any) => <StatusBadge status={v} /> },
      {
        key: "_actions",
        label: "Actions",
        render: (_v: any, row: any) => (
          <div style={{ display: "flex", gap: "0.375rem" }}>
            {row.status === "Draft" && (
              <button
                type="button"
                className="rpt-btn rpt-btn--sm"
                disabled={busy}
                onClick={() => runAction(() => reportingApi.issueInvoice(row.code))}
              >
                <FiCheckCircle size={13} /> Issue
              </button>
            )}
            {row.status === "Issued" && (
              <button
                type="button"
                className="rpt-btn rpt-btn--sm"
                disabled={busy || !canCreateInvoice}
                onClick={() => runAction(() => reportingApi.payInvoice(row.code))}
              >
                <FiDollarSign size={13} /> Mark paid
              </button>
            )}
          </div>
        ),
      },
    ],
    [busy, canCreateInvoice, runAction],
  );

  const payoutColumns = useMemo(
    () => [
      { key: "code", label: "Payout" },
      { key: "budgetCode", label: "Budget", render: (v: any) => v || "—" },
      { key: "invoiceCode", label: "Invoice", render: (v: any) => v || "—" },
      { key: "reason", label: "Reason", render: (v: any) => v || "—" },
      { key: "amount", label: "Amount", render: (v: any) => `$${money(v)}` },
      { key: "status", label: "Status", render: (v: any) => <StatusBadge status={v} /> },
      { key: "requestedBy", label: "Requested by", render: (v: any) => v || "—" },
      {
        key: "_actions",
        label: "Actions",
        render: (_v: any, row: any) => (
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            {row.status === "Pending" && canApprovePayouts && (
              <>
                <button
                  type="button"
                  className="rpt-btn rpt-btn--sm"
                  disabled={busy}
                  onClick={() => runAction(() => reportingApi.approvePayout(row.code))}
                >
                  <FiCheckCircle size={13} /> Approve
                </button>
                <button
                  type="button"
                  className="rpt-btn rpt-btn--ghost rpt-btn--sm"
                  disabled={busy}
                  onClick={() => runAction(() => reportingApi.rejectPayout(row.code))}
                >
                  <FiXCircle size={13} /> Reject
                </button>
              </>
            )}
            {row.status === "Approved" && canApprovePayouts && (
              <button
                type="button"
                className="rpt-btn rpt-btn--sm"
                disabled={busy}
                onClick={() => runAction(() => reportingApi.payPayout(row.code))}
              >
                <FiDollarSign size={13} /> Mark paid
              </button>
            )}
          </div>
        ),
      },
    ],
    [busy, canApprovePayouts, runAction],
  );

  const milestoneColumns = useMemo(
    () => [
      { key: "name", label: "Milestone" },
      { key: "studyId", label: "Study", render: (v: any) => v || "—" },
      { key: "siteId", label: "Site", render: (v: any) => v || "—" },
      { key: "category", label: "Category", render: (v: any) => v || "—" },
      { key: "weight", label: "Weight", render: (v: any) => money(v) },
      { key: "targetDate", label: "Target date", render: (v: any) => v || "—" },
      { key: "status", label: "Status", render: (v: any) => <StatusBadge status={v} /> },
      {
        key: "_actions",
        label: "Update",
        render: (_v: any, row: any) => (
          <select
            aria-label={`Update status for ${row.name}`}
            value={row.status}
            disabled={busy || !canManageBudgets}
            onChange={(e) =>
              runAction(() =>
                reportingApi.updateMilestoneStatus(row.code, e.target.value),
              )
            }
          >
            {["Not Started", "In Progress", "Delayed", "Completed", "Approved"].map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        ),
      },
    ],
    [busy, canManageBudgets, runAction],
  );

  const completion = snapshot?.completion || {};

  if (!isApiEnabled()) {
    return (
      <DashboardLayout>
        <div className="rpt-page">
          <div className="rpt-empty-state">
            <FiDollarSign size={28} />
            <p>
              Financials & Milestones need the backend API configured (
              <code>VITE_API_URL</code>). Start the FastAPI engine and relaunch
              the app in API mode — see SETUP.md §4/§5.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="rpt-page">
        <div className="rpt-header">
          <div>
            <h1>Financials &amp; Milestones</h1>
            <p className="rpt-subtitle">
              Site budgets vs. actual spend with explicit variance, invoice and
              payout workflows, and contractual milestone completion.
            </p>
          </div>
          <div className="rpt-header-actions">
            <select
              aria-label="Filter by study"
              value={studyFilter}
              onChange={(e) => setStudyFilter(e.target.value)}
            >
              <option value="">All studies</option>
              {studyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Filter by site"
              placeholder="Site..."
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              style={{ padding: "0.5rem 0.625rem", borderRadius: "0.25rem", border: "1px solid #d1d5db" }}
            />
            <button type="button" className="rpt-btn rpt-btn--ghost" onClick={load} disabled={loading}>
              <FiRefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>

        <div className="rpt-tabs">
          <button
            type="button"
            className={`rpt-tab${tab === "finance" ? " active" : ""}`}
            onClick={() => setTab("finance")}
          >
            Finance
          </button>
          <button
            type="button"
            className={`rpt-tab${tab === "milestones" ? " active" : ""}`}
            onClick={() => setTab("milestones")}
          >
            Milestones
          </button>
        </div>

        {error && <div className="rpt-error-banner">{error}</div>}

        {/* KPI row (shown on both tabs) */}
        <div className="rpt-kpi-row">
          <KPICard
            title="Budget baseline"
            value={`$${money(summary.totalBudgetBaseline)}`}
            icon={<FiDollarSign />}
            variant="blue"
          />
          <KPICard
            title="Actual spend"
            value={`$${money(summary.totalActualSpend)}`}
            icon={<FiArrowDownCircle />}
            variant="amber"
          />
          <KPICard
            title="Variance (actual − baseline)"
            value={`${Number(summary.totalVariance) > 0 ? "+" : ""}$${money(summary.totalVariance)}`}
            icon={<FiFlag />}
            variant={Number(summary.totalVariance) > 0 ? "red" : "green"}
          />
          <KPICard
            title="Pending payout approvals"
            value={summary.pendingPayoutApprovals ?? 0}
            icon={<FiCheckCircle />}
            variant="amber"
          />
          <KPICard
            title="Milestone completion"
            value={pctValue(summary.milestoneCompletionPct)}
            icon={<FiFlag />}
            variant="blue"
          />
        </div>

        {loading && !snapshot ? (
          <p className="rpt-subtitle">Loading financials...</p>
        ) : tab === "finance" ? (
          <>
            {/* spend by site roll-up */}
            {(snapshot?.spendBySite || []).length > 0 && (
              <>
                <h2 className="rpt-section-title">Spend vs. baseline by site</h2>
                <DataTable
                  title="Site budget spend"
                  columns={[
                    { key: "studyId", label: "Study", render: (v: any) => v || "—" },
                    { key: "siteId", label: "Site", render: (v: any) => v || "—" },
                    { key: "baselineAmount", label: "Baseline", render: (v: any) => `$${money(v)}` },
                    { key: "actualSpend", label: "Actual", render: (v: any) => `$${money(v)}` },
                    {
                      key: "variance",
                      label: "Variance",
                      render: (v: any) => (
                        <span style={{ color: Number(v) > 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                          {Number(v) > 0 ? "+" : ""}${money(v)}
                        </span>
                      ),
                    },
                    {
                      key: "variancePct",
                      label: "Variance %",
                      render: (v: any) => `${Number(v) > 0 ? "+" : ""}${pctValue(v)}`,
                    },
                    {
                      key: "_spend",
                      label: "Baseline used",
                      render: (_v: any, row: any) => (
                        <ProgressCell
                          value={
                            row.baselineAmount
                              ? ((row.actualSpend / row.baselineAmount) * 100).toFixed(1)
                              : 0
                          }
                        />
                      ),
                    },
                  ]}
                  data={snapshot?.spendBySite || []}
                  pagination
                  emptyMessage="No site budgets recorded."
                />
              </>
            )}

            {/* budgets */}
            <div className="rpt-header" style={{ marginBottom: "0.5rem", marginTop: "1.5rem" }}>
              <h2 style={{ margin: 0 }} className="rpt-section-title">Site budgets</h2>
              {canCreateBudget && (
                <button type="button" className="rpt-btn rpt-btn--sm" onClick={() => setShowBudget(true)}>
                  <FiPlus size={14} /> Add budget
                </button>
              )}
            </div>
            <DataTable
              title={`Budget lines (${(snapshot?.budgets || []).length})`}
              columns={budgetColumns}
              data={snapshot?.budgets || []}
              searchable
              searchPlaceholder="Search budgets..."
              pagination
              emptyMessage="No budget lines yet. Add the first site budget above."
            />

            {/* invoices */}
            <div className="rpt-header" style={{ marginBottom: "0.5rem", marginTop: "1.5rem" }}>
              <h2 style={{ margin: 0 }} className="rpt-section-title">Invoices</h2>
              {canCreateInvoice && (
                <button type="button" className="rpt-btn rpt-btn--sm" onClick={() => setShowInvoice(true)}>
                  <FiPlus size={14} /> Generate invoice
                </button>
              )}
            </div>
            <DataTable
              title={`Invoices (${(snapshot?.invoices || []).length})`}
              columns={invoiceColumns}
              data={snapshot?.invoices || []}
              pagination
              emptyMessage="No invoices generated yet."
            />

            {/* payouts */}
            <div className="rpt-header" style={{ marginBottom: "0.5rem", marginTop: "1.5rem" }}>
              <h2 style={{ margin: 0 }} className="rpt-section-title">Payouts</h2>
              {canCreatePayout && (
                <button type="button" className="rpt-btn rpt-btn--sm" onClick={() => setShowPayout(true)}>
                  <FiPlus size={14} /> Request payout
                </button>
              )}
            </div>
            <DataTable
              title={`Payout requests (${(snapshot?.payouts || []).length})`}
              columns={payoutColumns}
              data={snapshot?.payouts || []}
              pagination
              emptyMessage="No payout requests yet."
            />
          </>
        ) : (
          <>
            {/* completion per study + site */}
            {(completion.byStudy || []).length > 0 && (
              <>
                <h2 className="rpt-section-title">Contractual milestone completion by study</h2>
                <div className="rpt-card-grid">
                  {completion.byStudy.map((entry: any) => (
                    <div key={entry.studyId} className="rpt-card">
                      <h3>{entry.studyId}</h3>
                      <ProgressCell value={entry.completionPct} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {(completion.bySite || []).length > 0 && (
              <>
                <h2 className="rpt-section-title">Completion by study / site</h2>
                <DataTable
                  title="Milestone completion by site"
                  columns={[
                    { key: "studyId", label: "Study", render: (v: any) => v || "—" },
                    { key: "siteId", label: "Site", render: (v: any) => v || "—" },
                    {
                      key: "completionPct",
                      label: "Completion %",
                      render: (v: any) => <ProgressCell value={v} />,
                    },
                  ]}
                  data={completion.bySite || []}
                  pagination
                  emptyMessage="No milestones assigned to sites yet."
                />
              </>
            )}

            {/* milestone table */}
            <div className="rpt-header" style={{ marginBottom: "0.5rem", marginTop: "1.5rem" }}>
              <h2 style={{ margin: 0 }} className="rpt-section-title">Contractual milestones</h2>
              {canCreateMilestone && (
                <button type="button" className="rpt-btn rpt-btn--sm" onClick={() => setShowMilestone(true)}>
                  <FiPlus size={14} /> Add milestone
                </button>
              )}
            </div>
            <DataTable
              title={`Milestones (${(snapshot?.milestones || []).length})`}
              columns={milestoneColumns}
              data={snapshot?.milestones || []}
              searchable
              searchPlaceholder="Search milestones..."
              pagination
              emptyMessage="No contractual milestones recorded yet."
            />
          </>
        )}

        {/* ------------------------------ modals ------------------------------ */}

        {showBudget && (
          <div className="rpt-modal-overlay" onClick={() => setShowBudget(false)}>
            <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Add site budget</h2>
              <form onSubmit={handleSubmitBudget}>
                <label>
                  Budget name
                  <input
                    required
                    value={budgetForm.name || ""}
                    placeholder="e.g. Site activation fee"
                    onChange={(e) => setBudgetForm((f: any) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label>
                  Study
                  <select
                    value={budgetForm.studyId || ""}
                    onChange={(e) => setBudgetForm((f: any) => ({ ...f, studyId: e.target.value }))}
                  >
                    <option value="">— optional —</option>
                    {studyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Site (name)
                  <input
                    value={budgetForm.siteName || ""}
                    placeholder="e.g. Site 01 — Apollo"
                    onChange={(e) => setBudgetForm((f: any) => ({ ...f, siteName: e.target.value }))}
                  />
                </label>
                <label>
                  Baseline amount (USD)
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={budgetForm.baselineAmount ?? ""}
                    placeholder="25000.00"
                    onChange={(e) =>
                      setBudgetForm((f: any) => ({ ...f, baselineAmount: e.target.value }))
                    }
                  />
                </label>
                <div className="rpt-modal-actions">
                  <button type="button" onClick={() => setShowBudget(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="rpt-btn" disabled={busy}>
                    {busy ? "Saving..." : "Add budget"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showInvoice && (
          <div className="rpt-modal-overlay" onClick={() => setShowInvoice(false)}>
            <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Generate invoice</h2>
              <form onSubmit={handleSubmitInvoice}>
                <label>
                  Amount (USD)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={invoiceForm.amount ?? ""}
                    onChange={(e) => setInvoiceForm((f: any) => ({ ...f, amount: e.target.value }))}
                  />
                </label>
                <label>
                  Study
                  <select
                    value={invoiceForm.studyId || ""}
                    onChange={(e) => setInvoiceForm((f: any) => ({ ...f, studyId: e.target.value }))}
                  >
                    <option value="">— optional —</option>
                    {studyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Site (id)
                  <input
                    value={invoiceForm.siteId || ""}
                    onChange={(e) => setInvoiceForm((f: any) => ({ ...f, siteId: e.target.value }))}
                  />
                </label>
                <label>
                  Budget code
                  <input
                    value={invoiceForm.budgetCode || ""}
                    placeholder="e.g. BGT-XXXXXX"
                    onChange={(e) => setInvoiceForm((f: any) => ({ ...f, budgetCode: e.target.value }))}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={invoiceForm.description || ""}
                    placeholder="Milestone payment for..."
                    onChange={(e) => setInvoiceForm((f: any) => ({ ...f, description: e.target.value }))}
                  />
                </label>
                <div className="rpt-modal-actions">
                  <button type="button" onClick={() => setShowInvoice(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="rpt-btn" disabled={busy}>
                    {busy ? "Saving..." : "Create draft invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPayout && (
          <div className="rpt-modal-overlay" onClick={() => setShowPayout(false)}>
            <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Request payout</h2>
              <form onSubmit={handleSubmitPayout}>
                <label>
                  Amount (USD)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payoutForm.amount ?? ""}
                    onChange={(e) => setPayoutForm((f: any) => ({ ...f, amount: e.target.value }))}
                  />
                </label>
                <label>
                  Budget code
                  <input
                    value={payoutForm.budgetCode || ""}
                    placeholder="e.g. BGT-XXXXXX"
                    onChange={(e) => setPayoutForm((f: any) => ({ ...f, budgetCode: e.target.value }))}
                  />
                </label>
                <label>
                  Invoice code (optional)
                  <input
                    value={payoutForm.invoiceCode || ""}
                    onChange={(e) => setPayoutForm((f: any) => ({ ...f, invoiceCode: e.target.value }))}
                  />
                </label>
                <label>
                  Reason
                  <textarea
                    value={payoutForm.reason || ""}
                    placeholder="Payment for invoice..."
                    onChange={(e) => setPayoutForm((f: any) => ({ ...f, reason: e.target.value }))}
                  />
                </label>
                <div className="rpt-modal-actions">
                  <button type="button" onClick={() => setShowPayout(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="rpt-btn" disabled={busy}>
                    {busy ? "Saving..." : "Request payout"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showMilestone && (
          <div className="rpt-modal-overlay" onClick={() => setShowMilestone(false)}>
            <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Add contractual milestone</h2>
              <form onSubmit={handleSubmitMilestone}>
                <label>
                  Milestone name
                  <input
                    required
                    value={milestoneForm.name || ""}
                    placeholder="e.g. First subject enrolled"
                    onChange={(e) => setMilestoneForm((f: any) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label>
                  Study
                  <select
                    value={milestoneForm.studyId || ""}
                    onChange={(e) => setMilestoneForm((f: any) => ({ ...f, studyId: e.target.value }))}
                  >
                    <option value="">— optional —</option>
                    {studyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Site (id)
                  <input
                    value={milestoneForm.siteId || ""}
                    onChange={(e) => setMilestoneForm((f: any) => ({ ...f, siteId: e.target.value }))}
                  />
                </label>
                <label>
                  Weight
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={milestoneForm.weight ?? 1}
                    onChange={(e) => setMilestoneForm((f: any) => ({ ...f, weight: e.target.value }))}
                  />
                </label>
                <div className="rpt-modal-actions">
                  <button type="button" onClick={() => setShowMilestone(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="rpt-btn" disabled={busy}>
                    {busy ? "Saving..." : "Add milestone"}
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

function MilestonesDashboard() {
  return <FinanceDashboard initialTab="milestones" />;
}

export default FinanceDashboard;
export { MilestonesDashboard };
