import React from "react";
import LogCrudTable from "./LogCrudTable";

// Site Visit Log — Study Workspace → Logs.
// Thin, self-contained wrapper over the shared LogCrudTable. Only the
// columns, form fields, status options and search/filter config are
// defined here; data + persistence stay in StudyLogsTab (the parent),
// exactly like Training Log / Delegation Log.

const SITE_VISIT_COLUMNS = [
  { key: "visitId", label: "Visit ID" },
  { key: "site", label: "Site" },
  { key: "visitType", label: "Visit Type" },
  { key: "visitDate", label: "Visit Date" },
  { key: "monitor", label: "Monitor" },
  { key: "status", label: "Status" }
];

const SITE_VISIT_FORM_FIELDS = [
  {
    key: "visitId",
    label: "Visit ID",
    type: "text",
    required: true,
    placeholder: "e.g. SV-001"
  },
  {
    key: "site",
    label: "Site",
    type: "site",
    required: true,
    placeholder: "e.g. Apollo Hospital, Hyderabad"
  },
  {
    key: "visitType",
    label: "Visit Type",
    type: "select",
    required: true,
    options: ["SIV", "IMV", "COV", "Other"]
  },
  {
    key: "visitDate",
    label: "Visit Date",
    type: "date",
    required: true
  },
  {
    key: "monitor",
    label: "Monitor",
    type: "text",
    placeholder: "e.g. Priya Sharma (CRA)"
  },
  {
    key: "visitPurpose",
    label: "Visit Purpose",
    type: "text",
    placeholder: "e.g. Site initiation, source data verification"
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    options: ["Planned", "Completed", "Cancelled"]
  },
  {
    key: "notes",
    label: "Notes",
    type: "textarea",
    placeholder: "Additional visit notes..."
  }
];

function SiteVisitLog(props) {
  return (
    <LogCrudTable
      title="Site Visit Log"
      recordLabel="Site Visit"
      addButtonLabel="+ Add Site Visit"
      columns={SITE_VISIT_COLUMNS}
      formFields={SITE_VISIT_FORM_FIELDS}
      emptyMessage="No site visits found"
      searchPlaceholder="Search by Visit ID, site, monitor, type or status..."
      searchFields={[
        "visitId",
        "site",
        "visitType",
        "visitDate",
        "monitor",
        "visitPurpose",
        "status",
        "notes"
      ]}
      filters={[
        { key: "visitType", label: "Visit Type" },
        { key: "status", label: "Status" }
      ]}
      {...props}
    />
  );
}

export default SiteVisitLog;
