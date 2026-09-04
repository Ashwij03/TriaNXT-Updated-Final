import React, { useState } from "react";
import DataTable from "./dashboard/shared/DataTable";
import "./ClinicalLog.css";

// ---- Task 2A (Ramya): AE/SE Log. Follows the same architecture as the
// Delegation Log: StudyLogsTab is the single source of truth and passes
// `records` down as a prop; this component stays presentational and manages
// its own Add/Edit/View/Delete modals, calling onSave / onDelete so the
// parent can persist via the existing adminService localStorage pattern. ----

const TYPE_OPTIONS = ["AE", "SAE"];
const SEVERITY_OPTIONS = ["Mild", "Moderate", "Severe"];
const STATUS_OPTIONS = ["Open", "Resolved", "Closed"];

const emptyForm = (defaultSite = "", count = 0) => ({
  aeId: `AE-${String(count + 1).padStart(3, "0")}`,
  subjectId: "",
  site: defaultSite,
  event: "",
  type: "AE",
  severity: "Mild",
  onsetDate: "",
  outcome: "",
  status: "Open"
});

const FORM_FIELDS = [
  { key: "aeId", label: "AE/SE ID", type: "text" },
  { key: "subjectId", label: "Subject ID", type: "text" },
  { key: "site", label: "Site", type: "text" },
  { key: "event", label: "Event", type: "text" },
  { key: "type", label: "Type", type: "select", options: TYPE_OPTIONS },
  { key: "severity", label: "Severity", type: "select", options: SEVERITY_OPTIONS },
  { key: "onsetDate", label: "Onset Date", type: "date" },
  { key: "outcome", label: "Outcome", type: "text" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS }
];

const AELog = ({ records = [], defaultSite = "", onSave, onDelete }: any) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyForm(defaultSite));
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const recordCount = Array.isArray(records) ? records.length : 0;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm(defaultSite, recordCount));
    setFormOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm({ ...emptyForm(defaultSite, 0), ...record });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (
      !form.aeId.trim() ||
      !form.subjectId.trim() ||
      !form.event.trim() ||
      !form.onsetDate.trim()
    ) {
      alert("Please fill in AE/SE ID, Subject ID, Event, and Onset Date.");
      return;
    }
    onSave({ ...form, id: editing ? editing.id : Date.now() });
    setFormOpen(false);
  };

  const handleDelete = () => {
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const renderField = (field) => {
    const common = {
      value: form[field.key] || "",
      onChange: (e) => setForm({ ...form, [field.key]: e.target.value })
    };

    if (field.type === "select") {
      return (
        <div className="clinical-field" key={field.key}>
          <label>{field.label}</label>
          <select {...common}>
            <option value="">Select {field.label}</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className="clinical-field" key={field.key}>
        <label>{field.label}</label>
        <input
          type={field.type || "text"}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          {...common}
        />
      </div>
    );
  };

  const columns = [
    { key: "aeId", label: "AE/SE ID" },
    { key: "subjectId", label: "Subject ID" },
    { key: "event", label: "Event" },
    { key: "type", label: "Type" },
    { key: "severity", label: "Severity" },
    { key: "onsetDate", label: "Onset Date" },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      render: (_value, row) => (
        <div className="clinical-actions">
          <button type="button" onClick={() => setViewTarget(row)}>
            View
          </button>
          <button type="button" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button type="button" onClick={() => setDeleteTarget(row)}>
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="clinical-log">
      <div className="clinical-log-header">
        <h2>AE/SE Log</h2>
        <button type="button" className="clinical-add-btn" onClick={openAdd}>
          + Add AE/SE Record
        </button>
      </div>

      <DataTable
        columns={columns}
        data={records}
        emptyMessage="No AE/SE records found"
        searchable
        searchPlaceholder="Search AE/SE records (ID, subject, event, type, status)..."
        searchFields={["aeId", "subjectId", "event", "type", "severity", "status"]}
        filters={[
          { key: "type", label: "Type" },
          { key: "status", label: "Status" }
        ]}
        pagination
        initialPageSize={10}
      />

      {/* Add / Edit modal */}
      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "42.5rem" }}>
            <div className="modal-title">
              {editing ? "Edit AE/SE Record" : "Add AE/SE Record"}
            </div>
            <div className="modal-body">
              <div className="clinical-form-grid">
                {FORM_FIELDS.map(renderField)}
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSubmit}>
                {editing ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "35rem" }}>
            <div className="modal-header">
              <h3>{viewTarget.aeId || "AE/SE Record"}</h3>
              <span className="close-btn" onClick={() => setViewTarget(null)}>
                ✖
              </span>
            </div>
            <table className="clinical-view-table">
              <tbody>
                {FORM_FIELDS.map((field) => (
                  <tr key={field.key}>
                    <th>{field.label}</th>
                    <td>{viewTarget[field.key] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setViewTarget(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "26.25rem" }}>
            <div className="modal-title">Delete AE/SE Record</div>
            <div className="modal-body">
              <p>Are you sure you want to delete this record?</p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AELog;
