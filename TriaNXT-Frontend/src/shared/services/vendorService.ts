/**
 * Vendor & Lab Management Service (M22 / spec 6.29)
 * ==================================================
 * Third-party vendors (central labs, imaging, ECG core labs, translation
 * vendors) are first-class entities with contracts and offboarding; lab
 * kits / specimens carry a reconstructable chain of custody.
 *
 * Business rules:
 *   - A specimen/kit record must always link to a valid subject + visit.
 *   - Vendor contract expiry reuses the standard expiring/renewal pattern.
 *   - Offboarding is an explicit state transition with a reason, retained
 *     for audit rather than deleted.
 */

import { addAuditLog } from "./auditService";
import { getEffectiveRole, getCurrentUser } from "./roleService";
import { syncGapCollection } from "./gapSync";

const VENDOR_STORAGE_KEY = "trianxtVendors";

export const VENDOR_TYPES = [
  "Central Lab",
  "Imaging",
  "ECG Core Lab",
  "Translation",
  "Other",
];

export const VENDOR_STATUSES = [
  "Onboarding",
  "Active",
  "Offboarding",
  "Offboarded",
];

export const KIT_STATUSES = [
  "Collected",
  "Shipped",
  "Received",
  "Resulted",
  "Archived",
];

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore() {
  const empty = { vendors: [], kits: [] };
  if (!isBrowser()) return empty;
  try {
    const parsed = JSON.parse(localStorage.getItem(VENDOR_STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return empty;
    return {
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
      kits: Array.isArray(parsed.kits) ? parsed.kits : [],
    };
  } catch {
    return empty;
  }
}

function writeStore(store) {
  if (!isBrowser()) return;
  localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event("vendors-updated"));
  // FastAPI integration: mirror each collection (API mode only).
  if (Array.isArray(store.vendors) && store.vendors.length) {
    syncGapCollection("/api/site/vendors/sync", store.vendors);
  }
  if (Array.isArray(store.kits) && store.kits.length) {
    syncGapCollection("/api/site/vendors/kits/sync", store.kits);
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

function stamp(obj, action) {
  const history = Array.isArray(obj.history) ? obj.history : [];
  history.push({
    action,
    at: new Date().toISOString(),
    by: actingRole() || "Unknown",
  });
  return history;
}

function findIndex(list, id) {
  return list.findIndex((item) => String(item.id) === String(id));
}

/* ------------------------------------------------------------------
   Vendors
------------------------------------------------------------------- */

export function addVendor(payload: any = {}) {
  if (!payload.name || !payload.type) {
    throw new Error("Vendor name and type are required.");
  }
  if (!VENDOR_TYPES.includes(payload.type)) {
    throw new Error("A valid vendor type is required.");
  }
  const vendor = {
    id: "VND-" + Date.now().toString(36).toUpperCase(),
    name: payload.name,
    type: payload.type,
    scope: payload.scope || "",
    contractRef: payload.contractRef || "",
    contractExpiryDate: payload.contractExpiryDate || "",
    contactName: payload.contactName || "",
    contactEmail: payload.contactEmail || "",
    status: payload.status || "Onboarding",
    notes: payload.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actingRole(),
    history: [],
  };
  vendor.history = stamp(vendor, "VENDOR_ADDED");

  const store = readStore();
  const exists = store.vendors.some(
    (v) => normalizeValue(v.name) === normalizeValue(payload.name)
  );
  if (exists) throw new Error("A vendor with this name already exists.");
  store.vendors.push(vendor);
  writeStore(store);

  addAuditLog("VENDOR_ADDED", {
    vendorId: vendor.id,
    vendorName: vendor.name,
    type: vendor.type,
    timestamp: vendor.createdAt,
  });
  return vendor;
}

export function setVendorActive(vendorId) {
  const store = readStore();
  const index = findIndex(store.vendors, vendorId);
  if (index === -1) throw new Error("Vendor not found.");
  const vendor = store.vendors[index];
  if (vendor.status === "Offboarded") {
    throw new Error("Offboarded vendors cannot be reactivated directly.");
  }
  vendor.status = "Active";
  vendor.updatedAt = new Date().toISOString();
  vendor.updatedBy = actingRole();
  vendor.history = stamp(vendor, "VENDOR_ACTIVATED");
  store.vendors[index] = vendor;
  writeStore(store);
  return vendor;
}

export function offboardVendor(vendorId, reason = "") {
  if (!String(reason || "").trim()) {
    throw new Error("An offboarding reason is required.");
  }
  const store = readStore();
  const index = findIndex(store.vendors, vendorId);
  if (index === -1) throw new Error("Vendor not found.");
  const vendor = store.vendors[index];
  if (vendor.status === "Offboarded") {
    throw new Error("Vendor is already offboarded.");
  }
  vendor.status = "Offboarded";
  vendor.offboardReason = reason;
  vendor.offboardedAt = new Date().toISOString();
  vendor.updatedAt = vendor.offboardedAt;
  vendor.updatedBy = actingRole();
  vendor.history = stamp(vendor, "VENDOR_OFFBOARDED");
  store.vendors[index] = vendor;
  writeStore(store);

  addAuditLog("VENDOR_OFFBOARDED", {
    vendorId: vendor.id,
    vendorName: vendor.name,
    reason,
    timestamp: vendor.updatedAt,
  });
  return vendor;
}

/** Contract expiry follows the standard expiring/renewal engine. */
export function isVendorContractExpiring(vendor: any = {}, withinDays = 90) {
  if (!vendor.contractExpiryDate) return false;
  const expiry = new Date(vendor.contractExpiryDate);
  const horizon = new Date(Date.now() + withinDays * 86400000);
  return expiry.getTime() <= horizon.getTime();
}

export function getVendors() {
  return readStore().vendors.slice();
}

export function getVendor(vendorId) {
  if (!vendorId) return null;
  return readStore().vendors.find((v) => String(v.id) === String(vendorId)) || null;
}

/* ------------------------------------------------------------------
   Lab kits / specimens
------------------------------------------------------------------- */

export function registerKit(payload: any = {}) {
  if (!payload.vendorId || !payload.subjectId || !payload.visitCode) {
    throw new Error(
      "A kit must link to a vendor, subject and visit context."
    );
  }
  if (!payload.kitType) throw new Error("Kit type is required.");
  const vendor = getVendor(payload.vendorId);
  if (!vendor || vendor.status === "Offboarded") {
    throw new Error("Kit vendor must exist and not be offboarded.");
  }

  const kit = {
    id: "KT-" + Date.now().toString(36).toUpperCase(),
    vendorId: vendor.id,
    vendorName: vendor.name,
    studyCode: payload.studyCode || "",
    subjectId: payload.subjectId,
    visitCode: payload.visitCode,
    kitType: payload.kitType,
    specimenId: payload.specimenId || "",
    status: "Collected",
    chainOfCustody: [
      {
        at: new Date().toISOString(),
        action: "Collected at site",
        handler: actingRole() || "Unknown",
        location: payload.collectedLocation || "Site",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actingRole(),
    history: [],
  };
  kit.history = stamp(kit, "KIT_REGISTERED");

  const store = readStore();
  store.kits.push(kit);
  writeStore(store);

  addAuditLog("LAB_KIT_REGISTERED", {
    kitId: kit.id,
    vendorId: vendor.id,
    subjectId: kit.subjectId,
    visitCode: kit.visitCode,
    timestamp: kit.createdAt,
  });
  return kit;
}

const KIT_FLOW = ["Collected", "Shipped", "Received", "Resulted", "Archived"];

export function advanceKitStatus(kitId, nextStatus, location = "") {
  if (!KIT_STATUSES.includes(nextStatus)) {
    throw new Error("Invalid kit status.");
  }
  const store = readStore();
  const index = findIndex(store.kits, kitId);
  if (index === -1) throw new Error("Kit not found.");
  const kit = store.kits[index];
  const currentPos = KIT_FLOW.indexOf(kit.status);
  const nextPos = KIT_FLOW.indexOf(nextStatus);
  if (nextPos <= currentPos && kit.status !== nextStatus) {
    throw new Error("Kit status can only move forward through the flow.");
  }

  kit.status = nextStatus;
  kit.updatedAt = new Date().toISOString();
  kit.updatedBy = actingRole();
  kit.chainOfCustody.push({
    at: kit.updatedAt,
    action: nextStatus,
    handler: actingRole() || "Unknown",
    location: location || "",
  });
  kit.history = stamp(kit, "KIT_STATUS:" + nextStatus);
  store.kits[index] = kit;
  writeStore(store);

  addAuditLog("LAB_KIT_STATUS", {
    kitId: kit.id,
    subjectId: kit.subjectId,
    status: nextStatus,
    timestamp: kit.updatedAt,
  });
  return kit;
}

export function getKits(studyCode) {
  const store = readStore();
  if (!studyCode) return store.kits.slice();
  const key = normalizeValue(studyCode);
  return store.kits.filter((kit) => normalizeValue(kit.studyCode) === key);
}

export function getKit(kitId) {
  if (!kitId) return null;
  return readStore().kits.find((k) => String(k.id) === String(kitId)) || null;
}

export function getAllKits() {
  return readStore().kits.slice();
}

export function subscribeVendors(handler) {
  if (isBrowser() && typeof handler === "function") {
    window.addEventListener("vendors-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("vendors-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }
  return () => {};
}

const VendorService = {
  VENDOR_TYPES,
  VENDOR_STATUSES,
  KIT_STATUSES,
  addVendor,
  setVendorActive,
  offboardVendor,
  isVendorContractExpiring,
  getVendors,
  getVendor,
  registerKit,
  advanceKitStatus,
  getKits,
  getKit,
  getAllKits,
  subscribeVendors,
};

export default VendorService;
