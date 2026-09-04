import React, { useMemo, useState } from "react";
import DataTable from "./dashboard/shared/DataTable";
import "./LogCrudTable.css";

// Shared CRUD log table powering the Site Visit / NTF / Miscellaneous logs
// inside Study Workspace → Logs.
//
// It deliberately reuses the exact presentation stack the Training Log and
// Delegation Log use — no new log architecture:
//   - the shared DataTable (search → filters → pagination)
//   - the StudyLogsTab modal classes (.modal-overlay / .modal-box /
//     .modal-title / .modal-body / .modal-footer / .save-btn / .cancel-btn)
//   - the Delegation Log's View / Edit (confirm → form) / Delete
//     (confirm → reason) action flows
//
// Only the per-log differences (title, columns, form fields, status options,
// search/filter config) come in through props, supplied by each log's thin
// wrapper component. Data and persistence stay in the parent (StudyLogsTab),
// which passes `records` down and receives changes back via `onSave` /
// `onDelete` — the same single-source-of-truth pattern Training Log and
// Delegation Log already use.
function LogCrudTable({
  title,
  recordLabel = "Record",
  addButtonLabel = "+ Add",
  columns = [],
  records = [],
  formFields = [],
  searchPlaceholder = "Search...",
  searchFields,
  filters = [],
  emptyMessage = "No records found",
  siteOptions = [],
  initialSite = "",
  onSave,
  onDelete
}: any) {
  // ---- Add flow state ---- //
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Record<string, any>>({});

  // ---- Edit flow state (confirm → pre-filled form), mirrors Delegation Log ---- //
  const [editConfirmTarget, setEditConfirmTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // ---- View flow state ---- //
  const [viewTarget, setViewTarget] = useState(null);

  // ---- Delete flow state (confirm → mandatory reason), mirrors Delegation Log ---- //
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [deleteReasonTarget, setDeleteReasonTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonError, setDeleteReasonError] = useState("");

  const blankForm = useMemo(() => {
    const base: Record<string, any> = {};;
    formFields.forEach((field) => {
      base[field.key] = "";
    });
    return base;
  }, [formFields]);

  // Copy only the configured fields out of a record (used to pre-fill the
  // Edit form from the row the user confirmed).
  const pickFields = (record) => {
    const picked: Record<string, any> = {};;
    formFields.forEach((field) => {
      picked[field.key] = record?.[field.key] ?? "";
    });
    return picked;
  };

  // Lightweight required-field validation — matches the Delegation Log's
  // approach of alerting on missing core fields before saving.
  const validate = (form) => {
    const missing = formFields
      .filter((field) => field.required)
      .filter((field) => !String(form[field.key] ?? "").trim())
      .map((field) => field.label);

    if (missing.length > 0) {
      alert(`Please fill in: ${missing.join(", ")}`);
      return false;
    }
    return true;
  };

  const normalizedRecords = useMemo(
    () => (Array.isArray(records) ? records : []).map((record) => ({ ...record })),
    [records]
  );

  // Table columns = the log's columns + the shared View / Edit / Delete
  // Actions column (same button set the Delegation Log renders).
  const tableColumns = useMemo(
    () => [
      ...columns,
      {
        key: "actions",
        label: "Actions",
        render: (_value, row) => (
          <div className="log-crud-actions">
            <button type="button" onClick={() => setViewTarget(row)}>
              View
            </button>
            <button type="button" onClick={() => setEditConfirmTarget(row)}>
              Edit
            </button>
            <button type="button" onClick={() => setDeleteConfirmTarget(row)}>
              Delete
            </button>
          </div>
        )
      }
    ],
    [columns]
  );

  // ---- Add flow handlers ---- //
  const openAddModal = () => {
    setAddForm({ ...blankForm, site: initialSite || blankForm.site || "" });
    setShowAdd(true);
  };

  const handleAddSubmit = () => {
    if (!validate(addForm)) return;
    onSave({ ...addForm, id: Date.now() });
    setShowAdd(false);
    setAddForm(blankForm);
  };

  // ---- Edit flow handlers ---- //
  const handleContinueToEdit = () => {
    setEditForm(pickFields(editConfirmTarget));
    setEditTarget(editConfirmTarget);
    setEditConfirmTarget(null);
  };

  const handleUpdateSubmit = () => {
    if (!validate(editForm)) return;
    onSave({ ...editForm, id: editTarget.id });
    setEditTarget(null);
  };

  // ---- Delete flow handlers ---- //
  const handleContinueToDeleteReason = () => {
    setDeleteReasonTarget(deleteConfirmTarget);
    setDeleteConfirmTarget(null);
    setDeleteReason("");
    setDeleteReasonError("");
  };

  const handleDeleteSubmit = () => {
    if (!deleteReason.trim()) {
      setDeleteReasonError("Reason for deletion is required.");
      return;
    }
    onDelete(deleteReasonTarget.id, deleteReason.trim());
    setDeleteReasonTarget(null);
  };

  // Renders the right control for each form-field config: text, date,
  // select (fixed options), site (text + datalist of known sites) or
  // textarea (notes / descriptions).
  const renderFormField = (field, form, onChange) => {
    const value = form[field.key] ?? "";

    if (field.type === "select") {
      return (
        <select
          value={value}
          onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
        >
          <option value="">Select {field.label}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          value={value}
          placeholder={field.placeholder || ""}
          onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
        />
      );
    }

    if (field.type === "site") {
      return (
        <>
          <input
            type="text"
            value={value}
            list="log-crud-site-options"
            placeholder={field.placeholder || "Site name"}
            onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
          />
          <datalist id="log-crud-site-options">
            {siteOptions.map((site) => (
              <option key={site} value={site} />
            ))}
          </datalist>
        </>
      );
    }

    return (
      <input
        type={field.type === "date" ? "date" : "text"}
        value={value}
        placeholder={field.placeholder || ""}
        onChange={(e) => onChange({ ...form, [field.key]: e.target.value })}
      />
    );
  };

  const renderForm = (form, onChange) =>
    formFields.map((field) => (
      <div className="log-crud-field" key={field.key}>
        <label>
          {field.label}
          {field.required ? " *" : ""}
        </label>
        {renderFormField(field, form, onChange)}
      </div>
    ));

  return (
    <div className="log-crud-container">
      <div className="log-crud-header">
        <h2 className="log-crud-title">{title}</h2>
        <button type="button" className="log-crud-add-btn" onClick={openAddModal}>
          {addButtonLabel}
        </button>
      </div>

      {/* Same canonical DataTable pipeline the Delegation Log uses:
          authorized dataset → search → filters → pagination. */}
      <DataTable
        columns={tableColumns}
        data={normalizedRecords}
        emptyMessage={emptyMessage}
        searchable
        searchPlaceholder={searchPlaceholder}
        searchFields={searchFields}
        filters={filters}
        pagination
        initialPageSize={10}
      />

      {/* ============================================================ */}
      {/* Add modal — same modal-title/body/footer style as Add        */}
      {/* Delegation in StudyLogsTab.                                   */}
      {/* ============================================================ */}
      {showAdd && (
        <div className="modal-overlay log-crud-modal-overlay">
          <div className="modal-box" style={{ width: "3rem" }}>
            <div className="modal-title">Add {recordLabel}</div>
            <div className="modal-body">{renderForm(addForm, setAddForm)}</div>
            <div className="modal-footer log-crud-modal-footer">
              <button
                className="log-crud-cancel-btn"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button className="log-crud-save-btn" onClick={handleAddSubmit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* View modal — read-only field table, same layout as the       */}
      {/* Delegation Log's View modal.                                  */}
      {/* ============================================================ */}
      {viewTarget && (
        <div className="modal-overlay log-crud-modal-overlay">
          <div className="modal-box" style={{ width: "35rem" }}>
            <div className="log-crud-view-header">
              <h3>
                {viewTarget[columns[0]?.key] || recordLabel} — Details
              </h3>
              <span
                className="log-crud-view-close"
                onClick={() => setViewTarget(null)}
              >
                ✖
              </span>
            </div>
            <div className="modal-body" style={{ paddingTop: "1rem" }}>
              <table className="log-crud-view-table">
                <tbody>
                  {formFields.map((field) => (
                    <tr key={field.key}>
                      <th>{field.label}</th>
                      <td>{viewTarget[field.key] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer log-crud-modal-footer">
              <button
                className="log-crud-cancel-btn"
                onClick={() => setViewTarget(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Confirm Edit popup (step 1 of the Edit flow) — mirrors the   */}
      {/* Delegation Log's flow.                                        */}
      {/* ============================================================ */}
      {editConfirmTarget && (
        <div className="modal-overlay log-crud-modal-overlay">
          <div className="modal-box" style={{ width: "26.25rem" }}>
            <div className="modal-title">Confirm Edit</div>
            <div className="modal-body">
              <p>
                Are you sure you want to edit this {recordLabel.toLowerCase()}?
              </p>
            </div>
            <div className="modal-footer log-crud-modal-footer">
              <button
                className="log-crud-cancel-btn"
                onClick={() => setEditConfirmTarget(null)}
              >
                Cancel
              </button>
              <button
                className="log-crud-save-btn"
                onClick={handleContinueToEdit}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Edit modal (step 2 of the Edit flow), pre-filled from the     */}
      {/* confirmed row.                                                */}
      {/* ============================================================ */}
      {editTarget && (
        <div className="modal-overlay log-crud-modal-overlay">
          <div className="modal-box" style={{ width: "3rem" }}>
            <div className="modal-title">Edit {recordLabel}</div>
            <div className="modal-body">{renderForm(editForm, setEditForm)}</div>
            <div className="modal-footer log-crud-modal-footer">
              <button
                className="log-crud-cancel-btn"
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </button>
              <button
                className="log-crud-save-btn"
                onClick={handleUpdateSubmit}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Delete confirm popup (step 1 of Delete flow) — mirrors the    */}
      {/* Delegation Log's flow.                                        */}
      {/* ============================================================ */}
      {deleteConfirmTarget && (
        <div className="modal-overlay log-crud-modal-overlay">
          <div className="modal-box" style={{ width: "26.25rem" }}>
            <div className="modal-title">Delete {recordLabel}</div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete this {recordLabel.toLowerCase()}?
              </p>
            </div>
            <div className="modal-footer log-crud-modal-footer">
              <button
                className="log-crud-cancel-btn"
                onClick={() => setDeleteConfirmTarget(null)}
              >
                Cancel
              </button>
              <button
                className="log-crud-save-btn"
                onClick={handleContinueToDeleteReason}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Mandatory reason popup (step 2 of Delete flow) — mirrors the  */}
      {/* Delegation Log's flow.                                        */}
      {/* ============================================================ */}
      {deleteReasonTarget && (
        <div className="modal-overlay log-crud-modal-overlay">
          <div className="modal-box" style={{ width: "28.75rem" }}>
            <div className="modal-title">Reason for Deletion</div>
            <div className="modal-body">
              <textarea
                className="log-crud-delete-reason"
                placeholder="Enter reason"
                value={deleteReason}
                onChange={(e) => {
                  setDeleteReason(e.target.value);
                  if (deleteReasonError) setDeleteReasonError("");
                }}
                style={{
                  border: deleteReasonError ? "1px solid #dc3545" : undefined
                }}
              />
              {deleteReasonError && (
                <p
                  style={{
                    color: "#dc3545",
                    fontSize: "0.8125rem",
                    marginTop: "0.375rem"
                  }}>

                  {deleteReasonError}
                </p>
              )}
            </div>
            <div className="modal-footer log-crud-modal-footer">
              <button
                className="log-crud-cancel-btn"
                onClick={() => setDeleteReasonTarget(null)}>

                Cancel
              </button>
              <button className="log-crud-save-btn" onClick={handleDeleteSubmit}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LogCrudTable;
