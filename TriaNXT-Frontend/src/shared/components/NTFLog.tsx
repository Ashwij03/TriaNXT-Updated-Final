import React from "react";
import LogCrudTable from "./LogCrudTable";

// NTF Log (Notify Log) — Study Workspace → Logs.
// Thin, self-contained wrapper over the shared LogCrudTable. Only the
// columns, form fields, status options and search/filter config are
// defined here; data + persistence stay in StudyLogsTab (the parent),
// exactly like Training Log / Delegation Log.

const NTF_COLUMNS = [
  { key: "ntfId", label: "NTF ID" },
  { key: "site", label: "Site" },
  { key: "notificationType", label: "Notification Type" },
  { key: "date", label: "Date" },
  { key: "sentBy", label: "Sent By" },
  { key: "status", label: "Status" }
];

const NTF_FORM_FIELDS = [
  {
    key: "ntfId",
    label: "NTF ID",
    type: "text",
    required: true,
    placeholder: "e.g. NTF-001"
  },
  {
    key: "site",
    label: "Site",
    type: "site",
    required: true,
    placeholder: "e.g. Apollo Hospital, Hyderabad"
  },
  {
    key: "notificationType",
    label: "Notification Type",
    type: "text",
    required: true,
    placeholder: "e.g. Amendment, Safety, Administrative"
  },
  {
    key: "date",
    label: "Date",
    type: "date",
    required: true
  },
  {
    key: "subject",
    label: "Subject / Title",
    type: "text",
    required: true,
    placeholder: "Notification subject or title"
  },
  {
    key: "description",
    label: "Description / Message",
    type: "textarea",
    placeholder: "Notification message body..."
  },
  {
    key: "sentBy",
    label: "Sent By",
    type: "text",
    required: true,
    placeholder: "e.g. Regulatory Team"
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    options: ["Draft", "Sent", "Closed"]
  },
  {
    key: "notes",
    label: "Notes",
    type: "textarea",
    placeholder: "Additional notes..."
  }
];

function NTFLog(props) {
  return (
    <LogCrudTable
      title="NTF Log"
      recordLabel="NTF"
      addButtonLabel="+ Add NTF"
      columns={NTF_COLUMNS}
      formFields={NTF_FORM_FIELDS}
      emptyMessage="No NTF records found"
      searchPlaceholder="Search by NTF ID, site, type, subject, sent by or status..."
      searchFields={[
        "ntfId",
        "site",
        "notificationType",
        "date",
        "subject",
        "description",
        "sentBy",
        "status",
        "notes"
      ]}
      filters={[
        { key: "notificationType", label: "Notification Type" },
        { key: "status", label: "Status" }
      ]}
      {...props}
    />
  );
}

export default NTFLog;
