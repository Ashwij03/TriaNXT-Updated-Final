import React, { useState } from "react";
import DataTable from "./dashboard/shared/DataTable";
import "./ClinicalLog.css";

// ---- Task 2A (Ramya): Temp Log (Temperature Log). Same architecture as the
// Delegation Log: StudyLogsTab owns `records` and persistence, this component
// manages its own Add/Edit/View/Delete modals and reports changes back
// through onSave / onDelete. ----

const EQUIPMENT_TYPES = [
  "Refrigerator",
  "Freezer",
  "Ultra-Low Freezer",
  "Incubator",
  "Thermometer",
  "Temperature Logger",
  "Cold Room",
  "Other"
];
const UNIT_OPTIONS = ["°C", "°F"];
const STATUS_OPTIONS = ["Within Range", "Excursion"];

const emptyForm = (defaultSite = "", count = 0) => ({
  logId: `TEMP-${String(count + 1).padStart(3, "0")}`,
  site: defaultSite,
  storageLocation: "",
  equipmentId: "",
  equipmentType: "",
  date: "",
  time: "",
  temperature: "",
  unit: "°C",
  allowedRange: "",
  status: "Within Range",
  actionTaken: ""
});

const FORM_FIELDS = [
  { key: "logId", label: "Temperature Log ID", type: "text" },
  { key: "site", label: "Site", type: "text" },
  { key: "storageLocation", label: "Storage Location", type: "text" },
  { key: "equipmentId", label: "Equipment ID", type: "text" },
  { key: "equipmentType", label: "Equipment Type", type: "select", options: EQUIPMENT_TYPES },
  { key: "date", label: "Date", type: "date" },
  { key: "time", label: "Time", type: "time" },
  { key: "temperature", label: "Temperature", type: "number" },
  { key: "unit", label: "Unit", type: "select", options: UNIT_OPTIONS },
  { key: "allowedRange", label: "Allowed Min / Max Range", type: "text" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  { key: "actionTaken", label: "Action Taken", type: "textarea" }
];

const TempLog = ({ records = [], defaultSite = "", onSave, onDelete }: any) => {
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
      !form.logId.trim() ||
      !form.date.trim() ||
      !form.time.trim() ||
      !form.temperature.trim()
    ) {
      alert(
        "Please fill in Temperature Log ID, Date, Time, and Temperature."
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
    { key: "logId", label: "Log ID" },
    { key: "site", label: "Site" },
    {
      key: "equipmentType",
      label: "Equipment",
      render: (value, row) => {
        const type = value || "";
        const id = row.equipmentId || "";
        return type || id ? `${type}${id ? ` (${id})` : ""}` : "—";
      }
    },
    { key: "date", label: "Date" },
    { key: "time", label: "Time" },
    {
      key: "temperature",
      label: "Temperature",
      render: (value, row) =>
        value || value === 0 ? `${value} ${row.unit || "°C"}` : "—"
    },
    {
      key: "allowedRange",
      label: "Range",
      render: (value, row) =>
        value ? `${value} ${row.unit || "°C"}` : "—"
    },
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
        <h2>Temperature Log</h2>
        <button type="button" className="clinical-add-btn" onClick={openAdd}>
          + Add Temperature Record
        </button>
      </div>

      <DataTable
        columns={columns}
        data={records}
        emptyMessage="No temperature records found"
        searchable
        searchPlaceholder="Search temperature records (ID, site, equipment, status)..."
        searchFields={[
          "logId",
          "site",
          "storageLocation",
          "equipmentId",
          "equipmentType",
          "status"
        ]}
        filters={[
          { key: "status", label: "Status" },
          { key: "equipmentType", label: "Equipment Type" }
        ]}
        pagination
        initialPageSize={10}
      />

      {/* Add / Edit modal */}
      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: "42.5rem" }}>
            <div className="modal-title">
              {editing ? "Edit Temperature Record" : "Add Temperature Record"}
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
              <h3>{viewTarget.logId || "Temperature Record"}</h3>
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
            <div className="modal-title">Delete Temperature Record</div>
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

export default TempLog;
