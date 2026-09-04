import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheck, FiEye, FiPlus, FiX } from "react-icons/fi";

import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import DataTable from "../../components/dashboard/shared/DataTable";
import { isApiEnabled, monitoringApi } from "../../services/api";
import { getCurrentUser } from "../../services/roleService";
import ROLES from "../../constants/roles";

import "./MonitoringAccess.css";

const APPROVER_ROLES = [ROLES.ADMIN, ROLES.SITE_STAFF];

const initialForm = {
  site: "",
  start_date: "",
  end_date: "",
  reason: "",
};

function StatusBadge({ status }: any) {
  const normalized = String(status || "").toLowerCase();
  return <span className={`monitoring-status monitoring-status--${normalized}`}>{status}</span>;
}

function MonitoringAccess() {
  const user = getCurrentUser();
  const isApprover = APPROVER_ROLES.includes(user?.role);

  const [requests, setRequests] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      const [requestRows, siteRows] = await Promise.all([
        monitoringApi.listMonitoringRequests(),
        // Only requesters need the site picker; approvers already see the
        // site name on each request row.
        isApprover ? Promise.resolve([]) : monitoringApi.listSites(),
      ]);
      setRequests(Array.isArray(requestRows) ? requestRows : []);
      setSites(Array.isArray(siteRows) ? siteRows : []);
    } catch (err) {
      // A brand-new install has no requests yet — the backend 404s that
      // case instead of returning an empty list; treat it as empty, not
      // an error.
      if (err?.status === 404) {
        setRequests([]);
      } else {
        setError(err?.message || "Failed to load monitoring access requests.");
      }
    } finally {
      setLoading(false);
    }
  }, [isApprover]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!form.site || !form.start_date || !form.end_date) {
        setError("Site, start date, and end date are required.");
        return;
      }
      if (form.end_date < form.start_date) {
        setError("End date cannot be before start date.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await monitoringApi.createMonitoringRequest(form);
        setShowModal(false);
        setForm(initialForm);
        await load();
      } catch (err) {
        setError(err?.message || "Failed to submit monitoring access request.");
      } finally {
        setSaving(false);
      }
    },
    [form, load]
  );

  const decide = useCallback(
    async (action, request) => {
      let note = "";
      if (action === "reject") {
        note = window.prompt("Reason for rejecting (optional):") || "";
      } else if (action === "revoke") {
        note = window.prompt("Reason for revoking access (optional):") || "";
      }
      try {
        if (action === "approve") await monitoringApi.approveMonitoringRequest(request.id, note);
        else if (action === "reject") await monitoringApi.rejectMonitoringRequest(request.id, note);
        else if (action === "revoke") await monitoringApi.revokeMonitoringRequest(request.id, note);
        await load();
      } catch (err) {
        setError(err?.message || `Failed to ${action} request.`);
      }
    },
    [load]
  );

  const columns = useMemo(() => {
    const base = [
      { key: "requested_by_name", label: "Requested By", render: (v, row) => v || "—" },
      { key: "requester_role_label", label: "Role", render: (v) => v || "—" },
      { key: "site_name", label: "Site", render: (v) => v || "—" },
      {
        key: "_dates",
        label: "Requested Dates",
        render: (_v, row) => `${row.start_date} to ${row.end_date}`,
      },
      { key: "reason", label: "Reason", render: (v) => v || "—" },
      { key: "status", label: "Status", render: (v) => <StatusBadge status={v} /> },
    ];

    if (isApprover) {
      base.push({
        key: "_actions",
        label: "Actions",
        render: (_v, row) => {
          if (row.status === "pending") {
            return (
              <div className="monitoring-actions">
                <button type="button" className="monitoring-action-btn approve" onClick={() => decide("approve", row)}>
                  <FiCheck size={14} /> Approve
                </button>
                <button type="button" className="monitoring-action-btn reject" onClick={() => decide("reject", row)}>
                  <FiX size={14} /> Reject
                </button>
              </div>
            );
          }
          if (row.status === "approved") {
            return (
              <button type="button" className="monitoring-action-btn revoke" onClick={() => decide("revoke", row)}>
                <FiX size={14} /> Revoke
              </button>
            );
          }
          return <span className="monitoring-actions-none">—</span>;
        },
      });
    }

    return base;
  }, [isApprover, decide]);

  if (!isApiEnabled()) {
    return (
      <DashboardLayout>
        <div className="monitoring-access">
          <div className="monitoring-empty-state">
            <FiEye size={28} />
            <p>
              Monitoring Access needs the API backend configured (
              <code>REACT_APP_API_URL</code>) to load and submit requests.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="monitoring-access">
        <div className="monitoring-header">
          <div>
            <h1>Monitoring Access</h1>
            <p className="monitoring-subtitle">
              {isApprover
                ? "Review and manage date-scoped, view-only monitoring access requests for your site."
                : "Request view-only access to a site for an upcoming monitoring visit."}
            </p>
          </div>
          {!isApprover && (
            <button type="button" className="monitoring-primary-btn" onClick={() => setShowModal(true)}>
              <FiPlus size={16} /> Request Access
            </button>
          )}
        </div>

        {error && <div className="monitoring-error-banner">{error}</div>}

        <DataTable
          title={isApprover ? "Monitoring Access Requests" : "My Monitoring Access Requests"}
          columns={columns}
          data={requests}
          searchable
          searchPlaceholder="Search by requester, site..."
          filters={[
            {
              key: "status",
              label: "Status",
              options: ["pending", "approved", "rejected", "revoked"].map((s) => ({ value: s, label: s })),
            },
          ]}
          pagination
          emptyMessage={loading ? "Loading..." : "No monitoring access requests yet."}
        />

        {showModal && (
          <div className="monitoring-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="monitoring-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Request Monitoring Access</h2>
              <form onSubmit={handleSubmit}>
                <label>
                  Site
                  <select
                    value={form.site}
                    onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))}
                    required
                  >
                    <option value="">Select a site...</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <FiCalendar size={14} style={{ marginRight: 4 }} />
                  Start date
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  <FiCalendar size={14} style={{ marginRight: 4 }} />
                  End date
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Reason
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g. Routine monitoring visit"
                  />
                </label>
                <div className="monitoring-modal-actions">
                  <button type="button" onClick={() => setShowModal(false)} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="monitoring-primary-btn" disabled={saving}>
                    {saving ? "Submitting..." : "Submit Request"}
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

export default MonitoringAccess;
