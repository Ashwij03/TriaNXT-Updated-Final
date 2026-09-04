import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import EISFDashboard from "../EISF/EDashboard/EISFDashboard";

import "../EISF/EDashboard/EISFDashboard.css";
import "../EISF/EISFModuleWorkspace.css";
import "./EtmfCenter.css";

/**
 * eTMF Center — mirrors the eISF module structure exactly.
 * Uses the same EISFDashboard component for sidebar + content layout,
 * providing an identical user experience with eTMF labeling.
 */
function EtmfCenter() {
  return (
    <DashboardLayout>
      <div className="etmf-center">
        <div className="etmf-header">
          <div>
            <h1>Trial Master File</h1>
            <p className="etmf-subtitle">
              eTMF document management — zones, folders, and completeness tracking
            </p>
          </div>
        </div>

        <div className="etmf-dashboard-wrapper">
          <EISFDashboard studyCode="" />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default EtmfCenter;
