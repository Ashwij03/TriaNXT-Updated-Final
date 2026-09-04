import ROLES from "../../../constants/roles";

export const FILTER_ORDERS = {
  [ROLES.SPONSOR]: [
    "cro",
    "indication",
    "study",
    "siteNumber",
    "siteName",
    "subject",
  ],
  [ROLES.CRO]: [
    "sponsor",
    "indication",
    "study",
    "siteNumber",
    "siteName",
    "subject",
  ],
  [ROLES.PI]: ["indication", "sponsor", "cro", "study", "subject"],
  [ROLES.SITE_STAFF]: ["indication", "sponsor", "cro", "study", "subject"],
  [ROLES.ADMIN]: [
    "role",
    "indication",
    "siteNumber",
    "siteName",
    "study",
    "subject",
  ],
};

export const FILTER_LABELS = {
  role: "Role",
  indication: "Indication",
  sponsor: "Sponsor",
  cro: "CRO",
  siteNumber: "Site Number",
  siteName: "Institution",
  study: "Study Number",
  subject: "Subject Number",
};

export const ROLE_BADGE_CLASSES = {
  [ROLES.ADMIN]: "role-badge--admin",
  [ROLES.SITE_STAFF]: "role-badge--site-staff",
  [ROLES.PI]: "role-badge--pi",
  [ROLES.CRO]: "role-badge--cro",
  [ROLES.SPONSOR]: "role-badge--sponsor",
};

export const QUICK_ACTIONS = [
  { label: "Studies", path: "/studies" },
  { label: "Reports", path: "/reports" },
  { label: "User Management", path: "/user-management" },
  { label: "Access Permission", path: "/access-permission" },
];
