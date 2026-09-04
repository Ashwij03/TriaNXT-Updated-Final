import React, { useState } from "react";
import {
  FaFileAlt,
  FaExclamationCircle,
  FaCheckCircle,
  FaGavel,
  FaClipboardCheck,
  FaUpload,
  FaEye,
  FaEdit,
  FaTrash,
  FaSave,
} from "react-icons/fa";
import PIKpiCard from "./PIKpiCard";
import {
  getRegulatoryData,
  saveRegulatoryData,
  getNavbarData,
  filterByStudy,
} from "./piDashboardService";

const STATUS_CYCLE = {
  Active: "Expiring Soon",
  "Expiring Soon": "Pending",
  Pending: "Approved",
  Approved: "Active",
};

function PIRegulatory({ selectedStudy: studyProp }: any) {
  const [data, setData] = useState(getRegulatoryData);
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [editSubmission, setEditSubmission] = useState(null);
  const selectedStudy = studyProp || getNavbarData().selectedStudy || "All Studies";

  const persist = (updated) => {
    const saved = saveRegulatoryData(updated);
    setData(saved);
    window.dispatchEvent(new CustomEvent("pi-study-data-updated"));
  };

  const filteredDocs = filterByStudy(data.documents, selectedStudy);
  const displayDocs =
    statusFilter === "All"
      ? filteredDocs
      : filteredDocs.filter((d) => d.status === statusFilter);

  const saveDocument = () => {
    if (!editDoc) return;
    const docs = data.documents.map((d) =>
      d.id === editDoc.id ? editDoc : d
    );
    persist({ ...data, documents: docs });
    setSelectedDoc(null);
    setEditDoc(null);
  };

  const saveSubmission = () => {
    if (!editSubmission) return;
    const submissions = (data.submissions || []).map((s) =>
      s.id === editSubmission.id ? editSubmission : s
    );
    persist({ ...data, submissions });
    setSelectedSubmission(null);
    setEditSubmission(null);
  };

  const deleteSubmission = (id) => {
    if (!window.confirm("Delete this submission?")) return;
    persist({
      ...data,
      submissions: (data.submissions || []).filter((s) => s.id !== id),
    });
    setSelectedSubmission(null);
    setEditSubmission(null);
  };

  const kpiCards = [
    { title: "IRB Approvals", value: data.kpis.irbApprovals, icon: FaGavel, color: "blue", filter: "IRB" },
    { title: "Expiring Documents", value: filteredDocs.filter((d) => d.status === "Expiring Soon").length, icon: FaExclamationCircle, color: "orange", filter: "Expiring Soon" },
    { title: "Compliance Reviews", value: data.kpis.complianceReviews, icon: FaClipboardCheck, color: "purple", filter: "Pending" },
    { title: "Regulatory Submissions", value: (data.submissions || []).length, icon: FaUpload, color: "teal", filter: "All" },
    { title: "Audit Readiness", value: `${data.kpis.auditReadiness}%`, icon: FaCheckCircle, color: "green", filter: "All" },
    { title: "Training Compliance", value: `${data.kpis.trainingCompliance}%`, icon: FaFileAlt, color: "blue", filter: "Training" },
  ];

  return (
    <div className="pi-page-content tnxt-compact">
      <div className="dashboard-header">
        <div>
          <h2>Regulatory Management</h2>
          <p className="pi-subtitle">
            Monitor IRB, compliance, and document status
            {selectedStudy !== "All Studies" && ` — ${selectedStudy}`}
          </p>
        </div>
        <div className="dashboard-actions">
          <select className="pi-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
          </select>
        </div>
      </div>

      <div className="pi-kpi-grid pi-kpi-grid-4">
        {kpiCards.map((kpi) => (
          <PIKpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            clickable
            onClick={() => kpi.filter !== "All" && setStatusFilter(kpi.filter === "IRB" ? "Active" : kpi.filter === "Training" ? "Active" : kpi.filter)}
          />
        ))}
      </div>

      <div className="table-container">
        <div className="section-header">
          <h2>Regulatory Documents</h2>
          <button type="button" className="view-all-btn" onClick={() => setStatusFilter("All")}>View All</button>
        </div>
        <div className="pi-table-responsive">
          <table className="pi-table ctms-standard-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Study</th>
                <th>Status</th>
                <th>Expiry Date</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayDocs.map((doc, i) => (
                <tr key={doc.id || i} className="pi-table-clickable">
                  <td>{doc.document}</td>
                  <td>{doc.category || "—"}</td>
                  <td>{doc.study || "—"}</td>
                  <td>
                    <span className={doc.status === "Active" || doc.status === "Approved" ? "status-success" : doc.status === "Expiring Soon" ? "status-warning" : "status-danger"}>
                      {doc.status}
                    </span>
                  </td>
                  <td>{doc.expiry}</td>
                  <td>{doc.owner}</td>
                  <td>
                    <button
                      type="button"
                      className="view-all-btn pi-btn-icon"
                      onClick={() => { setSelectedDoc(doc); setEditDoc({ ...doc }); }}
                    >
                      <FaEye /> View
                    </button>
                    <button
                      type="button"
                      className="export-btn pi-btn-sm pi-btn-icon"
                      style={{ marginLeft: "0.375rem" }}
                      onClick={() => { setSelectedDoc(doc); setEditDoc({ ...doc }); }}
                    >
                      <FaEdit /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-container" style={{ marginTop: "1.5rem" }}>
        <div className="section-header">
          <h2>Regulatory Submissions</h2>
        </div>
        <div className="pi-table-responsive">
          <table className="pi-table ctms-standard-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Study</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filterByStudy(data.submissions || [], selectedStudy).map((sub) => (
                <tr key={sub.id} className="pi-table-clickable">
                  <td>{sub.title}</td>
                  <td>{sub.study}</td>
                  <td><span className="status-success">{sub.status}</span></td>
                  <td>{sub.date}</td>
                  <td>
                    <button type="button" className="view-all-btn pi-btn-icon" onClick={() => { setSelectedSubmission(sub); setEditSubmission({ ...sub }); }}>
                      <FaEye /> View
                    </button>
                    <button type="button" className="export-btn pi-btn-sm pi-btn-icon" style={{ marginLeft: "0.375rem" }} onClick={() => { setSelectedSubmission(sub); setEditSubmission({ ...sub }); }}>
                      <FaEdit /> Edit
                    </button>
                    <button type="button" className="view-all-btn pi-btn-sm pi-btn-icon" style={{ marginLeft: "0.375rem", color: "#dc2626", borderColor: "#dc2626" }} onClick={() => deleteSubmission(sub.id)}>
                      <FaTrash /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedDoc && editDoc && (
        <div className="study-modal-overlay">
          <div className="study-modal">
            <h3>Regulatory Document</h3>
            <input type="text" value={editDoc.document} onChange={(e) => setEditDoc({ ...editDoc, document: e.target.value })} />
            <input type="text" value={editDoc.category || ""} onChange={(e) => setEditDoc({ ...editDoc, category: e.target.value })} />
            <input type="text" value={editDoc.study || ""} onChange={(e) => setEditDoc({ ...editDoc, study: e.target.value })} />
            <select value={editDoc.status} onChange={(e) => setEditDoc({ ...editDoc, status: e.target.value })}>
              {Object.keys(STATUS_CYCLE).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input type="text" value={editDoc.expiry || ""} onChange={(e) => setEditDoc({ ...editDoc, expiry: e.target.value })} />
            <input type="text" value={editDoc.owner || ""} onChange={(e) => setEditDoc({ ...editDoc, owner: e.target.value })} />
            <div className="modal-buttons">
              <button type="button" onClick={() => { setSelectedDoc(null); setEditDoc(null); }}>Cancel</button>
              <button type="button" onClick={saveDocument}><FaSave /> Save</button>
            </div>
          </div>
        </div>
      )}

      {selectedSubmission && editSubmission && (
        <div className="study-modal-overlay">
          <div className="study-modal">
            <h3>Regulatory Submission</h3>
            <input type="text" value={editSubmission.title} onChange={(e) => setEditSubmission({ ...editSubmission, title: e.target.value })} />
            <input type="text" value={editSubmission.study} onChange={(e) => setEditSubmission({ ...editSubmission, study: e.target.value })} />
            <select value={editSubmission.status} onChange={(e) => setEditSubmission({ ...editSubmission, status: e.target.value })}>
              <option>Submitted</option>
              <option>Under Review</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
            <input type="text" value={editSubmission.date} onChange={(e) => setEditSubmission({ ...editSubmission, date: e.target.value })} />
            <div className="modal-buttons">
              <button type="button" onClick={() => { setSelectedSubmission(null); setEditSubmission(null); }}>Cancel</button>
              <button type="button" onClick={saveSubmission}><FaSave /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PIRegulatory;
