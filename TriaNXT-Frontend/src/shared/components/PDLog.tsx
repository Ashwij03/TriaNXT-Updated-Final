import React, { useState } from "react";
import DataTable from "./dashboard/shared/DataTable";
import "./ClinicalLog.css";

// ---- Task 2A (Ramya): PD Log (Protocol Deviation). Same architecture as
// the Delegation Log: StudyLogsTab owns `records` and persistence, this
// component manages its own Add/Edit/View/Delete modals and reports changes
// back through onSave / onDelete. ----

const DEVIATION_TYPES = [
  "Eligibility",
  "Informed Consent",
  "Procedural",
  "Dosing / Drug Administration",
  "Visit / Schedule",
  "Documentation",
  "Reporting",
  "Other"
];
const IMPACT_OPTIONS = ["Low", "Medium", "High", "Critical"];
const STATUS_OPTIONS = ["Open", "Under Review", "Resolved"];

const emptyForm = (defaultSite = "", count = 0) => ({
  pdId: `PD-${String(count + 1).padStart(3, "0")}`,
  subjectId: "",
  site: defaultSite,
  protocol: "",
  deviationType: "",
  deviationDate: "",
  description: "",
  impact: "Low",
  correctiveAction: "",
  status: "Open"
});

const FORM_FIELDS = [
  { key: "pdId", label: "PD ID", type: "text" },
  { key: "subjectId", label: "Subject ID", type: "text" },
  { key: "site", label: "Site", type: "text" },
  { key: "protocol", label: "Protocol / Version", type: "text" },
  { key: "deviationType", label: "Deviation Type", type: "select", options: DEVIATION_TYPES },
  { key: "deviationDate", label: "Deviation Date", type: "date" },
  { key: "impact", label: "Impact / Risk", type: "select", options: IMPACT_OPTIONS },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  { key: "description", label: "Description", type: "textarea" },
  { key: "correctiveAction", label: "Corrective Action", type: "textarea" }
];

const PDLog = ({ records = [], defaultSite = "", onSave, onDelete }: any) => {
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
      !form.pdId.trim() ||
      !form.subjectId.trim() ||
      !form.deviationType.trim() ||
      !form.deviationDate.trim()
    ) {
      alert(
        "Please fill in PD ID, Subject ID, Deviation Type, and Deviation Date."
      );
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

    if (field.type === "textarea") {
      return (
        <div className="clinical-field full" key={field.key}>
          <label>{field.label}</label>
          <textarea rows={2} {...common} />
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
    { key: "pdId", label: "PD ID" },
    { key: "subjectId", label: "Subject ID" },
    { key: "site", label: "Site" },
    { key: "deviationType", label: "Deviation Type" },
    { key: "deviationDate", label: "Deviation Date" },
    { key: "impact", label: "Impact" },
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
        <h2>PD Log</h2>
        <button type="button" className="clinical-add-btn" onClick={openAdd}>
          + Add PD Record
        </button>
      </div>

      <DataTable
        columns={columns}
        data={records}
        emptyMessage="No protocol deviation records found"
        searchable
        searchPlaceholder="Search PD records (ID, subject, type, impact, status)..."
        searchFields={[
          "pdId",
          "subjectId",
          "site",
          "deviationType",
          "impact",
          "status"
        ]}
        filters={[
          { key: "status", label: "Status" },
          { key: "impact", label: "Impact" }
        ]}
        pagination
        initialPageSize={10}
      />

      {/* Add / Edit modal */}
      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "42.5rem" }}>
            <div className="modal-title">
              {editing ? "Edit PD Record" : "Add PD Record"}
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
              <h3>{viewTarget.pdId || "PD Record"}</h3>
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
            <div className="modal-title">Delete PD Record</div>
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

export default PDLog;
