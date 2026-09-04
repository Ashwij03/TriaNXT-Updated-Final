/**
 * IP / Supply Accountability Service (M19 / spec 6.26)
 * =====================================================
 * Investigational product / device supply chain-of-custody per site:
 *
 *   Shipped -> Received -> In Use -> Reconciled | Returned | Destroyed
 *
 * Each lot keeps an immutable transaction trail (receipt, dispense,
 * return, destroy) and an on-hand quantity. Validation rules:
 *
 *   IP-01  Dispensation cannot exceed on-hand quantity.
 *   IP-02  A reported temperature excursion requires a disposition
 *          decision before further dispensation from that lot.
 *   IP-03  Destruction requires two-person (witness) approval evidence.
 *
 * Reconciliation compares expected vs. on-hand and surfaces discrepancies
 * rather than silently zeroing them.
 */

import { addAuditLog } from "./auditService";
import { getEffectiveRole, getCurrentUser } from "./roleService";
import { pullGapRecords, syncGapCollection } from "./gapSync";

const IP_STORAGE_KEY = "trianxtIpAccountability";

export const IP_LOT_STATUSES = [
  "Shipped",
  "Received",
  "In Use",
  "Reconciled",
  "Returned",
  "Destroyed",
];

export const IP_RECONCILIATION_STATUSES = [
  "Balanced",
  "Discrepancy",
  "Under investigation",
];

export const IP_EXCURSION_DISPOSITIONS = ["Use", "Quarantine", "Discard"];

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore() {
  if (!isBrowser()) return { lots: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(IP_STORAGE_KEY));
    return { lots: Array.isArray(parsed && parsed.lots) ? parsed.lots : [] };
  } catch {
    return { lots: [] };
  }
}

function writeStore(store) {
  if (!isBrowser()) return;
  localStorage.setItem(IP_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("ip-accountability-updated"));
  // FastAPI integration: mirror lots to the backend (API mode only).
  syncGapCollection("/api/site/ip/sync", store.lots);
}

let hydratedIpLotsFromBackend = false;

/** Pull IP lots from the backend into an empty local store (once). */
export async function hydrateIpLotsFromBackend() {
  if (hydratedIpLotsFromBackend) {
    return;
  }
  hydratedIpLotsFromBackend = true;
  if (!isBrowser()) {
    return;
  }
  try {
    const remote = await pullGapRecords("/api/site/ip/lots");
    if (!remote || remote.length === 0) {
      return;
    }
    if (readStore().lots.length > 0) {
      return;
    }
    localStorage.setItem(IP_STORAGE_KEY, JSON.stringify({ lots: remote }));
    window.dispatchEvent(new Event("ip-accountability-updated"));
  } catch {
    // Backend unreachable — local store stands.
  }
}

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function actingRole() {
  try {
    return getEffectiveRole(getCurrentUser()) || "";
  } catch {
    return "";
  }
}

function findLot(store, lotId) {
  return store.lots.find((lot) => String(lot.id) === String(lotId)) || null;
}

function transactionTotal(lot, type) {
  return (lot.transactions || [])
    .filter((tx) => tx.type === type)
    .reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);
}

export function getExpectedOnHand(lot = {}) {
  const received = transactionTotal(lot, "Receipt");
  const dispensed = transactionTotal(lot, "Dispense");
  const returned = transactionTotal(lot, "Return");
  const destroyed = transactionTotal(lot, "Destroy");
  return received - dispensed - returned - destroyed;
}

function hasOpenExcursion(lot) {
  return (lot.excursions || []).some(
    (excursion) =>
      !excursion.disposition || excursion.disposition === "Quarantine"
  );
}

/* ------------------------------------------------------------------
   Shipment / receipt
------------------------------------------------------------------- */

/** Record dispatch of a shipment (creates the lot in Shipped state). */
export function recordShipment(payload: any = {}) {
  if (!payload.studyCode || !payload.siteCode || !payload.lotNumber) {
    throw new Error("studyCode, siteCode and lotNumber are required.");
  }
  const quantity = Number(payload.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity received must be a positive number.");
  }

  const lot = {
    id: "IPL-" + Date.now().toString(36).toUpperCase(),
    studyCode: payload.studyCode,
    siteCode: payload.siteCode,
    lotNumber: payload.lotNumber,
    kitNumber: payload.kitNumber || "",
    quantityReceived: quantity,
    quantityOnHand: 0,
    status: "Shipped",
    condition: "",
    receivedAt: null,
    receivedBy: "",
    transactions: [
      {
        id: "TX-" + Date.now().toString(36),
        type: "Receipt",
        quantity,
        date: new Date().toISOString(),
        by: actingRole() || "Unknown",
        note: "Shipment dispatched",
      },
    ],
    excursions: [],
    reconciliationStatus: "Under investigation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actingRole(),
    history: [
      {
        action: "SHIPMENT_DISPATCHED:" + payload.lotNumber,
        at: new Date().toISOString(),
        by: actingRole() || "Unknown",
      },
    ],
  };

  const store = readStore();
  store.lots.push(lot);
  writeStore(store);

  addAuditLog("IP_SHIPMENT_DISPATCHED", {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    studyCode: lot.studyCode,
    siteCode: lot.siteCode,
    timestamp: lot.createdAt,
  });
  return lot;
}

/** Confirm receipt + storage condition: Shipped -> Received. */
export function receiveShipment(lotId, payload: any = {}) {
  const store = readStore();
  const lot = findLot(store, lotId);
  if (!lot) throw new Error("Lot not found.");
  if (lot.status !== "Shipped") {
    throw new Error("Only Shipped lots can be received.");
  }

  const condition = payload.condition || "Acceptable";
  if (!["Acceptable", "Excursion", "Rejected"].includes(condition)) {
    throw new Error("Receipt condition must be Acceptable, Excursion or Rejected.");
  }

  lot.status = "Received";
  lot.condition = condition;
  lot.quantityOnHand = lot.quantityReceived;
  lot.receivedAt = new Date().toISOString();
  lot.receivedBy = actingRole();
  lot.updatedAt = lot.receivedAt;
  lot.updatedBy = actingRole();

  if (condition === "Excursion" || condition === "Rejected") {
    // IP-02: an excursion at receipt needs a disposition decision before use.
    lot.excursions.push({
      id: "EXC-" + Date.now().toString(36),
      temperature: payload.temperature || null,
      reportedAt: lot.receivedAt,
      reportedBy: actingRole(),
      disposition: null,
      witness: "",
      resolved: false,
    });
  }
  lot.history.push({
    action: "SHIPMENT_RECEIVED:" + condition,
    at: lot.receivedAt,
    by: actingRole(),
  });
  writeStore(store);

  addAuditLog("IP_SHIPMENT_RECEIVED", {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    condition,
    timestamp: lot.receivedAt,
  });
  return lot;
}

/* ------------------------------------------------------------------
   Dispensation (IP-01, IP-02)
------------------------------------------------------------------- */

export function dispenseToSubject(lotId, subjectId, quantity, visitCode = "") {
  if (!subjectId) throw new Error("A subject is required for dispensation.");
  const store = readStore();
  const lot = findLot(store, lotId);
  if (!lot) throw new Error("Lot not found.");
  if (lot.status !== "Received" && lot.status !== "In Use") {
    throw new Error("Lot must be Received/In Use before dispensation.");
  }
  // IP-02
  if (hasOpenExcursion(lot)) {
    throw new Error(
      "A temperature excursion requires a disposition decision before further dispensation from this lot."
    );
  }
  const requested = Number(quantity);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error("Quantity must be a positive number.");
  }
  // IP-01
  if (requested > lot.quantityOnHand) {
    throw new Error(
      "Dispensation cannot exceed on-hand quantity (on hand: " +
        lot.quantityOnHand +
        ", requested: " +
        requested +
        ")."
    );
  }

  lot.quantityOnHand -= requested;
  lot.status = "In Use";
  lot.updatedAt = new Date().toISOString();
  lot.updatedBy = actingRole();
  lot.transactions.push({
    id: "TX-" + Date.now().toString(36),
    type: "Dispense",
    quantity: requested,
    subjectId,
    visitCode: visitCode || "",
    date: lot.updatedAt,
    by: actingRole(),
    note: "",
  });
  lot.history.push({
    action: "DISPENSED:" + requested + ":" + subjectId,
    at: lot.updatedAt,
    by: actingRole(),
  });
  writeStore(store);

  addAuditLog("IP_DISPENSED_TO_SUBJECT", {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    subjectId,
    quantity: requested,
    timestamp: lot.updatedAt,
  });
  return lot;
}

/* ------------------------------------------------------------------
   Excursion disposition (IP-02/IP-03)
------------------------------------------------------------------- */

export function resolveExcursion(lotId, excursionId, disposition, witness = "") {
  if (!["Use", "Quarantine", "Discard"].includes(disposition)) {
    throw new Error("Disposition must be Use, Quarantine or Discard.");
  }
  const store = readStore();
  const lot = findLot(store, lotId);
  if (!lot) throw new Error("Lot not found.");

  const excursion = (lot.excursions || []).find(
    (exc) => String(exc.id) === String(excursionId)
  );
  if (!excursion) throw new Error("Excursion record not found.");

  if (disposition === "Discard") {
    // IP-03: destruction/discard needs two-person evidence.
    if (!String(witness || "").trim()) {
      throw new Error(
        "Discard requires a two-person (witness) approval signature."
      );
    }
    excursion.witness = witness;
    lot.quantityOnHand = 0;
    lot.status = "Destroyed";
  }
  excursion.disposition = disposition;
  excursion.resolved = disposition === "Use";
  excursion.witness = disposition === "Use" ? excursion.witness : witness;
  lot.updatedAt = new Date().toISOString();
  lot.updatedBy = actingRole();
  lot.history.push({
    action: "EXCURSION_DISPOSITION:" + disposition,
    at: lot.updatedAt,
    by: actingRole(),
  });
  writeStore(store);

  addAuditLog("IP_EXCURSION_DISPOSITION", {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    disposition,
    timestamp: lot.updatedAt,
  });
  return lot;
}

/* ------------------------------------------------------------------
   Return / destruction / reconciliation
------------------------------------------------------------------- */

export function returnLot(lotId, quantity, reason = "") {
  const store = readStore();
  const lot = findLot(store, lotId);
  if (!lot) throw new Error("Lot not found.");

  const requested = Number(quantity);
  if (!Number.isFinite(requested) || requested <= 0 || requested > lot.quantityOnHand) {
    throw new Error("Return quantity must be positive and no more than on-hand.");
  }
  lot.quantityOnHand -= requested;
  lot.updatedAt = new Date().toISOString();
  lot.updatedBy = actingRole();
  lot.transactions.push({
    id: "TX-" + Date.now().toString(36),
    type: "Return",
    quantity: requested,
    date: lot.updatedAt,
    by: actingRole(),
    note: reason || "",
  });
  if (lot.quantityOnHand === 0) lot.status = "Returned";
  lot.history.push({
    action: "RETURNED:" + requested,
    at: lot.updatedAt,
    by: actingRole(),
  });
  writeStore(store);
  return lot;
}

export function destroyLot(lotId, witness = "") {
  // IP-03
  if (!String(witness || "").trim()) {
    throw new Error("Destruction requires two-person (witness) approval evidence.");
  }
  const store = readStore();
  const lot = findLot(store, lotId);
  if (!lot) throw new Error("Lot not found.");
  if (lot.status === "Destroyed" || lot.status === "Returned") {
    throw new Error("Lot already has a final disposition.");
  }
  const remaining = lot.quantityOnHand;
  lot.quantityOnHand = 0;
  lot.status = "Destroyed";
  lot.updatedAt = new Date().toISOString();
  lot.updatedBy = actingRole();
  lot.transactions.push({
    id: "TX-" + Date.now().toString(36),
    type: "Destroy",
    quantity: remaining,
    date: lot.updatedAt,
    by: actingRole(),
    note: "Witness: " + witness,
  });
  lot.history.push({
    action: "DESTROYED:" + remaining,
    at: lot.updatedAt,
    by: actingRole(),
  });
  writeStore(store);

  addAuditLog("IP_LOT_DESTROYED", {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    witness,
    timestamp: lot.updatedAt,
  });
  return lot;
}

/**
 * Periodic reconciliation: expected on-hand (receipts minus dispensed minus
 * returned minus destroyed) vs. recorded on-hand. Discrepancies are
 * surfaced, never silently zeroed.
 */
export function runReconciliation(lotId) {
  const store = readStore();
  const lot = findLot(store, lotId);
  if (!lot) throw new Error("Lot not found.");

  const expected = getExpectedOnHand(lot);
  const recorded = Number(lot.quantityOnHand) || 0;
  lot.reconciliationStatus =
    expected === recorded ? "Balanced" : "Discrepancy";
  lot.expectedOnHand = expected;
  if (lot.reconciliationStatus === "Balanced" && recorded === 0) {
    lot.status = "Reconciled";
  }
  lot.updatedAt = new Date().toISOString();
  lot.updatedBy = actingRole();
  lot.history.push({
    action: "RECONCILIATION:" + lot.reconciliationStatus,
    at: lot.updatedAt,
    by: actingRole(),
  });
  writeStore(store);

  addAuditLog("IP_RECONCILIATION", {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    expected,
    recorded,
    status: lot.reconciliationStatus,
    timestamp: lot.updatedAt,
  });
  return lot;
}

/* ------------------------------------------------------------------
   Reads
------------------------------------------------------------------- */

export function getLots(studyCode) {
  const store = readStore();
  if (!studyCode) return store.lots.slice();
  const key = normalizeValue(studyCode);
  return store.lots.filter((lot) => normalizeValue(lot.studyCode) === key);
}

export function getLot(lotId) {
  if (!lotId) return null;
  const store = readStore();
  return findLot(store, lotId);
}

export function getAllLots() {
  return readStore().lots.slice();
}

export function subscribeIpAccountability(handler) {
  if (isBrowser() && typeof handler === "function") {
    window.addEventListener("ip-accountability-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("ip-accountability-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }
  return () => {};
}

const IpAccountabilityService = {
  IP_LOT_STATUSES,
  IP_RECONCILIATION_STATUSES,
  recordShipment,
  receiveShipment,
  dispenseToSubject,
  resolveExcursion,
  returnLot,
  destroyLot,
  runReconciliation,
  getExpectedOnHand,
  getLots,
  getLot,
  getAllLots,
  subscribeIpAccountability,
};

export default IpAccountabilityService;
