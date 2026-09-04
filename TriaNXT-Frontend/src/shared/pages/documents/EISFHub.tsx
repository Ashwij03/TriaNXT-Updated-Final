import { useState } from "react";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import DocumentFolderManager from "../../components/DocumentFolderManager";
import useCanEditStudyContent from "../../hooks/useCanEditStudyContent";
import "./EISFHub.css";

const DOCUMENT_TABS = [
  { id: "eISF", label: "eISF" },
  { id: "icf", label: "ICF" },
  { id: "others", label: "Others" }
];

function EISFHub() {
  const [activeTab, setActiveTab] = useState("eISF");
  // Vastav — Task 5: eISF/ICF/Others are still study documents, so a
  // Read-only CRO/Sponsor user should be able to view but not modify them.
  const canEdit = useCanEditStudyContent(`eISF Hub - ${activeTab}`, "global");

  return (
    <DashboardLayout>
      <div className="eisf-hub">
        <div className="eisf-hub-header">
          <h1>eISF Document Center</h1>
          <p>Manage eISF, ICF, and other regulatory documents</p>
        </div>

        <div className="eisf-hub-tabs">
          {DOCUMENT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}>

              {tab.label}
            </button>
          ))}
        </div>

        <DocumentFolderManager
          sectionId={activeTab}
          contextKey="global"
          title={DOCUMENT_TABS.find((tab) => tab.id === activeTab)?.label}
          readOnly={!canEdit}
        />
      </div>
    </DashboardLayout>
  );
}

export default EISFHub;
