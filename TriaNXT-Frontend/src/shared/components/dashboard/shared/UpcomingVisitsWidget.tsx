import { useEffect, useMemo, useState } from "react";
import { formatScheduleDisplayDate } from "../../../utils/formatScheduleDisplayDate";
import "./dashboard.css";

function UpcomingVisitsWidget({
  visits = [],
  emptyMessage = "No upcoming visits scheduled",
  pageSize = 3
}: any) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(visits.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [visits.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleVisits = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return visits.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, visits]);

  if (!visits.length) {
    return (
      <div className="dashboard-widget">
        <h3>Upcoming Visits</h3>
        <p className="visit-item-empty">{emptyMessage}</p>
      </div>
    );
  }

  const showPagination = visits.length > pageSize;

  return (
    <div className="dashboard-widget">
      <h3>Upcoming Visits</h3>

      {visibleVisits.map((visit, index) => (
        <div key={`${visit.subject || visit.subjectId}-${index}`} className="visit-item">
          <strong>{visit.subject || visit.subjectId || "—"}</strong>
          <div>{visit.visit || "—"}</div>
          <small>{formatScheduleDisplayDate(visit.date)}</small>
        </div>
      ))}

      {showPagination && (
        <div className="upcoming-visits-pagination">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <span>
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default UpcomingVisitsWidget;