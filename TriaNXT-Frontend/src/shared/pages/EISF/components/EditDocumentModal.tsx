import { useEffect, useState } from "react";
import { DOCUMENT_STATUS_OPTIONS } from "../Constants/documentStatus";
import "./EditDocumentModal.css";

export default function EditDocumentModal({
  open,
  document,
  onClose,
  onSave
}: any) {
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (document) {
      setForm(document);
    }
  }, [document]);

  if (!open || !document) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="edit-overlay">

      <div className="edit-modal">

        <div className="edit-header">
          Edit Document
        </div>

        <div className="edit-body">

          <label>Document Name</label>
          <input
            value={form.documentName || ""}
            onChange={(e) =>
              handleChange("documentName", e.target.value)
            }
          />

          <label>Category</label>
          <input
            value={form.category || ""}
            onChange={(e) => {
              handleChange("category", e.target.value);
              handleChange("documentType", e.target.value);
            }}
          />

          <label>Version</label>
          <input
            value={form.version || ""}
            onChange={(e) =>
              handleChange("version", e.target.value)
            }
          />

          <label>Status</label>

          <select
            value={form.status || ""}
            onChange={(e) =>
              handleChange("status", e.target.value)
            }>

            {DOCUMENT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

        </div>

        <div className="edit-footer">

          <button
            type="button"
            className="cancel-btn"
            onClick={onClose}>

            Cancel
          </button>

          <button
            type="button"
            className="save-btn"
            onClick={() => onSave(form)}>

            Save
          </button>

        </div>

      </div>

    </div>
  );
}