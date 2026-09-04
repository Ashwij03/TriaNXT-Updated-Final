import EISFModuleWorkspace from "../EISFModuleWorkspace";
import EISF_ASSIGNED_MODULES from "../eisfAssignedModuleConfig";
import "./Protocol.css";

export default function Protocol({ activeSectionId, studyCode, moduleOptions, selectedModuleId, onModuleChange, onSectionChange }: any) {
  return (
    <EISFModuleWorkspace
      moduleConfig={EISF_ASSIGNED_MODULES.protocol}
      activeSectionId={activeSectionId}
      studyCode={studyCode}
      moduleOptions={moduleOptions}
      selectedModuleId={selectedModuleId}
      onModuleChange={onModuleChange}
      onSectionChange={onSectionChange}
    />
  );
}
