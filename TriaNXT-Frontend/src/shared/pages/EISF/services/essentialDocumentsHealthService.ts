import EISF_ASSIGNED_MODULES from "../eisfAssignedModuleConfig";
import { getEISFModuleDocuments } from "./eisfService";
export const EISF_DOCUMENTS_EVENT = "trianxt-eisf-documents-updated";
export const FIXED_EISF_MODULE_TOTAL = 22;

export function getFixedEISFModules() {
  return Object.values(EISF_ASSIGNED_MODULES)
    .filter((moduleConfig) => moduleConfig?.id)
    .sort(
      (firstModule, secondModule) =>
        Number.parseFloat(firstModule.id) - Number.parseFloat(secondModule.id)
    )
    .slice(0, FIXED_EISF_MODULE_TOTAL);
}

export function getEssentialDocumentsHealth(studyCode) {
  const modules = getFixedEISFModules();
  const code = String(studyCode || "");

  const moduleBreakdown = modules.map((moduleConfig) => {
    const documents = getEISFModuleDocuments(moduleConfig, code);
    const documentCount = Array.isArray(documents) ? documents.length : 0;

    return {
      id: moduleConfig.id,
      title: moduleConfig.title,
      documentCount,
      complete: documentCount > 0,
    };
  });

  const completedModules = moduleBreakdown.filter((module) => module.complete)
    .length;
  const documentCount = moduleBreakdown.reduce(
    (total, module) => total + module.documentCount,
    0
  );
  const percent = Math.round(
    (completedModules / FIXED_EISF_MODULE_TOTAL) * 100
  );

  return {
    completedModules,
    totalModules: FIXED_EISF_MODULE_TOTAL,
    moduleBreakdown,
    documentCount,
    uploaded: documentCount,
    expected: FIXED_EISF_MODULE_TOTAL,
    percent,
    complete: completedModules === FIXED_EISF_MODULE_TOTAL,
  };
}
