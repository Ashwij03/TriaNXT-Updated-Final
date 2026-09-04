import { getPortfolioStudies, getSites } from "./sponsorDataStore";

const DOCUMENT_REPORTS_EVENT = "sponsor-document-reports-updated";

let documentRecords = [];

let reportSubscriptions = [];

function emitUpdate() {
  window.dispatchEvent(new CustomEvent(DOCUMENT_REPORTS_EVENT));
}

function cloneRecords() {
  return documentRecords.map((record) => ({ ...record }));
}

function isExpired(record, today = new Date()) {
  if (!record.expiryDate) {
    return false;
  }

  const expiry = new Date(record.expiryDate);
  return !Number.isNaN(expiry.getTime()) && expiry < today;
}

export function getDocumentReportRecords() {
  return cloneRecords();
}

export function getReportFilterOptions() {
  const studies = ["All", ...new Set<any>(documentRecords.map((item) => item.study))];
  const sites = ["All", ...new Set<any>(documentRecords.map((item) => item.site))];
  const folders = ["All", ...new Set<any>(documentRecords.map((item) => item.folder))];
  const statuses = [
    "All",
    ...new Set<any>(documentRecords.map((item) => item.status))
  ];

  return { studies, sites, folders, statuses };
}

export function filterDocumentRecords(filters: any = {}) {
  const study = filters.study || "All";
  const site = filters.site || "All";
  const folder = filters.folder || "All";
  const status = filters.status || "All";

  return cloneRecords().filter((record) => {
    if (study !== "All" && record.study !== study) {
      return false;
    }

    if (site !== "All" && record.site !== site) {
      return false;
    }

    if (folder !== "All" && record.folder !== folder) {
      return false;
    }

    if (status !== "All" && record.status !== status) {
      return false;
    }

    return true;
  });
}

export function getMissingMetadataReport(filters) {
  return filterDocumentRecords(filters).filter((record) => !record.hasMetadata);
}

export function getMissingDocumentsReport(filters) {
  return filterDocumentRecords(filters).filter(
    (record) => record.status === "Missing" || !record.uploadedDate
  );
}

export function getExpiredDocumentsReport(filters) {
  return filterDocumentRecords(filters).filter((record) => isExpired(record));
}

export function getPendingReviewReport(filters) {
  return filterDocumentRecords(filters).filter(
    (record) => record.status === "Pending Review"
  );
}

export function getDocumentCompletionReport(filters) {
  return filterDocumentRecords(filters).map((record) => ({
    ...record,
    completionScore: record.isComplete ? 100 : record.hasMetadata ? 65 : 25
  }));
}

export function getDocumentStatusSummary(filters) {
  const records = filterDocumentRecords(filters);
  const summary: Record<string, any> = {};;

  records.forEach((record) => {
    summary[record.status] = (summary[record.status] || 0) + 1;
  });

  return Object.entries(summary).map(([name, value]) => ({ name, value }));
}

export function getComplianceAnalytics(filters) {
  const records = filterDocumentRecords(filters);
  const total = records.length || 1;
  const complete = records.filter((record) => record.isComplete).length;
  const withMetadata = records.filter((record) => record.hasMetadata).length;
  const expired = records.filter((record) => isExpired(record)).length;
  const pending = records.filter(
    (record) => record.status === "Pending Review"
  ).length;

  return [
    { name: "Complete", value: complete },
    { name: "Missing Metadata", value: records.length - withMetadata },
    { name: "Expired", value: expired },
    { name: "Pending Review", value: pending },
    { name: "Compliance Rate", value: Math.round((complete / total) * 100) }
  ];
}

export function getReportSubscriptions() {
  return reportSubscriptions.map((item) => ({ ...item }));
}

export function saveReportSubscription(subscription) {
  const existingIndex = reportSubscriptions.findIndex(
    (item) => item.id === subscription.id
  );

  if (existingIndex >= 0) {
    reportSubscriptions[existingIndex] = { ...subscription };
  } else {
    reportSubscriptions = [
      ...reportSubscriptions,
      {
        ...subscription,
        id: subscription.id || `SUB-${Date.now()}`
      }
    ];
  }

  emitUpdate();
  return getReportSubscriptions();
}

export function getSponsorDocumentReportCards() {
  return [
    {
      title: "Missing Metadata Report",
      description: "Documents missing required metadata fields",
      type: "Missing Metadata Report"
    },
    {
      title: "Missing Documents Report",
      description: "Required documents not yet uploaded",
      type: "Missing Documents Report"
    },
    {
      title: "Expired Documents Report",
      description: "Documents past their expiry date",
      type: "Expired Documents Report"
    },
    {
      title: "Pending Review Report",
      description: "Documents awaiting review or approval",
      type: "Pending Review Report"
    },
    {
      title: "Document Completion Report",
      description: "Completion score by document",
      type: "Document Completion Report"
    },
    {
      title: "Document Status Summary",
      description: "Status distribution across documents",
      type: "Document Status Summary"
    },
    {
      title: "Compliance Analytics Chart",
      description: "Compliance metrics and analytics",
      type: "Compliance Analytics Chart"
    }
  ];
}

export function getPortfolioStudyOptions() {
  return getPortfolioStudies().map((study) => study.studyId);
}

export function getSiteOptions() {
  return getSites().map((site) => site.name);
}

export { DOCUMENT_REPORTS_EVENT };
