// NEW FILE — Dynamic Subscription & Plan Catalog System.
// Shared usage-stat tiles used by BOTH MyLicense.js (every role, read-only)
// and Admin SubscriptionManagement.js (Admin) so the KPI row markup isn't
// duplicated across the two pages.
//
// Renders three KPICards (Studies / Users / Storage) from the live
// getSubscriptionUsage() snapshot and self-refreshes on the same events the
// rest of the app dispatches, so numbers stay current without a reload.
// Storage now shows a real "used / limit" figure too (storageUsedGb is a
// live byte-sum of every subject file across every study — see
// subscriptionService.getSubscriptionUsage) and colors the same way
// Studies/Users do: "amber" at 70-90% and "red" at >= 90%.

import { useEffect, useState } from "react";
import { FiFolder, FiUsers, FiDatabase } from "react-icons/fi";
import KPICard from "../dashboard/shared/KPICard";
import {
  getSubscriptionUsage,
  SUBSCRIPTION_UPDATED_EVENT,
} from "../../services/subscriptionService";
import { PLAN_CATALOG_UPDATED_EVENT } from "../../services/planCatalogService";
import { SUBJECT_FILES_EVENT } from "../SubjectExplorer/fileService";
import "../../styles/SubscriptionManagement.css";

/** GB value -> "0.42" / "3.1" / "128" — trims to a sensible precision. */
function formatGb(value) {
  const num = Number(value) || 0;
  if (num === 0) return "0";
  if (num < 10) return num.toFixed(2).replace(/\.?0+$/, "");
  if (num < 100) return num.toFixed(1).replace(/\.0$/, "");
  return Math.round(num).toString();
}

/** red when at/over 90%, amber at 70-90%, blue otherwise. */
function kpiVariant(percent) {
  if (percent >= 90) {
    return "red";
  }
  if (percent >= 70) {
    return "amber";
  }
  return "blue";
}

function SubscriptionUsagePanel() {
  const [usage, setUsage] = useState(() => getSubscriptionUsage());

  useEffect(() => {
    const refresh = () => setUsage(getSubscriptionUsage());

    // Usage depends on studies + active users + subscription/plan state, so
    // listen to every event those sources already dispatch.
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, refresh);
    window.addEventListener(PLAN_CATALOG_UPDATED_EVENT, refresh);
    window.addEventListener("studies-updated", refresh);
    window.addEventListener("admin-data-updated", refresh);
    window.addEventListener("sponsor-data-updated", refresh);
    // Storage is a live byte-sum of subject files, so every upload/delete
    // (any study — fileService fires this same event name for all of them)
    // needs to refresh the tile too.
    window.addEventListener(SUBJECT_FILES_EVENT, refresh);

    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, refresh);
      window.removeEventListener(PLAN_CATALOG_UPDATED_EVENT, refresh);
      window.removeEventListener("studies-updated", refresh);
      window.removeEventListener("admin-data-updated", refresh);
      window.removeEventListener("sponsor-data-updated", refresh);
      window.removeEventListener(SUBJECT_FILES_EVENT, refresh);
    };
  }, []);

  return (
    <div className="subscription-usage-kpi-row">
      <KPICard
        title="Studies"
        value={`${usage.studiesUsed}/${usage.studiesLimit}`}
        subtitle="Studies used"
        icon={<FiFolder size={22} />}
        variant={kpiVariant(usage.studiesPercent)}
        layout="row"
      />

      <KPICard
        title="Users"
        value={`${usage.usersUsed}/${usage.usersLimit}`}
        subtitle="Active users"
        icon={<FiUsers size={22} />}
        variant={kpiVariant(usage.usersPercent)}
        layout="row"
      />

      <KPICard
        title="Storage"
        value={`${formatGb(usage.storageUsedGb)}/${formatGb(usage.storageLimitGb)} GB`}
        subtitle="Storage used"
        icon={<FiDatabase size={22} />}
        variant={kpiVariant(usage.storagePercent)}
        layout="row"
      />
    </div>
  );
}

export default SubscriptionUsagePanel;