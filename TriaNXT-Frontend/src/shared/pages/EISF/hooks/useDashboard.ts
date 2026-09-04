import { useMemo } from "react";
import DOCUMENT_STATUS from "../Constants/documentStatus";

export default function useDashboard(documents: any = []) {
  const dashboardData = useMemo(() => {
    const safeDocuments = Array.isArray(documents) ? documents : [];

    const today = new Date();

    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    const totalDocuments = safeDocuments.length;

    const approvedDocuments = safeDocuments.filter(
      (document) => document.status === DOCUMENT_STATUS.APPROVED
    );

    const pendingDocuments = safeDocuments.filter((document) =>
      [
        DOCUMENT_STATUS.PENDING,
        DOCUMENT_STATUS.UNDER_REVIEW,
      ].includes(document.status)
    );

    const draftDocuments = safeDocuments.filter(
      (document) => document.status === DOCUMENT_STATUS.DRAFT
    );

    const missingDocuments = safeDocuments.filter(
      (document) => document.status === DOCUMENT_STATUS.MISSING
    );

    const expiredDocuments = safeDocuments.filter((document) => {
      if (document.status === DOCUMENT_STATUS.EXPIRED) return true;
      if (!document.expiryDate || document.expiryDate === "-") return false;

      return new Date(document.expiryDate) < today;
    });

    const expiringSoonDocuments = safeDocuments.filter((document) => {
      if (!document.expiryDate || document.expiryDate === "-") return false;
      if (document.status === DOCUMENT_STATUS.EXPIRED) return false;

      const expiryDate = new Date(document.expiryDate);

      return expiryDate >= today && expiryDate <= next30Days;
    });

    const documentsUnderApproval = safeDocuments.filter((document) =>
      [
        DOCUMENT_STATUS.PENDING,
        DOCUMENT_STATUS.UNDER_REVIEW,
        DOCUMENT_STATUS.UNDER_APPROVAL,
      ].includes(document.status)
    );

    const completionPercentage =
      totalDocuments === 0
        ? 0
        : Math.round(
            (approvedDocuments.length / totalDocuments) * 100
          );

    return {
      documents: safeDocuments,

      totalDocuments,

      approvedDocuments,
      pendingDocuments,
      draftDocuments,
      missingDocuments,

      expiredDocuments,
      expiringSoonDocuments,
      documentsUnderApproval,

      approvedCount: approvedDocuments.length,
      pendingCount: pendingDocuments.length,
      draftCount: draftDocuments.length,
      missingCount: missingDocuments.length,
      expiredCount: expiredDocuments.length,
      expiringSoonCount: expiringSoonDocuments.length,
      documentsUnderApprovalCount:
        documentsUnderApproval.length,

      completionPercentage,

      hasDocuments: totalDocuments > 0,
      isEmpty: totalDocuments === 0,
    };
  }, [documents]);

  return dashboardData;
}
