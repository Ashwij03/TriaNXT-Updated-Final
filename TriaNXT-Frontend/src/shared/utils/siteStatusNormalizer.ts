const ACTIVATION_STATUS_MAP = {
  active: "Active",
  activated: "Active",
  "in progress": "Active",
  onboarding: "Onboarding",
  pending: "Pending",
  "pending activation": "Pending",
  "not activated": "Pending",
  inactive: "Inactive",
  closed: "Closed",
  "closed out": "Closed",
  suspended: "Suspended",
  paused: "Suspended",
};

const GCP_STATUS_MAP = {
  valid: "Valid",
  active: "Valid",
  current: "Valid",
  expiring: "Expiring",
  "expiring soon": "Expiring",
  expired: "Expired",
  inactive: "Expired",
  missing: "Missing",
  "not available": "Missing",
  pending: "Missing",
};

export function normalizeSiteActivationStatus(status) {
  const raw = String(status ?? "").trim();
  if (!raw) return "Pending";
  const key = raw.toLowerCase();
  return ACTIVATION_STATUS_MAP[key] || raw;
}

export function normalizeGCPStatus(status) {
  const raw = String(status ?? "").trim();
  if (!raw) return "Missing";
  const key = raw.toLowerCase();
  return GCP_STATUS_MAP[key] || raw;
}

export const SITE_ACTIVATION_BUCKETS = [
  "Active",
  "Onboarding",
  "Pending",
  "Suspended",
  "Closed",
];

export const GCP_CERT_BUCKETS = ["Valid", "Expiring", "Expired", "Missing"];
