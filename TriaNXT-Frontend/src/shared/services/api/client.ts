/**
 * TriaNXT API client.
 *
 * Thin fetch wrapper used by every `*Api` module. It centralises:
 *   - base URL from VITE_API_URL (e.g. http://localhost:4000/api/v1)
 *   - the platform API key from VITE_API_KEY  -> sent as `X-API-Key`
 *   - the per-user JWT (set at login)              -> sent as `Authorization: Bearer <token>`
 *   - JSON request/response handling + a typed ApiError
 *   - S3 presigned-URL upload/download helpers (binaries go straight to S3;
 *     the DB only stores bucket + key + metadata)
 *
 * The client is intentionally dependency-free (uses window.fetch) so it works
 * in the CRA build without extra packages.
 */

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_KEY = import.meta.env.VITE_API_KEY || "";

export const TOKEN_STORAGE_KEY = "trianxtAuthToken";

/** True when a backend base URL is configured. Services use this to decide
 *  whether to call the API or fall back to localStorage. */
export function isApiEnabled() {
  return API_URL.length > 0;
}

export function getApiBaseUrl() {
  return API_URL;
}

export class ApiError extends Error {
  status: number; // HTTP status, or 0 for client-side/config errors
  code: any; // machine-readable error code from the server
  details: any;
  constructor(message: string, status = 0, code = null, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code || null;
    this.details = details || null;
  }
}

/* ----------------------------- auth token store ---------------------------- */

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable (SSR / private mode) — ignore */
  }
}

export function clearAuthToken() {
  setAuthToken("");
}

/* --------------------------------- headers --------------------------------- */

function buildHeaders(extra, hasJsonBody) {
  const headers = { Accept: "application/json", ...(extra || {}) };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (hasJsonBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

/* ------------------------------ error parsing ------------------------------ */

async function throwHttpError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const message =
    (body && (body.message || body.error)) || `Request failed with status ${res.status}`;
  const code = body && body.code;
  const details = body && body.details;

  // A 401 means the JWT expired or is invalid — clear it so the app can
  // re-authenticate cleanly instead of looping on a dead token.
  if (res.status === 401) {
    clearAuthToken();
  }
  throw new ApiError(message, res.status, code, details);
}

/* --------------------------------- core fetch ------------------------------ */

/**
 * @param {string} path  path beginning with "/" (appended to the base URL)
 * @param {object} [opts]
 * @param {string} [opts.method]
 * @param {object} [opts.query]   stringifiable query params (empty values skipped)
 * @param {*}      [opts.body]    JSON body (or FormData for multipart uploads)
 * @param {object} [opts.headers]
 * @param {AbortSignal} [opts.signal]
 */
export async function apiFetch(path,opts: any = {}) {
  if (!isApiEnabled()) {
    throw new ApiError(
      "API is not configured. Set VITE_API_URL to enable backend calls.",
      0,
      "api_disabled"
    );
  }

  const { method = "GET", query, body, headers, signal } = opts;

  const url = new URL(API_URL + path);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const hasJsonBody = body !== undefined && !isFormData;

  const init: RequestInit = {
    method,
    headers: buildHeaders(headers, hasJsonBody) as HeadersInit,
    signal,
    // The backend authenticates via Django session cookie (not the Bearer
    // token below, which nothing currently issues) — "include" is required
    // for that cookie to be sent/received cross-origin, since the CRA dev
    // server and the Django backend run on different ports/origins.
    credentials: "include",
  };
  if (isFormData) {
    init.body = body; // browser sets the multipart Content-Type + boundary
  } else if (hasJsonBody) {
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url.toString(), init);
  } catch (err) {
    throw new ApiError(
      err && err.message ? err.message : "Network request failed",
      0,
      "network_error"
    );
  }

  if (!res.ok) {
    await throwHttpError(res);
  }
  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

/* ------------------------------ verb helpers ------------------------------- */

// verb helpers: every parameter after `path` is optional because the legacy
// wrapper modules call them with varying arities (opts was optional in the
// original JS and callers relied on that).
export const api = {
  get: (path: string, opts?: any) => apiFetch(path, { ...opts, method: "GET" }),
  post: (path: string, body?: any, opts?: any) => apiFetch(path, { ...opts, method: "POST", body }),
  put: (path: string, body?: any, opts?: any) => apiFetch(path, { ...opts, method: "PUT", body }),
  patch: (path: string, body?: any, opts?: any) => apiFetch(path, { ...opts, method: "PATCH", body }),
  delete: (path: string, opts?: any) => apiFetch(path, { ...opts, method: "DELETE" }),
};

/* --------------------------- S3 presigned helpers -------------------------- */

/**
 * Ask the backend for a presigned PUT URL, then upload the file bytes directly
 * to S3. Returns the stored pointer ({ bucket, key, ... }) the backend created.
 *
 * @param {File|Blob} file
 * @param {object} meta  { folderId?, studyId?, subjectId?, eisfModule?, eisfSubModule? }
 */
export async function uploadFileToS3(file,meta: any = {}) {
  const { uploadUrl, document } = await api.post("/documents/presign-upload", {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSizeBytes: file.size,
    ...meta,
  });

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!putRes.ok) {
    throw new ApiError(`S3 upload failed with status ${putRes.status}`, putRes.status, "s3_upload_failed");
  }

  // Confirm the upload so the backend can flip the document status to "uploaded".
  const confirmed = await api.post(`/documents/${document.id}/confirm-upload`);
  return confirmed || document;
}

/** Get a short-lived presigned GET URL to download/preview a document. */
export async function getDownloadUrl(documentId) {
  const { downloadUrl } = await api.get(`/documents/${encodeURIComponent(documentId)}/download-url`);
  return downloadUrl;
}

export default api;
