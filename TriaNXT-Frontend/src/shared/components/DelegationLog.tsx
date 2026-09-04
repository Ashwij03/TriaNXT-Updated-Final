import React, { useMemo, useState } from "react";
import DataTable from "./dashboard/shared/DataTable";
import "./DelegationLog.css";

// ---- MODIFIED: staff is no longer fetched here — it's the single source of
// truth living in StudyLogsTab and passed down as a prop. `history` is also
// passed down (was previously hardcoded inside the History modal). `onEdit`
// and `onDelete` are callbacks that update the parent's state. ----
// Phase 6 — IMP-3 (Delegation Log Pagination, Search & Filters).
// The raw <table className="staff-table"> was replaced with the shared
// DataTable so the Delegation Log follows the canonical pipeline
// (authorized dataset → search/filter → pagination). Search and the
// Role/Status filters operate on the FULL `staff` array passed in from
// StudyLogsTab, never on a pre-sliced page. All existing Edit / Delete /
// View flows and their modals are preserved verbatim — only the row
// container/columns changed.
const DelegationLog = ({ staff = [], history = [], onEdit, onDelete }: any) => {

  // ---- Phase 6 cleanup: replaced the boolean `showModal` (which drove a
  // hardcoded "Megan Richards / Investigator / A2 / A3 / Physical Exam /
  // Medical Review" dialog) with a `viewTarget` that stores the actual
  // delegation record the user clicked. The dialog now renders that
  // record's real fields. ----
  const [viewTarget, setViewTarget] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // ---- NEW: Edit flow state — step 1 (confirm) then step 2 (edit form). ----
  const [editConfirmTarget, setEditConfirmTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    responsibility: "",
    status: "Active"
  });

  // ---- NEW: Delete flow state — step 1 (confirm) then step 2 (mandatory reason). ----
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [deleteReasonTarget, setDeleteReasonTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonError, setDeleteReasonError] = useState("");

  // ---- NEW: called from the "Confirm Edit" popup's Continue button.
  // Pre-fills the edit form with the selected row's current values. ----
  const handleContinueToEdit = () => {
    setEditForm({
      name: editConfirmTarget.name || "",
      role: editConfirmTarget.role || "",
      responsibility: editConfirmTarget.responsibility || "",
      status: editConfirmTarget.status || "Active"
    });
    setEditTarget(editConfirmTarget);
    setEditConfirmTarget(null);
  };

  // ---- NEW: called from the Edit modal's Update button. ----
  const handleUpdateSubmit = () => {
    if (!editForm.name.trim() || !editForm.role.trim() || !editForm.responsibility.trim()) {
      alert("Please fill in Name, Role, and Responsibility.");
      return;
    }
    onEdit(editTarget.id, editForm);
    setEditTarget(null);
  };

  // ---- NEW: called from the "Delete Delegation" popup's Continue button. ----
  const handleContinueToDeleteReason = () => {
    setDeleteReasonTarget(deleteConfirmTarget);
    setDeleteConfirmTarget(null);
    setDeleteReason("");
    setDeleteReasonError("");
  };

  // ---- NEW: called from the reason modal's Delete button. Reason is mandatory. ----
  const handleDeleteSubmit = () => {
    if (!deleteReason.trim()) {
      setDeleteReasonError("Reason for deletion is required.");
      return;
    }
    onDelete(deleteReasonTarget.id, deleteReason.trim());
    setDeleteReasonTarget(null);
  };

  // Phase 6 — IMP-3: normalize the incoming staff array so DataTable's
  // built-in search / filter / auto-derived filter options see stable
  // primitive fields regardless of the record shape emitted by
  // StudyLogsTab (some legacy rows use delegateName/description). Keep
  // the original object accessible via `_raw` so the row-action buttons
  // in the render column can still hand the untouched record back to
  // the Edit/Delete flows.
  const normalizedStaff = useMemo(
    () =>
      (Array.isArray(staff) ? staff : []).map((member) => ({
        id: member.id,
        name: member.name || member.delegateName || "",
        role: member.role || "-",
        responsibility: member.responsibility || member.description || "",
        status: member.status || "Active",
        _raw: member
      })),
    [staff]
  );

  // Column definitions for the shared DataTable. `render` on Actions is
  // the exact same button set that was in the raw <table> — Edit opens
  // the "Confirm Edit" popup, Delete opens the "Delete Delegation"
  // popup, View opens the profile modal. No behavior change.
  const delegationColumns = useMemo(
    () => [
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "responsibility", label: "Responsibility" },
      { key: "status", label: "Status" },
      {
        key: "actions",
        label: "Actions",
        render: (_value, row) => (
          <div className="delegation-actions">
            <button
              type="button"
              onClick={() => setEditConfirmTarget(row._raw || row)}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirmTarget(row._raw || row)}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setViewTarget(row._raw || row)}
            >
              View
            </button>
          </div>
        )
      }
    ],
    []
  );

  return (

    <div className="delegation-container tnxt-compact">

      <h2 className="delegation-title">
         Electronic Delegation Log
      </h2>
      <div className="delegation-header">

        <button onClick={() => alert("Open Add Staff Form")}>
          Add Staff
        </button>

        <button onClick={() => setShowHistory(true)}>
          Delegation History
        </button>

      </div>

      {/* Phase 6 — IMP-3: shared DataTable replaces the raw staff table.
          - `data={normalizedStaff}` is the full authorized dataset.
          - `searchable` + `searchFields` power the search box.
          - `filters` power Role and Status dropdowns (options are
            auto-derived by DataTable from the same full dataset, so
            they never go stale after add/edit/delete).
          - `pagination` gives Previous/Next, page totals, and
            rows-per-page. Every action (search, filter, page-size
            change) resets pagination via DataTable's internal effects.
          - The Actions column preserves the existing Edit / Delete /
            View flows exactly — they still fire the same Confirm-Edit
            and Delete-Reason modals rendered below. */}
      <DataTable
        columns={delegationColumns}
        data={normalizedStaff}
        emptyMessage="No delegation records found"
        searchable
        searchPlaceholder="Search delegations by name, role, or responsibility..."
        searchFields={["name", "role", "responsibility", "status"]}
        filters={[
          { key: "role", label: "Role" },
          { key: "status", label: "Status" }
        ]}
        pagination
        initialPageSize={10}
      />

      {/* ============================================================ */}
      {/* Delegation History modal — driven entirely by the `history`   */}
      {/* prop from StudyLogsTab.                                       */}
      {/* ============================================================ */}
      {showHistory && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Delegation History</h3>
              <span
                className="close-btn"
                onClick={() => setShowHistory(false)}
              >
                ✖
              </span>
            </div>

            <table className="delegation-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "#98a2b3" }}>
                      No history yet.
                    </td>
                  </tr>
                ) : (
                  history.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.date}</td>
                      <td>
                        {entry.action}
                        {entry.reason ? ` — ${entry.reason}` : ""}
                      </td>
                      <td>{entry.user}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Phase 6 cleanup: View Delegation modal — the OLD static      */}
      {/* dialog (Megan Richards / Investigator / A2 / A3 / Physical    */}
      {/* Exam / Medical Review) has been removed. This modal now       */}
      {/* renders the fields of the delegation record the user clicked. */}
      {/* ============================================================ */}
      {viewTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "35rem" }}>
            <div className="modal-header">
              <div className="modal-user">
                <div>
                  <h3>{viewTarget.name || viewTarget.delegateName || "—"}</h3>
                  <p>{viewTarget.role || "—"}</p>
                </div>
              </div>
              <span
                className="close-btn"
                onClick={() => setViewTarget(null)}
              >
                ✖
              </span>
            </div>

            <table className="delegation-table" style={{ marginTop: "1.25rem" }}>
              <tbody>
                <tr>
                  <th style={{ width: "35%" }}>Name</th>
                  <td>{viewTarget.name || viewTarget.delegateName || "—"}</td>
                </tr>
                <tr>
                  <th>Role</th>
                  <td>{viewTarget.role || "—"}</td>
                </tr>
                <tr>
                  <th>Responsibility</th>
                  <td>
                    {viewTarget.responsibility ||
                      viewTarget.description ||
                      "—"}
                  </td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{viewTarget.status || "Active"}</td>
                </tr>
              </tbody>
            </table>

            <div className="modal-footer" style={{ marginTop: "1.25rem", textAlign: "right" }}>
              <button className="cancel-btn" onClick={() => setViewTarget(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ---- NEW: Confirm Edit popup (step 1 of the Edit flow) ---- */}
      {/* ============================================================ */}
      {editConfirmTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "26.25rem" }}>
            <div className="modal-title">Confirm Edit</div>
            <div className="modal-body">
              <p>Are you sure you want to edit this delegation?</p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setEditConfirmTarget(null)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleContinueToEdit}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ---- NEW: Edit modal (step 2 of the Edit flow), pre-filled ---- */}
      {/* ============================================================ */}
      {editTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "28.75rem" }}>
            <div className="modal-title">Edit Delegation</div>
            <div className="modal-body">
              <input
                placeholder="Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />

              <input
                placeholder="Role"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              />

              <input
                placeholder="Responsibility"
                value={editForm.responsibility}
                onChange={(e) => setEditForm({ ...editForm, responsibility: e.target.value })}
              />

              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setEditTarget(null)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleUpdateSubmit}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ---- NEW: Delete Delegation confirm popup (step 1 of Delete) ---- */}
      {/* ============================================================ */}
      {deleteConfirmTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "26.25rem" }}>
            <div className="modal-title">Delete Delegation</div>
            <div className="modal-body">
              <p>Are you sure you want to delete this delegation?</p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setDeleteConfirmTarget(null)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleContinueToDeleteReason}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ---- NEW: Mandatory reason popup (step 2 of Delete flow) ---- */}
      {/* ============================================================ */}
      {deleteReasonTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "28.75rem" }}>
            <div className="modal-title">Reason for Deletion</div>
            <div className="modal-body">
              <textarea
                placeholder="Enter reason"
                value={deleteReason}
                onChange={(e) => {
                  setDeleteReason(e.target.value);
                  if (deleteReasonError) setDeleteReasonError("");
                }}
                style={{
                  width: "100%",
                  minHeight: "5.625rem",
                  padding: "10px 12px",
                  border: deleteReasonError ? "1px solid #dc3545" : "1px solid #d5dce5",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                  boxSizing: "border-box"
                }}
              />
              {deleteReasonError && (
                <p style={{ color: "#dc3545", fontSize: "0.8125rem", marginTop: "0.375rem" }}>
                  {deleteReasonError}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setDeleteReasonTarget(null)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleDeleteSubmit}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

  );

};

export default DelegationLog;