import React from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import "./PaginationFooter.css";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

/**
 * Shared pagination footer - "Showing X to Y of Z", rows-per-page,
 * previous/next - used by `AllSubjectsTable` (Task 1.6) and
 * `SubjectFileManager`'s file table (Task 1.7). Built once here instead of
 * twice so the two tables reach parity with the eISF pagination footer the
 * same way, with one implementation to maintain.
 *
 * Props
 *   page       current 1-based page
 *   pageSize   rows per page
 *   total      total row count (pre-pagination, post-filter)
 *   onPageChange     (page) => void
 *   onPageSizeChange (pageSize) => void
 *   pageSizeOptions  optional override
 */
function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: any) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="tnxt-pagination">
      <div className="tnxt-pagination-info">
        Showing {start} to {end} of {total}
      </div>

      <div className="tnxt-pagination-controls">
        <label className="tnxt-pagination-size">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="tnxt-pagination-btn"
          onClick={() => onPageChange?.(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <MdChevronLeft size={16} />
        </button>

        <span className="tnxt-pagination-page">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="tnxt-pagination-btn"
          onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <MdChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default React.memo(PaginationFooter);
