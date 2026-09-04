import { useEffect, useMemo, useState } from "react";
import {
  HEADER_FILTERS_EVENT,
  INSTITUTION_FILTER_EVENT
} from "../constants/headerFilters";
import { getCurrentUser } from "../services/roleService";
import {
  getFilteredSchedules,
  getUpcomingVisitsForDate,
  getUpcomingVisitsWindow,
  SCHEDULES_EVENT
} from "../services/visitScheduleService";

export default function useVisitSchedules(options: any = {}) {
  const { studyCode, institutionFilter, daysAhead = 7 } = options;
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);

    window.addEventListener(SCHEDULES_EVENT, bump);
    window.addEventListener(HEADER_FILTERS_EVENT, bump);
    window.addEventListener(INSTITUTION_FILTER_EVENT, bump);

    return () => {
      window.removeEventListener(SCHEDULES_EVENT, bump);
      window.removeEventListener(HEADER_FILTERS_EVENT, bump);
      window.removeEventListener(INSTITUTION_FILTER_EVENT, bump);
    };
  }, []);

  const schedules = useMemo(() => {
    void version;
    return getFilteredSchedules(getCurrentUser(), {
      studyCode,
      institution: institutionFilter
    });
  }, [version, studyCode, institutionFilter]);

  const upcomingWindow = useMemo(
    () => getUpcomingVisitsWindow(schedules, daysAhead),
    [schedules, daysAhead]
  );

  const getVisitsForDate = (date) =>
    getUpcomingVisitsForDate(schedules, date);

  return {
    schedules,
    upcomingWindow,
    getVisitsForDate,
    refresh: () => setVersion((value) => value + 1)
  };
}
