/**
 * Subject Explorer - ADVANCED FILE FILTERS (Phase 6)
 * ==================================================
 *
 * Pure predicate layer for the three Phase 6 filter dimensions:
 *
 *   - file type      (by type label: PDF, DOCX, XLSX, ...)
 *   - uploaded date  (relative windows: today / 7d / 30d / 90d / this year)
 *   - file size      (coarse buckets: small / medium / large / very large)
 *
 * Kept separate from `fileService` so Phase 4's search/sort contract is not
 * touched. The composition order is deliberate and matches what the user
 * sees in the toolbar:
 *
 *     folder files -> advanced filters -> text search -> sort
 *
 * Filtering before search means the "N of M" counter reports matches within
 * the active filter set, which is what the count badge claims.
 *
 * Everything is a pure function of its inputs, so these helpers are safe to
 * call during render and trivially unit-testable.
 */

import { getExtension, getFileTypeLabel } from "./fileTypes";

/* ==================================================================
   OPTION DEFINITIONS
   Each option carries its own predicate so views only ever map over
   these arrays - adding a bucket never means touching a component.
================================================================== */

export const ANY = "any";

/** Relative uploaded-date windows, measured in days back from now. */
export const DATE_OPTIONS = [
  { value: ANY, label: "Any time", days: null },
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "year", label: "This year", days: null },
];

const KB = 1024;
const MB = KB * 1024;

/**
 * Size buckets as inclusive-min / exclusive-max byte ranges.
 * `max: null` means unbounded.
 */
export const SIZE_OPTIONS = [
  { value: ANY, label: "Any size", min: 0, max: null },
  { value: "small", label: "Small (< 100 KB)", min: 0, max: 100 * KB },
  { value: "medium", label: "Medium (100 KB – 1 MB)", min: 100 * KB, max: MB },
  { value: "large", label: "Large (1 – 5 MB)", min: MB, max: 5 * MB },
  { value: "xlarge", label: "Very large (> 5 MB)", min: 5 * MB, max: null },
];

/** The neutral filter state - nothing narrowed. */
export const DEFAULT_FILTERS = {
  type: ANY,
  date: ANY,
  size: ANY,
};

/* ==================================================================
   OPTION BUILDERS
================================================================== */

/**
 * Type options derived from the files actually present, each with its own
 * count.
 *
 * Deriving from the data (rather than listing every supported extension)
 * keeps the dropdown short and means a user never picks a type that would
 * return nothing.
 */
export function buildTypeOptions(files) {
  const counts = new Map();

  (files || []).forEach((file) => {
    const label = getFileTypeLabel(file.name);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const options = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({
      value: label,
      label: `${label} (${count})`,
      count,
    }));

  return [
    { value: ANY, label: "All types", count: (files || []).length, empty: false },
    /* Derived from the data, so a listed type always has at least one match -
       `empty` is carried anyway so all three dropdowns share one option
       contract and the view needs no per-dimension special-casing. */
    ...options.map((option) => ({ ...option, empty: false })),
  ];
}

/**
 * Date options for the files actually present, each with its own count.
 *
 * `buildTypeOptions` has always derived its list from the data, so the type
 * dropdown can never offer a choice that returns nothing. Date and size were
 * fixed lists, which meant a folder whose newest file is months old still
 * offered "Today" / "Last 7 days" - picking one emptied the table and looked
 * like the filter was broken rather than correctly reporting "no matches".
 *
 * The window itself is never removed (the set of windows is meaningful even
 * when one is empty); each option now carries `count` and `empty` so the view
 * can show the number and disable the dead ones. `now` is injectable to keep
 * the function pure and testable.
 */
export function buildDateOptions(files, now = new Date()) {
  const list = files || [];

  return DATE_OPTIONS.map((option) => {
    const count =
      option.value === ANY
        ? list.length
        : list.filter((file) => matchesDate(file, option.value, now)).length;

    return {
      ...option,
      count,
      empty: count === 0 && option.value !== ANY,
      label: option.value === ANY ? option.label : `${option.label} (${count})`,
    };
  });
}

/** Size options with live counts, on the same contract as the date options. */
export function buildSizeOptions(files) {
  const list = files || [];

  return SIZE_OPTIONS.map((option) => {
    const count =
      option.value === ANY
        ? list.length
        : list.filter((file) => matchesSize(file, option.value)).length;

    return {
      ...option,
      count,
      empty: count === 0 && option.value !== ANY,
      label: option.value === ANY ? option.label : `${option.label} (${count})`,
    };
  });
}

/* ==================================================================
   PREDICATES
================================================================== */

/** Start-of-day boundary `days` back from `now` (today => start of today). */
function dateFloor(days, now = new Date()) {
  const floor = new Date(now);
  floor.setHours(0, 0, 0, 0);
  floor.setDate(floor.getDate() - (days - 1));
  return floor;
}

export function matchesType(file, value) {
  if (!value || value === ANY) return true;
  return getFileTypeLabel(file.name) === value;
}

/**
 * Uploaded-date match.
 *
 * Records with an unparseable date are treated as non-matching for any
 * specific window, so a corrupt value cannot masquerade as recent.
 */
export function matchesDate(file, value, now = new Date()) {
  if (!value || value === ANY) return true;

  const option = DATE_OPTIONS.find((entry) => entry.value === value);
  if (!option) return true;

  const stamp = new Date(file.uploadedAt).getTime();
  if (!Number.isFinite(stamp)) return false;

  if (option.value === "year") {
    return new Date(stamp).getFullYear() === now.getFullYear();
  }

  return stamp >= dateFloor(option.days, now).getTime();
}

export function matchesSize(file, value) {
  if (!value || value === ANY) return true;

  const option = SIZE_OPTIONS.find((entry) => entry.value === value);
  if (!option) return true;

  const size = Number(file.size) || 0;

  return size >= option.min && (option.max === null || size < option.max);
}

/**
 * Apply all three filters at once.
 *
 * Returns the original array untouched when no filter is active, so the
 * common case adds no allocation.
 */
export function applyFilters(files, filters = DEFAULT_FILTERS, now = new Date()) {
  const { type = ANY, date = ANY, size = ANY } = filters || {};

  if (type === ANY && date === ANY && size === ANY) return files || [];

  return (files || []).filter(
    (file) =>
      matchesType(file, type) &&
      matchesDate(file, date, now) &&
      matchesSize(file, size)
  );
}

/** How many dimensions are currently narrowed (drives the "Clear (n)" pill). */
export function countActiveFilters(filters = DEFAULT_FILTERS) {
  const { type = ANY, date = ANY, size = ANY } = filters || {};
  return [type, date, size].filter((value) => value && value !== ANY).length;
}

export function hasActiveFilters(filters) {
  return countActiveFilters(filters) > 0;
}

/**
 * Drop any filter value that no longer exists among the current options.
 *
 * The type options are derived from the folder's files, so deleting the last
 * PDF while `type: "PDF"` was selected left a `<select>` whose value matched no
 * `<option>`. Browsers then paint the first option ("All types") while the
 * state still filtered on PDF - the table showed zero rows and the control
 * disagreed with it. Date and size are fixed lists, so only `type` can go
 * stale, but all three are checked so this keeps holding if the lists change.
 *
 * Returns the same object when nothing is stale, so callers can use the result
 * as a `setState` guard without causing a render loop.
 */
export function reconcileFilters(filters = DEFAULT_FILTERS,files: any = []) {
  const current = { ...DEFAULT_FILTERS, ...(filters || {}) };

  const valid = {
    type: buildTypeOptions(files).map((option) => option.value),
    date: DATE_OPTIONS.map((option) => option.value),
    size: SIZE_OPTIONS.map((option) => option.value),
  };

  let changed = false;
  const next = { ...current };

  Object.keys(valid).forEach((key) => {
    if (current[key] !== ANY && !valid[key].includes(current[key])) {
      next[key] = ANY;
      changed = true;
    }
  });

  return changed ? next : filters;
}

/** Short human summary of the active filters, e.g. `PDF · Last 7 days`. */
export function describeFilters(filters = DEFAULT_FILTERS) {
  const { type = ANY, date = ANY, size = ANY } = filters || {};
  const parts = [];

  if (type !== ANY) parts.push(type);
  if (date !== ANY) {
    parts.push(DATE_OPTIONS.find((o) => o.value === date)?.label || date);
  }
  if (size !== ANY) {
    parts.push(SIZE_OPTIONS.find((o) => o.value === size)?.label || size);
  }

  return parts.join(" · ");
}

/** Extension helper re-exported so views need only one filter import. */
export { getExtension };

const FileFilterService = {
  ANY,
  DATE_OPTIONS,
  SIZE_OPTIONS,
  DEFAULT_FILTERS,
  buildTypeOptions,
  buildDateOptions,
  buildSizeOptions,
  reconcileFilters,
  matchesType,
  matchesDate,
  matchesSize,
  applyFilters,
  countActiveFilters,
  hasActiveFilters,
  describeFilters,
};

export default FileFilterService;
