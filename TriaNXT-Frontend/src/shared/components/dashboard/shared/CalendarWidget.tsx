import { useEffect, useMemo, useState } from "react";
import { resolveSiteDisplay } from "../../../utils/siteDisplay";
import { getStudies } from "../../../services/studyService";
import { getCalendarDateKey } from "../../../services/visitScheduleService";
import "./CalendarWidget.css";

function parseCalendarDateKey(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(dateKey);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function CalendarWidget({
  schedules = [],
  selectedDate,
  onDateSelect,
}: any) {
  const isControlled = typeof onDateSelect === "function";

  const todayDateKey = getCalendarDateKey(new Date());

  // First upcoming schedule date only
  const firstScheduleDate = useMemo(() => {
    if (selectedDate) {
      return selectedDate;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [...schedules]
      .filter((item) => {
        if (!item?.date) {
          return false;
        }

        const visitDate = new Date(item.date);
        visitDate.setHours(0, 0, 0, 0);

        return visitDate >= today;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return upcoming.length > 0
      ? getCalendarDateKey(upcoming[0].date)
      : todayDateKey;
  }, [selectedDate, schedules, todayDateKey]);

  const [internalSelectedDate, setInternalSelectedDate] =
    useState(firstScheduleDate);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const baseDate = firstScheduleDate
      ? parseCalendarDateKey(firstScheduleDate)
      : new Date();

    return baseDate.getMonth();
  });

  const [currentYear, setCurrentYear] = useState(() => {
    const baseDate = firstScheduleDate
      ? parseCalendarDateKey(firstScheduleDate)
      : new Date();

    return baseDate.getFullYear();
  });

  const activeDate = isControlled ? selectedDate : internalSelectedDate;

  useEffect(() => {
    if (isControlled && selectedDate) {
      const d = parseCalendarDateKey(selectedDate);
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
    }
  }, [isControlled, selectedDate]);

  const weekDays = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ];

  useEffect(() => {
    if (!selectedDate && firstScheduleDate) {
      setInternalSelectedDate(firstScheduleDate);

      const d = parseCalendarDateKey(firstScheduleDate);
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
    }
  }, [firstScheduleDate, selectedDate]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const handleDateSelect = (date) => {
    if (isControlled) {
      onDateSelect(date);
    } else {
      setInternalSelectedDate(date);
    }
  };

  const getSchedulesForDate = (date) => {
    if (!date) {
      return [];
    }

    return schedules.filter(
      (schedule) => getCalendarDateKey(schedule.date) === date
    );
  };

  const changeMonth = (direction) => {
    if (direction === "prev") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((prev) => prev - 1);
      } else {
        setCurrentMonth((prev) => prev - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((prev) => prev + 1);
      } else {
        setCurrentMonth((prev) => prev + 1);
      }
    }
  };

  const calendarCells = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  const selectedSchedules = getSchedulesForDate(activeDate);

  // Item 17 — resolve schedule.site to the actual Site Number for display.

  const siteSources = useMemo(() => {
    try {
      return getStudies();
    } catch {
      return [];
    }
  }, []);

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => changeMonth("prev")}>

          ←
        </button>

        <div>
          <span className="calendar-eyebrow">Visit Calendar</span>
          <h3 className="calendar-title">
            {monthNames[currentMonth]} {currentYear}
          </h3>
        </div>

        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => changeMonth("next")}>

          →
        </button>
      </div>

      <div className="calendar-weekdays">
        {weekDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarCells.map((day, index) => {
          if (!day) {
            return (
              <div
                key={`empty-${index}`}
                className="calendar-empty-cell"
                aria-hidden="true"
              />
            );
          }

          const date = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

          const daySchedules = getSchedulesForDate(date);

          // IMPORTANT: highlight only today and future schedule dates
          const currentDate = parseCalendarDateKey(date);
          currentDate.setHours(0, 0, 0, 0);

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const hasSchedule =
            daySchedules.length > 0 && currentDate >= today;

          const isSelected = activeDate === date;
          const isToday = todayDateKey === date;

          return (
            <button
              key={date}
              type="button"
              aria-label={`${date}${isToday ? " Today" : ""}${
                hasSchedule ? ` ${daySchedules.length} scheduled visit${daySchedules.length !== 1 ? "s" : ""}` : ""
              }`}
              className={[
                "calendar-day",
                hasSchedule ? "has-schedule" : "",
                isToday ? "today" : "",
                isSelected ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleDateSelect(date)}>

              <span>{day}</span>

              {isToday && (
                <em>
                  Today
                </em>
              )}

              {hasSchedule && (
                <small>
                  {daySchedules.length}
                </small>
              )}

              {isToday && <em>Today</em>}

              {hasSchedule && <small>{daySchedules.length}</small>}
            </button>
          );
        })}
      </div>

      <div className="calendar-details">
        <div className="calendar-details-title">
          <div>
            <span>Schedule Details</span>
            <p>
              {selectedSchedules.length} item
              {selectedSchedules.length !== 1 ? "s" : ""}
            </p>
          </div>

          <strong>{activeDate || "Select a date"}</strong>
        </div>

        {!activeDate ? (
          <div className="calendar-empty">
            Select a date to view schedule details
          </div>
        ) : selectedSchedules.length > 0 ? (
          selectedSchedules.map((schedule, index) => (
            <div key={index} className="schedule-card">
              <div className="schedule-card-top">
                <div>
                  <strong>{schedule.visit}</strong>
                  <small>{schedule.time || "09:00 AM"}</small>
                </div>

                <span>{schedule.status}</span>
              </div>

              <div className="schedule-meta">
                <p>
                  <b>Subject:</b> {schedule.subjectId}
                </p>

                <p>
                  <b>Study:</b> {schedule.study}
                </p>

                <p>
                  <b>Site:</b>{" "}
                  {resolveSiteDisplay(schedule.site, {
                    sources: siteSources,
                    fallback: schedule.site || "—",
                  })}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="calendar-empty">
            No schedules on this date
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarWidget;
