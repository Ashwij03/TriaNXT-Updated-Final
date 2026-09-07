import React, { useEffect, useMemo, useState } from "react";
import {
  getSubjectConsentStatus,
  type SubjectConsentStatus,
} from "./subjectConsentStatus";
import { subscribeConsentIcf } from "../../services/icfConsentService";

/**
 * Subject Explorer - CONSENT STATUS BADGE
 * =======================================
 *
 * Presentational pill driven entirely by `subjectConsentStatus` (which in
 * turn reads only `icfConsentService` state) - there is deliberately no
 * consent state machine here. Pass a resolved status via `status`, or use
 * `useSubjectConsentStatus(studyId, subjectId, siteCode)` to resolve and
 * keep it live against consent-store updates.
 */

const ICON_BY_TONE = {
  ok: "✓",
  warn: "!",
  danger: "!",
  muted: "•",
};

function ConsentStatusBadge({ status, compact = false, className = "" }: any) {
  if (!status || !status.key) return null;

  const label =
    typeof status.label === "string" ? status.label : status.key;
  const detail =
    typeof status.detail === "string" && !compact ? status.detail : "";

  return (
    <span
      className={`sxp-consent-badge sxp-consent-badge--${status.tone}${compact ? " sxp-consent-badge--compact" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      title={detail || label}
    >
      <span className="sxp-consent-badge-dot" aria-hidden="true">
        {ICON_BY_TONE[status.tone] || "•"}
      </span>
      <span className="sxp-consent-badge-label">{label}</span>
      {detail && <span className="sxp-consent-badge-detail">{detail}</span>}
    </span>
  );
}

/**
 * Live consent state for a subject. Re-resolves whenever the subject or
 * study changes and re-renders on every `consent-icf-updated` / storage
 * event, so the badge can never go stale relative to the consent store.
 */
export function useSubjectConsentStatus(studyId, subjectId, siteCode?) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return subscribeConsentIcf(() => setVersion((value) => value + 1));
  }, []);

  const status = useMemo(
    () =>
      studyId && subjectId
        ? getSubjectConsentStatus(studyId, subjectId, siteCode)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [studyId, subjectId, siteCode, version],
  );

  return status as SubjectConsentStatus | null;
}

export default ConsentStatusBadge;
