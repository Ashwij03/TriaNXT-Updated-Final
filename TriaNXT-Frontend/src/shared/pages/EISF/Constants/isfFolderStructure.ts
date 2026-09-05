/**
 * Standard Investigator Site File (ISF) folder structure — Architecture
 * Blueprint for the eISF Regulatory Document Repository.
 *
 * The seven top-level folders are the canonical taxonomy (mirrored
 * server-side in tria_engine/apps/eisf/structure.py, endpoint
 * GET /api/eisf/folders). Every granular eISF menu module maps onto one of
 * them through `sourceModuleIds` so documents can be classified under the
 * standard structure without restructuring the existing 22-module menu.
 */

export const ISF_FOLDER_STRUCTURE = [
  {
    key: "protocol",
    label: "Protocol",
    description:
      "Approved study protocol, protocol amendments and related correspondence.",
    sourceModuleIds: ["3.0"],
    typicalDocuments: [
      "Current Approved Study Protocol",
      "Protocol Amendments",
      "Site Protocol Version Tracker",
    ],
  },
  {
    key: "irb_iec",
    label: "IRB/IEC",
    description: "Ethics committee (IRB/IEC) approvals, submissions and correspondence.",
    sourceModuleIds: ["6.0"],
    typicalDocuments: [
      "Ethics Approval Letters",
      "Ethics Submission Documents",
      "Committee Composition & Compliance",
    ],
  },
  {
    key: "regulatory",
    label: "Regulatory",
    description: "Regulatory authorisations and supplementary regulatory documents.",
    sourceModuleIds: ["5.0"],
    typicalDocuments: ["Regulatory Authorisation", "Supplementary Documents"],
  },
  {
    key: "cvs_licenses",
    label: "CVs/Licenses",
    description:
      "Investigator/staff curricula vitae, medical licences, GCP and other training certificates.",
    sourceModuleIds: ["1.0"],
    typicalDocuments: [
      "CVs",
      "Medical Licences",
      "GCP Training Certificates",
      "EDC Training Certifications",
    ],
  },
  {
    key: "icf",
    label: "ICF",
    description:
      "Informed consent forms (PGICF/PICF), version trackers and signed consent documents.",
    sourceModuleIds: ["4.0"],
    typicalDocuments: [
      "PGICF & PICF Version Tracker",
      "Current PGICF & PICFs",
      "Signed PGICF & PICFs",
    ],
  },
  {
    key: "financials",
    label: "Financials",
    description: "Finance documentation: invoices, receipts and related correspondence.",
    sourceModuleIds: ["19.0"],
    typicalDocuments: ["Invoices / Receipts", "Related Correspondence"],
  },
  {
    key: "monitoring_reports",
    label: "Monitoring Reports",
    description: "Monitoring visit reports, correspondence, audits and inspections.",
    sourceModuleIds: ["15.0"],
    typicalDocuments: [
      "Site Monitoring Log",
      "Monitoring Visit Correspondence and Feedback",
      "Trial Close-Out",
      "Regulatory Inspections Reports and Correspondence",
    ],
  },
];

export const ISF_FOLDER_KEYS = ISF_FOLDER_STRUCTURE.map((folder) => folder.key);

export const ISF_FOLDER_LABELS = Object.fromEntries(
  ISF_FOLDER_STRUCTURE.map((folder) => [folder.key, folder.label])
);

export function isfFolderLabel(folderKey) {
  return ISF_FOLDER_LABELS[folderKey] || folderKey || "";
}

/** Map a granular eISF menu module id onto its standard folder (or null). */
export function standardFolderForModuleId(moduleId) {
  const id = String(moduleId || "");
  return (
    ISF_FOLDER_STRUCTURE.find((folder) => folder.sourceModuleIds.includes(id)) ||
    null
  );
}

/** Standard folder for a normalized EISF document (moduleId is required
 *  on every record normalized by documentService). */
export function standardFolderForDocument(document: any = {}) {
  const folderKey = document.isfFolderKey || document.folderKey;
  if (folderKey && ISF_FOLDER_KEYS.includes(folderKey)) {
    return ISF_FOLDER_STRUCTURE.find((folder) => folder.key === folderKey) || null;
  }
  return standardFolderForModuleId(document.moduleId);
}

export default ISF_FOLDER_STRUCTURE;
