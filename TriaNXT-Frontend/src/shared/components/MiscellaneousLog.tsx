import React from "react";
import LogCrudTable from "./LogCrudTable";

// Miscellaneous Log — Study Workspace → Logs.
// Thin, self-contained wrapper over the shared LogCrudTable. Only the
// columns, form fields, status options and search/filter config are
// defined here; data + persistence stay in StudyLogsTab (the parent),
// exactly like Training Log / Delegation Log.

const MISCELLANEOUS_COLUMNS = [
  { key: "logId", label: "Log ID" },
  { key: "site", label: "Site" },
  { key: "category", label: "Category" },
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "createdBy", label: "Created By" },
  { key: "status", label: "Status" }
];

const MISCELLANEOUS_FORM_FIELDS = [
  {
    key: "logId",
    label: "Log ID",
    type: "text",
    required: true,
    placeholder: "e.g. ML-001"
  },
  {
    key: "site",
    label: "Site",
    type: "site",
    required: true,
    placeholder: "e.g. Apollo Hospital, Hyderabad"
  },
  {
    key: "category",
    label: "Category",
    type: "text",
    required: true,
    placeholder: "e.g. Site Communication, Document, General"
  },
  {
    key: "date",
    label: "Date",
    type: "date",
    required: true
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    required: true,
    placeholder: "Describe the entry..."
  },
  {
    key: "createdBy",
    label: "Created By",
    type: "text",
    required: true,
    placeholder: "e.g. John Doe (SC)"
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    options: ["Open", "Closed"]
  },
  {
    key: "notes",
    label: "Notes",
    type: "textarea",
    placeholder: "Additional notes..."
  }
];

function MiscellaneousLog(props) {
  return (
    <LogCrudTable
      title="Miscellaneous Log"
      recordLabel="Log Entry"
      addButtonLabel="+ Add Log Entry"
      columns={MISCELLANEOUS_COLUMNS}
      formFields={MISCELLANEOUS_FORM_FIELDS}
      emptyMessage="No miscellaneous log entries found"
      searchPlaceholder="Search by Log ID, site, category, description, created by or status..."
      searchFields={[
        "logId",
        "site",
        "category",
        "date",
        "description",
        "createdBy",
        "status",
        "notes"
      ]}
      filters={[
        { key: "category", label: "Category" },
        { key: "status", label: "Status" }
      ]}
      {...props}
    />
  );
}

export default MiscellaneousLog;
