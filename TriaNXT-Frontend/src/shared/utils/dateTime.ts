/**
 * Shared UTC Date/Time Formatters
 * ================================
 *
 * All file/folder/audit timestamps in the app MUST be displayed in UTC
 * to avoid timezone-related inconsistencies across users in different
 * locations. These utilities use getUTC* methods exclusively.
 *
 * DO NOT use toLocaleString/toLocaleDateString/getHours()/getMinutes()
 * for file/folder timestamps — always import from this module instead.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format an ISO date string as "02-Sep-2026" in UTC.
 * Returns "—" for invalid/missing dates.
 *
 * @param {string} iso  ISO 8601 date string
 * @returns {string}
 */
export function formatDateUTC(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return `${String(date.getUTCDate()).padStart(2, "0")}-${MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

/**
 * Format an ISO date string as "02-Sep-2026, 09:57 UTC" in UTC.
 * Returns "—" for invalid/missing dates.
 *
 * @param {string} iso  ISO 8601 date string
 * @returns {string}
 */
export function formatDateTimeUTC(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return `${formatDateUTC(iso)}, ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
}
