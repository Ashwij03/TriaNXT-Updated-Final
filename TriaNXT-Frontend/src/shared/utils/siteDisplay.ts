/*
  Shared site display helpers.

  Per REVISED Item 17:
    - Where a Site Name is used as an operational/reference display, show the
      actual Site Number instead (heading "Site Name" becomes "Site").
    - Where a column/field is explicitly named "Site Number", keep it as-is.
    - Site-selection controls should render as:
          SITE-001 — Apollo Clinical Research
      while preserving underlying values/IDs.
    - Missing values must render a safe fallback (—) rather than
      "undefined" / "null".
    - Do NOT fabricate Site Numbers. Do NOT overwrite stored siteName values.

  This module exposes:
    - resolveSiteNumber(reference, options?)   → resolves to Site Number string
    - resolveSiteDisplay(reference, options?)  → resolves to Site Number for
                                                 operational reference display
                                                 (falls back to Site Name, then "—")
    - formatSiteOption(site)                   → "SITE-001 — Apollo Clinical Research"
    - formatSiteLabel(...)                     → LEGACY helper preserved for any
                                                 callers still using it. Now
                                                 returns just the Site Number
                                                 (or Site Name if number is
                                                 unknown) — the cancelled
                                                 "Name (Number)" format is
                                                 no longer produced.
    - MISSING_SITE_DISPLAY constant             → "—"
*/

export const MISSING_SITE_DISPLAY = "—";

function safeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function pickName(site) {
  if (!site || typeof site !== "object") return "";
  return safeString(
    site.siteName ||
      site.name ||
      site.institution ||
      site.site ||
      site.location ||
      ""
  );
}

function pickNumber(site) {
  if (!site || typeof site !== "object") return "";
  return safeString(
    site.siteNumber ||
      site.number ||
      site.siteNo ||
      site.site_number ||
      site.siteCode ||
      ""
  );
}

function pickId(site) {
  if (!site || typeof site !== "object") return "";
  return safeString(site.id || site.siteId || "");
}

function normalize(value) {
  return safeString(value).toLowerCase();
}

/*
  Look up a site record from an authoritative source list, matching
  by any of the fields a caller might have on hand.

  `reference` can be:
    - a string (Site Number, Site Name, or site ID)
    - an object with siteNumber / siteName / id
*/
function findSite(reference, sources) {
  if (!reference || !Array.isArray(sources) || sources.length === 0) {
    return null;
  }

  let refNumber = "";
  let refName = "";
  let refId = "";

  if (typeof reference === "string") {
    refNumber = reference;
    refName = reference;
    refId = reference;
  } else if (typeof reference === "object") {
    refNumber = pickNumber(reference);
    refName = pickName(reference);
    refId = pickId(reference);
  }

  const nNumber = normalize(refNumber);
  const nName = normalize(refName);
  const nId = normalize(refId);

  for (const site of sources) {
    if (!site || typeof site !== "object") continue;

    const sNumber = normalize(pickNumber(site));
    const sName = normalize(pickName(site));
    const sId = normalize(pickId(site));

    if (nNumber && sNumber && sNumber === nNumber) return site;
    if (nId && sId && sId === nId) return site;
    if (nName && sName && sName === nName) return site;
  }

  return null;
}

/*
  Public resolver for callers that need the canonical site record, while still
  using this module's shared Item 17 matching rules and avoiding a parallel
  site lookup implementation.
*/
export function resolveSiteRecord(reference,sources: any = []) {
  return findSite(reference, sources);
}

export function getSiteDisplayName(site) {
  return pickName(site);
}

export function getSiteDisplayNumber(site) {
  return pickNumber(site);
}

/*
  Resolve a reference into an actual Site Number string.

  options:
    - sources: array of authoritative site records to search through
    - fallback: value returned when no Site Number can be resolved
                (defaults to MISSING_SITE_DISPLAY, i.e. "—")
*/
export function resolveSiteNumber(reference,options: any = {}) {
  const { sources = [], fallback = MISSING_SITE_DISPLAY } = options;

  // Direct siteNumber on the reference itself takes priority.
  if (reference && typeof reference === "object") {
    const direct = pickNumber(reference);
    if (direct) return direct;
  }

  // Strings that already look like a Site Number (e.g. "SITE-001").
  if (typeof reference === "string" && /^\s*SITE[-_ ]?\d+/i.test(reference)) {
    return safeString(reference);
  }

  const match = findSite(reference, sources);
  if (match) {
    const number = pickNumber(match);
    if (number) return number;
  }

  return fallback;
}

/*
  Resolve a reference into the display value used wherever a Site Name
  previously served as an operational reference. Prefers Site Number;
  if no Site Number is knowable, falls back to a resolved Site Name;
  otherwise "—".
*/
export function resolveSiteDisplay(reference,options: any = {}) {
  const { sources = [], fallback = MISSING_SITE_DISPLAY } = options;

  const number = resolveSiteNumber(reference, { sources, fallback: "" });
  if (number) return number;

  if (reference && typeof reference === "object") {
    const name = pickName(reference);
    if (name) return name;
  }

  const match = findSite(reference, sources);
  if (match) {
    const name = pickName(match);
    if (name) return name;
  }

  if (typeof reference === "string" && reference.trim()) {
    return safeString(reference);
  }

  return fallback;
}

/*
  Build the "SITE-001 — Apollo Clinical Research" label used by
  site-selection controls. Any missing piece is silently dropped so
  the label never renders parentheses around undefined.
*/
export function formatSiteOption(site) {
  const name = pickName(site);
  const number = pickNumber(site);

  if (number && name) return `${number} — ${name}`;
  if (number) return number;
  if (name) return name;
  return "";
}

/*
  LEGACY helper. The old "Site Name (Site Number)" format has been
  cancelled by REVISED Item 17. Callers that still import this helper
  now receive just the Site Number (preferred) or the Site Name when
  no Site Number is available.
*/
export function formatSiteLabel(siteOrName, maybeNumber?) {
  let name = "";
  let number = "";

  if (typeof siteOrName === "string") {
    name = siteOrName;
    number = maybeNumber == null ? "" : String(maybeNumber);
  } else {
    name = pickName(siteOrName);
    number = pickNumber(siteOrName);
  }

  name = safeString(name);
  number = safeString(number);

  if (number) return number;
  if (name) return name;
  return "";
}

export default resolveSiteDisplay;
