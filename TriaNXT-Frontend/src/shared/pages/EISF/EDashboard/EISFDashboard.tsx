import { useCallback, useEffect, useMemo, useState } from "react";
import "./EISFDashboard.css";
import EISFMenuConfig from "../Constants/EISFMenuConfig";
import EISF_ASSIGNED_MODULES from "../eisfAssignedModuleConfig";
import {
  EISF_DOCUMENTS_EVENT,
  getFolderCounts,
  initializeModuleDocuments,
} from "../services/documentService";
import {
  getSubModuleEnabledMap,
  setSubModuleEnabled,
} from "../utils/subModuleStateUtils";

// Pages
import ParticipatingSiteTeam from "../ParticipatingSiteTeam/ParticipatingSiteTeam";
import ProjectManagement from "../ProjectManagement/ProjectManagement";
import Protocol from "../Protocol/Protocol";
import ParticipantConsent from "../ParticipantConsent/ParticipantConsent";
import Regulatory from "../Regulatory/Regulatory";
import Ethics from "../Ethics/Ethics";
import ResearchGovernance from "../ResearchGovernance/ResearchGovernance";
import SOP from "../Sop/Sop";
import SiteInitiation from "../SiteInitiation/SiteInitiation";
import SiteTraining from "../SiteTraining/SiteTraining";
import Recruitment from "../Recruitment/Recruitment";
import Randomization from "../Randomization/Randomization";
import DataManagement from "../DataManagement/DataManagement";
import Safety from "../Safety/Safety";
import Monitoring from "../Monitoring/Monitoring";
import Laboratory from "../Laboratory/Laboratory";
import Supplies from "../Supplies/Supplies";
import Legal from "../Legal/Legal";
import Finance from "../Finance/Finance";
import OtherCommunication from "../OtherCommunication/OtherCommunication";
import Archiving from "../Archiving/Archiving";
import InvestigationalProduct from "../InvestigationalProduct/InvestigationalProduct";

const pageMap = {
  "1.0": ParticipatingSiteTeam,
  "2.0": ProjectManagement,
  "3.0": Protocol,
  "4.0": ParticipantConsent,
  "5.0": Regulatory,
  "6.0": Ethics,
  "7.0": ResearchGovernance,
  "8.0": SOP,
  "9.0": SiteInitiation,
  "10.0": SiteTraining,
  "11.0": Recruitment,
  "12.0": Randomization,
  "13.0": DataManagement,
  "14.0": Safety,
  "15.0": Monitoring,
  "16.0": Laboratory,
  "17.0": Supplies,
  "18.0": Legal,
  "19.0": Finance,
  "20.0": OtherCommunication,
  "21.0": Archiving,
  "22.0": InvestigationalProduct,
};
function getParentSectionId(id) {
  if (!id) return "1.0";

  const [sectionNumber] = id.split(".");

  return `${sectionNumber}.0`;
}

// Reuses the existing module configs, keyed by module id, so the accordion can
// read the same sections/documents the workspace already uses.
const moduleConfigById = Object.values(EISF_ASSIGNED_MODULES).reduce(
  (map, moduleConfig) => {
    map[moduleConfig.id] = moduleConfig;
    return map;
  },
  {}
);

export default function EISFDashboard({ studyCode }: any = {}) {
  const [selected, setSelected] = useState("1.0");
  const [expandedModuleId, setExpandedModuleId] = useState(null);
  // Sub-module Enable/Disable state (Item 9) — same localStorage-backed state
  // the workspace already used, now surfaced in the accordion.
  const [enabledMap, setEnabledMap] = useState(() =>
    getSubModuleEnabledMap(studyCode)
  );
  // Bumped when the workspace persists documents (existing eISF event) so the
  // sub-module counts stay in sync, and when a sub-module is toggled so the
  // workspace re-reads the stored enable/disable state.
  const [documentsVersion, setDocumentsVersion] = useState(0);
  const [enabledVersion, setEnabledVersion] = useState(0);

  const selectedModuleId = useMemo(
    () => getParentSectionId(selected),
    [selected]
  );

  useEffect(() => {
    setEnabledMap(getSubModuleEnabledMap(studyCode));
  }, [studyCode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const bump = () => setDocumentsVersion((current) => current + 1);

    window.addEventListener(EISF_DOCUMENTS_EVENT, bump);

    return () => window.removeEventListener(EISF_DOCUMENTS_EVENT, bump);
  }, []);

  // Document counts per sub-module, built from the same module documents and
  // the same getFolderCounts() helper the removed panel used.
  const folderCounts = useMemo(() => {
    return EISFMenuConfig.reduce((counts, item) => {
      const moduleConfig = moduleConfigById[item.id];

      if (!moduleConfig) return counts;

      return {
        ...counts,
        ...getFolderCounts(
          moduleConfig.sections,
          initializeModuleDocuments(moduleConfig, studyCode)
        ),
      };
    }, {});
    // documentsVersion re-reads the persisted documents after an upload/delete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyCode, documentsVersion]);

  const isSectionEnabled = useCallback(
    (sectionId) => {
      if (!sectionId) return true;
      // Default to enabled (backwards compatible) when never toggled.
      return enabledMap[sectionId] !== false;
    },
    [enabledMap]
  );

  const handleToggleSectionEnabled = useCallback(
    (sectionId, event) => {
      if (event) {
        event.stopPropagation();
      }
      if (!sectionId) return;

      const nextEnabled = !isSectionEnabled(sectionId);
      setSubModuleEnabled(studyCode, sectionId, nextEnabled);
      setEnabledMap((prev) => ({ ...prev, [sectionId]: nextEnabled }));
      setEnabledVersion((current) => current + 1);
    },
    [isSectionEnabled, studyCode]
  );

  const CurrentPage = useMemo(() => {
    return pageMap[selectedModuleId] || ParticipatingSiteTeam;
  }, [selectedModuleId]);
  const handleModuleChange = (moduleId) => {
    setSelected(moduleId);
  };

  const handleSectionChange = (sectionId) => {
    setSelected(sectionId);
  };

  const toggleModule = (moduleId) => {
    setExpandedModuleId((currentModuleId) =>
      currentModuleId === moduleId ? null : moduleId
    );
  };

  // Task 1: the whole module row is the expand/collapse trigger. It keeps the
  // existing module-selection behaviour and the single-open accordion, while
  // the "+" / "−" glyph is now only a visual indicator.
  const handleModuleRowClick = (item) => {
    handleModuleChange(item.id);

    if (item.children?.length > 0) {
      toggleModule(item.id);
    }
  };

  return (
    <div className="eisf-layout eisf-layout-reference">
      <aside className="eisf-sidebar">
        <div className="eisf-sidebar-title">eISF Modules</div>

        <div className="eisf-sidebar-list">
          {EISFMenuConfig.map((item) => (
            <div className="eisf-sidebar-group" key={item.id}>
              <div
                className={`eisf-menu-item ${
                  selectedModuleId === item.id ? "active" : ""
                } ${expandedModuleId === item.id ? "expanded" : ""}`}>

                <button
                  type="button"
                  className="eisf-menu-label"
                  onClick={() => handleModuleRowClick(item)}
                  aria-expanded={
                    item.children?.length > 0
                      ? expandedModuleId === item.id
                      : undefined
                  }
                  aria-label={
                    item.children?.length > 0
                      ? `${expandedModuleId === item.id ? "Collapse" : "Expand"} ${item.title}`
                      : item.title
                  }>

                  <span className="eisf-menu-text">
                    <span className="eisf-module-number">{item.id}</span>
                    <span>{item.title}</span>
                  </span>

                  {item.children?.length > 0 && (
                    <span className="eisf-expand-indicator" aria-hidden="true">
                      {expandedModuleId === item.id ? "−" : "+"}
                    </span>
                  )}
                </button>
              </div>

              {expandedModuleId === item.id &&
                item.children?.map((child) => {
                  const enabled = isSectionEnabled(child.id);

                  return (
                    <div className="eisf-child-row" key={child.id}>
                      <button
                        type="button"
                        className={`eisf-child-item ${
                          selected === child.id ? "active" : ""
                        } ${enabled ? "" : "disabled"}`}
                        onClick={() => handleSectionChange(child.id)}>

                        <span className="eisf-child-title">
                          {child.id} {child.title}
                        </span>
                        <span className="section-count">
                          {folderCounts[child.id] || 0}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`eisf-submodule-toggle ${enabled ? "enabled" : ""}`}
                        onClick={(event) =>
                          handleToggleSectionEnabled(child.id, event)
                        }
                        aria-pressed={enabled}
                        aria-label={
                          enabled ? "Disable sub-module" : "Enable sub-module"
                        }
                        title={
                          enabled ? "Disable sub-module" : "Enable sub-module"
                        }>

                        <span className="toggle-track" aria-hidden="true">
                          <span className="toggle-thumb" />
                        </span>
                      </button>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </aside>

      <main className="eisf-content">
        <CurrentPage
          // enabledVersion re-mounts the module page after a sub-module toggle
          // so it re-reads the stored enable/disable state (no prop-chain or
          // service changes needed).
          key={`${selectedModuleId}-${enabledVersion}`}
          studyCode={studyCode}
          activeSectionId={selected === selectedModuleId ? undefined : selected}
          selectedModuleId={selectedModuleId}
          onModuleChange={handleModuleChange}
          onSectionChange={handleSectionChange}
        />
      </main>
    </div>
  );
}
