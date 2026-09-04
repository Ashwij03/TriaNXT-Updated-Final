import React, { useEffect, useState } from "react";
import "./SiteForms.css";

const defaultForm = {
  label: "",
  completed: false,
  dueDate: "",
  notes: "",
};

export default function SiteRegulatoryForm({
  initialData,
  onSave,
  onCancel,
}: any) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (initialData) {
      setForm({
        ...defaultForm,
        ...initialData,
      });
    } else {
      setForm(defaultForm);
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.label.trim()) {
      alert("Regulatory Item is required.");
      return;
    }

    onSave(form);
  };

  return (
    <div className="site-form-overlay">
      <div className="site-form-modal">

        <div className="site-form-header">
          <h2>
            {initialData
              ? "Edit Regulatory Record"
              : "Add Regulatory Record"}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>

          <label>Regulatory Item</label>
          <input
            name="label"
            value={form.label}
            onChange={handleChange}
          />

          <label>Due Date</label>
          <input
            type="date"
            name="dueDate"
            value={form.dueDate}
            onChange={handleChange}
          />

          <label>Notes</label>
          <textarea
            name="notes"
            rows={4}
            value={form.notes}
            onChange={handleChange}
          />

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.625rem",
            }}>

            <input
              type="checkbox"
              name="completed"
              checked={form.completed}
              onChange={handleChange}
            />
            Completed
          </label>

          <div className="site-form-buttons">

            <button
              type="button"
              className="secondary-btn"
              onClick={onCancel}>

              Cancel
            </button>

            <button
              type="submit"
              className="primary-btn">

              Save
            </button>

          </div>

        </form>
      </div>
    </div>
  );
}