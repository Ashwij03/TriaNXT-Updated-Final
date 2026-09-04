import React, { useMemo, useState } from "react";
import CROLayout from "./CROLayout";
import { useCROData } from "./CRODATAContext";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import CROModal from "./CROModal";
import RequestPermissionButton from "../../shared/components/RequestPermissionButton";
import { getAccessibleStudies, getCurrentUser } from "../../shared/services/roleService";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

function CRORegulatoryDocuments() {
  const { documents } = useCROData();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [studies, setStudies] = useState(() => getAccessibleStudies(getCurrentUser()));
  const [uploadStudyCode, setUploadStudyCode] = useState("");

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  React.useEffect(() => {
    const refresh = () => setStudies(getAccessibleStudies(getCurrentUser()));
    window.addEventListener("studies-updated", refresh);
    return () => window.removeEventListener("studies-updated", refresh);
  }, []);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = String(doc.name || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const approvedCount = documents.filter((doc) => doc.status === "Approved").length;
  const pendingCount = documents.filter((doc) => doc.status === "Pending").length;
  const expiringCount = documents.filter((doc) => {
    if (!doc.expiry) return false;
    const expiry = new Date(doc.expiry);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  const handleView = (doc) => {
    setSelectedDoc(doc);
    setShowViewModal(true);
  };

  return (
    <CROLayout>
      <h1>Regulatory Documents</h1>

      <div className="cro-stats-grid">
        <div className="cro-card">
          <h3>Total Documents</h3>
          <h2>{documents.length}</h2>
        </div>
        <div className="cro-card">
          <h3>Approved</h3>
          <h2>{approvedCount}</h2>
        </div>
        <div className="cro-card">
          <h3>Pending Review</h3>
          <h2>{pendingCount}</h2>
        </div>
        <div className="cro-card">
          <h3>Expiring Soon</h3>
          <h2>{expiringCount}</h2>
        </div>
      </div>

      <div className="cro-panel">
        <div className="cro-panel-header">
          <div className="cro-panel-filters">
            <input
              type="text"
              placeholder="Search Document..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="cro-input"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="cro-input"
            >
              <option value="All">All</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div className="cro-panel-filters">
            <select
              value={uploadStudyCode}
              onChange={(event) => setUploadStudyCode(event.target.value)}
              className="cro-input"
              aria-label="Select study for new document"
            >
              <option value="">Select study…</option>
              {studies.map((study) => (
                <option key={study.code} value={study.code}>
                  {study.name || study.code}
                </option>
              ))}
            </select>
            {uploadStudyCode && (
              <RequestPermissionButton
                action="Upload Document"
                module="Regulatory Documents"
                studyCode={uploadStudyCode}
                label="+ Upload Document"
                className="cro-btn-primary-inline request-permission-btn"
              />
            )}
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <EmptyState title="No data available yet" />
        ) : (
          <div className="table-scroll-wrap tnxt-compact">
            <table className="cro-table ctms-standard-table">
              <thead>
                <tr>
                  <th>Document ID</th>
                  <th>Name</th>
                  <th>Site</th>
                  <th>Version</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.id}</td>
                    <td>{doc.name}</td>
                    <td>{displaySite(doc.site)}</td>
                    <td>{doc.version}</td>
                    <td>{doc.expiry}</td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cro-btn-primary-inline"
                        onClick={() => handleView(doc)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CROModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={selectedDoc?.name || "Document"}
        footer={
          selectedDoc?.status === "Pending" ? (
            <RequestPermissionButton
              action="Approve Document"
              module="Regulatory Documents"
              recordId={selectedDoc?.id}
              recordName={selectedDoc?.name}
              studyCode={selectedDoc?.studyCode}
              label="Approve"
              className="cro-btn cro-btn-primary"
            />
          ) : null
        }
      >
        {selectedDoc && (
          <div>
            <p>
              <strong>ID:</strong> {selectedDoc.id}
            </p>
            <p>
              <strong>Site:</strong> {displaySite(selectedDoc.site)}
            </p>
            <p>
              <strong>Version:</strong> {selectedDoc.version}
            </p>
            <p>
              <strong>Expiry:</strong> {selectedDoc.expiry}
            </p>
            <p>
              <strong>Status:</strong> <StatusBadge status={selectedDoc.status} />
            </p>
          </div>
        )}
      </CROModal>
    </CROLayout>
  );
}

export default CRORegulatoryDocuments;