import React, { useEffect, useState } from "react";
import CROSidebar from "./CROSidebar";
import CRONavbar from "./CRONavbar";
import RequestPermissionButton from "../../shared/components/RequestPermissionButton";
import { getAccessibleStudies, getCurrentUser } from "../../shared/services/roleService";

function readSharedFiles() {
  try {
    return JSON.parse(localStorage.getItem("files")) || [];
  } catch {
    return [];
  }
}

function FileDetails() {
  const [files, setFiles] = useState(readSharedFiles);
  const [studies, setStudies] = useState(() => getAccessibleStudies(getCurrentUser()));
  const [uploadStudyCode, setUploadStudyCode] = useState("");

  useEffect(() => {
    const refresh = () => setFiles(readSharedFiles());
    window.addEventListener("files-updated", refresh);
    return () => window.removeEventListener("files-updated", refresh);
  }, []);

  useEffect(() => {
    const refreshStudies = () => setStudies(getAccessibleStudies(getCurrentUser()));
    window.addEventListener("studies-updated", refreshStudies);
    return () => window.removeEventListener("studies-updated", refreshStudies);
  }, []);

  const handleDownload = (file) => {
    if (!file.url) return;
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name || "download";
    link.click();
  };

  return (
    <div className="dashboard-layout">
      <CROSidebar />
      <div className="main-content">
        <CRONavbar />
        <div style={{ padding: "1.875rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
            }}
          >
            <h1>Files</h1>
            <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
              <select
                value={uploadStudyCode}
                onChange={(event) => setUploadStudyCode(event.target.value)}
                aria-label="Select study for new file"
                style={{ padding: "0.5rem" }}
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
                  action="Upload File"
                  module="Files"
                  studyCode={uploadStudyCode}
                  label="+ Add File"
                />
              )}
            </div>
          </div>

          {files.length === 0 ? (
            <p>No data available yet</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{file.name || file.fileName}</strong>
                    <p style={{ margin: "0.25rem 0 0", color: "#64748b" }}>
                      {file.category || file.type || "General"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => handleDownload(file)}>
                      Download
                    </button>
                    <RequestPermissionButton
                      action="Delete File"
                      module="Files"
                      recordId={file.id}
                      recordName={file.name || file.fileName}
                      studyCode={file.studyCode}
                      label="Delete"
                      variant="link"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileDetails;