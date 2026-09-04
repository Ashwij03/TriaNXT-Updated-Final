import { useEffect, useMemo, useState } from "react";
import {
  PLANNING_UPDATED_EVENT,
  getPlanningMilestones,
  getPlanningTasks,
  getStudyTeam,
  getRegulatoryChecklist,
  getProtocols,
} from "../services/planningService";

export default function usePlanning(studyCode) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(PLANNING_UPDATED_EVENT, bump);
    window.addEventListener("studies-updated", bump);

    return () => {
      window.removeEventListener(PLANNING_UPDATED_EVENT, bump);
      window.removeEventListener("studies-updated", bump);
    };
  }, []);

  return useMemo(() => {
    void version;
    const code = String(studyCode || "");

    return {
      milestones: getPlanningMilestones(code),
      tasks: getPlanningTasks(code),
      team: getStudyTeam(code),
      regulatoryChecklist: getRegulatoryChecklist(code),
      protocols: getProtocols(code),
      refresh: () => setVersion((v) => v + 1),
    };
  }, [studyCode, version]);
}
