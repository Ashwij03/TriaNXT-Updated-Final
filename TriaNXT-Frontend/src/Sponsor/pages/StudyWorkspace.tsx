import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "./AppLayout";
import "../styles/StudyWorkspace.css";
import "../styles/SponsorShared.css";
import StudyFinancials from "../../shared/pages/Financials/StudyFinancials";
import StudyVisitPlan from "../../shared/pages/studies/StudyVisitPlan";
import StudyPlanning from "../../shared/pages/studies/StudyPlanning";
import StudyDocuments from "../../shared/pages/studies/StudyDocuments";
import StudyActivity from "../../shared/pages/studies/StudyActivity";
import ClinicalSitesDashboard from "../../shared/pages/studies/ClinicalSitesDashboard";
import { getPortfolioStudies, getRisks, getOversightStudies, getOversightKPIs } from '../data/sponsorDataStore';

function StudyWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [study, setStudy] = useState(null);
  const [openRisks, setOpenRisks] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const refresh = () => {
      const studies = getPortfolioStudies();
      const match = studies.find((s) => s.studyId === id);
      setStudy(match || null);
      setOpenRisks(getRisks().filter((r) => r.study === id && r.status === "Open").length);
    };
    refresh();
    window.addEventListener("sponsor-data-updated", refresh);
    return () => window.removeEventListener("sponsor-data-updated", refresh);
  }, [id]);

  if (!study) {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="sponsor-page-header">
            <h1>Study Not Found</h1>
            <p>Could not load study {id}.</p>
          </div>
          <button type="button" className="sponsor-btn-primary" onClick={() => navigate("/studies")}>
            Back to Studies
          </button>
        </div>
      </AppLayout>
    );
  }

  const enrollmentRate = study.target
    ? Math.round((study.enrolled / study.target) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="page-container">
        <div className="workspace-header">
          <h1>{study.studyName}</h1>
          <p>Study ID: {study.studyId} · {study.phase} · {study.status}</p>
        </div>

        <div className="study-kpi-container">
          <div className="study-kpi-card">
            <h3>Enrolled</h3>
            <p>{study.enrolled?.toLocaleString() ?? 0}</p>
          </div>
          <div className="study-kpi-card">
            <h3>Target</h3>
            <p>{study.target?.toLocaleString() ?? 0}</p>
          </div>
          <div className="study-kpi-card">
            <h3>Sites</h3>
            <p>{study.sites ?? 0}</p>
          </div>
          <div className="study-kpi-card">
            <h3>Enrollment Rate</h3>
            <p>{enrollmentRate}%</p>
          </div>
        </div>

   <div className="workspace-tabs">
  <button
    type="button"
    className={activeTab === "overview" ? "active-tab" : ""}
    onClick={() => setActiveTab("overview")}
  >
    Overview
  </button>

  <button
    type="button"
    className={activeTab === "details" ? "active-tab" : ""}
    onClick={() => setActiveTab("details")}
  >
    Details
  </button>

  <button
    type="button"
    className={activeTab === "visitplan" ? "active-tab" : ""}
    onClick={() => setActiveTab("visitplan")}
  >
    Visit Plan
  </button>

  <button
    type="button"
    className={activeTab === "financials" ? "active-tab" : ""}
    onClick={() => setActiveTab("financials")}
  >
    Financials
  </button>

  <button
    type="button"
    className={activeTab === "sites" ? "active-tab" : ""}
    onClick={() => setActiveTab("sites")}
  >
    Clinical Sites
  </button>

  <button
    type="button"
    className={activeTab === "monitoring" ? "active-tab" : ""}
    onClick={() => setActiveTab("monitoring")}
  >
    Monitoring
  </button>

  <button
    type="button"
    className={activeTab === "files" ? "active-tab" : ""}
    onClick={() => setActiveTab("files")}
  >
    Files
  </button>

  <button
    type="button"
    className={activeTab === "study-milestone" ? "active-tab" : ""}
    onClick={() => setActiveTab("study-milestone")}
  >
    Study Milestone
  </button>

  <button
    type="button"
    className={activeTab === "activity" ? "active-tab" : ""}
    onClick={() => setActiveTab("activity")}
  >
    Activity
  </button>
</div>

        {activeTab === "overview" && (
          <div className="workspace-content workspace-card">
            <div className="performance-cards">
              <div className="study-kpi-card">
                <h3>CRO</h3>
                <p>{study.cro || "—"}</p>
              </div>
              <div className="study-kpi-card">
                <h3>Therapeutic Area</h3>
                <p>{study.therapeuticArea || "—"}</p>
              </div>
              <div className="study-kpi-card">
                <h3>Open Risks</h3>
                <p>{openRisks}</p>
              </div>
              <div className="study-kpi-card">
                <h3>Start Date</h3>
                <p>{study.startDate || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "details" && (
          <div className="workspace-content workspace-card">
            <p><strong>Study ID:</strong> {study.studyId}</p>
            <p><strong>Phase:</strong> {study.phase}</p>
            <p><strong>Status:</strong> {study.status}</p>
            <p><strong>CRO:</strong> {study.cro}</p>
            <p><strong>Sites:</strong> {study.sites}</p>
            <p><strong>Therapeutic Area:</strong> {study.therapeuticArea}</p>
          </div>
        )}

        {activeTab === "financials" && (
          <StudyFinancials study={study} />
        )}

        {activeTab === "visitplan" && (
          <div className="workspace-content workspace-card">
            <StudyVisitPlan />
          </div>
        )}

        {activeTab === "sites" && (
          <div className="workspace-content workspace-card">
            <ClinicalSitesDashboard study={study} />
          </div>
        )}

        {activeTab === "monitoring" && (
          <div className="workspace-content workspace-card">
            <SponsorMonitoringContent study={study} />
          </div>
        )}

        {activeTab === "files" && (
          <div className="workspace-content workspace-card">
            <StudyDocuments />
          </div>
        )}

        {activeTab === "study-milestone" && (
          <div className="workspace-content workspace-card">
            <StudyPlanning />
          </div>
        )}

        {activeTab === "activity" && (
          <div className="workspace-content workspace-card">
            <StudyActivity />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SponsorMonitoringContent({ study }: any) {
  const [oversightStudies, setOversightStudies] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ total: 0, onTrack: 0, delayed: 0 });

  useEffect(() => {
    const refresh = () => {
      setOversightStudies(getOversightStudies());
      setKpis(getOversightKPIs());
    };
    refresh();
    window.addEventListener("sponsor-data-updated", refresh);
    return () => window.removeEventListener("sponsor-data-updated", refresh);
  }, []);

  const currentStudyOversight = useMemo(() => {
    if (!study?.studyId) return null;
    return oversightStudies.find((s) => s.studyId === study.studyId) || null;
  }, [oversightStudies, study]);

  return (
    <div className="monitoring-content">
      <h3>Monitoring Overview</h3>

      <div className="study-kpi-container" style={{ marginBottom: "1rem" }}>
        <div className="study-kpi-card">
          <h3>Total Studies</h3>
          <p>{kpis.total}</p>
        </div>
        <div className="study-kpi-card">
          <h3>On Track</h3>
          <p>{kpis.onTrack}</p>
        </div>
        <div className="study-kpi-card">
          <h3>Delayed</h3>
          <p>{kpis.delayed}</p>
        </div>
      </div>

      {currentStudyOversight && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Current Study Status</h4>
          <div className="study-kpi-container">
            <div className="study-kpi-card">
              <h3>Status</h3>
              <p>{currentStudyOversight.status}</p>
            </div>
            <div className="study-kpi-card">
              <h3>Progress</h3>
              <p>{currentStudyOversight.progress}%</p>
            </div>
            <div className="study-kpi-card">
              <h3>Enrollment</h3>
              <p>{currentStudyOversight.enrollment}</p>
            </div>
            <div className="study-kpi-card">
              <h3>Milestone</h3>
              <p>{currentStudyOversight.milestone || "—"}</p>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <h4>All Studies Under Oversight</h4>
        <table className="ctms-standard-table">
          <thead>
            <tr>
              <th>Study ID</th>
              <th>Study Name</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Enrollment</th>
              <th>Next Review</th>
            </tr>
          </thead>
          <tbody>
            {oversightStudies.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  No studies under oversight
                </td>
              </tr>
            ) : (
              oversightStudies.map((item) => (
                <tr key={item.studyId}>
                  <td>{item.studyId}</td>
                  <td>{item.studyName}</td>
                  <td>
                    <span className={`status-badge ${item.status === "Delayed" ? "open" : "active"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.progress}%</td>
                  <td>{item.enrollment}</td>
                  <td>{item.nextReview || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StudyWorkspace;
