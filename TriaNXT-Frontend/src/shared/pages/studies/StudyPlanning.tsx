import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import RequestPermissionButton from "../../components/RequestPermissionButton";
import useCanEditStudyContent from "../../hooks/useCanEditStudyContent";
import { canEditStudyContent } from "../../utils/contentAccess";
import { getCurrentUser } from "../../services/roleService";
import { getStudyByCode } from "../../services/studyService";
import { resolveSiteDisplay } from "../../utils/siteDisplay";
import {
  PLANNING_UPDATED_EVENT,
  getPlanningMilestones,
  getPlanningTasks,
  getStudyTeam,
  getRegulatoryChecklist,
  getProtocols,
  savePlanningMilestone,
  deletePlanningMilestone,
  savePlanningTask,
  deletePlanningTask,
  saveStudyTeamMember,
  deleteStudyTeamMember,
  saveRegulatoryChecklistItem,
  deleteRegulatoryChecklistItem,
  saveProtocol,
  deleteProtocol,
} from "../../services/planningService";
import "./StudyPlanning.css";

function StudyPlanning() {
  const [editingProtocol, setEditingProtocol] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const { id: studyCode } = useParams();
  const canEdit = useCanEditStudyContent("Study Planning", studyCode);
  const [version, setVersion] = useState(0);
  const [editingMilestone, setEditingMilestone] = useState(null);
const [editingTask, setEditingTask] = useState(null);
const [editingChecklistItem, setEditingChecklistItem] = useState(null);

  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener(PLANNING_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PLANNING_UPDATED_EVENT, refresh);
  }, []);

  void version;

  const milestones = getPlanningMilestones(studyCode);
  const tasks = getPlanningTasks(studyCode);
  const team = getStudyTeam(studyCode);
  const checklist = getRegulatoryChecklist(studyCode);
  const protocols = getProtocols(studyCode);
  const studyRecord = getStudyByCode(studyCode);

  const bump = () => setVersion((v) => v + 1);

  return (
    <div className="study-planning-page tnxt-compact">
      <div className="study-planning-header">
        <div>
          <h2>Study Milestone</h2>
          <p className="study-planning-site-ref">
            <span>Site</span>{" "}
            <strong>
              {resolveSiteDisplay({
                siteNumber:
                  (studyRecord &&
                    (studyRecord.siteNumber || studyRecord.siteNo)) ||
                  "",
                siteName:
                  (studyRecord &&
                    (studyRecord.siteName ||
                      studyRecord.site ||
                      studyRecord.location)) ||
                  "",
              })}
            </strong>
          </p>
        </div>
        {!canEdit && (
          <RequestPermissionButton
            action="Edit Planning"
            module="Study Planning"
            studyCode={studyCode}
            label="Request Edit Permission"
          />
        )}
      </div>

      <section className="planning-section">

  <div className="planning-section-header">
    <h3>Site Management Milestone</h3>

    <button
      type="button"
      className="secondary-btn"
      onClick={() => {
        // navigate/open full milestone list
      }}>

      View All
    </button>
  </div>
        {milestones.length === 0 ? (
          <p className="planning-empty">No planning milestones yet</p>
        ) : (
          <table className="planning-table ctms-standard-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Due</th>
                <th>Owner</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {milestones.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.dueDate || "—"}</td>
                  <td>{item.owner || "—"}</td>
                  <td>{item.status}</td>
                  {canEdit && (
                    <td>
  <button
    type="button"
    className="link-btn"
    onClick={() => setEditingMilestone(item)}>

    Edit
  </button>

  <button
    type="button"
    className="link-btn danger"
    onClick={() => {
      deletePlanningMilestone(studyCode, item.id);
      bump();
    }}>

    Delete
  </button>
</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canEdit && (
          <PlanningMilestoneForm
    initialData={editingMilestone}
    onSave={(data)=>{
        savePlanningMilestone(studyCode,data);
        setEditingMilestone(null);
        bump();
    }}
/>
        )}
      </section>

      <section className="planning-section">
        <div className="planning-section-header">
  <h3>Tasks</h3>

  <button
    type="button"
    className="secondary-btn"
    onClick={() => {
      // navigate/open full task list
    }}>

    View All
  </button>
</div>
        {tasks.length === 0 ? (
          <p className="planning-empty">No tasks yet</p>
        ) : (
          <table className="planning-table ctms-standard-table">
            <thead>
  <tr>
    <th>Task ID</th>
    <th>Task</th>
    <th>Assignee</th>
    <th>Due</th>
    <th>Priority</th>
    <th>Status</th>
    {canEdit && <th>Actions</th>}
  </tr>
</thead>
            <tbody>
              {tasks.map((item) => (
                <tr key={item.id}>
                  <td>{item.taskId || item.id}</td>
<td>{item.title}</td>
<td>{item.assignee || "—"}</td>
<td>{item.dueDate || "—"}</td>
<td>{item.priority}</td>
<td>{item.status}</td>
                  {canEdit && (
                    <td>
  <button
    type="button"
    className="link-btn"
    onClick={() => setEditingTask(item)}>

    Edit
  </button>

  <button
    type="button"
    className="link-btn danger"
    onClick={() => {
      deletePlanningTask(studyCode, item.id);
      bump();
    }}>

    Delete
  </button>
</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canEdit && (
          <PlanningTaskForm
  initialData={editingTask}
  onSave={(data) => {
    savePlanningTask(studyCode, data);
    setEditingTask(null);
    bump();
  }}
/>
        )}
      </section>

      <section className="planning-section">
        <h3>Study Team</h3>
        {team.length === 0 ? (
          <p className="planning-empty">No team members added yet</p>
        ) : (
          <table className="planning-table ctms-standard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Start Date</th>
                <th>Organization</th>
                <th>Email</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id}>
                  <td>{member.name || "—"}</td>
                  <td>{member.role || "—"}</td>
                  <td>{member.startDate || "—"}</td>
                  <td>{member.organization || "—"}</td>
                  <td>{member.email || "—"}</td>
                  {canEdit && (
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setEditingMember(member)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="link-btn danger"
                        onClick={() => {
                          deleteStudyTeamMember(studyCode, member.id);
                          bump();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canEdit && (
          <StudyTeamForm
  initialData={editingMember}
  onSave={(data) => {
    saveStudyTeamMember(studyCode, data);
    setEditingMember(null);
    bump();
  }}
/>
        )}
      </section>

      <section className="planning-section">
        <h3>Regulatory Documents Checklist</h3>
        {checklist.length === 0 ? (
          <p className="planning-empty">No checklist items yet</p>
        ) : (
          <ul className="regulatory-checklist">
            {checklist.map((item) => (
              <li key={item.id}>

             <div className="checklist-info">

<strong>{item.label}</strong>

<div>
Document Date:
{item.documentDate || "—"}
</div>

<div>
Status:
{item.status || "Pending"}
</div>

<div>
Due:
{item.dueDate || "—"}
</div>

{item.documentName && (
<div>
Uploaded:
{item.documentName}
</div>
)}

</div>

<div className="checklist-actions">
  <button
    type="button"
    className="link-btn"
    onClick={() => setEditingChecklistItem(item)}
  >
    Edit
  </button>

  {item.documentUrl && (
    <button
      type="button"
      className="link-btn"
      onClick={() =>
        window.open(item.documentUrl, "_blank")
      }
    >
      View Document
    </button>
  )}

  <button
    type="button"
    className="link-btn danger"
    onClick={() => {
      deleteRegulatoryChecklistItem(studyCode, item.id);
      bump();
    }}
  >
    Remove
  </button>
</div>
</li>
            ))}
          </ul>
        )}
        {canEdit && (
         <RegulatoryItemForm
  initialData={editingChecklistItem}
  onSave={(data) => {
    saveRegulatoryChecklistItem(studyCode, data);
    setEditingChecklistItem(null);
    bump();
  }}
/>
        )}
      </section>

      <section className="planning-section">
        <h3>Protocols</h3>
        {protocols.length === 0 ? (
          <p className="planning-empty">No protocols recorded yet</p>
        ) : (
          protocols.map((protocol) => (
            <div key={protocol.id} className="protocol-card">
              <div className="protocol-header">
  <div>
    <strong>{protocol.title}</strong>

    <div>
      <strong>Protocol Number:</strong>{" "}
      {protocol.protocolNumber || "—"}
    </div>

    <div>
      <strong>Current Version:</strong>{" "}
      v{protocol.currentVersion || "—"}
    </div>

    <div>
      <strong>Status:</strong>{" "}
      {protocol.status || "Draft"}
    </div>
  </div>

  {canEdit && (
    <div>
      <button
        type="button"
        className="link-btn"
        onClick={() => setEditingProtocol(protocol)}>

        Edit
      </button>

      <button
        type="button"
        className="link-btn danger"
        onClick={() => {
          deleteProtocol(studyCode, protocol.id);
          bump();
        }}>

        Delete
      </button>
    </div>
  )}
</div>
              <ul className="protocol-versions">
                {(protocol.versions || []).map((versionRow, index) => (
                  <li key={`${protocol.id}-v-${index}`}>
                    v{versionRow.version} — {versionRow.effectiveDate || "—"} (
                    {versionRow.status || "Draft"})
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {canEdit && (
          <ProtocolForm
initialData={editingProtocol}
onSave={(data)=>{
saveProtocol(studyCode,data);
setEditingProtocol(null);
bump();
}}
/>
        )}
      </section>
    </div>
  );
}

const MILESTONE_FORM_DEFAULTS = {
  title: "",
  dueDate: "",
  owner: "",
  status: "Not Started",
};

function PlanningMilestoneForm({
    initialData,
    onSave
}: any) {
  const [form, setForm] = useState<typeof MILESTONE_FORM_DEFAULTS & { id?: number }>(MILESTONE_FORM_DEFAULTS);
  useEffect(() => {
    // Phase 11–13 BUG-1: Merge stored record onto defaults so every controlled
    // field remains a defined string. Stored records may be missing keys
    // (e.g. legacy milestone with no `owner`), which previously flipped the
    // corresponding input from controlled → uncontrolled on Edit.
    if (initialData) {
      setForm({
        ...MILESTONE_FORM_DEFAULTS,
        ...initialData,
        title: initialData.title ?? "",
        dueDate: initialData.dueDate ?? "",
        owner: initialData.owner ?? "",
        status: initialData.status ?? "Not Started",
      });
    }
  }, [initialData]);

  return (
    <form
      className="planning-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        onSave(form);
        setForm(MILESTONE_FORM_DEFAULTS);
      }}>

      <input
        placeholder="Milestone title"
        value={form.title ?? ""}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        type="date"
        value={form.dueDate ?? ""}
        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
      />
      <input
        placeholder="Owner"
        value={form.owner ?? ""}
        onChange={(e) => setForm({ ...form, owner: e.target.value })}
      />
      <button type="submit" className="secondary-btn">
        {form.id ? "Update Milestone" : "Add Milestone"}
      </button>
    </form>
  );
}

const TASK_FORM_DEFAULTS = {
  title: "",
  assignee: "",
  dueDate: "",
  priority: "Medium",
  status: "Open",
};

function PlanningTaskForm({
  initialData,
  onSave,
}: any) {
  const [form, setForm] = useState<typeof TASK_FORM_DEFAULTS & { id?: number }>(TASK_FORM_DEFAULTS);
  useEffect(() => {
    // Phase 11–13 BUG-1: keep every controlled field defined when editing an
    // existing task record that may not carry all keys.
    if (initialData) {
      setForm({
        ...TASK_FORM_DEFAULTS,
        ...initialData,
        title: initialData.title ?? "",
        assignee: initialData.assignee ?? "",
        dueDate: initialData.dueDate ?? "",
        priority: initialData.priority ?? "Medium",
        status: initialData.status ?? "Open",
      });
    }
  }, [initialData]);
  return (
    <form
      className="planning-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        onSave(form);
        setForm(TASK_FORM_DEFAULTS);
      }}>

      <input
        placeholder="Task title"
        value={form.title ?? ""}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        placeholder="Assignee"
        value={form.assignee ?? ""}
        onChange={(e) => setForm({ ...form, assignee: e.target.value })}
      />
      <input
        type="date"
        value={form.dueDate ?? ""}
        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
      />
     <button type="submit" className="secondary-btn">
  {form.id ? "Update Task" : "Add Task"}
</button>
    </form>
  );
}

const STUDY_TEAM_FORM_DEFAULTS = {
  name: "",
  role: "",
  email: "",
  organization: "",
  startDate: "",
};

function StudyTeamForm({
  initialData,
  onSave,
}: any) {
  const [form, setForm] = useState<typeof STUDY_TEAM_FORM_DEFAULTS & { id?: number }>(STUDY_TEAM_FORM_DEFAULTS);
  useEffect(() => {
    // Phase 11–13 BUG-1: keep every controlled field defined when editing an
    // existing team member record.
    if (initialData) {
      setForm({
        ...STUDY_TEAM_FORM_DEFAULTS,
        ...initialData,
        name: initialData.name ?? "",
        role: initialData.role ?? "",
        email: initialData.email ?? "",
        organization: initialData.organization ?? "",
        startDate: initialData.startDate ?? "",
      });
    }
  }, [initialData]);

  return (
    <form
      className="planning-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave(form);
        setForm(STUDY_TEAM_FORM_DEFAULTS);
      }}>

      <input
        placeholder="Name"
        value={form.name ?? ""}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        placeholder="Role"
        value={form.role ?? ""}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
      />
      <input
  type="date"
  value={form.startDate ?? ""}
  onChange={(e) =>
    setForm({
      ...form,
      startDate: e.target.value,
    })
  }
/>
      <input
        placeholder="Email"
        value={form.email ?? ""}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        placeholder="Organization"
        value={form.organization ?? ""}
        onChange={(e) => setForm({ ...form, organization: e.target.value })}
      />
      <button type="submit" className="secondary-btn">
        {form.id ? "Update Member" : "Add Member"}
      </button>
    </form>
  );
}

const REGULATORY_ITEM_FORM_DEFAULTS = {
  label: "",
  documentDate: "",
  dueDate: "",
  status: "Pending",
  documentName: "",
  documentUrl: "",
};

function RegulatoryItemForm({
  initialData,
  onSave,
}: any) {
  const [form, setForm] = useState<typeof REGULATORY_ITEM_FORM_DEFAULTS & { id?: number }>(REGULATORY_ITEM_FORM_DEFAULTS);
  useEffect(() => {
    // Phase 11–13 BUG-1: keep every controlled field defined when editing an
    // existing regulatory checklist item that may not carry all keys.
    if (initialData) {
      setForm({
        ...REGULATORY_ITEM_FORM_DEFAULTS,
        ...initialData,
        label: initialData.label ?? "",
        documentDate: initialData.documentDate ?? "",
        dueDate: initialData.dueDate ?? "",
        status: initialData.status ?? "Pending",
        documentName: initialData.documentName ?? "",
        documentUrl: initialData.documentUrl ?? "",
      });
    }
  }, [initialData]);

  return (
    <form
      className="planning-inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.label.trim()) return;

onSave({
  ...form,
  completed: false,
});        setForm(REGULATORY_ITEM_FORM_DEFAULTS);
      }}>

      <input
        placeholder="Checklist Item"
  value={form.label ?? ""}
  onChange={(e) =>
    setForm({
      ...form,
      label: e.target.value,
    })
  }
/>

<input
  type="date"
  value={form.documentDate ?? ""}
  onChange={(e) =>
    setForm({
      ...form,
      documentDate: e.target.value,
    })
  }
/>

<input
  type="date"
  value={form.dueDate ?? ""}
  onChange={(e) =>
    setForm({
      ...form,
      dueDate: e.target.value,
    })
  }
/>

<select
  value={form.status ?? "Pending"}
  onChange={(e) =>
    setForm({
      ...form,
      status: e.target.value,
    })
  }>

  <option>Pending</option>
  <option>Submitted</option>
  <option>Approved</option>
  <option>Rejected</option>
</select>

<input
  type="file"
  onChange={(e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setForm({
      ...form,
      documentName: file.name,
      documentUrl: URL.createObjectURL(file),
    });
  }}
/>
      <button type="submit" className="secondary-btn">
        Add Item
      </button>
    </form>
  );
}

const PROTOCOL_FORM_DEFAULTS = {
  title: "",
  protocolNumber: "",
  version: "1.0",
  effectiveDate: "",
  summary: "",
  status: "Draft",
};

function ProtocolForm({
initialData,
onSave
}: any) {
  const [form, setForm] = useState<typeof PROTOCOL_FORM_DEFAULTS & { id?: number }>(PROTOCOL_FORM_DEFAULTS);
  useEffect(() => {
    // Phase 11–13 BUG-1: keep every controlled field defined when editing an
    // existing protocol record that may not carry all keys (legacy protocols
    // often have no `summary`, `effectiveDate`, or `protocolNumber`).
    if (initialData) {
      setForm({
        ...PROTOCOL_FORM_DEFAULTS,
        ...initialData,
        title: initialData.title ?? "",
        protocolNumber: initialData.protocolNumber ?? "",
        version: initialData.version ?? "1.0",
        effectiveDate: initialData.effectiveDate ?? "",
        summary: initialData.summary ?? "",
        status: initialData.status ?? "Draft",
      });
    }
  }, [initialData]);

  return (
    <form
      className="planning-inline-form planning-inline-form--stacked"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        onSave(form);
        setForm(PROTOCOL_FORM_DEFAULTS);
      }}>

      <input
        placeholder="Protocol title"
        value={form.title ?? ""}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
placeholder="Protocol Number"
value={form.protocolNumber ?? ""}
onChange={(e)=>
setForm({
...form,
protocolNumber:e.target.value
})
}
/>
<select
value={form.status ?? "Draft"}
onChange={(e)=>
setForm({
...form,
status:e.target.value
})
}>

<option>Draft</option>
<option>In Review</option>
<option>Approved</option>
<option>Active</option>
<option>Archived</option>

</select>
      <input
        placeholder="Version"
        value={form.version ?? ""}
        onChange={(e) => setForm({ ...form, version: e.target.value })}
      />
      <input
        type="date"
        value={form.effectiveDate ?? ""}
        onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
      />
      <textarea
        placeholder="Summary"
        value={form.summary ?? ""}
        rows={2}
        onChange={(e) => setForm({ ...form, summary: e.target.value })}
      />
      <button type="submit" className="secondary-btn">
        {form.id ? "Update Protocol" : "Add Protocol"}
      </button>
    </form>
  );
}

export default StudyPlanning;