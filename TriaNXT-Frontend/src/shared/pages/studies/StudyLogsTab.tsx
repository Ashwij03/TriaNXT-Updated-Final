import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import DataTable from "../../components/dashboard/shared/DataTable";
import DocumentFolderManager from "../../components/DocumentFolderManager";
import DelegationLog from "../../components/DelegationLog";
import TrainingLog from "../../components/TrainingLog";
import SiteVisitLog from "../../components/SiteVisitLog";
import NTFLog from "../../components/NTFLog";
import MiscellaneousLog from "../../components/MiscellaneousLog";
import AELog from "../../components/AELog";
import PDLog from "../../components/PDLog";
import TempLog from "../../components/TempLog";

import {
  getStudyLogs,
  getDelegationLogs,
  getTrainingLogs,
  getSiteVisitLogs,
  getNTFLogs,
  getMiscellaneousLogs,
  saveSiteVisitLogs,
  saveNTFLogs,
  saveMiscellaneousLogs,
  getAELogs,
  getPDLogs,
  getTempLogs,
  saveAELogs,
  savePDLogs,
  saveTempLogs
} from "../../services/adminService";
import { getSiteNumberDirectory } from "../../services/filterService";
import { getStudyByCode } from "../../services/studyService";
import "./StudyLogsTab.css";

function StudyLogsTab() {
  const [staff, setStaff] = useState<any[]>([]);
  const { id } = useParams();

  const study = getStudyByCode(id);
  const studyCode = study?.code || id;

  const [showModal, setShowModal] = useState(false);

  // ---- NEW: which sub-log is active within the Study Logs tab.
  // Follows the same "single source of truth in the parent" pattern the
  // Delegation Log uses, so Training Log data is fetched here and the
  // child component stays presentational. ----
  const [activeLog, setActiveLog] = useState("delegation");
  const [trainingRecords, setTrainingRecords] = useState<any[]>([]);

  // ---- NEW: Site Visit / NTF / Miscellaneous log records follow the
  // same pattern as trainingRecords — fetched from the shared log
  // services, owned here (single source of truth), and passed down to
  // the presentational log components as props. `siteOptions` feeds the
  // Site field datalist in each log's Add/Edit form. ----
  const [siteVisitLogs, setSiteVisitLogs] = useState<any[]>([]);
  const [ntfLogs, setNTFLogs] = useState<any[]>([]);
  const [miscellaneousLogs, setMiscellaneousLogs] = useState<any[]>([]);
  const [siteOptions, setSiteOptions] = useState<any[]>([]);

  // ---- Task 2A (Ramya): AE/SE, PD and Temperature log records are also
  // owned here (single source of truth) and passed down to AELog / PDLog /
  // TempLog as props. Loaded from the adminService localStorage keys, the
  // same persistence pattern the Training/Delegation logs use. ----
  const [aeRecords, setAeRecords] = useState<any[]>([]);
  const [pdRecords, setPdRecords] = useState<any[]>([]);
  const [tempRecords, setTempRecords] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: "",
    role: "",
    responsibility: "",
    status: "Active"
  });
  const ROLE_OPTIONS = [
  "Principal Investigator",
  "Sub Investigator",
  "Study Coordinator",
  "Research Nurse",
  "Clinical Research Associate",
  "Pharmacist",
  "Laboratory Technician",
  "Data Manager",
  "Regulatory Coordinator",
  "Quality Assurance",
  "Medical Monitor"
];

const RESPONSIBILITY_MAP = {
  "Principal Investigator": [
    "Medical Review",
    "Physical Exam",
    "Protocol Oversight",
    "Subject Eligibility",
    "Safety Review",
    "Adverse Event Review"
  ],

  "Sub Investigator": [
    "Medical Review",
    "Physical Exam",
    "Subject Follow-up",
    "Adverse Event Assessment"
  ],

  "Study Coordinator": [
    "eReg Access",
    "Source Documentation",
    "Visit Coordination",
    "Subject Scheduling",
    "Regulatory Documentation"
  ],

  "Research Nurse": [
    "Vital Signs",
    "Blood Collection",
    "Drug Administration",
    "ECG",
    "Sample Collection"
  ],

  "Clinical Research Associate": [
    "Source Data Verification",
    "Monitoring Visit",
    "Query Resolution",
    "Site Monitoring"
  ],

  "Pharmacist": [
    "Drug Dispensing",
    "IP Accountability",
    "Drug Storage",
    "Temperature Monitoring"
  ],

  "Laboratory Technician": [
    "Sample Collection",
    "Sample Processing",
    "Specimen Shipping",
    "Lab Testing"
  ],

  "Data Manager": [
    "Data Entry",
    "Data Validation",
    "Query Management",
    "Database Review"
  ],

  "Regulatory Coordinator": [
    "IRB Submission",
    "Regulatory Documents",
    "Essential Documents",
    "Protocol Amendment"
  ],

  "Quality Assurance": [
    "Internal Audit",
    "CAPA Review",
    "Compliance Review"
  ],

  "Medical Monitor": [
    "Medical Oversight",
    "Safety Assessment",
    "Protocol Review"
  ]
};

  // ---- NEW: Study Logs is now state instead of a static useMemo, so we can
  // append a new row every time a delegation is added/edited/deleted. ----
  const [studyLogs, setStudyLogs] = useState<any[]>([]);

  // ---- NEW: Delegation History is now owned here (single source of truth)
  // and passed down to DelegationLog via props instead of being hardcoded
  // inside the child component. ----
  const [delegationHistory, setDelegationHistory] = useState<any[]>([]);

  // Seed Study Logs from the service once we know the study code.
  useEffect(() => {
    if (studyCode) {
      setStudyLogs(getStudyLogs(studyCode));
    }
  }, [studyCode]);

  // ---- NEW: Delegation staff now lives in StudyLogsTab (was previously
  // duplicated inside DelegationLog.js). This fetch was moved here from
  // DelegationLog.js's old useEffect so there is only one copy of this state. ----
  useEffect(() => {
    const data = getDelegationLogs();
    const formatted = data.map((item) => ({
      ...item,
      name: item.delegateName,
      responsibility: item.description,
      status: item.status || "Active"
    }));
    setStaff(formatted);
  }, []);

  // ---- NEW: Training records also live here so the reused TrainingLog
  // component stays purely presentational, matching the DelegationLog
  // architecture (parent owns state, child receives it as a prop). ----
  useEffect(() => {
    setTrainingRecords(getTrainingLogs());
  }, []);

  // ---- NEW: Seed the Site Visit / NTF / Miscellaneous logs from the
  // shared log services (same localStorage-backed pattern as Training /
  // Delegation logs) and build the site name suggestions for the forms. ----
  useEffect(() => {
    setSiteVisitLogs(getSiteVisitLogs());
    setNTFLogs(getNTFLogs());
    setMiscellaneousLogs(getMiscellaneousLogs());
    setSiteOptions(getSiteNumberDirectory().map((entry) => entry.name));
  }, []);

  // ---- Task 2A (Ramya): AE/SE, PD and Temperature log records are also
  // owned here (single source of truth) and passed down to AELog / PDLog /
  // TempLog as props. Loaded from the adminService localStorage keys, the
  // same persistence pattern the Training/Delegation logs use. ----
  useEffect(() => {
    setAeRecords(getAELogs());
    setPdRecords(getPDLogs());
    setTempRecords(getTempLogs());
  }, []);

  // ---- NEW: shared helpers to append a Study Log row and a History row.
  // Every delegation action (add/edit/delete/status change) goes through
  // these so Study Logs and Delegation History stay in sync automatically. ----
  const addStudyLogEntry = (action, user, status) => {
    setStudyLogs((prev) => [
      ...prev,
      {
        id: `DEL-${Date.now()}`,
        type: "Delegation",
        action,
        user,
        timestamp: new Date().toLocaleDateString(),
        status
      }
    ]);
  };

  const addHistoryEntry = (action, user, reason = null) => {
    setDelegationHistory((prev) => [
      {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        action,
        user,
        reason
      },
      ...prev
    ]);
  };

  // ---- MODIFIED: handleSave now validates required fields, updates staff,
  // and records a Study Log + History entry. This replaces the old
  // handleSave/handleAdd pair (handleAdd was dead code — it wrote to a
  // delegationLogs state that was never rendered anywhere). ----
  const handleSave = () => {
    if (!form.name.trim() || !form.role.trim() || !form.responsibility.trim()) {
      alert("Please fill in Name, Role, and Responsibility.");
      return;
    }

    const newStaff = {
      id: Date.now(),
      name: form.name,
      role: form.role,
      responsibility: form.responsibility,
      status: form.status,
      duties: [
        {
          duty: "A2",
          description: form.responsibility
        }
      ]
    };

    setStaff((prev) => [...prev, newStaff]);
    addStudyLogEntry("Added Staff", form.name, form.status);
    addHistoryEntry("Staff Added", form.name);

    setForm({
      name: "",
      role: "",
      responsibility: "",
      status: "Active"
    });

    setShowModal(false);
  };

  // ---- NEW: passed to DelegationLog as onEdit. Runs after the child's
  // "Confirm Edit" step, and after Update is pressed in the edit modal. ----
  const handleUpdateStaff = (staffId, updatedFields) => {
    const original = staff.find((s) => s.id === staffId);

    setStaff((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? {
              ...s,
              ...updatedFields,
              duties: [{ duty: "A2", description: updatedFields.responsibility }]
            }
          : s
      )
    );

    addStudyLogEntry("Edited Staff", updatedFields.name, updatedFields.status);
    addHistoryEntry("Staff Edited", updatedFields.name);

    if (original && original.status !== updatedFields.status) {
      addStudyLogEntry("Status Changed", updatedFields.name, updatedFields.status);
      addHistoryEntry(`Status Changed to ${updatedFields.status}`, updatedFields.name);
    }
  };

  // ---- NEW: passed to DelegationLog as onDelete. Runs after the child's
  // "Delete Delegation" confirm step + mandatory reason step. ----
  const handleDeleteStaff = (staffId, reason) => {
    const target = staff.find((s) => s.id === staffId);

    setStaff((prev) => prev.filter((s) => s.id !== staffId));

    if (target) {
      addStudyLogEntry("Deleted Staff", target.name, "Inactive");
      addHistoryEntry("Staff Deleted", target.name, reason);
    }
  };

  // ---- NEW: Site Visit / NTF / Miscellaneous log persistence. Each
  // handler updates the in-memory list (single source of truth) and
  // writes the full array back through the shared log service saver,
  // so records survive reloads exactly like Training/Delegation logs. ----
  const handleSaveSiteVisitLog = (record) => {
    const exists = siteVisitLogs.some((item) => item.id === record.id);
    const next = exists
      ? siteVisitLogs.map((item) =>
          item.id === record.id ? { ...item, ...record } : item
        )
      : [...siteVisitLogs, record];
    setSiteVisitLogs(next);
    saveSiteVisitLogs(next);
  };

  const handleDeleteSiteVisitLog = (id) => {
    const next = siteVisitLogs.filter((item) => item.id !== id);
    setSiteVisitLogs(next);
    saveSiteVisitLogs(next);
  };

  const handleSaveNTFLog = (record) => {
    const exists = ntfLogs.some((item) => item.id === record.id);
    const next = exists
      ? ntfLogs.map((item) =>
          item.id === record.id ? { ...item, ...record } : item
        )
      : [...ntfLogs, record];
    setNTFLogs(next);
    saveNTFLogs(next);
  };

  const handleDeleteNTFLog = (id) => {
    const next = ntfLogs.filter((item) => item.id !== id);
    setNTFLogs(next);
    saveNTFLogs(next);
  };

  const handleSaveMiscellaneousLog = (record) => {
    const exists = miscellaneousLogs.some((item) => item.id === record.id);
    const next = exists
      ? miscellaneousLogs.map((item) =>
          item.id === record.id ? { ...item, ...record } : item
        )
      : [...miscellaneousLogs, record];
    setMiscellaneousLogs(next);
    saveMiscellaneousLogs(next);
  };

  const handleDeleteMiscellaneousLog = (id) => {
    const next = miscellaneousLogs.filter((item) => item.id !== id);
    setMiscellaneousLogs(next);
    saveMiscellaneousLogs(next);
  };

  // ---- Task 2A (Ramya): shared save/delete handlers for the AE/SE, PD and
  // Temperature logs. Each updates the in-memory array and immediately
  // persists the full array back through the adminService, so changes
  // survive refresh/remount — mirroring the existing Logs persistence
  // pattern (localStorage-backed service + parent-owned state). ----
  const persistLogRecords = (setter, persister, record) => {
    setter((prev) => {
      const exists = prev.some((item) => item.id === record.id);
      const next = exists
        ? prev.map((item) => (item.id === record.id ? record : item))
        : [...prev, record];
      persister(next);
      return next;
    });
  };

  const handleSaveAELog = (record) => persistLogRecords(setAeRecords, saveAELogs, record);
  const handleSavePDLog = (record) => persistLogRecords(setPdRecords, savePDLogs, record);
  const handleSaveTempLog = (record) => persistLogRecords(setTempRecords, saveTempLogs, record);

  const deleteLogRecord = (setter, persister, id) => {
    setter((prev) => {
      const next = prev.filter((item) => item.id !== id);
      persister(next);
      return next;
    });
  };

  const handleDeleteAELog = (id) => deleteLogRecord(setAeRecords, saveAELogs, id);
  const handleDeletePDLog = (id) => deleteLogRecord(setPdRecords, savePDLogs, id);
  const handleDeleteTempLog = (id) => deleteLogRecord(setTempRecords, saveTempLogs, id);

  return (
    <div className="module-card">
      <DocumentFolderManager
        sectionId="logs"
        contextKey={studyCode || "default"}
        title="Logs"
      />

      <div className="studylogs-toolbar">
        <button
          className="add-delegation-btn"
          onClick={() => setShowModal(true)}>

          + Add Delegation
        </button>
      </div>

      {/* Study Logs — the shared DataTable already enforces the required
          data → search → filters → pagination pipeline internally. `studyLogs`
          is the full authorized dataset from getStudyLogs(); search and
          filters run over the full dataset (not the current page), and
          pagination resets on any search/filter change. */}
      <DataTable
        title={`Study Logs — ${study?.name || studyCode}`}
        columns={[
          { key: "id", label: "Log ID" },
          { key: "type", label: "Type" },
          { key: "action", label: "Action" },
          { key: "user", label: "User" },
          { key: "timestamp", label: "Date/Time" },
          { key: "status", label: "Status" }
        ]}
        data={studyLogs}
        emptyMessage="No log entries for this study"
        searchable
        searchPlaceholder="Search Study Logs (ID, action, user, status)..."
        searchFields={["id", "type", "action", "user", "status"]}
        filters={[
          { key: "type", label: "Type" },
          { key: "status", label: "Status" }
        ]}
        pagination
      />

      {/* ---- NEW: sub-log tab strip. Delegation Log stays the default;
      Training Log is now reachable from inside the study (the old global
      /logs/training page was removed by request). ---- */}
      <div className="study-log-tabs">
        <button
          type="button"
          className={activeLog === "delegation" ? "tab active" : "tab"}
          onClick={() => setActiveLog("delegation")}>

          Delegation Log
        </button>
        <button
          type="button"
          className={activeLog === "training" ? "tab active" : "tab"}
          onClick={() => setActiveLog("training")}>

          Training Log
        </button>
        <button
          type="button"
          className={activeLog === "siteVisit" ? "tab active" : "tab"}
          onClick={() => setActiveLog("siteVisit")}>

          Site Visit Log
        </button>
        <button
          type="button"
          className={activeLog === "ntf" ? "tab active" : "tab"}
          onClick={() => setActiveLog("ntf")}>

          NTF Log
        </button>
        <button
          type="button"
          className={activeLog === "miscellaneous" ? "tab active" : "tab"}
          onClick={() => setActiveLog("miscellaneous")}>

          Miscellaneous Log
        </button>
        <button
          type="button"
          className={activeLog === "ae" ? "tab active" : "tab"}
          onClick={() => setActiveLog("ae")}>

          AE/SE Log
        </button>
        <button
          type="button"
          className={activeLog === "pd" ? "tab active" : "tab"}
          onClick={() => setActiveLog("pd")}>

          PD Log
        </button>
        <button
          type="button"
          className={activeLog === "temp" ? "tab active" : "tab"}
          onClick={() => setActiveLog("temp")}>

          Temperature Log
        </button>
      </div>

      {/* ---- MODIFIED: staff, history, and the edit/delete handlers are now
      passed down as props instead of DelegationLog fetching/holding its own
      copy of the staff list. ---- */}
      {activeLog === "delegation" && (
        <DelegationLog
          staff={staff}
          history={delegationHistory}
          onEdit={handleUpdateStaff}
          onDelete={handleDeleteStaff}
        />
      )}

      {/* ---- NEW: Training Log reuses the existing TrainingLog component.
      Records are fetched by StudyLogsTab (parent = source of truth) and
      passed as a prop, matching the Delegation Log integration pattern. ---- */}
      {activeLog === "training" && (
        <TrainingLog records={trainingRecords} />
      )}

      {/* ---- NEW: Site Visit / NTF / Miscellaneous logs reuse the shared
      LogCrudTable via their wrapper components. Records and site options
      live here (single source of truth); the Add/Edit/View/Delete flows
      are handled inside each log, and every save/delete comes back through
      the handlers above, which persist to the shared log services. ---- */}
      {activeLog === "siteVisit" && (
        <SiteVisitLog
          records={siteVisitLogs}
          siteOptions={siteOptions}
          initialSite={study?.site || ""}
          onSave={handleSaveSiteVisitLog}
          onDelete={handleDeleteSiteVisitLog}
        />
      )}

      {activeLog === "ntf" && (
        <NTFLog
          records={ntfLogs}
          siteOptions={siteOptions}
          initialSite={study?.site || ""}
          onSave={handleSaveNTFLog}
          onDelete={handleDeleteNTFLog}
        />
      )}

      {activeLog === "miscellaneous" && (
        <MiscellaneousLog
          records={miscellaneousLogs}
          siteOptions={siteOptions}
          initialSite={study?.site || ""}
          onSave={handleSaveMiscellaneousLog}
          onDelete={handleDeleteMiscellaneousLog}
        />
      )}

      {/* ---- Task 2A (Ramya): AE/SE, PD and Temperature logs. Each reuses
      the shared DataTable pipeline and modal style of the existing logs,
      with records owned + persisted by StudyLogsTab and the study's site
      pre-filled into the Add form. ---- */}
      {activeLog === "ae" && (
        <AELog
          records={aeRecords}
          defaultSite={study?.site || study?.location || ""}
          onSave={handleSaveAELog}
          onDelete={handleDeleteAELog}
        />
      )}

      {activeLog === "pd" && (
        <PDLog
          records={pdRecords}
          defaultSite={study?.site || study?.location || ""}
          onSave={handleSavePDLog}
          onDelete={handleDeletePDLog}
        />
      )}

      {activeLog === "temp" && (
        <TempLog
          records={tempRecords}
          defaultSite={study?.site || study?.location || ""}
          onSave={handleSaveTempLog}
          onDelete={handleDeleteTempLog}
        />
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">

            <div className="modal-title">
              Add Delegation
            </div>

            <div className="modal-body">
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />

              <select
  value={form.role}
  onChange={(e) =>
    setForm({
      ...form,
      role: e.target.value,
      responsibility: ""
    })
  }>

  <option value="">Select Role</option>

  {ROLE_OPTIONS.map((role) => (
    <option key={role} value={role}>
      {role}
    </option>
  ))}
</select>

              <select
  value={form.responsibility}
  disabled={!form.role}
  onChange={(e) =>
    setForm({
      ...form,
      responsibility: e.target.value
    })
  }>

  <option value="">
    Select Responsibility
  </option>

  {(RESPONSIBILITY_MAP[form.role] || []).map((item) => (
    <option key={item} value={item}>
      {item}
    </option>
  ))}
</select>

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value,
                  })
                }>

                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowModal(false)}>

                Cancel
              </button>

              <button
                className="save-btn"
                onClick={handleSave}>

                Save
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default StudyLogsTab;