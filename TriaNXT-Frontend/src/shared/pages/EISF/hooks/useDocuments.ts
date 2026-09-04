import { useMemo } from "react";
import DOCUMENT_STATUS from "../Constants/documentStatus";

export default function useDocuments(documents: any = []) {
  const safeDocuments = useMemo(
    () => (Array.isArray(documents) ? documents : []),
    [documents]
  );

  const totalDocuments = safeDocuments.length;

  const approvedDocuments = useMemo(
    () =>
      safeDocuments.filter(
        (document) => document.status === DOCUMENT_STATUS.APPROVED
      ),
    [safeDocuments]
  );

  const pendingDocuments = useMemo(
    () =>
      safeDocuments.filter((document) =>
        [
          DOCUMENT_STATUS.PENDING,
          DOCUMENT_STATUS.UNDER_REVIEW,
          DOCUMENT_STATUS.UNDER_APPROVAL,
        ].includes(document.status)
      ),
    [safeDocuments]
  );

  const draftDocuments = useMemo(
    () =>
      safeDocuments.filter(
        (document) => document.status === DOCUMENT_STATUS.DRAFT
      ),
    [safeDocuments]
  );

  const expiredDocuments = useMemo(
    () =>
      safeDocuments.filter(
        (document) => document.status === DOCUMENT_STATUS.EXPIRED
      ),
    [safeDocuments]
  );

  const missingDocuments = useMemo(
    () =>
      safeDocuments.filter(
        (document) => document.status === DOCUMENT_STATUS.MISSING
      ),
    [safeDocuments]
  );

  const completionPercentage = useMemo(() => {
    if (!totalDocuments) return 0;

    return Math.round(
      (approvedDocuments.length / totalDocuments) * 100
    );
  }, [approvedDocuments.length, totalDocuments]);

  const hasDocuments = totalDocuments > 0;

  const isEmpty = totalDocuments === 0;

  return {
    documents: safeDocuments,

    totalDocuments,

    approvedDocuments,
    pendingDocuments,
    draftDocuments,
    expiredDocuments,
    missingDocuments,

    approvedCount: approvedDocuments.length,
    pendingCount: pendingDocuments.length,
    draftCount: draftDocuments.length,
    expiredCount: expiredDocuments.length,
    missingCount: missingDocuments.length,

    completionPercentage,

    hasDocuments,
    isEmpty,
  };
}
