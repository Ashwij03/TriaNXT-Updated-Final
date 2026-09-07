/**
 * reportingApi — Custom Report Builder / Standard Report Center +
 * Financials & Milestones (Varsha's scope on the TriaNXT CTMS project).
 *
 * Mirrors the FastAPI surface under `tria_engine/apps/reporting/`:
 *
 *   Reports:
 *     GET  /api/reports/catalog
 *     GET  /api/reports/options?source=
 *     POST /api/reports/run
 *     GET  /api/reports/standard            (list)
 *     GET  /api/reports/standard/{key}      (run one)
 *     GET  /api/reports/standard/{key}/export?format=csv|xlsx|pdf
 *     POST /api/reports/export              (export an arbitrary run)
 *     GET/POST/PUT/DELETE /api/reports/templates
 *
 *   Finance / Milestones:
 *     GET  /api/finance/summary
 *     GET/POST /api/finance/budgets | PATCH /api/finance/budgets/{code}
 *     GET/POST /api/finance/invoices | POST .../issue | .../pay
 *     GET/POST /api/finance/payouts | POST .../approve | .../reject | .../pay
 *     GET/POST /api/milestones | PATCH /api/milestones/{code}/status
 *
 * Binary downloads (csv/xlsx/pdf) are fetched as blobs with the session
 * cookie (`credentials: "include"`), then saved through an <a download> —
 * the shared apiFetch wrapper would stringify the response body.
 */
import api, { getApiBaseUrl } from "./client";

/* --------------------------------- reports -------------------------------- */

export function getReportCatalog() {
  // => { sources, aggregates, operators, standard }
  return api.get("/api/reports/catalog");
}

export function getReportOptions(source: string) {
  // => { source, options: { <filterField>: [distinct values] } }
  return api.get("/api/reports/options", { query: { source } });
}

export function runBuilderReport(config: any) {
  // config: { source, columns[], filters[], aggregate, limit }
  return api.post("/api/reports/run", config);
}

export function listStandardReports() {
  // => { reports: [...] }
  return api.get("/api/reports/standard");
}

export function runStandardReport(key: string, params: any = {}) {
  // params: { study?, site? }
  return api.get(`/api/reports/standard/${encodeURIComponent(key)}`, {
    query: params,
  });
}

export function exportStandardReport(
  key: string,
  format: string,
  params: any = {}
) {
  // CSV / XLSX / PDF file download for one of the five standard reports.
  return downloadBlob(
    `/api/reports/standard/${encodeURIComponent(key)}/export`,
    { format, ...params },
    `${key}.${format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"}`
  );
}

export function exportReportResult(result: any, format: string) {
  // POST /api/reports/export — either { standard: {...} } or { config: {...} }
  const { title, standard, config } = result || {};
  return downloadBlob(
    "/api/reports/export",
    { format },
    `${(title || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}.${format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"}`,
    { method: "POST", body: { format, title, standard, config } }
  );
}

/* ------------------------------- templates -------------------------------- */

export function listReportTemplates() {
  return api.get("/api/reports/templates");
}

export function getReportTemplate(code: string) {
  return api.get(`/api/reports/templates/${encodeURIComponent(code)}`);
}

export function createReportTemplate(payload: any) {
  // payload: { name, studyId?, config }
  return api.post("/api/reports/templates", payload);
}

export function updateReportTemplate(code: string, payload: any) {
  return api.put(`/api/reports/templates/${encodeURIComponent(code)}`, payload);
}

export function deleteReportTemplate(code: string) {
  return api.delete(`/api/reports/templates/${encodeURIComponent(code)}`);
}

/* --------------------------------- finance -------------------------------- */

export function getFinanceSummary(params: any = {}) {
  // params: { studyId?, siteId? }
  // => { summary, budgets, invoices, payouts, milestones, completion,
  //      spendByStudy, spendBySite }
  return api.get("/api/finance/summary", { query: params });
}

export function listBudgets(params: any = {}) {
  return api.get("/api/finance/budgets", { query: params });
}

export function createBudget(payload: any) {
  return api.post("/api/finance/budgets", payload);
}

export function updateBudget(code: string, payload: any) {
  return api.patch(`/api/finance/budgets/${encodeURIComponent(code)}`, payload);
}

export function listInvoices(params: any = {}) {
  return api.get("/api/finance/invoices", { query: params });
}

export function createInvoice(payload: any) {
  return api.post("/api/finance/invoices", payload);
}

export function issueInvoice(code: string) {
  return api.post(`/api/finance/invoices/${encodeURIComponent(code)}/issue`);
}

export function payInvoice(code: string) {
  return api.post(`/api/finance/invoices/${encodeURIComponent(code)}/pay`);
}

export function listPayouts(params: any = {}) {
  return api.get("/api/finance/payouts", { query: params });
}

export function createPayout(payload: any) {
  return api.post("/api/finance/payouts", payload);
}

export function approvePayout(code: string) {
  return api.post(`/api/finance/payouts/${encodeURIComponent(code)}/approve`);
}

export function rejectPayout(code: string) {
  return api.post(`/api/finance/payouts/${encodeURIComponent(code)}/reject`);
}

export function payPayout(code: string) {
  return api.post(`/api/finance/payouts/${encodeURIComponent(code)}/pay`);
}

/* ------------------------------- milestones ------------------------------- */

export function getMilestones(params: any = {}) {
  // params: { studyId?, siteId? } => { milestones, completion }
  return api.get("/api/milestones", { query: params });
}

export function createMilestone(payload: any) {
  return api.post("/api/milestones", payload);
}

export function updateMilestoneStatus(code: string, status: string) {
  return api.patch(`/api/milestones/${encodeURIComponent(code)}/status`, {
    status,
  });
}

/* ------------------------- credentialed file download --------------------- */

/**
 * Fetch a backend file endpoint with the session cookie and save it locally
 * as a blob (works for csv/xlsx/pdf without corrupting binary content).
 */
async function downloadBlob(
  path: string,
  query: any = {},
  filename: string,
  init: any = {}
) {
  const url = new URL(getApiBaseUrl() + path);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const { method = "GET", body } = init;
  // A JSON body must be declared as such: fetch() otherwise falls back to
  // `text/plain;charset=UTF-8` and FastAPI skips JSON parsing (schema 400).
  const headers: Record<string, string> = { Accept: "*/*" };
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url.toString(), {
    method,
    headers,
    credentials: "include",
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Download failed with status ${res.status}`;
    try {
      const parsed = await res.json();
      message = parsed?.message || parsed?.detail || message;
    } catch {
      /* non-JSON error body — keep default message */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a beat before revoking the object URL.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  return { ok: true, filename };
}

const reportingApi = {
  getReportCatalog,
  getReportOptions,
  runBuilderReport,
  listStandardReports,
  runStandardReport,
  exportStandardReport,
  exportReportResult,
  listReportTemplates,
  getReportTemplate,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  getFinanceSummary,
  listBudgets,
  createBudget,
  updateBudget,
  listInvoices,
  createInvoice,
  issueInvoice,
  payInvoice,
  listPayouts,
  createPayout,
  approvePayout,
  rejectPayout,
  payPayout,
  getMilestones,
  createMilestone,
  updateMilestoneStatus,
};

export default reportingApi;
