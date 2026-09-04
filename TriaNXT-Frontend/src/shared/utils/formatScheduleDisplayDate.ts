/**
 * Display-only formatter for scheduled visit dates.
 * Preserves the authoritative datetime in source data; strips time at the UI boundary.
 */
export function formatScheduleDisplayDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const raw = String(dateValue).trim();
  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = isoDateMatch
    ? new Date(
        Number(isoDateMatch[1]),
        Number(isoDateMatch[2]) - 1,
        Number(isoDateMatch[3])
      )
    : new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const withoutTime = raw.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)?/i, "");

  return withoutTime || raw;
}
