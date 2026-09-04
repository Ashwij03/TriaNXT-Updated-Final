import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VISIT_PLANS_UPDATED_EVENT,
  getVisitPlans,
  getVisitPlanVisits,
  getVisitPlanProcedures,
  getVisitPlanTasks,
} from "../services/visitPlanService";
import { SCHEDULES_EVENT } from "../services/visitScheduleService";

export default function useVisitPlans(studyCode) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(VISIT_PLANS_UPDATED_EVENT, bump);
    window.addEventListener(SCHEDULES_EVENT, bump);
    window.addEventListener("subjects-updated", bump);

    return () => {
      window.removeEventListener(VISIT_PLANS_UPDATED_EVENT, bump);
      window.removeEventListener(SCHEDULES_EVENT, bump);
      window.removeEventListener("subjects-updated", bump);
    };
  }, []);

  const plans = useMemo(() => {
    void version;
    return getVisitPlans(studyCode);
  }, [studyCode, version]);

  const getPlanDetails = useCallback(
    (planId) => ({
      visits: getVisitPlanVisits(planId),
      procedures: getVisitPlanProcedures(planId),
      tasks: getVisitPlanTasks(planId),
    }),
    []
  );

  return {
    plans,
    getPlanDetails,
    refresh: () => setVersion((v) => v + 1),
  };
}
