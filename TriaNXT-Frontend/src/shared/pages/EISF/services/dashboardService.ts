import { getEISFModuleDocuments } from "./eisfService";
import DOCUMENT_STATUS from "../Constants/documentStatus";

/**
 * Returns all dashboard summary values.
 */
export function getDashboardSummary(..._ignored: any[]) {
  const documents = getEISFModuleDocuments();

  const totalDocuments = documents.length;

  const approvedDocuments = documents.filter(
    (doc) => doc.status === DOCUMENT_STATUS.APPROVED
  ).length;

  const pendingDocuments = documents.filter(
    (doc) =>
      doc.status === DOCUMENT_STATUS.PENDING ||
      doc.status === DOCUMENT_STATUS.UNDER_REVIEW
  ).length;

  const expiredDocuments = documents.filter(
    (doc) => doc.status === DOCUMENT_STATUS.EXPIRED
  ).length;

  const missingDocuments = documents.filter(
    (doc) => doc.status === DOCUMENT_STATUS.MISSING
  ).length;

  const completionPercentage =
    totalDocuments === 0
      ? 0
      : Math.round((approvedDocuments / totalDocuments) * 100);

  return {
    totalDocuments,
    approvedDocuments,
    pendingDocuments,
    expiredDocuments,
    missingDocuments,
    completionPercentage,
  };
}

/**
 * Returns document status counts.
 */
export function getDocumentStatusSummary(..._ignored: any[]) {
  const documents = getEISFModuleDocuments();

  return {
    draft: documents.filter(
      (doc) => doc.status === DOCUMENT_STATUS.DRAFT
    ).length,

    pending: documents.filter(
      (doc) => doc.status === DOCUMENT_STATUS.PENDING
    ).length,

    underReview: documents.filter(
      (doc) => doc.status === DOCUMENT_STATUS.UNDER_REVIEW
    ).length,

    approved: documents.filter(
      (doc) => doc.status === DOCUMENT_STATUS.APPROVED
    ).length,

    expired: documents.filter(
      (doc) => doc.status === DOCUMENT_STATUS.EXPIRED
    ).length,

    archived: documents.filter(
      (doc) => doc.status === DOCUMENT_STATUS.ARCHIVED
    ).length,
  };
}

/**
 * Documents pending approval.
 */
export function getDocumentsUnderApproval(..._ignored: any[]) {
  return getEISFModuleDocuments().filter(
    (doc) =>
      doc.status === DOCUMENT_STATUS.PENDING ||
      doc.status === DOCUMENT_STATUS.UNDER_REVIEW
  );
}

/**
 * Expired documents.
 */
export function getExpiredDocuments(..._ignored: any[]) {
  return getEISFModuleDocuments().filter(
    (doc) => doc.status === DOCUMENT_STATUS.EXPIRED
  );
}

/**
 * Missing documents.
 */
export function getMissingDocuments(..._ignored: any[]) {
  return getEISFModuleDocuments().filter(
    (doc) => doc.status === DOCUMENT_STATUS.MISSING
  );
}

/**
 * Dashboard completion percentage.
 */
export function getCompletionPercentage() {
  return getDashboardSummary().completionPercentage;
}

/* -------------------------------------------------------------------------- */
/*                         Additional Reusable Helpers                         */
/* -------------------------------------------------------------------------- */

/**
 * Returns documents by status.
 */
export function getDocumentsByStatus(status) {
  return getEISFModuleDocuments().filter(
    (doc) => doc.status === status
  );
}

/**
 * Returns total document count.
 */
export function getTotalDocuments() {
  return getEISFModuleDocuments().length;
}

/**
 * Returns approval percentage.
 */
export function getApprovalPercentage() {
  const summary = getDashboardSummary();

  return summary.totalDocuments
    ? Math.round(
        (summary.approvedDocuments / summary.totalDocuments) * 100
      )
    : 0;
}

/**
 * Returns pending percentage.
 */
export function getPendingPercentage() {
  const summary = getDashboardSummary();

  return summary.totalDocuments
    ? Math.round(
        (summary.pendingDocuments / summary.totalDocuments) * 100
      )
    : 0;
}

/**
 * Returns expired percentage.
 */
export function getExpiredPercentage() {
  const summary = getDashboardSummary();

  return summary.totalDocuments
    ? Math.round(
        (summary.expiredDocuments / summary.totalDocuments) * 100
      )
    : 0;
}

/**
 * Generic dashboard card data.
 * Can be reused by DashboardCards component.
 */
export function getDashboardCards() {
  const summary = getDashboardSummary();

  return [
    {
      key: "total",
      title: "Total Documents",
      value: summary.totalDocuments,
    },
    {
      key: "approved",
      title: "Approved",
      value: summary.approvedDocuments,
    },
    {
      key: "pending",
      title: "Pending",
      value: summary.pendingDocuments,
    },
    {
      key: "expired",
      title: "Expired",
      value: summary.expiredDocuments,
    },
    {
      key: "missing",
      title: "Missing",
      value: summary.missingDocuments,
    },
    {
      key: "completion",
      title: "Completion",
      value: summary.completionPercentage,
      suffix: "%",
    },
  ];
}
