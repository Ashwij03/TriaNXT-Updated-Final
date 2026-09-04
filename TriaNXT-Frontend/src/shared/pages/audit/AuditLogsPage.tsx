// SHARED AUDIT LOGS UI FOUNDATION (Batch A)
//
// One shared implementation for the Audit Logs page. Admin and SiteStaff
// (and, eventually, other roles) all read through this same component —
// there is no separate AdminAuditLogsPage / SiteStaffAuditLogsPage.
//
// Data pipeline (matches the required architecture):
//   canonical audit data -> authorization -> search -> filters -> sort
//   -> pagination
//
// Authorization happens in auditService.getVisibleAuditEvents() BEFORE
// this component ever sees the rows, so unauthorized rows are never
// loaded into the table in the first place — search/filter/pagination
// below operate only on already-authorized data.
//
// Batch B finalizes Admin/SiteStaff sidebar entries and any additional
// routing/permission wiring around this page. This file is the reusable
// foundation that Batch B will link to.

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../components/dashboard/shared/DashboardLayout";
import DataTable from "../../components/dashboard/shared/DataTable";
import KPICard from "../../components/dashboard/shared/KPICard";
import {
  AUDIT_UPDATED_EVENT,
  formatActorLabel,
  formatAuditTimestamp,
  getVisibleAuditEvents
} from "../../services/auditService";
import {
  getAssignedSite,
  getCurrentUser,
  isAdmin
} from "../../services/roleService";
import { getStudies } from "../../services/studyService";
import { resolveSiteDisplay } from "../../utils/siteDisplay";
import "../../styles/AdminPage.css";
import "./AuditLogsPage.css";

function buildDisplayRow(event, siteSources) {
  const studyLabel = event.studyId || event.studyCode || "—";
  const siteLabel = event.siteNumber || event.siteName || event.site
    ? resolveSiteDisplay(event.siteNumber || event.siteName || event.site, {
        sources: siteSources,
        fallback: event.site || "—"
      })
    : "—";

  return {
    id: event.id,
    dateTime: formatAuditTimestamp(event.timestamp),
    dateTimeSort: event.timestamp || "",
    user: formatActorLabel(event),
    role: event.actorRole || "—",
    action: event.actionLabel || event.action || event.actionType || "—",
    actionType: event.actionType || "—",
    module: event.module || "—",
    entity: event.entityId || event.subjectId || event.documentId || "—",
    studyId: studyLabel,
    site: siteLabel,
    details: event.description || "—"
  };
}

function AuditLogsPage() {
  const user = getCurrentUser();
  const assignedSite = getAssignedSite(user);
  const admin = isAdmin(user);

  const loadEvents = useCallback(() => getVisibleAuditEvents({ user }), [user]);

  const [events, setEvents] = useState(loadEvents);

  useEffect(() => {
    setEvents(loadEvents());
  }, [loadEvents]);

  useEffect(() => {
    // Event-driven sync only — no polling, no forced page reload. Any
    // successful business mutation anywhere in the app that calls
    // recordAuditEvent()/addAuditLog() dispatches this event, and this
    // page refreshes its canonical data in response.
    const refresh = () => setEvents(loadEvents());

    window.addEventListener(AUDIT_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(AUDIT_UPDATED_EVENT, refresh);
  }, [loadEvents]);

  const siteSources = useMemo(() => {
    try {
      return getStudies();
    } catch {
      return [];
    }
  }, []);

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      ),
    [events]
  );

  const tableData = useMemo(
    () => sortedEvents.map((event) => buildDisplayRow(event, siteSources)),
    [sortedEvents, siteSources]
  );

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return sortedEvents.filter(
      (event) => event.timestamp && new Date(event.timestamp).toDateString() === today
    ).length;
  }, [sortedEvents]);

  return (
    <DashboardLayout>
      <div className="admin-page audit-logs-page tnxt-compact">
        <div className="admin-page-title page-section-highlight">
          <h1>Audit Logs</h1>
          <p>
            {admin
              ? "Application-wide business activity trail"
              : `Site activity trail${assignedSite ? ` — ${assignedSite}` : ""}`}
          </p>
        </div>

        <div className="admin-kpi-grid">
          <KPICard
            title="Total Records"
            value={sortedEvents.length}
            subtitle="Authorized Audit Events"
            icon="🗂️"
          />
          <KPICard
            title="Today"
            value={todayCount}
            subtitle="Events Recorded Today"
            icon="🕒"
          />
        </div>

        <div className="admin-table-section">
          <DataTable
            className="ctms-standard-table"
            title="Audit Trail"
            columns={[
              { key: "dateTime", label: "Date & Time", width: "170px" },
              { key: "user", label: "User" },
              { key: "role", label: "Role", width: "110px" },
              { key: "action", label: "Action" },
              { key: "module", label: "Module" },
              { key: "entity", label: "Entity / Record" },
              { key: "studyId", label: "Study ID" },
              { key: "site", label: "Site" },
              {
                key: "details",
                label: "Details",
                render: (value) => (
                  <span className="audit-details-cell" title={value}>
                    {value}
                  </span>
                )
              }
            ]}
            data={tableData}
            searchable
            searchPlaceholder="Search audit logs..."
            searchFields={[
              "user",
              "role",
              "action",
              "actionType",
              "module",
              "entity",
              "studyId",
              "site",
              "details"
            ]}
            filters={[
              { key: "role", label: "Role" },
              { key: "actionType", label: "Action" },
              { key: "module", label: "Module" },
              { key: "studyId", label: "Study" },
              { key: "site", label: "Site" }
            ]}
            pagination
            initialPageSize={10}
            emptyMessage="No audit activity found."
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AuditLogsPage;