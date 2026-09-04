import React, { useMemo } from "react";
import { MdFilterList, MdClose, MdExpandMore } from "react-icons/md";

import {
  ANY,
  buildTypeOptions,
  buildDateOptions,
  buildSizeOptions,
  countActiveFilters,
} from "./fileFilterService";

/**
 * Subject Explorer - ADVANCED FILTERS (Phase 6, requirement 4)
 *
 * Three dropdowns - file type, uploaded date, file size - plus a clear-all
 * pill that appears only when something is narrowed.
 *
 * Presentational: the option lists and predicates live in
 * fileFilterService, and the type options are derived from the files in the
 * current folder so a user can never select a type that returns nothing.
 *
 * Phase 7 (polish only): the derived type options are memoised so they are
 * not rebuilt on unrelated renders, and the bar is memoised as a whole.
 *
 * Props
 *   files      unfiltered folder files (used to build type counts)
 *   filters    { type, date, size }
 *   onChange   (patch) => void   merged into the current filters
 *   onReset    () => void
 *   resultCount / totalCount     shown as "N of M"
 */
function FileFilterBar({
  files = [],
  filters,
  onChange,
  onReset,
  resultCount = 0,
  totalCount = 0,
}: any) {
  const { type = ANY, date = ANY, size = ANY } = filters || {};
  const activeCount = countActiveFilters(filters);

  /* Scanning every file to build the counts is the only real work here, so all
     three lists are memoised on `files`. Every option carries a live count and
     an `empty` flag, so a window with no matches is visibly disabled instead of
     silently emptying the table when picked. */
  const typeOptions = useMemo(() => buildTypeOptions(files), [files]);
  const dateOptions = useMemo(() => buildDateOptions(files), [files]);
  const sizeOptions = useMemo(() => buildSizeOptions(files), [files]);

  const groups = [
    {
      key: "type",
      label: "Type",
      value: type,
      options: typeOptions,
      title: "Filter by file type",
    },
    {
      key: "date",
      label: "Uploaded",
      value: date,
      options: dateOptions,
      title: "Filter by uploaded date",
    },
    {
      key: "size",
      label: "Size",
      value: size,
      options: sizeOptions,
      title: "Filter by file size",
    },
  ];

  return (
    <div
      className="sf-filterbar"
      id="sf-filterbar"
      role="group"
      aria-label="Advanced file filters"
    >
      <span className="sf-filterbar-lead" aria-hidden="true">
        <MdFilterList size={15} />
        <span>Filters</span>
      </span>

      <div className="sf-filterbar-groups">
        {groups.map(({ key, label, value, options, title }) => {
          const isActive = value !== ANY;

          return (
            <label
              key={key}
              className={`sf-filter${isActive ? " is-active" : ""}`}
              title={title}
            >
              <span className="sf-filter-label">{label}</span>

              <span className="sf-filter-control">
                <select
                  className="sf-filter-select"
                  value={value}
                  aria-label={title}
                  onChange={(event) => onChange?.({ [key]: event.target.value })}
                >
                  {options.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      /* A window with nothing in it stays visible - the set of
                         windows is meaningful - but cannot be chosen, so the
                         table is never emptied by a dead option. The currently
                         selected value is never disabled, or the browser would
                         fall back to painting the first option instead. */
                      disabled={option.empty && option.value !== value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <MdExpandMore
                  size={15}
                  className="sf-filter-caret"
                  aria-hidden="true"
                />
              </span>
            </label>
          );
        })}
      </div>

      <div className="sf-filterbar-right">
        <span className="sf-filter-count" aria-live="polite">
          <strong>{resultCount}</strong> of {totalCount}
        </span>

        {activeCount > 0 && (
          <button
            type="button"
            className="sf-filter-clear"
            onClick={onReset}
            title="Clear all filters"
          >
            <MdClose size={14} aria-hidden="true" />
            <span>Clear ({activeCount})</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(FileFilterBar);
