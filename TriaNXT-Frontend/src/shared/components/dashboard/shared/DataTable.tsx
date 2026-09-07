// newly added

import React, { useEffect, useMemo, useState } from "react";

import "./DataTable.css";

function DataTable({
  title,
  columns = [],
  data = [],
  emptyMessage = "No records found",
  className = "",
  searchable = false,
  searchPlaceholder = "Search...",
  searchFields,
  filters = [],
  pagination = false,
  initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  // Phase-6 Subject Comments: consumer-supplied key that forces the
  // pagination state back to page 1 when it changes. Used by
  // SubjectComments so switching to a different subject always lands
  // on page 1 even if the row count happens to be identical.
  resetPageKey
}: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const searchableFields = useMemo(
    () =>
      Array.isArray(searchFields) && searchFields.length > 0
        ? searchFields
        : columns.map((column) => column.key),
    [columns, searchFields]
  );

  const filterOptions = useMemo(() => {
    return filters.map((filter) => {
      if (Array.isArray(filter.options) && filter.options.length > 0) {
        return filter;
      }

      const options = [
        ...new Set<any>(
          data
            .map((row) => row?.[filter.key])
            .filter((value) => value !== null && value !== undefined && value !== "")
            .map(String)
        )
      ].sort((a, b) =>
        a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base"
        })
      );

      return {
        ...filter,
        options: options.map((value) => ({
          value,
          label: value
        }))
      };
    });
  }, [data, filters]);

  const processedData = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return data.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        searchableFields.some((field) =>
          String(row?.[field] ?? "")
            .toLowerCase()
            .includes(normalizedSearch)
        );

      const matchesFilters = filterOptions.every((filter) => {
        const selectedValue = filterValues[filter.key];
        return !selectedValue || String(row?.[filter.key] ?? "") === selectedValue;
      });

      return matchesSearch && matchesFilters;
    });
  }, [data, filterOptions, filterValues, searchTerm, searchableFields]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterValues, pageSize, data.length]);

  // Phase-6: external reset trigger (e.g. Subject change in
  // SubjectComments). Kept separate from the data.length effect above
  // so the two triggers don't collide when the row count is unchanged
  // but the underlying context is different.
  useEffect(() => {
    setCurrentPage(1);
  }, [resetPageKey]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleData = useMemo(() => {
    if (!pagination) {
      return processedData;
    }

    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, pagination, processedData]);

  const pageStart =
    processedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, processedData.length);
  const showToolbar = searchable || filterOptions.length > 0;

  // Row keys must be unique within the rendered list. Many tables (e.g. the
  // standard reports) have no per-row id and fall back to a shared field like
  // studyId, which made every row share one key — React then duplicates or
  // omits rows when the table content changes, visibly mixing rows/columns
  // from a previously viewed report. Appending the row's position guarantees
  // uniqueness while keeping the key stable across re-renders of the same data.
  const rowKey = (row: any, index: number) => {
    const base =
      row.id || row.subjectId || row.studyId || row.code || row.number || "";
    return base ? `${base}-${index}` : `row-${index}`;
  };

  return (

    <div className={`ctms-table-card${className ? ` ${className}` : ""}`}>

      <div className="ctms-table-header">

        <h3>{title}</h3>

      </div>

      {showToolbar && (
        <div className="ctms-table-toolbar">
          {searchable && (
            <input
              type="search"
              className="ctms-table-search"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label={`Search ${title || "table"}`}
            />
          )}

          {filterOptions.length > 0 && (
            <div className="ctms-table-filters">
              {filterOptions.map((filter) => (
                <label key={filter.key} className="ctms-table-filter">
                  <span>{filter.label}</span>

                  <select
                    value={filterValues[filter.key] || ""}
                    onChange={(event) =>
                      setFilterValues((currentValues) => ({
                        ...currentValues,
                        [filter.key]: event.target.value
                      }))
                    }
                    aria-label={`${filter.label} filter`}
                  >
                    <option value="">{filter.allLabel || `All ${filter.label}`}</option>

                    {filter.options.map((option) => {
                      const optionValue =
                        typeof option === "string" ? option : option.value;
                      const optionLabel =
                        typeof option === "string" ? option : option.label;

                      return (
                        <option key={optionValue} value={optionValue}>
                          {optionLabel}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="ctms-table-wrapper">

      <table
  className="ctms-table"
  style={{
    tableLayout: "fixed",
    width: "100%",
  }}
      >
          <thead>

            <tr>

              {columns.map((column) => (

                <th
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.label}
                </th>

              ))}

            </tr>

          </thead>

          <tbody>

            {visibleData.length > 0 ? (

              visibleData.map((row, index) => (

                <tr key={rowKey(row, index)}>

                  {columns.map((column) => (

  <td
  key={column.key}
  style={
    column.width
      ? {
          width: column.width,
          maxWidth: column.width,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace:
            column.key === "comment" ? "normal" : "nowrap",
          wordBreak: "break-word",
          verticalAlign: "top",
        }
      : {
          whiteSpace: "normal",
          wordBreak: "break-word",
          verticalAlign: "top",
        }
  }>

  {typeof column.render === "function"
    ? column.render(row[column.key], row)
    : row[column.key]}
</td>

                  ))}

                </tr>

              ))

            ) : (

              <tr>

                <td
                  colSpan={
                    columns.length
                  }
                  className="empty-row">

                  <div className="empty-row-inner">{emptyMessage}</div>

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

      {pagination && processedData.length > 0 && (
        <div className="ctms-table-pagination">
          <span>
            Showing {pageStart}-{pageEnd} of {processedData.length}
          </span>

          <div className="ctms-table-pagination-controls">
            <label>
              Rows
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="Rows per page">

                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}>

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
              disabled={currentPage === totalPages}>

              Next
            </button>
          </div>
        </div>
      )}

    </div>

  );
}

export default DataTable;