import DashboardLayout from "../components/dashboard/shared/DashboardLayout";
import DataTable from "../components/dashboard/shared/DataTable";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  acceptAccessRequest,
  getAccessRequestHistory,
  getPendingAccessRequests,
  revokeAccessRequest,
  PERMISSION_REQUESTS_UPDATED,
} from "../services/accessPermissionService";
import {
  approveSignupRequest,
  getPendingSignupRequests,
  rejectSignupRequest,
} from "../services/adminService";
import {
  getUserAccessLevel,
  setUserAccessLevel,
  ACCESS_LEVELS_UPDATED,
} from "../services/accessLevelService";
import { ROLE_LABELS } from "../services/roleService";
import ROLES from "../constants/roles";
import "./AccessPermissions.css";

function StatusPill({ status }: any) {
  const normalized = String(status || "").toLowerCase();
  let className = "status-pill";

  if (
    normalized === "active" ||
    normalized === "accepted" ||
    normalized === "approved"
  ) {
    className += " active";
  } else if (normalized === "pending") {
    className += " pending";
  } else if (
    normalized === "revoked" ||
    normalized === "rejected"
  ) {
    className += " revoked";
  } else {
    className += " inactive";
  }

  return <span className={className}>{status}</span>;
}

function AccessPermissions() {
  const [activeTab, setActiveTab] = useState("signup");
  const [refreshKey, setRefreshKey] = useState(0);
  const [signupError, setSignupError] = useState("");

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);

    window.addEventListener(PERMISSION_REQUESTS_UPDATED, refresh);
    window.addEventListener(ACCESS_LEVELS_UPDATED, refresh);

    return () => {
      window.removeEventListener(PERMISSION_REQUESTS_UPDATED, refresh);
      window.removeEventListener(ACCESS_LEVELS_UPDATED, refresh);
    };
  }, []);

  const pendingRequests = useMemo(() => {
    void refreshKey;
    return getPendingAccessRequests();
  }, [refreshKey]);

  const requestHistory = useMemo(() => {
    void refreshKey;
    return getAccessRequestHistory();
  }, [refreshKey]);

  const pendingSignupRequests = useMemo(() => {
    void refreshKey;
    return getPendingSignupRequests();
  }, [refreshKey]);

  const handleAccept = (requestId) => {
    acceptAccessRequest(requestId);
    setRefreshKey((value) => value + 1);
  };

  const handleRevoke = (requestId) => {
    revokeAccessRequest(requestId);
    setRefreshKey((value) => value + 1);
  };

  const handleApproveSignup = (email) => {
    setSignupError("");

    try {
      approveSignupRequest(email);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      // Subscription enforcement (subscriptionGuard.assertCanApproveUser)
      // throws when the license isn't Active or the user limit is reached.
      setSignupError(
        err?.message || "Unable to approve this signup request."
      );
    }
  };

  const handleRejectSignup = (email) => {
    rejectSignupRequest(email);
    setRefreshKey((value) => value + 1);
  };

  const handleAccessChange = useCallback((email, role, level) => {
    setUserAccessLevel(email, level, role);
    setRefreshKey((value) => value + 1);
  }, []);

  const pendingColumns = [
    { key: "id", label: "Request ID" },
    { key: "user", label: "User" },
    { key: "role", label: "Role" },
    { key: "action", label: "Action" },
    { key: "module", label: "Module" },
    { key: "record", label: "Record" },
    { key: "reason", label: "Reason" },
    { key: "requestedOn", label: "Requested On" },
    { key: "actions", label: "Actions" },
  ];

  const historyColumns = [
    { key: "id", label: "Request ID" },
    { key: "user", label: "User" },
    { key: "role", label: "Role" },
    { key: "action", label: "Action" },
    { key: "module", label: "Module" },
    { key: "record", label: "Record" },
    { key: "requestedOn", label: "Requested On" },
    { key: "status", label: "Status" },
    { key: "resolvedOn", label: "Resolved On" },
  ];

  // Access-controlled roles are the only ones whose Access column shows
  // interactive checkboxes.  Admin / Site Staff / PI always have full
  // access and display a static badge instead.
  const ACCESS_CONTROLLED_ROLES = [ROLES.CRO, ROLES.SPONSOR];

  const signupColumns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "organization", label: "Organization" },
    { key: "status", label: "Status" },
    { key: "access", label: "Access", width: "220px" },
    { key: "actions", label: "Actions" },
  ];

  const pendingData = pendingRequests.map((request) => ({
    id: request.id,
    user: request.userName || request.user || "Unknown User",
    role: request.role || "—",
    action: request.action || request.accessType || "—",
    module: request.module || "General",
    record:
      request.recordName ||
      request.recordId ||
      request.studySubject ||
      "—",
    reason: request.reason || "—",
    requestedOn:
      request.requestedOn || request.timestamp?.slice(0, 10),
    actions: (
      <>
        <button
          type="button"
          className="access-action-link"
          onClick={() => handleAccept(request.id)}>

          Approve
        </button>

        <button
          type="button"
          className="access-action-link revoke"
          onClick={() => handleRevoke(request.id)}>

          Reject
        </button>
      </>
    ),
  }));

  const historyData = requestHistory.map((request) => ({
    id: request.id,
    user: request.userName || request.user || "Unknown User",
    role: request.role || "—",
    action: request.action || request.accessType || "—",
    module: request.module || "General",
    record:
      request.recordName ||
      request.recordId ||
      request.studySubject ||
      "—",
    requestedOn:
      request.requestedOn || request.timestamp?.slice(0, 10),
    status: <StatusPill status={request.status || "Pending"} />,
    resolvedOn:
      request.resolvedOn?.slice?.(0, 10) ||
      request.resolvedOn ||
      "—",
  }));

  const signupData = pendingSignupRequests.map((user) => {
    const isAccessControlled = ACCESS_CONTROLLED_ROLES.includes(user.role);
    const currentLevel = getUserAccessLevel(user.email, user.role);

    return {
      name: user.name || "N/A",
      email: user.email || "N/A",
      role: ROLE_LABELS[user.role] || user.role || "N/A",
      organization: user.orgType || user.assignedSite || "—",
      status: <StatusPill status={user.approvalStatus || "Pending"} />,
      access: isAccessControlled ? (
        <div className="access-checkbox-group">
          <label className="access-checkbox-label">
            <input
              type="checkbox"
              checked={currentLevel === "Read" || currentLevel === "Read and Write" || currentLevel === "Edit"}
              onChange={() => handleAccessChange(user.email, user.role, "Read")}
            />
            <span>Read</span>
          </label>
          <label className="access-checkbox-label">
            <input
              type="checkbox"
              checked={currentLevel === "Read and Write" || currentLevel === "Edit"}
              onChange={() => handleAccessChange(user.email, user.role, "Read and Write")}
            />
            <span>Read and Write</span>
          </label>
          <label className="access-checkbox-label">
            <input
              type="checkbox"
              checked={currentLevel === "Edit"}
              onChange={() => handleAccessChange(user.email, user.role, "Edit")}
            />
            <span>Edit</span>
          </label>
        </div>
      ) : (
        <span className="access-full-badge">Full Access</span>
      ),
      actions: (
        <>
          <button
            type="button"
            className="access-action-link"
            onClick={() => handleApproveSignup(user.email)}>

            Approve
          </button>

          <button
            type="button"
            className="access-action-link revoke"
            onClick={() => handleRejectSignup(user.email)}>

            Reject
          </button>
        </>
      ),
    };
  });

  return (
    <DashboardLayout>
      <div className="access-permissions-page tnxt-compact">
        <div className="access-permissions-header page-section-highlight">
          <h1>Access Permission</h1>
          <p>Review signup approvals and manage access permission requests</p>
        </div>

        <div className="access-permissions-tabs">
          <button
            type="button"
            className={`access-tab${activeTab === "signup" ? " active" : ""}`}
            onClick={() => setActiveTab("signup")}>

            Signup Approvals
            <span className="access-tab-badge">
              {pendingSignupRequests.length}
            </span>
          </button>

          <button
            type="button"
            className={`access-tab${activeTab === "pending" ? " active" : ""}`}
            onClick={() => setActiveTab("pending")}>

            Pending Requests
            <span className="access-tab-badge">
              {pendingRequests.length}
            </span>
          </button>

          <button
            type="button"
            className={`access-tab${activeTab === "history" ? " active" : ""}`}
            onClick={() => setActiveTab("history")}>

            Request History
            <span className="access-tab-badge">
              {requestHistory.length}
            </span>
          </button>
        </div>

        {signupError && (
          <div className="access-permissions-error">{signupError}</div>
        )}

        {activeTab === "signup" ? (
          <DataTable
            className="ctms-standard-table"
            title="Pending Signup Approvals"
            columns={signupColumns}
            data={signupData}
            emptyMessage="No pending signup approvals"
            pagination
          />
        ) : activeTab === "pending" ? (
          <DataTable
            className="ctms-standard-table"
            title="Pending Requests"
            columns={pendingColumns}
            data={pendingData}
            emptyMessage="No pending access requests"
            pagination
          />
        ) : (
          <DataTable
            className="ctms-standard-table"
            title="Request History"
            columns={historyColumns}
            data={historyData}
            emptyMessage="No request history yet"
            pagination
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default AccessPermissions;
