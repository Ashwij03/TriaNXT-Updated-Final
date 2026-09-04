import DOCUMENT_STATUS from "./documentStatus";

/* -------------------------------------------------------------------------- */
/*                             Dashboard Widgets                              */
/* -------------------------------------------------------------------------- */

export const DASHBOARD_WIDGETS = Object.freeze({
  DOCUMENT_STATUS: "documentStatus",
  COMPLETION_PERCENTAGE: "completionPercentage",
  MISSING_DOCUMENTS: "missingDocuments",
  DOCUMENTS_UNDER_APPROVAL: "documentsUnderApproval",
  EXPIRING_SOON: "expiringSoon",
  EXPIRED_DOCUMENTS: "expiredDocuments",
});

/* -------------------------------------------------------------------------- */
/*                           Widget Display Order                             */
/* -------------------------------------------------------------------------- */

export const DASHBOARD_WIDGET_ORDER = [
  DASHBOARD_WIDGETS.DOCUMENT_STATUS,
  DASHBOARD_WIDGETS.COMPLETION_PERCENTAGE,
  DASHBOARD_WIDGETS.MISSING_DOCUMENTS,
  DASHBOARD_WIDGETS.DOCUMENTS_UNDER_APPROVAL,
  DASHBOARD_WIDGETS.EXPIRING_SOON,
  DASHBOARD_WIDGETS.EXPIRED_DOCUMENTS,
];

/* -------------------------------------------------------------------------- */
/*                           Widget Configuration                             */
/* -------------------------------------------------------------------------- */

export const DASHBOARD_WIDGET_CONFIG = Object.freeze({
  [DASHBOARD_WIDGETS.DOCUMENT_STATUS]: {
    title: "Document Status",
  },
  [DASHBOARD_WIDGETS.COMPLETION_PERCENTAGE]: {
    title: "Completion Percentage",
  },
  [DASHBOARD_WIDGETS.MISSING_DOCUMENTS]: {
    title: "Missing Documents",
  },
  [DASHBOARD_WIDGETS.DOCUMENTS_UNDER_APPROVAL]: {
    title: "Documents Under Approval",
  },
  [DASHBOARD_WIDGETS.EXPIRING_SOON]: {
    title: "Expiring Soon",
  },
  [DASHBOARD_WIDGETS.EXPIRED_DOCUMENTS]: {
    title: "Expired Documents",
  },
});

/* -------------------------------------------------------------------------- */
/*                              Status Filters                                */
/* -------------------------------------------------------------------------- */

export const DASHBOARD_STATUS_FILTERS = [
  DOCUMENT_STATUS.DRAFT,
  DOCUMENT_STATUS.PENDING,
  DOCUMENT_STATUS.UNDER_REVIEW,
  DOCUMENT_STATUS.UNDER_APPROVAL,
  DOCUMENT_STATUS.APPROVED,
  DOCUMENT_STATUS.EXPIRED,
];

/* -------------------------------------------------------------------------- */
/*                               Expiry Filters                               */
/* -------------------------------------------------------------------------- */

export const EXPIRY_DAY_FILTERS = Object.freeze({
  NEXT_7_DAYS: 7,
  NEXT_10_DAYS: 10,
  NEXT_30_DAYS: 30,
  NEXT_60_DAYS: 60,
  NEXT_90_DAYS: 90,
});

export const DOCUMENT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

/* -------------------------------------------------------------------------- */
/*                            Dashboard Defaults                              */
/* -------------------------------------------------------------------------- */

export const DASHBOARD_DEFAULT_VALUES = Object.freeze({
  totalDocuments: 0,
  approvedDocuments: 0,
  pendingDocuments: 0,
  expiredDocuments: 0,
  missingDocuments: 0,
  expiringSoonDocuments: 0,
  completionPercentage: 0,
});

const dashboardConstants = {
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDGET_ORDER,
  DASHBOARD_WIDGET_CONFIG,
  DASHBOARD_STATUS_FILTERS,
  EXPIRY_DAY_FILTERS,
  DASHBOARD_DEFAULT_VALUES,
};

export default dashboardConstants;
