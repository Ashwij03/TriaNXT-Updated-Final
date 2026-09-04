import { CRO_STORAGE_KEYS, loadFromStorage }from "./croStorage";

const DEFAULT_SETTINGS = {
  organization: "Clinical Research Org",
  email: "cro@trialnxt.com",
};

const ROLE_LABELS = {
  CRO: "Clinical Research Officer",
  Admin: "Administrator",
  SiteStaff: "Site Staff",
  PI: "Principal Investigator",
  Sponsor: "Sponsor Representative",
};

export function formatLastLogin(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) return "—";

  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursStr = String(hours).padStart(2, "0");

  return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;
}

export function getCROUserProfile() {
  const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const settings = loadFromStorage(CRO_STORAGE_KEYS.settings, DEFAULT_SETTINGS);

  const name =
    user.name ||
    localStorage.getItem("userFullName") ||
    "CRO User";

  const organization =
    settings.organization ||
    user.organization ||
    user.orgType ||
    "Clinical Research Org";

  const email = user.email || settings.email || "cro@trialnxt.com";
  const roleKey = user.role || "CRO";
  const role = ROLE_LABELS[roleKey] || roleKey;
  const lastLoginRaw =
    localStorage.getItem("lastLogin") || user.lastLogin || new Date().toISOString();

  return {
    name,
    role,
    roleKey,
    organization,
    email,
    lastLogin: formatLastLogin(lastLoginRaw),
    profileImage: user.profileImage || user.avatar || null,
    initials: (name.trim().charAt(0) || "C").toUpperCase(),
  };
}
