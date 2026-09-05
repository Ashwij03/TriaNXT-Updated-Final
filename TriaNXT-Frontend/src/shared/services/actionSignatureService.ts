/**
 * actionSignatureService — mandatory E-Signature gate for every file/folder
 * upload, edit and delete across TriaNXT.
 *
 * Why this exists
 * ---------------
 * Signing is no longer an optional, after-the-fact action. Before ANY
 * upload / save / edit / rename / replace / delete of a document, file or
 * folder completes, the acting user must complete an E-Signature step:
 *
 *   1. type their full printed name (pre-filled from the signed-in user)
 *   2. select the meaning of the action (Approval / Review / Authorship /
 *      Verification)
 *
 * On acceptance the service returns a `signature` record carrying who
 * (signer identity + printed name), what (meaning), when (timestamp) and a
 * SHA-256 signature stamp computed over the canonical action facts. The
 * caller persists that record with the mutation (document/file audit trail,
 * folder or deletion ledger) so other users viewing the history can always
 * see who uploaded, edited or deleted the item.
 *
 * The signature is accepted on the strength of the already-authenticated
 * session — there is no password re-authentication step.
 */

import {
  getCurrentUser,
  getEffectiveUser,
  getUserDisplayName,
} from "./roleService";

/* ------------------------------------------------------------------------
 * Signature meanings (mirror tria_engine/apps/eisf/structure.py
 * SIGNATURE_MEANINGS — the backend keeps the regulatory semantics under
 * the hood; the UI simply calls the feature "E-Signature").
 * ---------------------------------------------------------------------- */

export const SIGNATURE_MEANINGS = [
  {
    value: "approval",
    label: "Approval",
    description: "I approve this action for the stated purpose.",
  },
  {
    value: "review",
    label: "Review",
    description: "I have reviewed the change and its contents.",
  },
  {
    value: "authorship",
    label: "Authorship",
    description: "I authored / take ownership of this change.",
  },
  {
    value: "verification",
    label: "Verification",
    description: "I verified this change's integrity and authenticity.",
  },
];

export const SIGNATURE_MEANING_LABELS = Object.fromEntries(
  SIGNATURE_MEANINGS.map((meaning) => [meaning.value, meaning.label])
);

export function signatureMeaningLabel(meaning) {
  return (
    SIGNATURE_MEANING_LABELS[String(meaning || "").toLowerCase()] ||
    meaning ||
    ""
  );
}

/** Default meaning per action kind (upload/create => Authorship). */
export function defaultMeaningForAction(action = "") {
  const key = String(action || "").toLowerCase();
  if (key === "edit" || key === "save" || key === "rename" || key === "replace") {
    return "review";
  }
  if (key === "delete") {
    return "approval";
  }
  return "authorship";
}

/** Default confirm-button label per action kind. */
export function confirmLabelForAction(action = "") {
  const key = String(action || "").toLowerCase();
  if (key === "delete") return "Delete & Sign";
  if (key === "upload" || key === "create") return "Upload & Sign";
  if (key === "rename" || key === "replace") return "Save & Sign";
  return "Save & Sign"; // generic edit / save
}

/* ------------------------------------------------------------------------
 * Signer identity
 * ---------------------------------------------------------------------- */

export function getSignerIdentity() {
  const user = getEffectiveUser(getCurrentUser());
  return {
    displayName: getUserDisplayName(user),
    email: user?.email || "",
    role: user?.role || "",
    userId: user?.id || user?.userId || null,
  };
}

/* ------------------------------------------------------------------------
 * SHA-256 stamp over canonical action facts
 * ---------------------------------------------------------------------- */

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortObject(value[key])])
    );
  }
  return value;
}

function canonicalJson(payload) {
  return JSON.stringify(sortObject(payload));
}

async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertCryptoAvailable() {
  if (
    typeof globalThis === "undefined" ||
    !globalThis.crypto?.subtle ||
    typeof globalThis.crypto.subtle.digest !== "function"
  ) {
    throw new Error(
      "SHA-256 is unavailable in this browser context. Open the app over HTTPS or 127.0.0.1."
    );
  }
}

export const SIGNATURE_STAMP_ALGORITHM = "SHA-256";

function createSignatureId() {
  return `esig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deterministic SHA-256 stamp over the canonical action facts: scope +
 * entity + action + signer + meaning + printed name + timestamp.
 */
export async function buildActionStamp({
  scope = {},
  entityType = "",
  entityName = "",
  action = "",
  signer,
  meaning,
  printedName,
  signedAt,
}: any = {}) {
  const facts = {
    version: 1,
    domain: "trianxt-action-signature",
    scope,
    entity: {
      type: String(entityType || "").toLowerCase(),
      name: entityName,
    },
    action: String(action || "").toLowerCase(),
    signer: {
      userId: signer?.userId || null,
      email: signer?.email || "",
    },
    signature: {
      meaning: String(meaning || "").toLowerCase(),
      printedName,
      signedAt,
    },
  };
  return sha256Hex(canonicalJson(facts));
}

/* ------------------------------------------------------------------------
 * Core: create the E-Signature record for a pending action
 * ---------------------------------------------------------------------- */

/**
 * Perform the E-Signature step for an action about to happen. Resolves with
 * `{ ok: true, signature }` once the signature record and stamp are built,
 * or `{ ok: false, error }`.
 */
export async function createActionSignature({
  scope = {},
  entityType = "document",
  entityName = "",
  action = "upload",
  meaning,
  printedName,
}: any = {}) {
  const meaningKey = String(meaning || "").toLowerCase();
  const label = signatureMeaningLabel(meaningKey);
  const printed = String(printedName || "").trim();
  const signer = getSignerIdentity();

  if (!label) {
    return { ok: false, error: "Select the meaning of this signature." };
  }
  if (!printed) {
    return { ok: false, error: "Type your full printed name to sign." };
  }

  try {
    assertCryptoAvailable();

    const signedAt = new Date().toISOString();
    const signatureStamp = await buildActionStamp({
      scope,
      entityType,
      entityName,
      action,
      signer,
      meaning: meaningKey,
      printedName: printed,
      signedAt,
    });

    return {
      ok: true,
      signature: {
        id: createSignatureId(),
        token: createSignatureId().replace("esig-", "tok-"),
        action: String(action || "").toLowerCase(),
        entityType,
        entityName,
        meaning: meaningKey,
        meaningLabel: label,
        printedName: printed,
        signedAt,
        signatureStamp,
        signerId: signer.userId,
        signerEmail: signer.email,
        signerRole: signer.role,
        scope,
        source: "local",
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        (error && error.message) ||
        "The E-Signature could not be recorded. Try again.",
    };
  }
}

/* ------------------------------------------------------------------------
 * Persisting the record with the mutation
 * ---------------------------------------------------------------------- */

/** Human-readable summary of a signature (audit-trail safe). */
export function signatureSummary(signature: any = {}, actionLabel = "") {
  const meaning = signature.meaningLabel || signatureMeaningLabel(signature.meaning);
  const who = signature.printedName || signature.signerEmail || "Signer";
  const stamp = signature.signatureStamp || "";
  const stampSnippet = stamp ? ` · Stamp: ${stamp.slice(0, 12)}…` : "";
  return actionLabel
    ? `${actionLabel} — E-Signed by ${who} (${meaning})${stampSnippet}`
    : `E-Signed by ${who} (${meaning})${stampSnippet}`;
}

/** Format a timestamp for audit/history tables. */
export function formatSignatureTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

/** Format a signature stamp for compact display (head … tail). */
export function formatSignatureStamp(stamp) {
  if (!stamp) return "";
  return `${stamp.slice(0, 8)} … ${stamp.slice(-8)}`;
}

/**
 * Prepend an audit-trail entry describing a signed action. Returns a new
 * `{ ...record, auditTrail, signatures }` copy — the caller persists it
 * through its existing store. Never mutates the input.
 */
export function attachSignatureToRecord(
  record: any = {},
  signature: any = {},
  actionLabel = ""
) {
  const now = signature.signedAt || new Date().toISOString();
  const entry = {
    date: now,
    user: signature.printedName || record.uploadedBy || record.modifiedBy || "Signer",
    action: actionLabel || signatureSummary(signature),
    remarks: signatureSummary(signature, actionLabel),
  };
  const existingTrail = Array.isArray(record.auditTrail)
    ? record.auditTrail
    : [];
  const existingSignatures = Array.isArray(record.signatures)
    ? record.signatures
    : [];
  return {
    ...record,
    auditTrail: [entry, ...existingTrail],
    signatures: [...existingSignatures, signature],
    lastSignature: signature,
  };
}

/* ------------------------------------------------------------------------
 * Immutable signature / activity ledger
 *
 * Every signed mutation is appended here — including deletions, where the
 * record itself disappears from the working store. This is the durable
 * "who did what, when" trail other users can audit after the fact.
 * ---------------------------------------------------------------------- */

const LEDGER_KEY = "trianxt:esignature-ledger:v1";

function scopeKey(scope: any = {}) {
  const sorted = sortObject(scope || {});
  return JSON.stringify(sorted);
}

export function recordSignatureLedgerEntry(
  signature: any = {},
  extra: any = {}
) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    const entry = {
      id: signature.id || createSignatureId(),
      ...extra,
      signature: {
        meaning: signature.meaning,
        meaningLabel: signature.meaningLabel,
        printedName: signature.printedName,
        signerEmail: signature.signerEmail,
        signedAt: signature.signedAt,
        signatureStamp: signature.signatureStamp,
        scope: signature.scope || null,
      },
      recordedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify([entry, ...(Array.isArray(entries) ? entries : [])])
    );
    return entry;
  } catch {
    return null;
  }
}

/** Entries for one scope (study/module/context), newest first. */
export function getSignatureLedgerEntries(scope: any = {}) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) return [];
    if (!scope || Object.keys(scope).length === 0) return entries;
    const wanted = scopeKey(scope);
    return entries.filter(
      (entry) => scopeKey(entry?.signature?.scope) === wanted
    );
  } catch {
    return [];
  }
}

const ActionSignatureService = {
  SIGNATURE_MEANINGS,
  signatureMeaningLabel,
  defaultMeaningForAction,
  confirmLabelForAction,
  getSignerIdentity,
  createActionSignature,
  signatureSummary,
  attachSignatureToRecord,
  formatSignatureTime,
  formatSignatureStamp,
  recordSignatureLedgerEntry,
  getSignatureLedgerEntries,
};

export default ActionSignatureService;
