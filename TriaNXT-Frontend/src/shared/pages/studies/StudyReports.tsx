import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardPieChart from "../../components/dashboard/shared/DashboardPieChart";
import KPICard from "../../components/dashboard/shared/KPICard";
import { downloadCsvReport } from "../../utils/exportReport";
import { getStudyByCode, getStudies } from "../../services/studyService";
import { getSubjectsForStudy } from "../../services/subjectService";
import { getSubjectStatusAnalytics } from "../../utils/subjectStatusAnalytics";
import { resolveSiteDisplay } from "../../utils/siteDisplay";
import "./StudyReports.css";

function StudyReports() {
  const { id } = useParams();
  const study = getStudyByCode(id);
  const [reportStatus, setReportStatus] = useState("");

  const siteSources = useMemo(() => getStudies(), []);
  const displaySite = (value) =>
    value
      ? resolveSiteDisplay(value, {
          sources: siteSources,
          fallback: value
        })
      : "—";

  const studySubjects = useMemo(() => {
    try {
      return getSubjectsForStudy(id);
    } catch {
      return [];
    }
  }, [id]);

  const statusAnalytics = useMemo(
    () => getSubjectStatusAnalytics(studySubjects),
    [studySubjects]
  );

  const generateReport = () => {
    const payload = {
      studyCode: study?.code || id,
      studyName: study?.name,
      generatedAt: new Date().toISOString(),
      subjects: studySubjects,
      statusBreakdown: statusAnalytics
    };

    localStorage.setItem(`studyReport_${id}`, JSON.stringify(payload));
    setReportStatus("Study report generated. Ready for CSV download.");
  };

  const downloadReport = () => {
    const stored = localStorage.getItem(`studyReport_${id}`);

    if (!stored) {
      setReportStatus("Generate a report first before downloading.");
      return;
    }

    const report = JSON.parse(stored);
    const rows = [
      ["Study Report"],
      ["Study", report.studyName || report.studyCode],
      ["Generated", report.generatedAt],
      [],
      ["Subject Status", "Count"],
      ...report.statusBreakdown.map((item) => [item.name, item.value]),
      [],
      ["Subject ID", "Status", "Site", "PI"],
      ...studySubjects.map((subject) => [
        subject.id || subject.subjectId,
        subject.status,
        displaySite(subject.site),
        subject.pi
      ])
    ];

    downloadCsvReport(`study-report-${id}-${Date.now()}.csv`, rows);
    setReportStatus("Report downloaded as CSV.");
  };

  return (
    <div className="study-reports-page">
      <div className="study-reports-header">
        <div>
          <h2>Reports — {study?.name || id}</h2>
          <p>Full study overview and subject-status analytics</p>
        </div>
        <div className="study-reports-actions">
          <button type="button" className="report-btn" onClick={generateReport}>
            Generate Report
          </button>
          <button
            type="button"
            className="report-btn report-btn-primary"
            onClick={downloadReport}>

            Download Report
          </button>
        </div>
      </div>

      {reportStatus && <p className="study-reports-status">{reportStatus}</p>}

      <div className="study-reports-overview">
        <h3>Study Information</h3>
        <div className="study-reports-info-grid">
          <div>
            <label>Study Number</label>
            <span>{study?.code || id}</span>
          </div>
          <div>
            <label>Study Name</label>
            <span>{study?.name || "—"}</span>
          </div>
          <div>
            <label>Indication</label>
            <span>{study?.indication || "—"}</span>
          </div>
          <div>
            <label>Sponsor</label>
            <span>{study?.sponsor || "—"}</span>
          </div>
          <div>
            <label>CRO</label>
            <span>{study?.cro || "—"}</span>
          </div>
          <div>
            <label>Start Date</label>
            <span>{study?.startDate || "—"}</span>
          </div>
          <div>
            <label>Status</label>
            <span>{study?.status || "—"}</span>
          </div>
          <div>
            <label>Principal Investigator</label>
            <span>{study?.principalInvestigator || "—"}</span>
          </div>
        </div>
        {study?.description && (
          <div className="study-reports-description">
            <label>Description</label>
            <p>{study.description}</p>
          </div>
        )}
      </div>

      <div className="study-reports-kpi-grid">
        {statusAnalytics.map((item) => (
          <KPICard
            key={item.name}
            title={item.name}
            value={item.value}
            subtitle="Subjects"
          />
        ))}
      </div>

      <div className="study-reports-chart">
        <h3>Subject Status Overview</h3>
        <DashboardPieChart data={statusAnalytics} />
      </div>

      <p className="study-reports-format-note">
        Report downloads are exported as CSV files compatible with Excel.
      </p>
    </div>
  );
}

export default StudyReports;
