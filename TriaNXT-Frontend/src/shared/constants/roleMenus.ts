import ROLES from "./roles";

export const ROLE_EXTRA_MENU_ITEMS = {
  [ROLES.SPONSOR]: [
    { key: "screening", label: "Screening", path: "/screening" },
    { key: "enrollment", label: "Enrollment", path: "/enrollment" },
    { key: "visits", label: "Visits", path: "/visits" },
    { key: "files", label: "Files", path: "/files" },
    { key: "portfolio", label: "Portfolio", path: "/portfolio" },
    { key: "study-oversight", label: "Study Oversight", path: "/study-oversight" },
    { key: "cro-oversight", label: "CRO Oversight", path: "/cro-oversight" },
    { key: "risk-management", label: "Risk Management", path: "/risk-management" }
  ],
  [ROLES.PI]: [
    { key: "pi-subjects", label: "PI Subjects", path: "/pi-subjects-dashboard" },
    { key: "pi-eisf", label: "PI eISF", path: "/pi-eisf-dashboard" },
    { key: "pi-icf", label: "PI ICF", path: "/pi-icf-dashboard" },
    { key: "pi-recruitment", label: "PI Recruitment", path: "/pi-recruitment" },
    { key: "pi-regulatory", label: "PI Regulatory", path: "/pi-regulatory" },
    { key: "pi-reports", label: "PI Reports", path: "/pi-reports" }
  ],
  [ROLES.CRO]: [
    { key: "monitoring", label: "Monitoring", path: "/monitoring" },
    { key: "site-management", label: "Site Management", path: "/site-management" },
    { key: "screening", label: "Screening", path: "/screening" },
    { key: "enrollment", label: "Enrollment", path: "/enrollment" },
    { key: "visits", label: "Visits", path: "/visits" },
    { key: "queries", label: "Queries", path: "/queries" }
  ]
};

export function getRoleExtraMenuItems(role) {
  return ROLE_EXTRA_MENU_ITEMS[role] || [];
}
