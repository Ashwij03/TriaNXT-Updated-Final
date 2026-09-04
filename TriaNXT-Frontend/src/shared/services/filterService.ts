// Cascading header filters — indication drives studies, sites, and subjects.

import { getStudies } from "./studyService";
import { getAllSubjects } from "./subjectService";
import {
  getAccessibleSites,
  getAccessibleStudies,
  getAssignedSite,
  getCurrentUser,
  getStudiesForSite,
  isAdmin
} from "./roleService";
import {
  getStoredCROFilter,
  getStoredIndicationFilter,
  getStoredInstitutionFilter,
  getStoredSiteNumberFilter,
  getStoredSponsorFilter,
  getStoredStudyFilter
} from "../constants/headerFilters";

const DEFAULT_CROS = ["IQVIA", "PPD", "Syneos Health", "TriaNXT CRO"];
const DEFAULT_SPONSORS = [
  "TriaNXT Research",
  "Abbott Laboratories",
  "Intercept Pharmaceuticals"
];

/**
 * Subject data access via subjectService — the single source of truth.
 */
function readSubjectsByStudy() {
  try {
    // Use getAllSubjects() from subjectService which handles cross-checking
    const all = getAllSubjects();
    // Rebuild bucket map for backward compatibility with existing filter logic
    const bucketMap: Record<string, any> = {};;
    all.forEach((subject) => {
      const studyId = subject.studyId;
      if (!studyId) return;
      if (!bucketMap[studyId]) bucketMap[studyId] = [];
      bucketMap[studyId].push(subject);
    });
    return bucketMap;
  } catch {
    return {};
  }
}

function normalizeStudy(study) {
  return {
    ...study,
    indication: study.indication || "General",
    sponsor: study.sponsor || "TriaNXT Research",
    cro: study.cro || "TriaNXT CRO",
    site: study.site || study.location || "",
    country: study.country || ""
  };
}

function getBaseStudies(user = getCurrentUser()) {
  const studies = (isAdmin(user) ? getStudies() : getAccessibleStudies(user)).map(
    normalizeStudy
  );

  return studies;
}

function filterStudies(studies, filters, user = getCurrentUser()) {
  let result = studies;

  if (filters.indication) {
    result = result.filter(
      (study) => study.indication === filters.indication
    );
  }

  if (filters.sponsor) {
    result = result.filter((study) => study.sponsor === filters.sponsor);
  }

  if (filters.cro) {
    result = result.filter((study) => study.cro === filters.cro);
  }

  // Site Name and Site Number both describe the same institution, so
  // whichever one was actually selected should narrow the studies. If only
  // a Site Number was picked, resolve it back to its institution name via
  // the shared directory before filtering.
  const effectiveInstitution =
    filters.institution || getInstitutionForSiteNumber(filters.siteNumber, user);

  if (effectiveInstitution) {
    result = result.filter((study) => {
      const site = study.site || study.location || "";
      return (
        site === effectiveInstitution ||
        site.includes(effectiveInstitution) ||
        effectiveInstitution.includes(site)
      );
    });
  }

  if (filters.studyCode) {
    result = result.filter(
      (study) => String(study.code) === String(filters.studyCode)
    );
  }

  return result;
}

// Resolves the institution name paired with a given Site Number, and vice
// versa, using the same stable directory getSiteNumberOptions/
// getInstitutionOptions are built from. This is what lets selecting either
// field in the header filter show the correct value in the other.
export function getInstitutionForSiteNumber(siteNumber, user = getCurrentUser()) {
  if (!siteNumber) {
    return "";
  }

  const entry = getSiteNumberDirectory(user).find(
    (candidate) => String(candidate.number) === String(siteNumber)
  );

  return entry ? entry.name : "";
}

export function getSiteNumberForInstitution(institution, user = getCurrentUser()) {
  if (!institution) {
    return "";
  }

  const directory = getSiteNumberDirectory(user);
  const entry =
    directory.find((candidate) => candidate.name === institution) ||
    directory.find(
      (candidate) =>
        candidate.name.includes(institution) || institution.includes(candidate.name)
    );

  return entry ? entry.number : "";
}

export function getFilterState() {
  return {
    indication: getStoredIndicationFilter(),
    sponsor: getStoredSponsorFilter(),
    cro: getStoredCROFilter(),
    institution: getStoredInstitutionFilter(),
    siteNumber: getStoredSiteNumberFilter(),
    studyCode: getStoredStudyFilter()
  };
}

export function getIndicationOptions(user = getCurrentUser()) {
  const indications = [
    ...new Set<any>(getBaseStudies(user).map((study) => study.indication))
  ];

  return indications.sort().map((value) => ({ value, label: value }));
}

export function getSponsorOptions(user = getCurrentUser()) {
  const filters = getFilterState();
  const fromStudies = [
    ...new Set<any>(
      filterStudies(getBaseStudies(user), filters).map((study) => study.sponsor)
    )
  ];
  const merged = [...new Set<any>([...fromStudies, ...DEFAULT_SPONSORS])];

  return merged.sort().map((value) => ({ value, label: value }));
}

export function getCROOptions(user = getCurrentUser()) {
  const filters = getFilterState();
  const fromStudies = [
    ...new Set<any>(
      filterStudies(getBaseStudies(user), filters).map((study) => study.cro)
    )
  ];
  const merged = [...new Set<any>([...fromStudies, ...DEFAULT_CROS])];

  return merged.sort().map((value) => ({ value, label: value }));
}

export function getRecruitedCROOptions(user = getCurrentUser()) {
  const studies = getBaseStudies(user);
  const sponsorName = user?.orgType || user?.sponsor || "TriaNXT Research";
  const recruited = [
    ...new Set<any>(
      studies
        .filter(
          (study) =>
            study.sponsor === sponsorName &&
            study.cro &&
            study.cro !== "TriaNXT CRO"
        )
        .map((study) => study.cro)
    )
  ];

  try {
    const stored = JSON.parse(localStorage.getItem("sponsorRecruitedCROs") || "[]");
    stored.forEach((cro) => {
      if (cro && !recruited.includes(cro)) {
        recruited.push(cro);
      }
    });
  } catch {
    /* ignore */
  }

  return recruited.sort().map((value) => ({ value, label: value }));
}

// Task: Header Indication Site Scoping — once an Indication is selected in
// the header, Site Name and Site Number should only list sites that
// actually run a study under that indication (studies elsewhere in the
// portfolio, at other sites, shouldn't clutter either dropdown). Computed
// from Indication alone — never combined with whatever Site Name/Site
// Number/Study/etc. happens to already be selected — so this narrowing
// never reintroduces the Task 9 bug where Site Name and Site Number ended
// up pruning each other's option list.
function getIndicationScopedSiteNames(user, indication) {
  if (!indication) {
    return null;
  }

  return new Set<any>(
    getBaseStudies(user)
      .filter((study) => study.indication === indication)
      .map((study) => study.site)
      .filter(Boolean)
  );
}

export function getInstitutionOptions(user = getCurrentUser()) {
  const filters = getFilterState();
  const studies = filterStudies(getBaseStudies(user), filters, user);
  const studySites = [...new Set<any>(studies.map((study) => study.site).filter(Boolean))];
  const accessibleSites = getAccessibleSites(user).map((site) => site.name);

  // Task 9 (Header Site Filters Bug): this list must always show every
  // Site Name the user has access to, regardless of whichever Site
  // Number is currently selected. It used to collapse down to just the
  // one matching institution once a Site Number was picked, which made
  // every other Site Name disappear from the dropdown. The selected
  // Site Number is still reflected via the dropdown's own selected
  // value/highlight — the available option list itself is never pruned.
  let merged = [...new Set<any>([...studySites, ...accessibleSites])];

  // Task: Header Indication Site Scoping (see helper above).
  const indicationSites = getIndicationScopedSiteNames(user, filters.indication);

  if (indicationSites) {
    merged = merged.filter((site) => indicationSites.has(site));
  }

  merged = merged.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );

  return [
    { value: "", label: "All Institutions" },
    ...merged.map((value) => ({ value, label: value }))
  ];
}

// Institutions in this app aren't backed by a real "sites" table that a Site
// Number is ever entered into — institution names only ever come from what's
// typed on a Study's Site/Hospital field or a user's Organization Type. This
// builds the Site Number <-> Site Name pairing everywhere else in the app
// already assumes exists, deriving one stable "SITE-00N" per distinct
// institution name (alphabetical order keeps the numbering the same across
// renders/sessions) while still honoring a real siteNumber if one was ever
// entered directly on a study.
export function getSiteNumberDirectory(user = getCurrentUser()) {
  const studies = getBaseStudies(user);
  const accessibleSites = getAccessibleSites(user);

  const studySiteNames = studies.map((study) => study.site).filter(Boolean);
  const accessibleSiteNames = accessibleSites
    .map((site) => site.name)
    .filter(Boolean);

  const siteNames = [
    ...new Set<any>([...studySiteNames, ...accessibleSiteNames])
  ].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );

  return siteNames.map((name, index) => {
    const matchedStudy = studies.find(
      (study) => study.site === name && (study.siteNumber || study.siteNo)
    );
    const matchedAccessibleSite = accessibleSites.find(
      (site) => site.name === name && (site.siteNumber || site.id)
    );

    const number =
      matchedStudy?.siteNumber ||
      matchedStudy?.siteNo ||
      matchedAccessibleSite?.siteNumber ||
      matchedAccessibleSite?.id ||
      `SITE-${String(index + 1).padStart(3, "0")}`;

    return { number: String(number), name };
  });
}

export function getSiteNumberOptions(user = getCurrentUser()) {
  // Task 9 (Header Site Filters Bug): always list every Site Number the
  // user has access to, regardless of whichever Site Name is currently
  // selected. This used to filter the directory down to only the entry
  // matching the selected institution, which hid every other Site Number
  // from the dropdown as soon as a Site Name was picked.
  //
  // getSiteNumberDirectory() itself stays unfiltered (its numbering is
  // derived alphabetically across every site, so it must never be
  // regenerated from a narrowed subset or "SITE-002" could turn into
  // "SITE-001" depending on which filters happen to be active). Only the
  // *options list* built from it is narrowed here.
  const directory = getSiteNumberDirectory(user);

  // Task: Header Indication Site Scoping (see getIndicationScopedSiteNames
  // in getInstitutionOptions above) — once an Indication is selected, only
  // list Site Numbers whose Site Name actually runs a study under it.
  const filters = getFilterState();
  const indicationSites = getIndicationScopedSiteNames(user, filters.indication);
  const scopedDirectory = indicationSites
    ? directory.filter((entry) => indicationSites.has(entry.name))
    : directory;

  return [
    { value: "", label: "All Site Numbers" },
    ...scopedDirectory
      .map((entry) => ({
        value: entry.number,
        label: entry.number
      }))
      .sort((a, b) =>
        String(a.value).localeCompare(String(b.value), undefined, {
          numeric: true,
          sensitivity: "base"
        })
      )
  ];
}

export function getStudyOptions(user = getCurrentUser()) {
  const filters = getFilterState();

  // Task: Study Filter Site-Only Gating — Study options now only ever
  // populate once a specific Site Number or Site Name (Institution) is
  // selected in the header. Indication/Sponsor/CRO alone are no longer
  // enough to unlock this list on their own — they still narrow the
  // eventual set of studies once a site is picked (see filterStudies
  // below), same as before.
  const effectiveInstitution =
    filters.institution || getInstitutionForSiteNumber(filters.siteNumber, user);

  if (!effectiveInstitution) {
    return [];
  }

  let studies = filterStudies(getBaseStudies(user), filters, user);

  if (effectiveInstitution && isAdmin(user)) {
    studies = getStudiesForSite(effectiveInstitution).map(normalizeStudy);
    studies = filterStudies(studies, { ...filters, institution: "" }, user);
  }

  return studies
    .sort((a, b) =>
      String(a.code).localeCompare(String(b.code), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    )
    .map((study) => ({
      value: study.code,
      label: study.code
    }));
}

export function getSubjectOptions(user = getCurrentUser()) {
  const filters = getFilterState();

  // Task: Subject Filter Site+Study Gating — Subject options now only
  // populate once *both* a Site Number/Site Name and a specific Study are
  // selected in the header. Indication/Sponsor/CRO alone are not enough,
  // and neither is a site on its own without a Study picked too.
  const effectiveInstitution =
    filters.institution || getInstitutionForSiteNumber(filters.siteNumber, user);

  if (!effectiveInstitution || !filters.studyCode) {
    return [];
  }

  const studies = filterStudies(getBaseStudies(user), filters, user);
  const studyCodes = new Set<any>(studies.map((study) => String(study.code)));
  const subjectsByStudy = readSubjectsByStudy();

  const subjects = Object.entries(subjectsByStudy).flatMap(([studyKey, list]) => {
    if (String(studyKey) !== String(filters.studyCode)) {
      return [];
    }

    if (studyCodes.size && !studyCodes.has(String(studyKey))) {
      return [];
    }

    return (Array.isArray(list) ? list : []).map((subject) => ({
      value: String(subject.subjectId || subject.id),
      label: String(subject.subjectId || subject.id),
      studyKey
    }));
  });

  return subjects.sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

export function getDefaultInstitution(user = getCurrentUser()) {
  return getStoredInstitutionFilter() || getAssignedSite(user) || "";
}

export function getFilteredStudies(user = getCurrentUser()) {
    return filterStudies(
        getBaseStudies(user),
        getFilterState(),
        user
    );
}