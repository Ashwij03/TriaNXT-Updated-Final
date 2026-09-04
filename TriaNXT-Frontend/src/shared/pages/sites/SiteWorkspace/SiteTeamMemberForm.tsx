import React, { useEffect, useState } from "react";
import "./SiteForms.css";

const defaultForm = {
  name: "",
  role: "",
  organization: "",
  email: "",
  phone: "",
  startDate: "",
};

export default function SiteTeamMemberForm({
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
      alert("Team Member Name is required.");
      return;
    }

    if (!form.role.trim()) {
      alert("Role is required.");
      return;
    }

    onSave(form);
  };

  return (
    <div className="site-form-overlay">
      <div className="site-form-modal">

        <div className="site-form-header">
          <h2>
            {initialData ? "Edit Team Member" : "Add Team Member"}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>

          <label>Name</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
          />

          <label>Role</label>
          <input
            name="role"
            value={form.role}
            onChange={handleChange}
          />

          <label>Organization</label>
          <input
            name="organization"
            value={form.organization}
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

          <label>Start Date</label>
          <input
            type="date"
            name="startDate"
            value={form.startDate}
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