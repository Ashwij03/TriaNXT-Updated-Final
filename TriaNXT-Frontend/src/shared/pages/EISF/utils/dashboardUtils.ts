import DOCUMENT_STATUS from "../Constants/documentStatus";

/**
 * Calculate completion percentage.
 */
export const calculateCompletionPercentage = (
  approved = 0,
  total = 0
) => {
  if (!total) return 0;

  return Math.round((approved / total) * 100);
};

/**
 * Returns dashboard summary.
 */
export const getDashboardSummary = (documents: any = []) => {
  const today = new Date();

  const approvedDocuments = documents.filter(
    (doc) => doc.status === DOCUMENT_STATUS.APPROVED
  );

  const pendingDocuments = documents.filter((doc) =>
    [
      DOCUMENT_STATUS.PENDING,
      DOCUMENT_STATUS.UNDER_REVIEW,
      DOCUMENT_STATUS.UNDER_APPROVAL,
    ].includes(doc.status)
  );

  const expiredDocuments = documents.filter((doc) => {
    if (doc.status === DOCUMENT_STATUS.EXPIRED) return true;

    if (!doc.expiryDate || doc.expiryDate === "-") return false;

    return new Date(doc.expiryDate) < today;
  });

  const missingDocuments = documents.filter(
    (doc) => doc.status === DOCUMENT_STATUS.MISSING
  );

  const expiringSoonDocuments = getExpiringSoonDocuments(documents);

  return {
    totalDocuments: documents.length,

    approvedDocuments: approvedDocuments.length,

    pendingDocuments: pendingDocuments.length,

    expiredDocuments: expiredDocuments.length,

    missingDocuments: missingDocuments.length,

    expiringSoonDocuments: expiringSoonDocuments.length,

    completionPercentage: calculateCompletionPercentage(
      approvedDocuments.length,
      documents.length
    ),
  };
};

/**
 * Documents expiring within given days.
 */
export const getExpiringSoonDocuments = (documents: any = [],
  days = 30
) => {
  const today = new Date();

  const target = new Date();

  target.setDate(today.getDate() + days);

  return documents.filter((doc) => {
    if (!doc.expiryDate || doc.expiryDate === "-") return false;
    if (doc.status === DOCUMENT_STATUS.EXPIRED) return false;

    const expiry = new Date(doc.expiryDate);

    return expiry >= today && expiry <= target;
  });
};

/**
 * Generic dashboard cards.
 */
export const buildDashboardCards = (summary: any = {},
  cardConfig = [
    {
      key: "totalDocuments",
      title: "Total Documents",
    },
    {
      key: "approvedDocuments",
      title: "Approved",
    },
    {
      key: "pendingDocuments",
      title: "Pending",
    },
    {
      key: "expiredDocuments",
      title: "Expired",
    },
    {
      key: "missingDocuments",
      title: "Missing",
    },
    {
      key: "completionPercentage",
      title: "Completion",
      suffix: "%",
    },
  ]
) => {
  return cardConfig.map((card) => ({
    ...card,
    value: summary[card.key] ?? 0,
  }));
};

/**
 * Generic dashboard cards used by the eISF module workspace reference layout.
 */
export const buildReferenceDashboardCards = (documents: any = [],sections: any = []) => {
  const summary = getDashboardSummary(documents);
  const total = summary.totalDocuments;
  const percent = (count) => (total ? `${Math.round((count / total) * 100)}%` : "0%");
  const completedSections = sections.filter((section) => {
    const sectionDocuments = documents.filter(
      (document) => document.section === section.id || document.sectionId === section.id
    );

    return (
      sectionDocuments.length > 0 &&
      sectionDocuments.every((document) => document.status === DOCUMENT_STATUS.APPROVED)
    );
  }).length;

  return [
    {
      key: "total",
      title: "Total Documents",
      value: total,
      detail: "Across all sections",
      icon: "□",
      color: "#2f80ed",
    },
    {
      key: "approved",
      title: "Approved",
      value: summary.approvedDocuments,
      detail: percent(summary.approvedDocuments),
      icon: "▤",
      color: "#2bb673",
    },
    {
      key: "underReview",
      title: "Under Review",
      value: summary.pendingDocuments,
      detail: percent(summary.pendingDocuments),
      icon: "◷",
      color: "#f5a524",
    },
    {
      key: "expired",
      title: "Expired",
      value: summary.expiredDocuments,
      detail: percent(summary.expiredDocuments),
      icon: "◴",
      color: "#ef5b65",
    },
    {
      key: "completion",
      title: "Section Completion",
      value: summary.completionPercentage,
      suffix: "%",
      caption: "Overall Completion",
      detail: `${completedSections} / ${sections.length} sections`,
      color: "#2f80ed",
    },
  ];
};

/**
 * Returns dashboard metric.
 */
export const getDashboardMetric = (summary: any = {},
  metric
) => {
  return summary[metric] ?? 0;
};

/**
 * Returns whether dashboard has data.
 */
export const hasDashboardData = (documents: any = []) =>
  documents.length > 0;

/**
 * Returns empty dashboard summary.
 */
export const getEmptyDashboardSummary = () => ({
  totalDocuments: 0,
  approvedDocuments: 0,
  pendingDocuments: 0,
  expiredDocuments: 0,
  missingDocuments: 0,
  expiringSoonDocuments: 0,
  completionPercentage: 0,
});
