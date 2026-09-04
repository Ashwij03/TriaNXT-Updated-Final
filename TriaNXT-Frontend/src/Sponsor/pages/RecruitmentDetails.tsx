import React from "react";
import AppLayout from "./AppLayout";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/RecruitmentDetails.css";
import jsPDF from "jspdf";
import { getStudies } from "../../shared/services/studyService";
import { resolveSiteDisplay } from "../../shared/utils/siteDisplay";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from "recharts";

const RecruitmentDetails = () => {
  const [showCampaignModal, setShowCampaignModal] =
  useState(false);
 const [campaigns, setCampaigns] = useState([
  {
    id: "CMP-001",
    campaignName: "Q3 Oncology Recruitment Drive",
    targetSites: "Apollo, Care, Metro",
    targetSubjects: 800,
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    priority: "High",
    status: "Active",
    progress: "68%",
    createdBy: "Sponsor Admin"
  },

  {
    id: "CMP-002",
    campaignName: "Patient First Enrollment Initiative",
    targetSites: "Apollo, Yashoda",
    targetSubjects: 500,
    startDate: "2026-08-01",
    endDate: "2026-10-31",
    priority: "Medium",
    status: "Planned",
    progress: "24%",
    createdBy: "Sponsor Admin"
  }
]);

const [campaignForm, setCampaignForm] =
  useState({
    campaignName: "",
    targetSites: "",
    targetSubjects: "",
    startDate: "",
    endDate: "",
    priority: "Medium",
    status: "Planned"
  });
  const saveCampaign = () => {

  const newCampaign = {
    id: `CMP-${Date.now()}`,
    ...campaignForm,
    targetSubjects: campaignForm.targetSubjects as unknown as number,
    progress: "0%",
    createdBy: "Sponsor Admin"
  };

  setCampaigns([
    ...campaigns,
    newCampaign
  ]);

  setShowCampaignModal(false);

  setCampaignForm({
    campaignName: "",
    targetSites: "",
    targetSubjects: "",
    startDate: "",
    endDate: "",
    priority: "Medium",
    status: "Planned"
  });
};
  const enrollmentTrend = [
  { month: "Jan", enrolled: 1200 },
  { month: "Feb", enrolled: 1450 },
  { month: "Mar", enrolled: 1680 },
  { month: "Apr", enrolled: 1900 },
  { month: "May", enrolled: 2100 },
  { month: "Jun", enrolled: 2200 }
];
const funnelData = [
  { stage: "Screened", count: 3000 },
  { stage: "Eligible", count: 2700 },
  { stage: "Consented", count: 2500 },
  { stage: "Randomized", count: 2200 },
  { stage: "Completed", count: 1980 }
];
    const generateReport = () => {

  const doc = new jsPDF();

  doc.text("Recruitment Report", 20, 20);

  doc.text(
    `Study: ${studyData.study}`,
    20,
    40
  );

  doc.text(
    `Target: ${studyData.target}`,
    20,
    50
  );

  doc.text(
    `Enrolled: ${studyData.enrolled}`,
    20,
    60
  );

  doc.save("RecruitmentReport.pdf");
};

const exportData = () => {

  const csvData =
`Study,Target,Enrolled
${studyData.study},
${studyData.target},
${studyData.enrolled}`;

  const blob = new Blob(
    [csvData],
    { type: "text/csv" }
  );

  const url =
    window.URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;

  a.download =
    "RecruitmentData.csv";

  a.click();
};

  const navigate = useNavigate();
const location = useLocation();
  const studyData = location.state;

  if (!studyData) {
    return (
      <AppLayout>
        <h2>No Study Selected</h2>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      <div className="page-container tnxt-compact">
        <button
  className="back-btn"
  onClick={() => navigate(-1)}
        >
   Back
</button>

        <h1>{studyData.study}</h1>
        <div className="kpi-grid">

  <div className="kpi-card">
    <h3>Target Subjects</h3>
    <h2>{studyData.target}</h2>
  </div>

  <div className="kpi-card">
    <h3>Enrolled Subjects</h3>
    <h2>{studyData.enrolled}</h2>
  </div>

  <div className="kpi-card">
    <h3>Remaining</h3>
    <h2>{studyData.target - studyData.enrolled}</h2>
  </div>

  <div className="kpi-card">
    <h3>Recruitment %</h3>
    <h2>
      {Math.round(
        (studyData.enrolled / studyData.target) * 100
      )}%
    </h2>
  </div>

</div>

<div className="details-card">

  <h2>Recruitment Progress</h2>

  <p>
    {studyData.enrolled} / {studyData.target} Subjects Enrolled
  </p>

  <div className="progress-bar">
    <div
      className="progress-fill"
      style={{
        width: `${Math.round(
          (studyData.enrolled / studyData.target) * 100
        )}%`
      }}
    ></div>
  </div>

  <p>
    {Math.round(
      (studyData.enrolled / studyData.target) * 100
    )}% Complete
  </p>

</div>

<div className="details-card">

  <h2>Recruitment Metrics</h2>

  <table className="metrics-table ctms-standard-table">

    <thead>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
    </thead>

    <tbody>

      <tr>
        <td>Screened Subjects</td>
        <td>180</td>
      </tr>

      <tr>
        <td>Eligible Subjects</td>
        <td>145</td>
      </tr>

      <tr>
        <td>Enrolled Subjects</td>
        <td>{studyData.enrolled}</td>
      </tr>

      <tr>
        <td>Screen Failures</td>
        <td>25</td>
      </tr>

      <tr>
        <td>Dropouts</td>
        <td>5</td>
      </tr>

    </tbody>

  </table>

</div>
<div className="details-card">

  <h2>Enrollment Trend</h2>

  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={enrollmentTrend}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />

      <Line
        type="monotone"
        dataKey="enrolled"
        stroke="#2563eb"
        strokeWidth={3}
      />
    </LineChart>
  </ResponsiveContainer>

</div>
<div className="details-card">

  <h2>Recruitment Funnel</h2>

  <ResponsiveContainer width="100%" height={350}>
    <BarChart data={funnelData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="stage" />
      <YAxis />
      <Tooltip />

      <Bar
        dataKey="count"
        fill="#082b3d"
      />
    </BarChart>
  </ResponsiveContainer>

</div>
<div className="details-card">

  <h2>Recruitment Risk Panel</h2>

  <div className="details-grid">

    <div>
      <strong>Low Recruitment Sites</strong>
      <p>3 Sites</p>
    </div>

    <div>
      <strong>High Dropout Sites</strong>
      <p>2 Sites</p>
    </div>

    <div>
      <strong>Screen Failure Rate</strong>
      <p>9%</p>
    </div>

    <div>
      <strong>Enrollment Delays</strong>
      <p>4 Active</p>
    </div>

  </div>

</div>

<div className="details-card">

  <h2>Forecast Analytics</h2>

  <div className="details-grid">

    <div>
      <strong>Projected Completion</strong>
      <p>Dec 2026</p>
    </div>

    <div>
      <strong>Expected Enrollment</strong>
      <p>3100 Subjects</p>
    </div>

    <div>
      <strong>Recruitment Confidence</strong>
      <p>92%</p>
    </div>

    <div>
      <strong>Risk Probability</strong>
      <p>Low</p>
    </div>

  </div>

</div>
<div className="details-card">

  <h2>Site Recruitment Performance</h2>

  <table className="sponsor-table ctms-standard-table">

    <thead>
      <tr>
        <th>Site</th>
        <th>Target</th>
        <th>Actual</th>
        <th>Completion %</th>
        <th>Risk</th>
      </tr>
    </thead>

    <tbody>

      <tr>
        <td>{resolveSiteDisplay("Apollo Hospital", { sources: getStudies() })}</td>
        <td>500</td>
        <td>420</td>
        <td>84%</td>
        <td>Low</td>
      </tr>

      <tr>
        <td>{resolveSiteDisplay("Care Hospital", { sources: getStudies() })}</td>
        <td>400</td>
        <td>290</td>
        <td>72%</td>
        <td>Medium</td>
      </tr>

      <tr>
        <td>{resolveSiteDisplay("Metro Hospital", { sources: getStudies() })}</td>
        <td>350</td>
        <td>210</td>
        <td>60%</td>
        <td>High</td>
      </tr>

    </tbody>

  </table>

</div>

<div className="details-card">

  <h2>Recruitment Action Center</h2>

  <div className="action-buttons">

    <button onClick={generateReport}>
      Generate Recruitment Report
    </button>

    <button onClick={exportData}>
      Export Recruitment Data
    </button>

   <button
  onClick={() =>
    alert("Recruitment notification sent to all participating sites")
  }
   >
  Notify Sites
</button>

  <button
  onClick={() =>
    setShowCampaignModal(true)
  }
  >
  Create Recruitment Campaign
</button>

  </div>
  
</div>
<div className="details-card">

  <h2>Recruitment Campaigns</h2>

  <table className="sponsor-table ctms-standard-table">

    <thead>
      <tr>
        <th>Campaign ID</th>
        <th>Campaign Name</th>
        <th>Status</th>
        <th>Progress</th>
        <th>Created By</th>
      </tr>
    </thead>

    <tbody>

      {campaigns.map((campaign) => (

        <tr key={campaign.id}>

          <td>{campaign.id}</td>

          <td>{campaign.campaignName}</td>

          <td>{campaign.status}</td>

          <td>{campaign.progress}</td>

          <td>{campaign.createdBy}</td>

        </tr>

      ))}

    </tbody>

  </table>

</div>

{showCampaignModal && (
  <div className="modal-overlay">

    <div className="modal-content">

      <h2>Create Recruitment Campaign</h2>

      <input
        placeholder="Campaign Name"
        value={campaignForm.campaignName}
        onChange={(e) =>
          setCampaignForm({
            ...campaignForm,
            campaignName: e.target.value
          })
        }
      />

      <input
        placeholder="Target Sites"
        value={campaignForm.targetSites}
        onChange={(e) =>
          setCampaignForm({
            ...campaignForm,
            targetSites: e.target.value
          })
        }
      />

      <input
        placeholder="Target Subjects"
        value={campaignForm.targetSubjects}
        onChange={(e) =>
          setCampaignForm({
            ...campaignForm,
            targetSubjects: e.target.value
          })
        }
      />

      <input
        type="date"
        value={campaignForm.startDate}
        onChange={(e) =>
          setCampaignForm({
            ...campaignForm,
            startDate: e.target.value
          })
        }
      />

      <input
        type="date"
        value={campaignForm.endDate}
        onChange={(e) =>
          setCampaignForm({
            ...campaignForm,
            endDate: e.target.value
          })
        }
      />

      <select
        value={campaignForm.priority}
        onChange={(e) =>
          setCampaignForm({
            ...campaignForm,
            priority: e.target.value
          })
        }
      >
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>

      <select
        value={campaignForm.status}
        onChange={(e) =>
          setCampaignForm({
            ...campaignForm,
            status: e.target.value
          })
        }
      >
        <option>Planned</option>
        <option>Active</option>
        <option>Completed</option>
      </select>

      <div className="action-buttons">

        <button onClick={saveCampaign}>
          Save
        </button>

        <button
          onClick={() =>
            setShowCampaignModal(false)
          }
        >
          Cancel
        </button>

      </div>

    </div>

  </div>
)}
      </div>

    </AppLayout>
  );
};

export default RecruitmentDetails;