import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import CompletedVisit from "./shared/pages/visits/CompletedVisit";
import EISFHub from "./shared/pages/documents/EISFHub";
import FileDetails from "./shared/pages/documents/FileDetails";
import ForgotPassword from "./shared/auth/ForgotPassword";
import Login from "./shared/auth/Login";
import OperationsComments from "./shared/pages/operations/Comments";
import ProfilePage from "./shared/pages/profile/ProfilePage";
import ProtectedRoute from "./shared/auth/ProtectedRoute";
import ROLES from "./shared/constants/roles";
import Register from "./shared/auth/Register";
import SecurityPage from "./shared/pages/profile/SecurityPage";
import StudyDashboard from "./shared/pages/studies/StudyDashboard";
import VisitDetails from "./shared/pages/visits/VisitDetails";
import AmendmentManagement from "./shared/pages/amendments/AmendmentManagement";
import SiteFeasibility from "./shared/pages/feasibility/SiteFeasibility";
import IpAccountability from "./shared/pages/ip/IpAccountability";
import IrbSubmissions from "./shared/pages/irb/IrbSubmissions";
import IcfManagement from "./shared/pages/consent/IcfManagement";
import VendorManagement from "./shared/pages/vendor/VendorManagement";

import AdminDashboard from "./Admin/pages/Dashboard";
import SiteStaffDashboard from "./SiteStaff/pages/Dashboard";
import PIDashboard from "./PI/pages/PIDashboard";
import CRODashboard from "./CRO/pages/CRODashboard";
import SponsorDashboard from "./Sponsor/pages/SponsorDashboard";
import AccessRequestForm from "./shared/pages/AccessRequestForm";
import AccessPermissions from "./shared/pages/AccessPermissions";
import PermissionApproval from "./shared/pages/PermissionApproval";
import UserManagement from "./shared/pages/UserManagement";
import CROOverview from "./CRO/pages/CROOverview";

import AuditLogsPage from "./shared/pages/audit/AuditLogsPage";
// TODO(fix-needed): DelegationLogPage module not found - route disabled pending file restoration
// import DelegationLogPage from "./pages/shared/logs/DelegationLogPage";
// TODO(fix-needed): LogsPage module not found - route disabled pending file restoration
// import LogsPage from "./pages/shared/logs/LogsPage";
import Sites from "./Admin/pages/Sites";
// TODO(fix-needed): TrainingLogPage module not found - route disabled pending file restoration
// import TrainingLogPage from "./pages/shared/logs/TrainingLogPage";
import {
  getDashboardPath,
  getCurrentUser,
  getEffectiveRole,
} from "./shared/services/roleService";
import { cleanupCrossStudySubjectData } from "./shared/services/studyService";
import EISFDashboard from "./shared/pages/EISF/EDashboard/EISFDashboard";
import {
  RoleAwareComments,
  RoleAwareNotifications,
  RoleAwareProgressNotes,
  RoleAwareRecruitment,
  RoleAwareRegulatory,
  RoleAwareReports,
  RoleAwareSettings,
  RoleAwareReferral,
  RoleAwareSitePerformance,
  RoleAwareStudies,
  RoleAwareSubjects,
  RoleAwareEnrollment,
  RoleAwareQueries,
} from "./shared/routes/roleAwarePages";

import SponsorScreening from "./Sponsor/pages/Screening";
import SponsorVisits from "./Sponsor/pages/Visits";
import SponsorFiles from "./Sponsor/pages/Files";
import PortfolioManagement from "./Sponsor/pages/PortfolioManagement";
import StudyOversight from "./Sponsor/pages/StudyOversight";
import CROOversight from "./Sponsor/pages/CROOversight";
import RiskManagement from "./Sponsor/pages/RiskManagement";
import SiteRanking from "./Sponsor/pages/SiteRanking";
import SiteQueries from "./Sponsor/pages/SiteQueries";
import SiteDocuments from "./Sponsor/pages/SiteDocuments";
import SponsorCRODetails from "./Sponsor/pages/CRODetails";
import SponsorCROReport from "./Sponsor/pages/CROReport";
import SponsorCROContracts from "./Sponsor/pages/CROContracts";
import SiteDetailsPage from "./shared/pages/sites/SiteWorkspace/SiteDetailsPage";
import ReportDetails from "./Sponsor/pages/ReportDetails";
import RecruitmentDetails from "./Sponsor/pages/RecruitmentDetails";
import RegulatoryDetails from "./Sponsor/pages/RegulatoryDetails";
import RiskDetails from "./Sponsor/pages/RiskDetails";
import QueryDetails from "./Sponsor/pages/QueryDetails";
import NotificationDetails from "./Sponsor/pages/NotificationDetails";
import ProgressNoteDetails from "./Sponsor/pages/ProgressNoteDetails";
import SponsorVisitDetails from "./Sponsor/pages/VisitDetails";
import SponsorMonitoring from "./Sponsor/pages/Monitoring";
import SponsorQueries from "./Sponsor/pages/Queries";

import PIComments from "./PI/pages/PIComments";
import PIEISFDashboard from "./PI/pages/PIEISFDashboard";
import PIICFDashboard from "./PI/pages/PIICFDashboard";
import PILiveChat from "./PI/pages/PILiveChat";
import PINotifications from "./PI/pages/PINotifications";
import PIPageLayout from "./PI/pages/PIPageLayout";
import PIRecruitment from "./PI/pages/PIRecruitment";
import PIReferral from "./PI/pages/PIReferral";
import PIRegulatory from "./PI/pages/PIRegulatory";
import PIReports from "./PI/pages/PIReports";
import PISettings from "./PI/pages/PISettings";
import PISitePerformance from "./PI/pages/PISitePerformance";
import PIStudyFolderDashboard from "./PI/pages/PIStudyFolderDashboard";
import PIStudySubjectsProfile from "./PI/pages/PIStudySubjectsProfile";
import PISubjectsDashboard from "./PI/pages/PISubjectsDashboard";

import CroMonitoring from "./CRO/pages/CROMonitoring";
import CroSubjectManagement from "./CRO/pages/CROSubjectManagement";
import SiteManagement from "./CRO/pages/SiteManagement";
import CROLayout from "./CRO/pages/CROLayout";

import CroScreening from "./CRO/pages/CROScreening";
import CroEnrollment from "./CRO/pages/CROEnrollment";
import CroVisits from "./CRO/pages/CROVisits";
import CroComments from "./CRO/pages/CROComments";
import CroFiles from "./CRO/pages/CROFiles";
import CroSitePerformance from "./CRO/pages/CROSitePerformance";
import CroReports from "./CRO/pages/CROReports";
import CroNotifications from "./CRO/pages/CRONotifications";
import CroSettings from "./CRO/pages/CROSettings";
import CROReferral from "./CRO/pages/CROReferral";
import CroRegulatoryDocuments from "./CRO/pages/CRORegulatoryDocuments";
import CROLiveChat from "./CRO/pages/CROLiveChat";
import SponsorLiveChat from "./Sponsor/pages/LiveChat";
import AdminLiveChat from "./Admin/pages/LiveChat";
import SiteStaffLiveChat from "./SiteStaff/pages/LiveChat";

// ===== START: Safety / AI Review / eTMF imports =====
import SafetyCenter from "./shared/pages/safety/SafetyCenter";
import MonitoringAccess from "./shared/pages/monitoring/MonitoringAccess";
import RiskInsights from "./shared/pages/aiReview/RiskInsights";
import EtmfCenter from "./shared/pages/etmf/EtmfCenter";
// ===== END: Safety / AI Review / eTMF imports =====

// ===== START: Reports / Financials & Milestones imports =====
import CustomReportBuilder from "./shared/pages/reports/CustomReportBuilder";
import FinanceDashboard, {
  MilestonesDashboard,
} from "./shared/pages/reports/FinanceDashboard";
// ===== END: Reports / Financials & Milestones imports =====

// ===== START: Dynamic Subscription & Plan Catalog imports =====
import MyLicense from "./shared/pages/MyLicense";
import SubscriptionManagement from "./Admin/pages/SubscriptionManagement";
// ===== END: Dynamic Subscription & Plan Catalog imports =====

const SPONSOR_ROLES = [ROLES.SPONSOR];
const SPONSOR_ADMIN_ROLES = [ROLES.SPONSOR, ROLES.ADMIN];
const PI_ROLES = [ROLES.PI];
const CRO_ROLES = [ROLES.CRO, ROLES.ADMIN];

function RoleAwareFallback() {
  const user = getCurrentUser();
  const destination = user?.role ? getDashboardPath(user.role) : "/login";

  return <Navigate to={destination} replace />;
}

function UnifiedSettingsRedirect({ section, children }: any) {
  const role = getEffectiveRole(getCurrentUser());

  if (role === ROLES.ADMIN || role === ROLES.SITE_STAFF) {
    return <Navigate to="/settings" state={{ section }} replace />;
  }

  return children;
}

function App() {
  // One-time data repair (A2 follow-up): move/quarantine any subjects left
  // behind under the wrong study's storage key by earlier builds. Safe to
  // run on every app load — it no-ops after the first successful pass.
  // Exposed on window for a manual re-run from the console if ever needed:
  //   window.__trianxtCleanupSubjects({ force: true })
  useEffect(() => {
    cleanupCrossStudySubjectData();

    if (typeof window !== "undefined") {
      window.__trianxtCleanupSubjects = cleanupCrossStudySubjectData;
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/completedvisit" element={<CompletedVisit />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <UnifiedSettingsRedirect section="profile">
              <ProfilePage />
            </UnifiedSettingsRedirect>
          </ProtectedRoute>
        }
      />

      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <UnifiedSettingsRedirect section="security">
              <SecurityPage />
            </UnifiedSettingsRedirect>
          </ProtectedRoute>
        }
      />

      <Route
        path="/studies"
        element={
          <ProtectedRoute>
            <RoleAwareStudies />
          </ProtectedRoute>
        }
      />

      <Route
        path="/study-dashboard/:id"
        element={
          <ProtectedRoute>
            <StudyDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/visit/:visitId"
        element={
          <ProtectedRoute>
            <VisitDetails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subjects"
        element={
          <ProtectedRoute>
            <RoleAwareSubjects />
          </ProtectedRoute>
        }
      />

      {/* ===== START: Gap-implementation routes (addendum M18 / M23 / M19 / M20 / M21 / M22) ===== */}
      <Route
        path="/amendments"
        element={
          <ProtectedRoute>
            <AmendmentManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/site-feasibility"
        element={
          <ProtectedRoute>
            <SiteFeasibility />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ip-accountability"
        element={
          <ProtectedRoute>
            <IpAccountability />
          </ProtectedRoute>
        }
      />

      <Route
        path="/irb-submissions"
        element={
          <ProtectedRoute>
            <IrbSubmissions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/icf-consent"
        element={
          <ProtectedRoute>
            <IcfManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vendor-management"
        element={
          <ProtectedRoute>
            <VendorManagement />
          </ProtectedRoute>
        }
      />
      {/* ===== END: Gap-implementation routes ===== */}

      {/* <Route
        path="/subject/:id"
        element={
          <ProtectedRoute>
            <SubjectProfilePage />
          </ProtectedRoute>
        }
      /> */}

      <Route
        path="/operations/comments"
        element={
          <ProtectedRoute>
            <OperationsComments />
          </ProtectedRoute>
        }
      />

      <Route
        path="/comments"
        element={
          <ProtectedRoute>
            <RoleAwareComments />
          </ProtectedRoute>
        }
      />

      <Route
        path="/progress-notes"
        element={
          <ProtectedRoute>
            <RoleAwareProgressNotes />
          </ProtectedRoute>
        }
      />

      <Route
        path="/file-details"
        element={
          <ProtectedRoute>
            <FileDetails />
          </ProtectedRoute>
        }
      />

      {/* TODO(fix-needed): LogsPage module not found - route disabled pending file restoration
      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <LogsPage />
          </ProtectedRoute>
        }
      />
      */}

      {/* TODO(fix-needed): TrainingLogPage module not found - route disabled pending file restoration
      <Route
        path="/logs/training"
        element={
          <ProtectedRoute>
            <TrainingLogPage />
          </ProtectedRoute>
        }
      />
      */}

      {/* TODO(fix-needed): DelegationLogPage module not found - route disabled pending file restoration
      <Route
        path="/logs/delegation"
        element={
          <ProtectedRoute>
            <DelegationLogPage />
          </ProtectedRoute>
        }
      />
      */}

      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute>
            <AuditLogsPage />
          </ProtectedRoute>
        }
      />

      {/* ---- Global Logs module removed by request. Training & Delegation
      logs now live inside each study at Studies → Study → Logs tab. Old
      /logs, /logs/training, /logs/delegation, /delegation, /training
      routes have been removed. ---- */}

      <Route
        path="/ereg-comments"
        element={
          <ProtectedRoute>
            <EISFHub />
          </ProtectedRoute>
        }
      />

      <Route
        path="/eisf"
        element={
          <ProtectedRoute>
            <EISFDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/icf" element={<Navigate to="/ereg-comments" replace />} />
      <Route
        path="/study-folder"
        element={<Navigate to="/studies" replace />}
      />

      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/site-staff-dashboard"
        element={
          <ProtectedRoute allowedRoles={[ROLES.SITE_STAFF, ROLES.PI]}>
            <SiteStaffDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pi-dashboard"
        element={
          <ProtectedRoute allowedRoles={[...PI_ROLES, ROLES.ADMIN]}>
            <PIPageLayout>
              <PIDashboard embeddedInLayout />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cro-dashboard"
        element={
          <ProtectedRoute allowedRoles={[...CRO_ROLES, ROLES.ADMIN]}>
            <CRODashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sponsor-dashboard"
        element={
          <ProtectedRoute allowedRoles={[...SPONSOR_ROLES, ROLES.ADMIN]}>
            <SponsorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/access-request"
        element={
          <ProtectedRoute>
            <AccessRequestForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/access-permission"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF]}>
            <AccessPermissions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/permission-approval"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF]}>
            <PermissionApproval />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cro-overview"
        element={
          <ProtectedRoute
            allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.CRO]}
>
            <CROOverview />
          </ProtectedRoute>
        }
      />

      <Route
        path="/user-management"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF]}>
            <UserManagement />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sites"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CRO]}>
            <Sites />
          </ProtectedRoute>
        }
      />

      <Route
        path="/queries"
        element={
          <ProtectedRoute>
            <RoleAwareQueries />
          </ProtectedRoute>
        }
      />

      <Route
        path="/site-performance"
        element={
          <ProtectedRoute>
            <RoleAwareSitePerformance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recruitment"
        element={
          <ProtectedRoute>
            <RoleAwareRecruitment />
          </ProtectedRoute>
        }
      />

      <Route
        path="/regulatory"
        element={
          <ProtectedRoute>
            <RoleAwareRegulatory />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <RoleAwareReports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/builder"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.PI, ROLES.CRO, ROLES.SPONSOR]}>
            <CustomReportBuilder />
          </ProtectedRoute>
        }
      />

      <Route
        path="/finance"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.CRO, ROLES.SPONSOR]}>
            <FinanceDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/milestones"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.CRO, ROLES.SPONSOR]}>
            <MilestonesDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <RoleAwareNotifications />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <RoleAwareSettings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/referral"
        element={
          <ProtectedRoute>
            <RoleAwareReferral />
          </ProtectedRoute>
        }
      />

      {/* ===== START: Dynamic Subscription & Plan Catalog routes ===== */}
      <Route
        path="/my-license"
        element={
          <ProtectedRoute>
            <MyLicense />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/subscription"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <SubscriptionManagement />
          </ProtectedRoute>
        }
      />
      {/* ===== END: Dynamic Subscription & Plan Catalog routes ===== */}

      {/* Sponsor-specific routes */}
      <Route
        path="/screening"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorScreening />
          </ProtectedRoute>
        }
      />
      <Route
        path="/enrollment"
        element={
          <ProtectedRoute allowedRoles={[...SPONSOR_ROLES, ...CRO_ROLES]}>
            <RoleAwareEnrollment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visits"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorVisits />
          </ProtectedRoute>
        }
      />
      <Route
        path="/files"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorFiles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portfolio"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <PortfolioManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/study-oversight"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <StudyOversight />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-oversight"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <CROOversight />
          </ProtectedRoute>
        }
      />
      <Route
        path="/risk-management"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <RiskManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/site-ranking"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SiteRanking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/site-queries/:siteId"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SiteQueries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/site-documents/:siteId"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SiteDocuments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorCRODetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-report"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorCROReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-contracts"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorCROContracts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/site-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ADMIN_ROLES}>
            <SiteDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <ReportDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruitment-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <RecruitmentDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/regulatory-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <RegulatoryDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/risk-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <RiskDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/query-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <QueryDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notification-details"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <NotificationDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/progress-note-details/:id"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <ProgressNoteDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visit-details/:id"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorVisitDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sponsor-monitoring"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorMonitoring />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sponsor-queries"
        element={
          <ProtectedRoute allowedRoles={SPONSOR_ROLES}>
            <SponsorQueries />
          </ProtectedRoute>
        }
      />

      {/* PI-specific routes */}
      <Route
        path="/pi-comments"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIComments />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-site-performance"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PISitePerformance />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-recruitment"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIRecruitment />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-regulatory"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIRegulatory />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-reports"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIReports />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-notifications"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PINotifications />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-settings"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PISettings />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-referral"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIReferral />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-subjects-dashboard"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PISubjectsDashboard />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-study-folder-dashboard"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIStudyFolderDashboard />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-study-subject-profile"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIStudySubjectsProfile />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-eisf-dashboard"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIEISFDashboard />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-icf-dashboard"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PIICFDashboard />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pi-livechat"
        element={
          <ProtectedRoute allowedRoles={PI_ROLES}>
            <PIPageLayout>
              <PILiveChat />
            </PIPageLayout>
          </ProtectedRoute>
        }
      />

      {/* CRO-specific routes */}
      <Route
        path="/cro-subject-management"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroSubjectManagement />
          </ProtectedRoute>
        }
      />
      {/* <Route path="/cro-subject/:id" element={<ProtectedRoute allowedRoles={CRO_ROLES}><CroSubjectDetail /></ProtectedRoute>} /> */}
      <Route
        path="/cro-monitoring"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroMonitoring />
          </ProtectedRoute>
        }
      />
      {/* Alias so the CRO menu entry "Monitoring" (/monitoring) resolves —
          the guard matrix already lists /monitoring for CRO. */}
      <Route
        path="/monitoring"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroMonitoring />
          </ProtectedRoute>
        }
      />
      {/* Alias so the CRO menu entry "Site Management" (/site-management) resolves. */}
      <Route
        path="/site-management"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CROLayout>
              <SiteManagement />
            </CROLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-regulatory-documents"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroRegulatoryDocuments />
          </ProtectedRoute>
        }
      />
      {/* <Route path="/cro-subjects" element={<ProtectedRoute allowedRoles={CRO_ROLES}><CroSubjects /></ProtectedRoute>} /> */}
      <Route
        path="/cro-screening"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroScreening />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-enrollment"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroEnrollment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-visits"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroVisits />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-comments"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroComments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-files"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroFiles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-site-performance"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroSitePerformance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-reports"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-notifications"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroNotifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-settings"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CroSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cro-referral"
        element={
          <ProtectedRoute allowedRoles={CRO_ROLES}>
            <CROReferral />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin-livechat"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLiveChat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/site-staff-livechat"
        element={
          <ProtectedRoute allowedRoles={[ROLES.SITE_STAFF, ROLES.PI]}>
            <SiteStaffLiveChat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/live-chat"
        element={
          <ProtectedRoute allowedRoles={[ROLES.SPONSOR, ROLES.ADMIN]}>
            <SponsorLiveChat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cro-livechat"
        element={
          <ProtectedRoute allowedRoles={[...CRO_ROLES, ROLES.ADMIN]}>
            <CROLiveChat />
          </ProtectedRoute>
        }
      />

      {/* ===== START: Safety / AI Review / eTMF routes ===== */}
      <Route
        path="/safety"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR]}>
            <SafetyCenter />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ai-review"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR]}>
            <RiskInsights />
          </ProtectedRoute>
        }
      />

      <Route
        path="/etmf"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.CRO, ROLES.SPONSOR]}>
            <EtmfCenter />
          </ProtectedRoute>
        }
      />
      {/* ===== END: Safety / AI Review / eTMF routes ===== */}

      {/* ===== START: Monitoring Access route ===== */}
      <Route
        path="/monitoring-access"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SITE_STAFF, ROLES.CRO, ROLES.SPONSOR]}>
            <MonitoringAccess />
          </ProtectedRoute>
        }
      />
      {/* ===== END: Monitoring Access route ===== */}

      <Route path="*" element={<RoleAwareFallback />} />
    </Routes>
  );
}

export default App;