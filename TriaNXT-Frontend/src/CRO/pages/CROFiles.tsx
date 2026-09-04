import React, { useMemo, useState } from "react";

import CROLayout from "./CROLayout";

import { useCROData } from "./CRODATAContext";

import EmptyState from "./EmptyState";

import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";

function CROFiles() {

  const { files, showAlert } = useCROData();

  const [searchTerm, setSearchTerm] = useState("");

  const siteSources = useMemo(() => getStudies(), []);

  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const filteredFiles = files.filter((f) =>

    f.name.toLowerCase().includes(searchTerm.toLowerCase())

  );

  return (

    <CROLayout>

      <h1 style={{ marginBottom: "1.5625rem" }}>Files</h1>

      <div className="cro-summary-cards">

        <div className="dashboard-card">

          <h3>Total Files</h3>

          <h1>{files.length}</h1>

        </div>

        <div className="dashboard-card">

          <h3>Monitoring</h3>

          <h1>{files.filter((f) => f.category === "Monitoring").length}</h1>

        </div>

        <div className="dashboard-card">

          <h3>Regulatory</h3>

          <h1>{files.filter((f) => f.category === "Regulatory").length}</h1>

        </div>

        <div className="dashboard-card">

          <h3>Other</h3>

          <h1>

            {files.filter(

              (f) => !["Monitoring", "Regulatory"].includes(f.category)

            ).length}

          </h1>

        </div>

      </div>

      <div className="cro-panel">

        <div className="cro-panel-header">

          <input

            type="text"

            placeholder="Search Files..."

            value={searchTerm}

            onChange={(e) => setSearchTerm(e.target.value)}

            className="cro-input"

          />

          <h2>Files List</h2>

        </div>

        {filteredFiles.length === 0 ? (

          <EmptyState title="No Files Found" />

        ) : (

          <div className="cro-table-wrap tnxt-compact">

            <table className="cro-data-table ctms-standard-table">

              <thead>

                <tr>

                  <th>File ID</th>

                  <th>Name</th>

                  <th>Category</th>

                  <th>Site</th>

                  <th>Uploaded On</th>

                  <th>Size</th>

                  <th>Actions</th>

                </tr>

              </thead>

              <tbody>

                {filteredFiles.map((file) => (

                  <tr key={file.id}>

                    <td>{file.id}</td>

                    <td>{file.name}</td>

                    <td>{file.category}</td>

                    <td>{displaySite(file.site)}</td>

                    <td>{file.uploadedOn}</td>

                    <td>{file.size}</td>

                    <td>

                      <button

                        type="button"

                        className="cro-btn-sm"

                        onClick={() =>

                          showAlert(

                            file.name,

                            `Category: ${file.category}\nSite: ${displaySite(file.site)}\nUploaded: ${file.uploadedOn}`

                          )

                        }
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

    </CROLayout>

  );

}

export default CROFiles;