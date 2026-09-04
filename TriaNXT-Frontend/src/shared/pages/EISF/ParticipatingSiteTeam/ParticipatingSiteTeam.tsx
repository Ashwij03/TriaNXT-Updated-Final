import EISFModuleWorkspace from "../EISFModuleWorkspace";
import EISF_ASSIGNED_MODULES from "../eisfAssignedModuleConfig";
import "./ParticipatingSiteTeam.css";

export default function ParticipatingSiteTeam({ activeSectionId, studyCode, moduleOptions, selectedModuleId, onModuleChange, onSectionChange }: any) {
  return (
    <EISFModuleWorkspace
      moduleConfig={EISF_ASSIGNED_MODULES.participatingSiteTeam}
      activeSectionId={activeSectionId}
      studyCode={studyCode}
      moduleOptions={moduleOptions}
      selectedModuleId={selectedModuleId}
      onModuleChange={onModuleChange}
      onSectionChange={onSectionChange}
    />
  );
}
