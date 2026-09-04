import EISFModuleWorkspace from "../EISFModuleWorkspace";
import EISF_ASSIGNED_MODULES from "../eisfAssignedModuleConfig";
import "./ParticipantConsent.css";

export default function ParticipantConsent({ activeSectionId, studyCode, moduleOptions, selectedModuleId, onModuleChange, onSectionChange }: any) {
  return (
    <EISFModuleWorkspace
      moduleConfig={EISF_ASSIGNED_MODULES.participantConsent}
      activeSectionId={activeSectionId}
      studyCode={studyCode}
      moduleOptions={moduleOptions}
      selectedModuleId={selectedModuleId}
      onModuleChange={onModuleChange}
      onSectionChange={onSectionChange}
    />
  );
}
