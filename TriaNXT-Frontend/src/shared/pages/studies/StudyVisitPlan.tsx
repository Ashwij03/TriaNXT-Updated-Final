import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import RequestPermissionButton from "../../components/RequestPermissionButton";
import useCanEditStudyContent from "../../hooks/useCanEditStudyContent";
import useVisitPlans from "../../hooks/useVisitPlans";
import useVisitSchedules from "../../hooks/useVisitSchedules";
import { canEditStudyContent } from "../../utils/contentAccess";
import { compareScheduleDates } from "../../services/visitScheduleService";
import { formatScheduleDisplayDate } from "../../utils/formatScheduleDisplayDate";
import { getCurrentUser } from "../../services/roleService";
import { getSubjectsForStudy } from "../../services/subjectService";
import {
  saveVisitPlan,
  deleteVisitPlan,
  saveVisitPlanVisit,
  deleteVisitPlanVisit,
  saveVisitPlanProcedure,
  deleteVisitPlanProcedure,
  getVisitScheduleMatrix,
  syncVisitPlanToSchedule,
} from "../../services/visitPlanService";
import "./StudyVisitPlan.css";

const WIZARD_STEPS = [
  "Basic Info",
  "Visit Details",
  "Procedures",
  "Screening / Enrollment",
  "Review & Schedule",
];

function StudyVisitPlan() {
  const { id: studyCode } = useParams();
  const canEdit = useCanEditStudyContent("Visit Plan", studyCode);
  const { plans, getPlanDetails, refresh } = useVisitPlans(studyCode);
  const { schedules, upcomingWindow } = useVisitSchedules({ studyCode });
  const upcomingVisits = useMemo(() => {
    return [...upcomingWindow].sort(compareScheduleDates);
  }, [upcomingWindow]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showWizard, setShowWizard] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [draft, setDraft] = useState(emptyDraft());

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const matchesSearch = String(plan.name || "")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || plan.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [plans, search, statusFilter]);

  const openCreateWizard = () => {
    setEditingPlanId(null);
    setDraft(emptyDraft());
    setWizardStep(0);
    setShowWizard(true);
  };

  const openEditWizard = (planId) => {
    const plan = plans.find((item) => item.id === planId);
    const details = getPlanDetails(planId);
    setEditingPlanId(planId);
    setDraft({
      ...emptyDraft(),
      ...plan,
      visits: details.visits,
      procedures: details.procedures,
    });
    setWizardStep(0);
    setShowWizard(true);
  };

  const handleSaveWizard = () => {
    if (!canEdit) return;
    if (!String(draft.name || "").trim()) return;

    const saved = saveVisitPlan(studyCode, {
      id: editingPlanId || undefined,

      name: draft.name,
      description: draft.description,

      clinicalStudy: draft.clinicalStudy,
      studyArm: draft.studyArm,
      version: draft.version,
      studyVisitGroup: draft.studyVisitGroup,

      status: draft.status,

      screeningWindow: draft.screeningWindow,
      enrollmentWindow: draft.enrollmentWindow,
    });

    const planId = saved.id;

    if (editingPlanId) {
      const existing = getPlanDetails(planId);
      existing.visits.forEach((visit) =>
        deleteVisitPlanVisit(planId, visit.id),
      );
      existing.procedures.forEach((proc) =>
        deleteVisitPlanProcedure(planId, proc.id),
      );
    }

    (draft.visits || []).forEach((visit) => {
      saveVisitPlanVisit(planId, visit);
    });
    (draft.procedures || []).forEach((proc) => {
      saveVisitPlanProcedure(planId, proc);
    });

    if (draft.syncToCalendar) {
      syncVisitPlanToSchedule(studyCode, planId);
    }

    setShowWizard(false);
    refresh();
  };

  return (
    <div className="study-visit-plan-page tnxt-compact">
      <div className="visit-plan-toolbar">
        <div>
          <h2>Visit Plan</h2>
          <p className="visit-plan-subtitle">
            Linked to calendar via visit schedule service ({schedules.length}{" "}
            scheduled visits)
          </p>
        </div>
        <div className="visit-plan-actions">
          {!canEdit && (
            <RequestPermissionButton
              action="Edit Visit Plan"
              module="Visit Plan"
              studyCode={studyCode}
              label="Request Edit Permission"
            />
          )}
          {canEdit && (
            <button
              type="button"
              className="add-study-btn"
              onClick={openCreateWizard}>

              + New Visit Plan
            </button>
          )}
        </div>
      </div>

      <div className="visit-plan-upcoming">
        <div className="visit-plan-upcoming-header">
          <div className="visit-plan-upcoming-title">
            <span className="visit-plan-upcoming-icon" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <div>
              <h3>Upcoming Visits</h3>
              <p className="visit-plan-upcoming-subtitle">
                Next scheduled visits for this study
              </p>
            </div>
          </div>
          <span className="visit-plan-upcoming-count">
            {upcomingVisits.length} scheduled
          </span>
        </div>

        {upcomingVisits.length === 0 ? (
          <div className="visit-plan-upcoming-empty">
            <p>No upcoming visits scheduled.</p>
          </div>
        ) : (
          <div className="visit-plan-upcoming-table-wrap">
            <table className="planning-table visit-plan-upcoming-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Visit</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {upcomingVisits.map((visit, index) => (
                  <tr key={visit.id || index}>
                    <td>
                      <span className="visit-plan-subject-cell">
                        {visit.subjectId || "—"}
                      </span>
                    </td>
                    <td>{visit.visit}</td>
                    <td>{formatScheduleDisplayDate(visit.date)}</td>
                    <td>
                      <span
                        className={`status-pill status-${String(
                          visit.status || "scheduled",
                        )
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}>

                        {visit.status || "Scheduled"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="visit-plan-filters">
        <div className="visit-plan-filters-header">
          <h3>Search Visit Plan</h3>
          <p className="visit-plan-filters-subtitle">
            Filter visit plans by name or status
          </p>
        </div>
        <div className="visit-plan-filters-controls">
          <div className="visit-plan-search-wrap">
            <span className="visit-plan-search-icon" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search visit plans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="visit-plan-search-input"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="visit-plan-status-select">

            <option value="all">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="visit-plan-empty">
          <h3>No visit plans yet</h3>
          <p>
            Create a visit plan to define study visit templates and procedures.
          </p>
          {canEdit && (
            <button
              type="button"
              className="secondary-btn"
              onClick={openCreateWizard}>

              Create Visit Plan
            </button>
          )}
        </div>
      ) : (
        <div className="visit-plan-grid">
          {filteredPlans.map((plan) => {
            const details = getPlanDetails(plan.id);
            return (
              <div key={plan.id} className="visit-plan-card">
                <div className="visit-plan-card-header">
                  <strong>{plan.name}</strong>
                  <span
                    className={`status-pill status-${String(plan.status || "draft").toLowerCase()}`}>

                    {plan.status}
                  </span>
                </div>
                <p>{plan.description || "No description"}</p>
                <div className="visit-plan-meta">
                  <span>{details.visits.length} visits</span>
                  <span>{details.procedures.length} procedures</span>
                </div>
                <div className="visit-plan-card-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => openEditWizard(plan.id)}>

                    {canEdit ? "Edit" : "View"}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      className="link-btn danger"
                      onClick={() => {
                        deleteVisitPlan(studyCode, plan.id);
                        refresh();
                      }}>

                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showWizard && (
        <VisitPlanWizard
          step={wizardStep}
          draft={draft}
          canEdit={canEdit}
          studyCode={studyCode}
          onChange={setDraft}
          onStepChange={setWizardStep}
          onClose={() => setShowWizard(false)}
          onSave={handleSaveWizard}
        />
      )}
    </div>
  );
}

function emptyDraft() {
  return {
    name: "",
    description: "",
    status: "",

    clinicalStudy: "",
    studyArm: "",
    version: "1.0",
    studyVisitGroup: "",

    screeningWindow: "",
    enrollmentWindow: "",

    visits: [],
    procedures: [],
    syncToCalendar: false,
  };
}

function VisitPlanWizard({
  step,
  draft,
  canEdit,
  studyCode,
  onChange,
  onStepChange,
  onClose,
  onSave,
}: any) {
  const isLastStep = step === WIZARD_STEPS.length - 1;
  const matrix = useMemo(() => {
    if (step !== WIZARD_STEPS.length - 1) return null;
    const tempPlanId = "preview";
    return {
      visits: draft.visits || [],
      procedures: draft.procedures || [],
      subjects: getVisitScheduleMatrix(studyCode, tempPlanId).subjects,
    };
  }, [step, draft, studyCode]);

  const canProceed = validateStep(step, draft);

  return (
    <div className="visit-plan-wizard-overlay">
      <div className="visit-plan-wizard">
        <div className="visit-plan-wizard-header">
          <h3>{draft.name || "New Visit Plan"}</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="visit-plan-steps">
          {WIZARD_STEPS.map((label, index) => (
            <span
              key={label}
              className={`visit-plan-step${index === step ? " active" : ""}${index < step ? " done" : ""}`}>

              {index + 1}. {label}
            </span>
          ))}
        </div>

        <div className="visit-plan-wizard-body">
          {step === 0 && (
            <>
              <label>
                Plan Name
                <input
                  value={draft.name}
                  disabled={!canEdit}
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={draft.description}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({ ...draft, description: e.target.value })
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={draft.status}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({ ...draft, status: e.target.value })
                  }>

                  <option>Draft</option>
                  <option>Active</option>
                  <option>Archived</option>
                </select>
              </label>
              <label>
                Clinical Study
                <input
                  value={draft.clinicalStudy}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      clinicalStudy: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Study Arm
                <input
                  value={draft.studyArm}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      studyArm: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Version
                <input
                  value={draft.version}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      version: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Study Visit Group
                <input
                  value={draft.studyVisitGroup}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      studyVisitGroup: e.target.value,
                    })
                  }
                />
              </label>
            </>
          )}

          {step === 1 && (
            <VisitDetailsTable
              visits={draft.visits}
              canEdit={canEdit}
              onChange={(visits) => onChange({ ...draft, visits })}
            />
          )}

          {step === 2 && (
            <ProcedureDetailsTable
              visits={draft.visits}
              procedures={draft.procedures}
              canEdit={canEdit}
              onChange={(procedures) => onChange({ ...draft, procedures })}
            />
          )}

          {step === 3 && (
            <>
              <label>
                Screening Window
                <input
                  placeholder="e.g. Day -28 to Day -1"
                  value={draft.screeningWindow}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({ ...draft, screeningWindow: e.target.value })
                  }
                />
              </label>
              <label>
                Enrollment Window
                <input
                  placeholder="e.g. Day 0 to Day 7"
                  value={draft.enrollmentWindow}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({ ...draft, enrollmentWindow: e.target.value })
                  }
                />
              </label>
              <ScreeningEnrollmentSummary studyCode={studyCode} />
            </>
          )}

          {step === 4 && (
            <>
              <ScheduleMatrix
                visits={matrix?.visits || []}
                procedures={matrix?.procedures || []}
                subjects={matrix?.subjects || []}
              />
              {canEdit && (
                <label className="sync-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.syncToCalendar)}
                    onChange={(e) =>
                      onChange({ ...draft, syncToCalendar: e.target.checked })
                    }
                  />
                  Sync visit windows to dashboard calendar on save
                </label>
              )}
            </>
          )}
        </div>

        <div className="visit-plan-wizard-footer">
          <button
            type="button"
            className="secondary-btn"
            disabled={step === 0}
            onClick={() => onStepChange(step - 1)}>

            Back
          </button>
          {!isLastStep ? (
            <button
              type="button"
              className="add-study-btn"
              disabled={!canProceed}
              onClick={() => onStepChange(step + 1)}>

              Next
            </button>
          ) : (
            canEdit && (
              <button
                type="button"
                className="add-study-btn"
                disabled={!canProceed}
                onClick={onSave}>

                Save Visit Plan
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function validateStep(step, draft) {
  if (step === 0) return Boolean(String(draft.name || "").trim());
  if (step === 1) return Array.isArray(draft.visits) && draft.visits.length > 0;
  if (step === 2) return true;
  if (step === 3) return true;
  if (step === 4) return Boolean(String(draft.name || "").trim());
  return true;
}

function VisitDetailsTable({ visits, canEdit, onChange }: any) {
  const list = Array.isArray(visits) ? visits : [];

  const addVisit = () => {
    onChange([
      ...list,
      {
        id: `vv-${Date.now()}`,

        visitTemplateId: `VT-${Date.now()}`,

        sequence: list.length + 1,

        visitName: "",

        visitType: "Scheduled",

        windowStart: "",
        windowStartUnit: "Days",

        windowEnd: "",
        windowEndUnit: "Days",

        dayOffset: "",

        required: true,
      },
    ]);
  };

  const updateVisit = (id, field, value) => {
    onChange(
      list.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeVisit = (id) => {
    onChange(list.filter((item) => item.id !== id));
  };

  return (
    <div>
      {list.length === 0 ? (
        <p className="planning-empty">Add at least one visit template</p>
      ) : (
        <table className="planning-table">
          <thead>
            <tr>
              <th>Sequence</th>

              <th>Visit Template ID</th>

              <th>Visit</th>

              <th>Visit Type</th>

              <th>Window Start</th>

              <th>Start Unit</th>

              <th>Window End</th>

              <th>End Unit</th>

              <th>Day Offset</th>

              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((visit, index) => (
              <tr key={visit.id}>
                <td>
                  <input value={visit.sequence} disabled />
                </td>
                <td>{visit.visitTemplateId || visit.id}</td>
                <td>
                  <input
                    value={visit.visitName}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateVisit(visit.id, "visitName", e.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    value={visit.visitType || "Scheduled"}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateVisit(visit.id, "visitType", e.target.value)
                    }>

                    <option>Scheduled</option>

                    <option>Screening</option>

                    <option>Baseline</option>

                    <option>Follow-up</option>

                    <option>Unscheduled</option>

                    <option>End of Study</option>
                  </select>
                </td>
                <td>
                  <input
                    type="date"
                    value={visit.windowStart || ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateVisit(visit.id, "windowStart", e.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    value={visit.windowStartUnit || "Days"}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateVisit(visit.id, "windowStartUnit", e.target.value)
                    }>

                    <option>Days</option>

                    <option>Hours</option>

                    <option>Weeks</option>
                  </select>
                </td>
                <td>
                  <input
                    type="date"
                    value={visit.windowEnd || ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateVisit(visit.id, "windowEnd", e.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    value={visit.windowEndUnit || "Days"}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateVisit(visit.id, "windowEndUnit", e.target.value)
                    }>

                    <option>Days</option>

                    <option>Hours</option>

                    <option>Weeks</option>
                  </select>
                </td>
                <td>
                  <input
                    value={visit.dayOffset ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateVisit(visit.id, "dayOffset", e.target.value)
                    }
                  />
                </td>
                {canEdit && (
                  <td>
                    <button
                      type="button"
                      className="link-btn"
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...list];

                        [next[index - 1], next[index]] = [
                          next[index],
                          next[index - 1],
                        ];

                        next.forEach((item, i) => (item.sequence = i + 1));

                        onChange(next);
                      }}>

                      ↑
                    </button>

                    <button
                      type="button"
                      className="link-btn"
                      disabled={index === list.length - 1}
                      onClick={() => {
                        const next = [...list];

                        [next[index + 1], next[index]] = [
                          next[index],
                          next[index + 1],
                        ];

                        next.forEach((item, i) => (item.sequence = i + 1));

                        onChange(next);
                      }}>

                      ↓
                    </button>

                    <button
                      type="button"
                      className="link-btn danger"
                      onClick={() => removeVisit(visit.id)}>

                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canEdit && (
        <button type="button" className="secondary-btn" onClick={addVisit}>
          + Add Visit
        </button>
      )}
    </div>
  );
}

function ProcedureDetailsTable({ visits, procedures, canEdit, onChange }: any) {
  const list = Array.isArray(procedures) ? procedures : [];
  const [search] = useState("");
  const addProcedure = () => {
    onChange([
      ...list,
      {
        id: `vproc-${Date.now()}`,

        visitId: visits?.[0]?.id || "",

        procedureCode: `PROC-${Date.now()}`,

        procedureName: "",

        taskOrder: list.length + 1,

        sequence: list.length + 1,

        category: "Assessment",

        required: true,
      },
    ]);
  };

  const updateProcedure = (id, field, value) => {
    onChange(
      list.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeProcedure = (id) => {
    onChange(list.filter((item) => item.id !== id));
  };

  return (
    <div>
      {list.length === 0 ? (
        <p className="planning-empty">No procedures defined (optional)</p>
      ) : (
        <table className="planning-table">
          <thead>
            <tr>
              <th>Sequence</th>

              <th>Visit</th>

              <th>Procedure Code</th>

              <th>Procedure</th>

              <th>Task Order</th>

              <th>Category</th>

              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {list
              .filter((proc) =>
                (proc.procedureName || "")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((proc, index) => (
                <tr key={proc.id}>
                  <td>
                    <input value={proc.sequence} disabled />
                  </td>
                  <td>
                    <select
                      value={proc.visitId || ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateProcedure(proc.id, "visitId", e.target.value)
                      }>

                      <option value="">All visits</option>
                      {(visits || []).map((visit) => (
                        <option key={visit.id} value={visit.id}>
                          {visit.visitName || "Visit"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={proc.procedureCode || ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateProcedure(
                          proc.id,
                          "procedureCode",
                          e.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={proc.procedureName}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateProcedure(
                          proc.id,
                          "procedureName",
                          e.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={proc.taskOrder || ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateProcedure(proc.id, "taskOrder", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={proc.category}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateProcedure(proc.id, "category", e.target.value)
                      }
                    />
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        type="button"
                        className="link-btn danger"
                        onClick={() => removeProcedure(proc.id)}>

                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {canEdit && (
        <button type="button" className="secondary-btn" onClick={addProcedure}>
          <button
            type="button"
            className="secondary-btn"
            onClick={addProcedure}>

            Select Standard Procedure
          </button>
          + Add Procedure
        </button>
      )}
    </div>
  );
}

function ScreeningEnrollmentSummary({ studyCode }: any) {
  let subjects = [];
  try {
    subjects = getSubjectsForStudy(String(studyCode || ""));
  } catch {
    subjects = [];
  }

  if (!subjects.length) {
    return (
      <p className="planning-empty">No subject screening/enrollment data yet</p>
    );
  }

  return (
    <table className="planning-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Status</th>
          <th>Screening Date</th>
          <th>Enrollment Date</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((subject) => (
          <tr key={subject.subjectId || subject.id}>
            <td>{subject.subjectId || subject.id}</td>
            <td>{subject.status || "—"}</td>
            <td>{subject.screeningDate || "—"}</td>
            <td>{subject.enrollmentDate || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScheduleMatrix({ visits, procedures, subjects }: any) {
  const handlePrint = () => window.print();

  if (!visits.length) {
    return (
      <p className="planning-empty">
        Add visits to preview the schedule matrix
      </p>
    );
  }

  return (
    <div className="schedule-matrix-wrap">
      <div className="schedule-matrix-actions">
        <button type="button" className="secondary-btn" onClick={handlePrint}>
          Print / Export
        </button>
      </div>
      <table className="schedule-matrix">
        <thead>
          <tr>
            <th>Subject</th>
            {visits.map((visit, index) => (
              <th key={visit.id}>{visit.visitName || `Visit ${index + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(subjects.length ? subjects : [{ subjectId: "—" }]).map(
            (subject) => (
              <tr key={subject.subjectId || subject.id}>
                <td>{subject.subjectId || subject.id}</td>
                {visits.map((visit) => {
                  const visitProcedures = procedures.filter(
                    (proc) => !proc.visitId || proc.visitId === visit.id,
                  );

                  return (
                    <td key={`${subject.subjectId}-${visit.id}`}>
                      {visitProcedures.length ? (
                        <ul className="schedule-procedure-list">
                          {visitProcedures.map((proc, index) => (
                            <li key={proc.id}>
                              <strong>
                                {proc.procedureCode || `PROC-${index + 1}`}
                              </strong>
                              {" - "}
                              {proc.procedureName || "Procedure"}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="no-procedure">No Procedures</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export default StudyVisitPlan;