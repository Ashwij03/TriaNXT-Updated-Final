import ROLES from "../../constants/roles";
import { getEffectiveRole } from "../../services/roleService";

// Financials is restricted to Admin and PI. getEffectiveRole() already
// resolves the Admin/PI "preview as role" state, so an Admin previewing
// as SiteStaff / CRO / Sponsor is correctly treated as that role here.
export const FINANCIALS_ALLOWED_ROLES = [ROLES.ADMIN, ROLES.PI];

export function canViewFinancials(currentUser?) {
  return FINANCIALS_ALLOWED_ROLES.includes(getEffectiveRole(currentUser));
}

export const STUDY_WORKSPACE_TABS = [
  {
    id: "overview",
    label: "Overview",
  },
  {
    id: "subjects",
    label: "Subjects",
  },
  {
    id: "logs",
    label: "Logs",
  },
  {
    id: "eisf",
    label: "eISF",
  },
  {
    id: "visit-plan",
    label: "Visit Plan",
  },
  {
    id: "clinical-sites",
    label: "Clinical Sites",
  },
  {
    id: "reports",
    label: "Reports",
  },
  {
    id: "study-files",
    label: "Study Files",
  },
  {
    id: "financials",
    label: "Financials",
  },
  {
    id: "others",
    label: "Others",
  },
  {
    id: "study-milestone",
    label: "Study Milestone",
  },
  {
    id: "activity",
    label: "Activity",
  },
];

// ===== END F1 CHANGES =====
