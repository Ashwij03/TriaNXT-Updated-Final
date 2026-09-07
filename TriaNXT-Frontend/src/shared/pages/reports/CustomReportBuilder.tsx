import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBarChart2,
  FiDownload,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiTrash2,
} from "react-icons/fi";

import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import DataTable from "../../components/dashboard/shared/DataTable";
import { isApiEnabled, reportingApi } from "../../services/api";
import { getCurrentUser } from "../../services/roleService";
import ROLES from "../../constants/roles";

import "./reports.css";

const EXPORT_FORMATS = [
  { key: "csv", label: "CSV" },
  { key: "xlsx", label: "Excel" },
  { key: "pdf", label: "PDF" },
];

const AGG_NO_GROUP_HINT =
  "Choose a group-by dimension (count) or a numeric column with an optional group-by (sum / average).";

function emptyFilter(field = "", op = "eq", value: any = "") {
  return { field, op, value };
}

function CustomReportBuilder() {
  const [catalog, setCatalog] = useState<any>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // configuration
  const [sourceKey, setSourceKey] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<any[]>([emptyFilter()]);
  const [options, setOptions] = useState<any>({});
  const [aggregate, setAggregate] = useState<any>({ type: "none" });

  // run/preview
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  // templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateStudyId, setTemplateStudyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);

  const user = getCurrentUser();
  const canSave =
    user?.role === ROLES.ADMIN ||
    [ROLES.SITE_STAFF, ROLES.PI, ROLES.SPONSOR].includes(user?.role);

  const source = useMemo(() => {
    const sources = catalog?.sources || [];
    return sources.find((entry: any) => entry.key === sourceKey) || null;
  }, [catalog, sourceKey]);

  const sourceColumns = useMemo(() => source?.columns || [], [source]);
  const filterFields = useMemo(() => source?.filterFields || [], [source]);
  const groupFields = useMemo(() => source?.groupFields || [], [source]);
  const metricColumns = useMemo(() => source?.metricColumns || [], [source]);

  const aggTypes = useMemo(() => catalog?.aggregates || [], [catalog]);
  const operators = useMemo(() => catalog?.operators || [], [catalog]);

  const buildConfig = useCallback(() => {
    // An empty filter row (no field or no value, incl. a blank between
    // range) must never be serialized — the backend rejects stray filter
    // objects, so emit an empty array when nothing is actually selected.
    const isEmptyValue = (value: any) =>
      value === "" ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) &&
        value.every((part) => part === "" || part === null || part === undefined));
    const usedFilters = filters
      .filter((item) => item.field && !isEmptyValue(item.value))
      .map((item) => ({
        field: item.field,
        op: item.op || "eq",
        value: item.value,
      }));

    return {
      source: sourceKey,
      columns: selectedColumns,
      filters: usedFilters,
      aggregate: {
        type: aggregate.type || "none",
        ...(aggregate.groupBy ? { groupBy: aggregate.groupBy } : {}),
        ...(aggregate.column ? { column: aggregate.column } : {}),
      },
      limit: 500,
    };
  }, [sourceKey, selectedColumns, filters, aggregate]);

  const loadOptions = useCallback(async (key: string) => {
    if (!isApiEnabled()) return;
    try {
      const res = await reportingApi.getReportOptions(key);
      setOptions(res?.options || {});
    } catch {
      setOptions({});
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!isApiEnabled()) {
      setLoadingCatalog(false);
      return;
    }
    setLoadingCatalog(true);
    setError(null);
    try {
      const res = await reportingApi.getReportCatalog();
      setCatalog(res || null);
      const sources = res?.sources || [];
      if (sources.length && !sourceKey) {
        const first = sources[0].key;
        setSourceKey(first);
        setSelectedColumns(
          (sources[0].columns || []).map((column: any) => column.key),
        );
        setFilters([emptyFilter()]);
        // Load the distinct value options for the initial source so the
        // filter Value control offers the valid choices immediately.
        loadOptions(first);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load the report catalog.");
    } finally {
      setLoadingCatalog(false);
    }
  }, [sourceKey, loadOptions]);

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSourceChange = (key: string) => {
    setSourceKey(key);
    const nextSource = (catalog?.sources || []).find(
      (entry: any) => entry.key === key,
    );
    setSelectedColumns(
      (nextSource?.columns || []).map((column: any) => column.key),
    );
    setFilters([emptyFilter()]);
    setAggregate({ type: "none" });
    setResult(null);
    loadOptions(key);
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns((current) =>
      current.includes(key)
        ? current.filter((column) => column !== key)
        : [...current, key],
    );
  };

  const updateFilter = (index: number, patch: any) => {
    setFilters((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const runPreview = useCallback(async () => {
    if (!sourceKey || !isApiEnabled()) return;
    setRunning(true);
    setError(null);
    try {
      const config = buildConfig();
      if (aggregate.type && aggregate.type !== "none" && !aggregate.groupBy) {
        // count without a group-by collapses to a tabular listing — tell the
        // user instead of silently ignoring the aggregate.
        if (aggregate.type === "count") {
          throw new Error(
            "Pick a group-by dimension for the count aggregate (or choose None to list rows).",
          );
        }
      }
      const res = await reportingApi.runBuilderReport(config);
      setResult(res || null);
    } catch (err: any) {
      setError(err?.message || "Failed to run the report.");
    } finally {
      setRunning(false);
    }
  }, [sourceKey, buildConfig, aggregate]);

  const loadTemplates = useCallback(async () => {
    if (!isApiEnabled()) return;
    try {
      const res = await reportingApi.listReportTemplates();
      setTemplates(Array.isArray(res) ? res : []);
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (isApiEnabled()) {
      loadTemplates();
    }
  }, [loadTemplates]);

  const handleSaveTemplate = useCallback(
    async (event: any) => {
      event.preventDefault();
      if (!templateName.trim() || !sourceKey) return;
      setSaving(true);
      setError(null);
      try {
        await reportingApi.createReportTemplate({
          name: templateName.trim(),
          studyId: templateStudyId || null,
          config: buildConfig(),
        });
        setShowSave(false);
        setTemplateName("");
        await loadTemplates();
      } catch (err: any) {
        setError(err?.message || "Failed to save the template.");
      } finally {
        setSaving(false);
      }
    },
    [templateName, templateStudyId, sourceKey, buildConfig, loadTemplates],
  );

  const handleLoadTemplate = useCallback(
    async (template: any) => {
      const config = template?.config || {};
      setSourceKey(config.source || "");
      setSelectedColumns(config.columns || []);
      setFilters(
        Array.isArray(config.filters) && config.filters.length
          ? config.filters.map((item: any) => ({
              field: item.field || "",
              op: item.op || "eq",
              value: item.value ?? "",
            }))
          : [emptyFilter()],
      );
      setAggregate(
        config.aggregate && config.aggregate.type
          ? {
              type: config.aggregate.type,
              column: config.aggregate.column || "",
              groupBy: config.aggregate.groupBy || "",
            }
          : { type: "none" },
      );
      setResult(null);
      if (config.source) loadOptions(config.source);
    },
    [loadOptions],
  );

  const handleDeleteTemplate = useCallback(
    async (code: string) => {
      try {
        await reportingApi.deleteReportTemplate(code);
        setTemplates((current) =>
          current.filter((template) => template.code !== code),
        );
      } catch (err: any) {
        setError(err?.message || "Failed to delete the template.");
      }
    },
    [],
  );

  const exportResult = useCallback(
    async (format: string) => {
      try {
        await reportingApi.exportReportResult(
          { title: templateName || "custom-report", config: buildConfig() },
          format,
        );
      } catch (err: any) {
        setError(err?.message || `Failed to export ${format.toUpperCase()}.`);
      }
    },
    [buildConfig, templateName],
  );

  const resultColumns = useMemo(() => {
    if (!result) return [];
    return (result.columns || []).map((column: any) => ({
      key: column.key,
      label: column.label,
      render: (value: any) => {
        if (value === null || value === undefined || value === "") return "—";
        if (typeof value === "number") {
          return Number.isInteger(value)
            ? String(value)
            : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
        return String(value);
      },
    }));
  }, [result]);

  if (!isApiEnabled()) {
    return (
      <DashboardLayout>
        <div className="rpt-page">
          <div className="rpt-empty-state">
            <FiBarChart2 size={28} />
            <p>
              The Report Builder needs the backend API configured (
              <code>VITE_API_URL</code>). Start the FastAPI engine and relaunch
              the app in API mode — see SETUP.md §4/§5.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="rpt-page">
        <div className="rpt-header">
          <div>
            <h1>Custom Report Builder</h1>
            <p className="rpt-subtitle">
              Pick a data source, columns, filters and an aggregate, preview the
              result, then save it as a reusable template.
            </p>
          </div>
          <div className="rpt-header-actions">
            <Link to="/reports" className="rpt-btn rpt-btn--ghost">
              <FiBarChart2 size={15} /> Report Center
            </Link>
            {canSave && (
              <button
                type="button"
                className="rpt-btn"
                onClick={() => setShowSave(true)}
              >
                <FiSave size={15} /> Save as template
              </button>
            )}
          </div>
        </div>

        {error && <div className="rpt-error-banner">{error}</div>}

        {loadingCatalog ? (
          <p className="rpt-subtitle">Loading report catalog...</p>
        ) : (
          <div className="rpt-builder">
            {/* ------------------------- configuration ------------------------ */}
            <div className="rpt-builder-form">
              <div className="rpt-field">
                <label>Data source</label>
                <select
                  value={sourceKey}
                  onChange={(e) => handleSourceChange(e.target.value)}
                >
                  {(catalog?.sources || []).map((entry: any) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                {source && (
                  <small className="rpt-small-note">{source.description}</small>
                )}
              </div>

              <div className="rpt-field">
                <label>
                  Columns{" "}
                  {aggregate.type !== "none"
                    ? "(hidden while an aggregate is applied)"
                    : `(${selectedColumns.length} selected)`}
                </label>
                <div
                  className="rpt-filter-list"
                  style={{ maxHeight: "12rem", overflowY: "auto" }}
                >
                  {sourceColumns.map((column: any) => (
                    <label key={column.key} className="rpt-checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(column.key)}
                        disabled={aggregate.type !== "none"}
                        onChange={() => toggleColumn(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* aggregate */}
              <div className="rpt-field">
                <label>Aggregate</label>
                <select
                  value={aggregate.type || "none"}
                  onChange={(e) =>
                    setAggregate({
                      type: e.target.value,
                      column: "",
                      groupBy: "",
                    })
                  }
                >
                  {aggTypes.map((entry: any) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              {aggregate.type && aggregate.type !== "none" && (
                <div className="rpt-field">
                  {aggregate.type === "count" ? (
                    <>
                      <label>Group by</label>
                      <select
                        value={aggregate.groupBy || ""}
                        onChange={(e) =>
                          setAggregate((current: any) => ({
                            ...current,
                            groupBy: e.target.value,
                          }))
                        }
                      >
                        <option value="">— choose a dimension —</option>
                        {groupFields.map((field: string) => (
                          <option key={field} value={field}>
                            {sourceColumns.find((c: any) => c.key === field)
                              ?.label || field}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label>Numeric column</label>
                      <select
                        value={aggregate.column || ""}
                        onChange={(e) =>
                          setAggregate((current: any) => ({
                            ...current,
                            column: e.target.value,
                          }))
                        }
                      >
                        <option value="">— choose a metric —</option>
                        {(metricColumns.length
                          ? metricColumns
                          : sourceColumns
                              .filter((column: any) => column.type === "number")
                              .map((column: any) => column.key)
                        ).map((key: string) => (
                          <option key={key} value={key}>
                            {sourceColumns.find((c: any) => c.key === key)
                              ?.label || key}
                          </option>
                        ))}
                      </select>
                      {metricColumns.length === 0 && (
                        <small className="rpt-small-note">
                          Tip: numeric metrics exist on the “Studies” roll-up
                          source.
                        </small>
                      )}
                      <label style={{ marginTop: "0.5rem" }}>Group by (optional)</label>
                      <select
                        value={aggregate.groupBy || ""}
                        onChange={(e) =>
                          setAggregate((current: any) => ({
                            ...current,
                            groupBy: e.target.value,
                          }))
                        }
                      >
                        <option value="">— none (overall) —</option>
                        {groupFields.map((field: string) => (
                          <option key={field} value={field}>
                            {sourceColumns.find((c: any) => c.key === field)
                              ?.label || field}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              {/* filters */}
              <div className="rpt-field">
                <label>
                  <FiFilter size={13} /> Filters ({filters.length})
                </label>
                <div className="rpt-filter-list">
                  {filters.map((filter, index) => {
                    const datalistId = `rpt-values-${index}`;
                    const valueOptions = options[filter.field] || [];
                    return (
                      <div key={index} className="rpt-filter-row">
                        <select
                          aria-label="Filter field"
                          value={filter.field}
                          onChange={(e) =>
                            updateFilter(index, {
                              field: e.target.value,
                              value: "",
                            })
                          }
                        >
                          <option value="">— field —</option>
                          {filterFields.map((field: string) => (
                            <option key={field} value={field}>
                              {sourceColumns.find((c: any) => c.key === field)
                                ?.label || field}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label="Operator"
                          value={filter.op || "eq"}
                          onChange={(e) =>
                            updateFilter(index, { op: e.target.value })
                          }
                        >
                          {operators.map((op: any) => (
                            <option key={op.key} value={op.key}>
                              {op.label}
                            </option>
                          ))}
                        </select>

                        {filter.op === "between" ? (
                          <div
                            style={{
                              display: "flex",
                              gap: "0.25rem",
                              alignItems: "center",
                            }}
                          >
                            <input
                              aria-label="From"
                              placeholder="From"
                              list={datalistId}
                              value={Array.isArray(filter.value) ? filter.value[0] ?? "" : ""}
                              onChange={(e) =>
                                updateFilter(index, {
                                  value: [
                                    e.target.value,
                                    Array.isArray(filter.value)
                                      ? filter.value[1]
                                      : "",
                                  ],
                                })
                              }
                            />
                            <input
                              aria-label="To"
                              placeholder="To"
                              value={
                                Array.isArray(filter.value) ? filter.value[1] ?? "" : ""
                              }
                              onChange={(e) =>
                                updateFilter(index, {
                                  value: [
                                    Array.isArray(filter.value)
                                      ? filter.value[0]
                                      : "",
                                    e.target.value,
                                  ],
                                })
                              }
                            />
                            <datalist id={datalistId}>
                              {valueOptions.map((value: string) => (
                                <option key={value} value={value} />
                              ))}
                            </datalist>
                          </div>
                        ) : valueOptions.length > 0 ? (
                          <select
                            aria-label="Filter value"
                            value={
                              Array.isArray(filter.value)
                                ? ""
                                : String(filter.value ?? "")
                            }
                            onChange={(e) =>
                              updateFilter(index, { value: e.target.value })
                            }
                          >
                            <option value="">— choose a value —</option>
                            {valueOptions.map((value: string) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input
                              aria-label="Filter value"
                              placeholder="Value"
                              value={
                                Array.isArray(filter.value)
                                  ? filter.value.join(" / ")
                                  : String(filter.value ?? "")
                              }
                              onChange={(e) =>
                                updateFilter(index, { value: e.target.value })
                              }
                            />
                          </>
                        )}

                        <button
                          type="button"
                          title="Remove filter"
                          aria-label="Remove filter"
                          disabled={filters.length === 1}
                          onClick={() =>
                            setFilters((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          className="rpt-btn rpt-btn--ghost rpt-btn--sm"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="rpt-btn rpt-btn--ghost rpt-btn--sm"
                  onClick={() =>
                    setFilters((current) => [
                      ...current,
                      emptyFilter(filterFields[0] || ""),
                    ])
                  }
                >
                  <FiPlus size={13} /> Add condition
                </button>
              </div>

              <button
                type="button"
                className="rpt-btn"
                onClick={runPreview}
                disabled={running || !sourceKey}
              >
                <FiRefreshCw size={15} />
                {running ? "Running..." : "Preview report"}
              </button>

              <small className="rpt-small-note">{AGG_NO_GROUP_HINT}</small>
            </div>

            {/* ---------------------------- preview ---------------------------- */}
            <div>
              {!result ? (
                <div className="rpt-empty-state">
                  <FiBarChart2 size={28} />
                  <p>
                    Configure the report on the left, then press{" "}
                    <strong>Preview report</strong>.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rpt-summary-row">
                    {result.summary?.map((item: any, index: number) => (
                      <span key={index} className="rpt-summary-chip">
                        {item.label}: <strong>{String(item.value ?? "—")}</strong>
                      </span>
                    ))}
                  </div>

                  <div
                    className="rpt-header-actions"
                    style={{ marginBottom: "1rem" }}
                  >
                    {EXPORT_FORMATS.map((format) => (
                      <button
                        key={format.key}
                        type="button"
                        className="rpt-btn rpt-btn--sm"
                        onClick={() => exportResult(format.key)}
                      >
                        <FiDownload size={13} /> {format.label}
                      </button>
                    ))}
                  </div>

                  <DataTable
                    title={result.title || "Preview"}
                    columns={resultColumns}
                    data={result.rows || []}
                    pagination
                    emptyMessage="No rows match the current configuration."
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------ templates ---------------------------- */}
        {!loadingCatalog && (
          <>
            <h2 className="rpt-section-title">
              Saved templates ({templates.length})
            </h2>
            {templates.length === 0 ? (
              <p className="rpt-small-note">
                No saved templates yet{canSave ? " — save this configuration to reuse it." : "."}
              </p>
            ) : (
              <div className="rpt-card-grid">
                {templates.map((template) => (
                  <div key={template.code} className="rpt-card">
                    <h3>{template.name}</h3>
                    <p>
                      Source:{" "}
                      {catalog?.sources?.find(
                        (entry: any) => entry.key === template.source,
                      )?.label || template.source}
                    </p>
                    <div className="rpt-card-footer">
                      <button
                        type="button"
                        className="rpt-btn rpt-btn--ghost rpt-btn--sm"
                        onClick={() => handleLoadTemplate(template)}
                      >
                        <FiRefreshCw size={13} /> Load & run
                      </button>
                      <button
                        type="button"
                        className="rpt-btn rpt-btn--ghost rpt-btn--sm"
                        title="Delete template"
                        onClick={() => handleDeleteTemplate(template.code)}
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* --------------------------- save modal ---------------------------- */}
      {showSave && (
        <div className="rpt-modal-overlay" onClick={() => setShowSave(false)}>
          <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Save report template</h2>
            <form onSubmit={handleSaveTemplate}>
              <label>
                Template name
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Monthly enrollment by site"
                  required
                />
              </label>
              <label>
                Study (optional)
                <input
                  value={templateStudyId}
                  onChange={(e) => setTemplateStudyId(e.target.value)}
                  placeholder="e.g. TNX-E2E-02"
                />
              </label>
              <div className="rpt-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowSave(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rpt-btn"
                  disabled={saving || !templateName.trim()}
                >
                  {saving ? "Saving..." : "Save template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default CustomReportBuilder;
