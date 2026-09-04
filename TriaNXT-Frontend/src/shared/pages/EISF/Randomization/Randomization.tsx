import EISFModuleWorkspace from "../EISFModuleWorkspace";
import EISF_ASSIGNED_MODULES from "../eisfAssignedModuleConfig";
import "./Randomization.css";

export default function Randomization({ activeSectionId, studyCode, moduleOptions, selectedModuleId, onModuleChange, onSectionChange }: any) {
  return (
    <EISFModuleWorkspace
      moduleConfig={EISF_ASSIGNED_MODULES.randomization}
      activeSectionId={activeSectionId}
      studyCode={studyCode}
      moduleOptions={moduleOptions}
      selectedModuleId={selectedModuleId}
      onModuleChange={onModuleChange}
      onSectionChange={onSectionChange}
    />
  );
}
