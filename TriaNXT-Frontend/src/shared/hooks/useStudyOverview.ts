import { useEffect, useMemo, useState } from "react";
import {
  STUDY_OVERVIEW_EVENT,
  getEssentialDocumentsCompletion,
  getStudyProgressSummary,
  getStudyMilestones,
  getStudyScopedSitePerformance,
  getSiteActivationCounts,
  getGCPCertificationSummary,
  getStudyHealthSummary,
} from "../services/studyOverviewService";
import { FOLDER_TREE_EVENT } from "../services/folderService";
import { SCHEDULES_EVENT } from "../services/visitScheduleService";
import { EISF_DOCUMENTS_EVENT } from "../pages/EISF/services/essentialDocumentsHealthService";

export default function useStudyOverview(studyCode, refreshKey = 0) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);

    window.addEventListener(STUDY_OVERVIEW_EVENT, bump);
    window.addEventListener("studies-updated", bump);
    window.addEventListener("subjects-updated", bump);
    window.addEventListener(FOLDER_TREE_EVENT, bump);
    window.addEventListener(EISF_DOCUMENTS_EVENT, bump);
    window.addEventListener(SCHEDULES_EVENT, bump);
    window.addEventListener("planning-updated", bump);
    window.addEventListener("visit-plans-updated", bump);

    return () => {
      window.removeEventListener(STUDY_OVERVIEW_EVENT, bump);
      window.removeEventListener("studies-updated", bump);
      window.removeEventListener("subjects-updated", bump);
      window.removeEventListener(FOLDER_TREE_EVENT, bump);
      window.removeEventListener(EISF_DOCUMENTS_EVENT, bump);
      window.removeEventListener(SCHEDULES_EVENT, bump);
      window.removeEventListener("planning-updated", bump);
      window.removeEventListener("visit-plans-updated", bump);
    };
  }, []);

  return useMemo(() => {
    void version;
    void refreshKey;

    const code = String(studyCode || "");

    return {
      documents: getEssentialDocumentsCompletion(code),
      progress: getStudyProgressSummary(code),
      milestones: getStudyMilestones(code),
      sitePerformance: getStudyScopedSitePerformance(code),
      siteActivation: getSiteActivationCounts(code),
      gcpCertification: getGCPCertificationSummary(code),
      health: getStudyHealthSummary(code),
      refresh: () => setVersion((v) => v + 1),
    };
  }, [studyCode, version, refreshKey]);
}
