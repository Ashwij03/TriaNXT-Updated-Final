import EISF_ASSIGNED_MODULES from "../eisfAssignedModuleConfig";
import DOCUMENT_STATUS from "../Constants/documentStatus";

const statusCycle = [
  DOCUMENT_STATUS.APPROVED,
  DOCUMENT_STATUS.PENDING,
  DOCUMENT_STATUS.DRAFT,
  DOCUMENT_STATUS.UNDER_REVIEW,
  DOCUMENT_STATUS.UNDER_APPROVAL,
  DOCUMENT_STATUS.EXPIRED,
];

const owners = [
  "Principal Investigator",
  "Study Coordinator",
  "Research Nurse",
  "Regulatory Specialist",
  "Data Manager",
];

const modifiedDates = [
  "02-May-2026",
  "15-Mar-2026",
  "21-Apr-2026",
  "08-Jun-2026",
  "27-Feb-2026",
];

const expiryDates = [
  "-",
  "30-Dec-2026",
  "15-Jan-2027",
  "01-Jun-2026",
  "-",
];

function fileNameFromDocumentName(documentName = "Document") {
  return `${documentName.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}.pdf`;
}

function buildHistory(document) {
  const currentVersion = document.version || "1.0";

  return [
    {
      version: "1.0",
      date: "10-Jan-2026",
      user: "Study Coordinator",
      status: DOCUMENT_STATUS.APPROVED,
    },
    {
      version: currentVersion,
      date: document.modifiedDate,
      user: document.uploadedBy,
      status: document.status,
    },
  ];
}

function buildAuditTrail(document) {
  return [
    {
      date: "10-Jan-2026",
      user: "Study Coordinator",
      action: "Uploaded",
      remarks: "Mock document created for eISF module filing.",
    },
    {
      date: document.modifiedDate,
      user: document.uploadedBy,
      action: "Status Updated",
      remarks: `Current status: ${document.status}.`,
    },
  ];
}

const eisfModuleDocuments = Object.values(EISF_ASSIGNED_MODULES).flatMap((module) =>
  module.sections.flatMap((section, sectionIndex) =>
    (section.documents || []).map((sourceDocument, documentIndex) => {
      const sequence = sectionIndex + documentIndex;
      const documentName =
        sourceDocument.documentName || sourceDocument.name || section.title;
      const status = statusCycle[sequence % statusCycle.length] || sourceDocument.status;
      const uploadedBy = sourceDocument.uploadedBy || owners[sequence % owners.length];
      const modifiedDate =
        sourceDocument.modifiedDate || modifiedDates[sequence % modifiedDates.length];
      const expiryDate =
        sourceDocument.expiryDate && sourceDocument.expiryDate !== "-"
          ? sourceDocument.expiryDate
          : expiryDates[sequence % expiryDates.length];

      const document = {
        id: `${module.id}-${section.id}-${documentIndex + 1}`,
        moduleId: module.id,
        moduleTitle: module.title,
        section: section.id,
        sectionId: section.id,
        folderId: section.id,
        folderTitle: section.title,
        documentName,
        name: documentName,
        description: section.description,
        category: sourceDocument.category || sourceDocument.documentType || section.title,
        documentType: sourceDocument.documentType || sourceDocument.category || section.title,
        version: sourceDocument.version || (documentIndex === 0 ? "1.0" : `1.${documentIndex}`),
        status,
        uploadedBy,
        createdBy: uploadedBy,
        approvedBy:
          sourceDocument.approvedBy ||
          (status === DOCUMENT_STATUS.APPROVED ? "Principal Investigator" : "-"),
        modifiedDate,
        expiryDate,
        fileName: sourceDocument.fileName || fileNameFromDocumentName(documentName),
        fileSize: sourceDocument.fileSize || `${(0.8 + documentIndex * 0.3).toFixed(1)} MB`,
      };

      return {
        ...document,
        history: sourceDocument.history || buildHistory(document),
        versions: sourceDocument.versions || buildHistory(document),
        auditTrail: sourceDocument.auditTrail || buildAuditTrail(document),
      };
    })
  )
);

export default eisfModuleDocuments;
