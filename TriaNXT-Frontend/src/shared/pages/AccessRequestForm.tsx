import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/shared/DashboardLayout";
import { getCurrentUser } from "../services/roleService";
import { submitAccessRequest } from "../services/accessPermissionService";
import "./AccessPermissions.css";

function AccessRequestForm() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [form, setForm] = useState({
    studySubject: "",
    accessType: "Edit Access",
    notes: ""
  });

  const accessTypes = [
    "Edit Access",
    "Restricted Content Access",
    "Document Edit Access",
    "Study Owner Access"
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = (event) => {
    event.preventDefault();

    if (!form.studySubject.trim()) {
      alert("Please enter a study or subject reference.");
      return;
    }

    submitAccessRequest(form, user);
    alert("Access request submitted successfully.");
    navigate("/studies");
  };

  return (
    <DashboardLayout>
      <div className="admin-page access-request-page">
        <div className="admin-page-title page-section-highlight">
          <h1>Request Access</h1>
          <p>
            Submit a permission request for restricted study or subject content.
          </p>
        </div>

        <form className="access-request-form" onSubmit={submit}>
          <label>
            Study / Subject Reference
            <input
              name="studySubject"
              value={form.studySubject}
              onChange={handleChange}
              placeholder="e.g. STUDY-2025-001 or SUB-001"
              required
            />
          </label>

          <label>
            Access Type
            <select
              name="accessType"
              value={form.accessType}
              onChange={handleChange}>

              {accessTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Notes
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Describe why you need this access..."
            />
          </label>

          <button type="submit" className="request-permission-btn">
            Submit Request
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default AccessRequestForm;
