import React, { useEffect, useState } from "react";
import "./SiteForms.css";

const defaultForm = {
  name: "",
  email: "",
  phone: "",
};

export default function SiteContactForm({
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
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Contact Name is required.");
      return;
    }

    if (!form.email.trim()) {
      alert("Email is required.");
      return;
    }

    onSave(form);
  };

  return (
    <div className="site-form-overlay">
      <div className="site-form-modal">

        <div className="site-form-header">
          <h2>
            {initialData ? "Edit Contact" : "Add Contact"}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>

          <label>Name</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
          />

          <label>Phone</label>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
          />

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