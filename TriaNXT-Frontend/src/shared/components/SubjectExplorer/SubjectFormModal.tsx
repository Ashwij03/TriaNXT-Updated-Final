import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdPersonAdd, MdEdit, MdErrorOutline } from "react-icons/md";

import { getSubjectStudyDefaults } from "../../services/studyService";
import {
  SUBJECT_LIFECYCLE_STAGES,
  SUBJECT_TERMINAL_STATES,
} from "../../utils/subjectLifecycle";
import "./FolderModals.css";
import "./SubjectDetailsModal.css";

/**
 * Subject Explorer - ADD / EDIT SUBJECT form modal.
 *
 * ONE shared modal for both flows (per the Subjects UI brief):
 *
 *   mode === "create"  the sidebar's "+ Add Subject" - every field starts
 *                      ready for a new entry; Subject ID is pre-suggested
 *                      (e.g. "SUB-007") but fully editable.
 *   mode === "edit"    the subject row's "Edit Subject" - every field is
 *                      pre-filled from the subject's metadata record.
 *
 * Fields: Subject ID, Initials, Principal Investigator, Site, Screening
 * Date, Enrollment Date, Status, Current Visit. PI and Site are study
 * relationships (see `getSubjectStudyDefaults`) and are shown read-only,
 * exactly like the same fields in `StudySubjects.js` and
 * `StudySubjects.js` - they are never hardcoded and never user-editable.
 *
 * Saving routes through the existing services:
 *   - Subject ID   FolderTreeService (createSubject / renameSubject),
 *                  validated with the `validate` prop (validateSubjectName).
 *   - the clinical fields   SubjectRecordsService.updateSubjectRecord, the
 *                  same `subjectsByStudy` storage StudySubjects.js owns.
 *
 * Props
 *   mode           "create" | "edit"
 *   subject        the tree node being edited ({ id, name }) - edit only
 *   record         the subject's metadata record (pre-fill) - edit only
 *   studyId        current study code (drives PI/Site defaults + metadata)
 *   suggestedName  default Subject ID for create ("" if none)
 *   validate       (name) => { valid, error }  (FolderTreeService)
 *   submitError    error returned by the service on submit
 *   onSubmit       (fields) => void
 *   onClose        () => void
 */
function SubjectFormModal({
  mode = "create",
  subject,
  record,
  studyId = "",
  suggestedName = "",
  validate,
  submitError = "",
  onSubmit,
  onClose,
}: any) {
  const isEdit = mode === "edit";
  const defaults = getSubjectStudyDefaults(studyId);

  const [form, setForm] = useState(() => ({
    id: isEdit ? subject?.name || "" : suggestedName || "",
    initials: record?.initials || "",
    screeningDate: record?.screeningDate || (!isEdit ? new Date().toISOString().split("T")[0] : ""),
    enrollmentDate: record?.enrollmentDate || "",
    status: record?.status || (!isEdit ? "Screened" : ""),
    currentVisit: record?.currentVisit || (!isEdit ? "Screening" : ""),
  }));
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (isEdit) inputRef.current?.select();
  }, [isEdit]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /* Live validation of the Subject ID only (same rule set the explorer's
     create/rename flows already used). */
  const validation = useMemo(() => {
    if (typeof validate !== "function") return { valid: true, error: "" };
    return validate(form.id);
  }, [validate, form.id]);

  const liveError = touched && !validation.valid ? validation.error : "";
  const error = liveError || submitError;

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTouched(true);
  };

  /* Edit with nothing changed - close quietly, nothing to persist. */
  const unchanged =
    isEdit &&
    form.id.trim() === (subject?.name || "").trim() &&
    form.initials.trim() === (record?.initials || "").trim() &&
    form.screeningDate === (record?.screeningDate || "") &&
    form.enrollmentDate === (record?.enrollmentDate || "") &&
    form.status === (record?.status || "") &&
    form.currentVisit.trim() === (record?.currentVisit || "").trim();

  const handleSubmit = (event) => {
    event.preventDefault();
    setTouched(true);

    if (!validation.valid) {
      inputRef.current?.focus();
      return;
    }

    if (unchanged) {
      onClose?.();
      return;
    }

    onSubmit?.({
      id: form.id.trim(),
      initials: form.initials.trim(),
      principalInvestigator: defaults.principalInvestigator || defaults.pi || "",
      site: defaults.site || "",
      siteNo: defaults.siteNumber || "",
      screeningDate: form.screeningDate || new Date().toISOString().split("T")[0],
      enrollmentDate: form.enrollmentDate || "",
      status: form.status || "Screened",
      currentVisit: form.currentVisit.trim() || "Screening",
    });
  };

  // Portalled to <body>: the sidebar clips its overflow, which would
  // otherwise cut the modal off inside the tree panel.
  return createPortal(
    <div
      className="sxm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="sxm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit Subject" : "Add Subject"}
      >
        <div className="sxm-header">
          <div className="sxm-header-title">
            <span className="sxm-header-icon">
              {isEdit ? <MdEdit size={17} /> : <MdPersonAdd size={17} />}
            </span>
            <div>
              <h3>{isEdit ? "Edit Subject" : "Add Subject"}</h3>
              <p>
                {isEdit
                  ? "Update the subject details below and save your changes."
                  : "Enter the details for the new subject."}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="sxm-close"
            aria-label="Close"
            onClick={onClose}
          >
            <MdClose size={17} />
          </button>
        </div>

        <form className="sxm-body" onSubmit={handleSubmit} noValidate>
          <div className="sxm-context">
            <span className="sxm-context-label">
              {isEdit ? "Subject" : "Location"}
            </span>
            <span className="sxm-context-value" title={isEdit ? subject?.name : undefined}>
              {isEdit ? subject?.name : "Explorer root"}
            </span>
          </div>

          <div className="sxm-field-row">
            <label className="sxm-field">
              <span>
                Subject ID <em>*</em>
              </span>
              <input
                ref={inputRef}
                type="text"
                className={error ? "has-error" : ""}
                placeholder="e.g. SUB-007"
                value={form.id}
                maxLength={80}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "sxm-subject-form-error" : undefined}
                onChange={(event) => setField("id", event.target.value)}
              />
            </label>

            <label className="sxm-field">
              <span>Initials</span>
              <input
                type="text"
                placeholder="e.g. A.T."
                value={form.initials}
                maxLength={10}
                onChange={(event) => setField("initials", event.target.value)}
              />
            </label>
          </div>

          <div className="sxm-field-row">
            <label className="sxm-field">
              <span>Principal Investigator</span>
              {/* PI is a study relationship, never user-editable (same
                  convention as StudySubjects.js). */}
              <input
                type="text"
                value={defaults.pi || "—"}
                readOnly
                aria-readonly="true"
              />
            </label>

            <label className="sxm-field">
              <span>Site</span>
              <input
                type="text"
                value={defaults.siteDisplay || defaults.site || "—"}
                readOnly
                aria-readonly="true"
              />
            </label>
          </div>

          <div className="sxm-field-row">
            <label className="sxm-field">
              <span>Screening Date</span>
              <input
                type="date"
                value={form.screeningDate}
                onChange={(event) => setField("screeningDate", event.target.value)}
              />
            </label>

            <label className="sxm-field">
              <span>Enrollment Date</span>
              <input
                type="date"
                value={form.enrollmentDate}
                onChange={(event) => setField("enrollmentDate", event.target.value)}
              />
            </label>
          </div>

          <div className="sxm-field-row">
            <label className="sxm-field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) => setField("status", event.target.value)}
              >
                <option value="">Select status</option>
                {[...SUBJECT_LIFECYCLE_STAGES, ...SUBJECT_TERMINAL_STATES].map(
                  (option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="sxm-field">
              <span>Current Visit</span>
              <input
                type="text"
                placeholder="e.g. Screening 2, Month 3"
                value={form.currentVisit}
                maxLength={60}
                onChange={(event) => setField("currentVisit", event.target.value)}
              />
            </label>
          </div>

          {error ? (
            <div className="sxm-error" id="sxm-subject-form-error" role="alert">
              <MdErrorOutline size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : (
            <p className="sxm-hint">
              Subject IDs must be unique. Initials, dates and the current
              visit can be updated later from the Subjects table.
            </p>
          )}

          <div className="sxm-footer">
            <button type="button" className="sxm-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="sxm-btn sxm-btn--primary"
              disabled={!form.id.trim()}>

              {isEdit ? "Save Changes" : "Add Subject"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default SubjectFormModal;
