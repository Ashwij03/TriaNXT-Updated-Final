import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../shared/components/dashboard/shared/DashboardLayout";
import DataTable from "../../shared/components/dashboard/shared/DataTable";
import KPICard from "../../shared/components/dashboard/shared/KPICard";
import {
  canManageReports,
  createReport,
  deleteReport,
  getReportsForStudy,
} from "../../shared/services/reportService";
import { getCurrentUser, getAccessibleStudies } from "../../shared/services/roleService";
import "../../shared/styles/AdminPage.css";

const REPORT_TYPE_OPTIONS = [
  "Enrollment",
  "Safety",
  "Compliance",
  "Operations",
  "Monitoring",
  "Executive",
];

const REPORT_STATUS_OPTIONS = ["Draft", "Pending", "Generated"];

function Reports() {
  const user = getCurrentUser();
  const canManage = canManageReports(user);

  const studies = useMemo(() => getAccessibleStudies(user), [user]);
  const studyNameByCode = useMemo(
    () =>
      studies.reduce((map, study) => {
        map[String(study.code)] = study.name || study.code;
        return map;
      }, {}),
    [studies],
  );

  const [reports, setReports] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    reportType: REPORT_TYPE_OPTIONS[0],
    status: REPORT_STATUS_OPTIONS[0],
    studyCode: "",
  });

  const refresh = useCallback(() => {
    const currentStudies = getAccessibleStudies(getCurrentUser());
    setReports(
      currentStudies.flatMap((study) =>
        getReportsForStudy(study.code, getCurrentUser()),
      ),
    );
  }, []);

  useEffect(() => {
    refresh();

    window.addEventListener("reports-updated", refresh);
    window.addEventListener("sponsor-data-updated", refresh);
    window.addEventListener("studies-updated", refresh);

    return () => {
      window.removeEventListener("reports-updated", refresh);
      window.removeEventListener("sponsor-data-updated", refresh);
      window.removeEventListener("studies-updated", refresh);
    };
  }, [refresh]);

  const readyReports = reports.filter(
    (report) => report.status === "Generated",
  ).length;
  const pendingReports = reports.filter(
    (report) => report.status === "Pending",
  ).length;

  const handleOpenForm = () => {
    setForm({
      name: "",
      reportType: REPORT_TYPE_OPTIONS[0],
      status: REPORT_STATUS_OPTIONS[0],
      studyCode: studies[0]?.code || "",
    });
    setShowForm(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.studyCode) {
      return;
    }

    const created = createReport(
      {
        name: form.name.trim(),
        reportType: form.reportType,
        status: form.status,
        studyCode: form.studyCode,
      },
      getCurrentUser(),
    );

    if (created) {
      setShowForm(false);
      refresh();
    }
  };

  const handleDelete = (report) => {
    if (deleteReport(report.id, getCurrentUser())) {
      refresh();
    }
  };

  return (
    <DashboardLayout>
      <div className="admin-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Reports</h1>
          <p>Study reports, scoped to your accessible studies</p>
        </div>

        <div className="admin-kpi-grid">
          <KPICard title="Total" value={reports.length} subtitle="Reports" icon="📈" />
          <KPICard title="Generated" value={readyReports} subtitle="Available Now" icon="✅" />
          <KPICard title="Pending" value={pendingReports} subtitle="In Progress" icon="⏳" />
        </div>

        {canManage && (
          <div style={{ margin: "1rem 0" }}>
            {!showForm ? (
              <button type="button" onClick={handleOpenForm}>
                + New Report
              </button>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="admin-table-section" style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      placeholder="Report name"
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      required
                    />

                    <select
                      value={form.reportType}
                      onChange={(event) =>
                        setForm({ ...form, reportType: event.target.value })
                      }
                    >
                      {REPORT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <select
                      value={form.studyCode}
                      onChange={(event) =>
                        setForm({ ...form, studyCode: event.target.value })
                      }
                      required
                    >
                      <option value="" disabled>
                        Select study
                      </option>
                      {studies.map((study) => (
                        <option key={study.code} value={study.code}>
                          {study.name || study.code}
                        </option>
                      ))}
                    </select>

                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({ ...form, status: event.target.value })
                      }
                    >
                      {REPORT_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>

                    <button type="submit">Save</button>
                    <button type="button" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="admin-table-section">
          <DataTable
            className="ctms-standard-table"
            title="Reports"
            columns={[
              { key: "id", label: "Report ID" },
              { key: "name", label: "Name" },
              { key: "reportType", label: "Type" },
              {
                key: "studyCode",
                label: "Study",
                render: (value) => studyNameByCode[String(value)] || value,
              },
              { key: "createdAt", label: "Created" },
              { key: "status", label: "Status" },
              ...(canManage
                ? [
                    {
                      key: "actions",
                      label: "Actions",
                      render: (_value, row) => (
                        <button type="button" onClick={() => handleDelete(row)}>
                          Delete
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
            data={reports}
            emptyMessage="No reports yet for your accessible studies"
            pagination
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Reports;