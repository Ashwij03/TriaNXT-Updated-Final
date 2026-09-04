import ROLES from "../constants/roles";
import { getEffectiveRole } from "../services/roleService";

import AdminComments from "../../Admin/pages/Comments";
import AdminNotifications from "../../Admin/pages/Notifications";
import AdminRecruitment from "../../Admin/pages/Recruitment";
import AdminReferral from "../../Admin/pages/Referral";
import AdminReports from "../../Admin/pages/Reports";
import AdminSettings from "../../Admin/pages/Settings";
import AdminSitePerformance from "../../Admin/pages/SitePerformance";
import CroEnrollment from "../../CRO/pages/CROEnrollment";
import CroQueries from "../../CRO/pages/CROQueries";
import DashboardLayout from "../components/dashboard/shared/DashboardLayout";
import RoleCommentsView from "../components/RoleCommentsView";
import SharedProgressNotes from "../pages/operations/ProgressNotes";
import SharedStudies from "../pages/studies/Studies";
import SponsorEnrollment from "../../CRO/pages/Enrollment";
import SponsorQueries from "../../Sponsor/pages/Queries";

import SponsorSitePerformance from "../../Sponsor/pages/SitePerformance";
import SponsorRecruitment from "../../Sponsor/pages/Recruitment";
import SponsorRegulatory from "../../Sponsor/pages/Regulatory";
import SponsorReports from "../../Sponsor/pages/Reports";
import SponsorNotifications from "../../Sponsor/pages/Notifications";
import SponsorSettings from "../../Sponsor/pages/Settings";
import SponsorReferral from "../../Sponsor/pages/Referral";
import SponsorProgressNotes from "../../Sponsor/pages/ProgressNotes";
import SponsorSubjects from "../../Sponsor/pages/Subjects";

import CroSitePerformance from "../../CRO/pages/CROSitePerformance";
import CroRecruitment from "../../CRO/pages/Recruitment";
import CroRegulatory from "../../CRO/pages/CRORegulatoryDocuments";
import CroReports from "../../CRO/pages/CROReports";
import CroNotifications from "../../CRO/pages/CRONotifications";
import CroSettings from "../../CRO/pages/CROSettings";

import PISitePerformance from "../../PI/pages/PISitePerformance";
import PISettings from "../../PI/pages/PISettings";

function pickComponent(roleMap, defaultComponent?) {
  const role = getEffectiveRole();
  return roleMap[role] || defaultComponent;
}

// The Admin role no longer has a dedicated Regulatory page (it was an
// orphaned page with no sidebar/nav link anywhere in the app). This is
// the fallback shown to any role without its own Regulatory page if the
// /regulatory route is ever reached directly.
function RegulatoryUnavailable() {
  return (
    <DashboardLayout>
      <div style={{ padding: "2.5rem 1.5rem" }}>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.375rem" }}>Regulatory</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          This page isn't available for your role.
        </p>
      </div>
    </DashboardLayout>
  );
}

function withDashboardLayout(Component) {
  return function DashboardLayoutWrapper(props) {
    return (
      <DashboardLayout>
        <Component {...props} />
      </DashboardLayout>
    );
  };
}

const PISettingsWithLayout = withDashboardLayout(PISettings);
const PISitePerformanceWithLayout = withDashboardLayout(PISitePerformance);

export function RoleAwareComments() {
  return (
    <DashboardLayout>
      <RoleCommentsView />
    </DashboardLayout>
  );
}

export function RoleAwareSitePerformance() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorSitePerformance,
      [ROLES.CRO]: CroSitePerformance,
      [ROLES.PI]: PISitePerformanceWithLayout
    },
    AdminSitePerformance
  );
  return <Component />;
}

export function RoleAwareRecruitment() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorRecruitment,
      [ROLES.CRO]: CroRecruitment
    },
    AdminRecruitment
  );
  return <Component />;
}

export function RoleAwareRegulatory() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorRegulatory,
      [ROLES.CRO]: CroRegulatory
    },
    RegulatoryUnavailable
  );
  return <Component />;
}

export function RoleAwareReports() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorReports,
      [ROLES.CRO]: CroReports
    },
    AdminReports
  );
  return <Component />;
}

export function RoleAwareNotifications() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorNotifications,
      [ROLES.CRO]: CroNotifications
    },
    AdminNotifications
  );
  return <Component />;
}

export function RoleAwareSettings() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorSettings,
      [ROLES.CRO]: CroSettings,
      [ROLES.PI]: PISettingsWithLayout,
    },
    AdminSettings
  );
  return <Component />;
}

export function RoleAwareReferral() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorReferral,
    },
    AdminReferral
  );
  return <Component />;
}

export function RoleAwareProgressNotes() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorProgressNotes
    },
    SharedProgressNotes
  );
  return <Component />;
}

export function RoleAwareStudies() {
  return <SharedStudies />;
}

export function RoleAwareEnrollment() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorEnrollment,
      [ROLES.CRO]: CroEnrollment
    },
    SponsorEnrollment
  );
  return <Component />;
}

export function RoleAwareQueries() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorQueries,
      [ROLES.CRO]: CroQueries
    },
    AdminComments
  );
  return <Component />;
}

export function RoleAwareSubjects() {
  const Component = pickComponent(
    {
      [ROLES.SPONSOR]: SponsorSubjects
    },
    // SharedSubjects
  );
  return <Component />;
}