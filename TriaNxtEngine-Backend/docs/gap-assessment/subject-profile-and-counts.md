# Gap report — Subject Profile, Visit Worklist & Studies counts

Owner: Noel (per `TriaNXT_CTMS_Team_Implementation_Plan-v4.docx`, §3.5)
Last updated: September 2026

## Scope of this pass

Deliverables covered: Bulk Folder Upload for Subjects (frontend), ICF Folder
Missing Bug Fix (frontend reconciliation), Studies Page Subject Actual Count
Fix (backend + frontend), Subject Profile & Visit Worklist (frontend +
backend history/consent reads).

## Decisions recorded here (per the agreed backend-source direction)

### 1. `subject_status_history` — newly added as `CtmsSubjectStatusHistory`

The CTMS ER diagram names a `subject_status_history` table (status_id,
subject_id FK, status, reason, changed_at, changed_by FK) as the source of
truth for the Profile timeline. **No such table existed in this codebase's
backend** — `tria_engine/apps/ctms/models.py` only carries the JSON-mirror
gap-module tables. Per the agreed decision:

- A new **`CtmsSubjectStatusHistory`** model (`ctms_subject_status_history`)
  is added — the ONLY new model in this work.
- It deliberately does **NOT** add a `status_history` JSON array to
  `CtmsSubject` (subject rows stay byte-faithful mirrors of the frontend).
- Like every other ctms table it stores the ER fields in `data`
  (`subjectId`, `status`, `reason`, `changedBy`, `changedAt`) on a thin
  relational row (org/study scope columns + unique `code`).
- Rows are **append-only**: each row's code is `study::subjectId::h<epoch>`,
  so the generic bulk-sync upsert can never overwrite a prior transition.
- Writes: frontend `subjectService.updateSubject` pushes a row to
  `POST /api/site/subjects/history/sync` whenever the subject's status
  changes (API mode only, fail-soft).
- Reads: `GET /api/site/subjects/{study::subjectId}/history` returns the
  merged chronological feed — status transitions + completed visits
  (`ctms_visit`) + consent events (`ctms_consentevent`) — consumed by the
  StudySubjectsWorkspace Profile tab in API mode, with local derivation as
  the offline fallback.

### 2. Consent — derived from consent events, NOT a documents join (deferred)

The instruction proposed deriving consent from `documents` where
`document_type = 'ICF'` joined with `document_approvals.status`. That
schema does not exist in this repo and creating it is **explicitly out of
scope** (eISF documents & 21 CFR Part 11 signatures = Venkat's task; any
new `documents` / `document_approvals` table or endpoint is deferred and
forbidden here).

Instead:

- Consent state is derived from the **real consent store already mirrored
  to `ctms_consentevent` + `ctms_icfversion`** (+ open re-consent
  campaigns), on both sides:
  - Frontend badge (`subjectConsentStatus.ts` → `icfConsentService.ts`) —
    unchanged sources, no second computation.
  - Server `GET /api/site/subjects/{study::subjectId}/consent` — same
    semantics for API consumers.
- When the eISF `documents`/`document_approvals` work lands (Venkat),
  icfConsentService should be pointed at that join as the authority; until
  then the consent-event derivation is the single source.

### 3. `visit_activities` — deliberately deferred

The visit checklist currently reads `subject_<subjectId>_visits` (mirrored
to `ctms_visit`) with the shared `VISIT_STAGES` vocabulary; the per-item
checklist state (`visit_activities.status` / `completed_at`) is the correct
long-term home for that state but the table does not exist and **creating
any new `visit_activities` table is deferred to a later pass** (per the gap
decision). No new model was added for it. When it lands, `VISIT_STAGES`
should be mapped onto its `activity_name` values rather than staying a
frontend-only list.

### 4. Studies count — enrollment counts endpoint + cache invalidation

- `GET /api/site/subjects/enrollment-counts` serves per-study DISTINCT
  subject counts where canonical status ∈ {Screened, Enrolled} — the
  JSON-mirror equivalent of `COUNT(DISTINCT subjects.id) … GROUP BY
  study_id/site_id` (subjects are mirrored JSON rows here, not a
  relational `subjects` table).
- Results are cached for 15 s through `core/cache.py` (Redis when
  `REDIS_URL` is set — **invalidated on every `POST /subjects/sync`**,
  i.e. subject registration — in-process fallback otherwise).
- Frontend: `dashboardService`/`StudyDashboard` no longer read the stale
  static `study.enrolled` record field (which subject registration never
  bumps); they derive live canonical counts from the subject store.

### 5. Path-name mapping note (for reviewers of the agreed file list)

The agreed list referenced `models/subject.py` / `routers/studies.py` /
`services/subject_service.py`; this repository consolidates those under
`tria_engine/apps/ctms/models.py`, `router_subjects.py`, `router_sync.py`
and the frontend `subjectService.ts`. Work touched the real equivalents;
no duplicate parallel tree was created.

## Explicitly deferred / out of scope (reminder)

- `documents` / `document_approvals` models & endpoints — Venkat (eISF &
  21 CFR Part 11).
- `visit_activities` table — deferred.
- Document-upload events in the server-side history feed — deferred with
  the documents work (the Profile timeline still shows them from the local
  file store).
- Auth / chat / reports / compliance surfaces — other owners.
