/*
  Per-study Financials persistence.

  Mirrors the localStorage pattern used by studyService.js. All financial
  records (budgets, payments, receivables, invoices, subject costs) are
  stored per-study under a single key so multiple studies do not share
  seed data.

  Storage shape:
    {
      [studyId]: {
        budgets: [],
        payments: [],
        receivables: [],
        invoices: [],
        subjectCosts: []
      }
    }
*/

const FINANCIALS_STORAGE_KEY = "trianxtFinancials";

const EMPTY_STUDY_FINANCIALS = Object.freeze({
  budgets: [],
  payments: [],
  receivables: [],
  invoices: [],
  subjectCosts: [],
});

const SECTION_KEYS = [
  "budgets",
  "payments",
  "receivables",
  "invoices",
  "subjectCosts",
];

function isBrowser() {
  return typeof window !== "undefined";
}

function readAll() {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = localStorage.getItem(FINANCIALS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  if (!isBrowser()) {
    return;
  }

  try {
    localStorage.setItem(FINANCIALS_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("financials-updated"));
  } catch {
    /* ignore quota / serialization errors */
  }
}

function normalizeStudyId(studyId) {
  if (studyId == null) {
    return "";
  }
  return String(studyId).trim();
}

function ensureShape(record) {
  const safe = record && typeof record === "object" ? record : {};

  const shaped: Record<string, any> = {};;
  SECTION_KEYS.forEach((key) => {
    shaped[key] = Array.isArray(safe[key]) ? safe[key] : [];
  });

  return shaped;
}

export function getStudyFinancials(studyId) {
  const key = normalizeStudyId(studyId);
  if (!key) {
    return { ...EMPTY_STUDY_FINANCIALS };
  }

  const all = readAll();
  return ensureShape(all[key]);
}

export function saveStudyFinancials(studyId, record) {
  const key = normalizeStudyId(studyId);
  if (!key) {
    return;
  }

  const all = readAll();
  all[key] = ensureShape(record);
  writeAll(all);
}

export function updateStudyFinancialsSection(studyId, section, items) {
  const key = normalizeStudyId(studyId);
  if (!key || !SECTION_KEYS.includes(section)) {
    return;
  }

  const all = readAll();
  const current = ensureShape(all[key]);
  current[section] = Array.isArray(items) ? items : [];
  all[key] = current;
  writeAll(all);
}

export function clearStudyFinancials(studyId) {
  const key = normalizeStudyId(studyId);
  if (!key) {
    return;
  }

  const all = readAll();
  if (all[key]) {
    delete all[key];
    writeAll(all);
  }
}

export const FINANCIAL_SECTION_KEYS = SECTION_KEYS;
export const FINANCIAL_EMPTY_RECORD = EMPTY_STUDY_FINANCIALS;
