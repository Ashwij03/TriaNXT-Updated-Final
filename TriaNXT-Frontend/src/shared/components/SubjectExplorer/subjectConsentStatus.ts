/**
 * Subject Explorer - SUBJECT CONSENT STATUS (pure derivation)
 * ===========================================================
 *
 * Single derivation of a subject's consent indicator. The ONLY data source
 * is `icfConsentService` (ICF versions, consent events, re-consent
 * campaigns) - this module never stores or guesses a second consent flag,
 * so the badge always matches the consent module's own state for the
 * subject.
 *
 * States returned:
 *   signed      - a consent event exists on the currently ACTIVE ICF version
 *                 for the subject's site.
 *   re-consent  - the subject signed an older ICF version and a newer one is
 *                 now active (or an open re-consent campaign targets them).
 *   pending     - an ACTIVE ICF version exists but no consent event is on
 *                 record for this subject.
 *   not-started - no ACTIVE ICF version exists for the study/site yet.
 *
 * `getSubjectConsentStatus` is pure (reads the consent store through the
 * service) so it can be unit-tested by seeding `trianxtConsentIcf`.
 */

import {
  getConsentEvents,
  getIcfVersions,
  isSubjectProceduresBlocked,
} from "../../services/icfConsentService";

export const CONSENT_STATE_KEYS = {
  SIGNED: "signed",
  RE_CONSENT: "re-consent",
  PENDING: "pending",
  NOT_STARTED: "not-started",
} as const;

export type ConsentStateKey = (typeof CONSENT_STATE_KEYS)[keyof typeof CONSENT_STATE_KEYS];

export interface SubjectConsentStatus {
  /** Machine key (signed / re-consent / pending / not-started). */
  key: ConsentStateKey;
  /** Short badge label, e.g. "Signed". */
  label: string;
  /** Badge tone: maps to a `.sxp-consent-badge--*` modifier. */
  tone: "ok" | "warn" | "danger" | "muted";
  /** One-line human detail (version, date, or what is missing). */
  detail: string;
  /** ISO timestamp of the most recent consent event, if any. */
  lastEventAt: string | null;
}

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isDateLike(value) {
  return Boolean(value) && String(value) !== "—" && String(value) !== "-";
}

/**
 * Resolve the subject's current consent state.
 *
 * @param studyId   study code (the key used by the consent store).
 * @param subjectId subject id as stored on consent events.
 * @param siteCode  subject's site code, when known - used to pick the
 *                  correct ACTIVE version in multi-site studies.
 */
export function getSubjectConsentStatus(
  studyId: string,
  subjectId: string,
  siteCode?: string,
): SubjectConsentStatus {
  const studyKey = normalizeValue(studyId);
  if (!studyKey || !subjectId) {
    return {
      key: CONSENT_STATE_KEYS.NOT_STARTED,
      label: "Not started",
      tone: "muted",
      detail: "No study or subject context.",
      lastEventAt: null,
    };
  }

  const versions = Array.isArray(getIcfVersions(studyId)) ? getIcfVersions(studyId) : [];
  const studyVersions = versions.filter(
    (v) => normalizeValue(v.studyCode) === studyKey && String(v.status).toLowerCase() === "active",
  );

  const events = Array.isArray(getConsentEvents(studyId, subjectId))
    ? getConsentEvents(studyId, subjectId)
    : [];

  const latestEvent = events[0] || null;
  const reConsentOpen = isSubjectProceduresBlocked(subjectId, studyId);

  /* Open re-consent campaign targeting this subject wins over everything -
     it means a newer consent is legally required right now. */
  if (reConsentOpen) {
    return {
      key: CONSENT_STATE_KEYS.RE_CONSENT,
      label: "Re-consent",
      tone: "danger",
      detail: "Consent refresh required on the active ICF version.",
      lastEventAt: latestEvent?.createdAt || latestEvent?.date || null,
    };
  }

  /* Pick the subject's ACTIVE version: exact site match first, then the
     version the latest event was signed against (when it is still active),
     then the single active version of the study. */
  const siteKey = normalizeValue(siteCode);
  const activeVersion =
    studyVersions.find((v) => siteKey && normalizeValue(v.siteCode) === siteKey) ||
    (latestEvent
      ? studyVersions.find(
          (v) => String(v.id) === String(latestEvent.icfVersionId),
        )
      : null) ||
    (studyVersions.length === 1 ? studyVersions[0] : null);

  if (!activeVersion) {
    if (events.length > 0) {
      return {
        key: CONSENT_STATE_KEYS.RE_CONSENT,
        label: "Re-consent",
        tone: "danger",
        detail: `Signed on an inactive ICF version (v${latestEvent?.icfVersion || "?"}).`,
        lastEventAt: latestEvent?.createdAt || latestEvent?.date || null,
      };
    }
    return {
      key: CONSENT_STATE_KEYS.NOT_STARTED,
      label: "Not started",
      tone: "muted",
      detail: "No active ICF version for this site yet.",
      lastEventAt: null,
    };
  }

  const signedOnActive = events.some(
    (e) => String(e.icfVersionId) === String(activeVersion.id),
  );

  if (signedOnActive) {
    const signedEvent = events.find(
      (e) => String(e.icfVersionId) === String(activeVersion.id),
    );
    const detailDate = isDateLike(signedEvent?.date) ? signedEvent.date : "";
    return {
      key: CONSENT_STATE_KEYS.SIGNED,
      label: "Signed",
      tone: "ok",
      detail: `Consent on ICF v${activeVersion.version}${detailDate ? ` · ${detailDate}` : ""}`,
      lastEventAt: signedEvent?.createdAt || signedEvent?.date || null,
    };
  }

  if (events.length > 0) {
    return {
      key: CONSENT_STATE_KEYS.RE_CONSENT,
      label: "Re-consent",
      tone: "danger",
      detail: `Active ICF v${activeVersion.version} requires fresh consent.`,
      lastEventAt: latestEvent?.createdAt || latestEvent?.date || null,
    };
  }

  return {
    key: CONSENT_STATE_KEYS.PENDING,
    label: "Pending",
    tone: "warn",
    detail: `Awaiting consent on active ICF v${activeVersion.version}.`,
    lastEventAt: null,
  };
}
