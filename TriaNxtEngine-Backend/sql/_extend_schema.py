#!/usr/bin/env python
"""Extend TriaNxtEngine-Backend/sql/CTMSScripts.sql so every TriaNXT screen
module has backing schema. Every replacement must match exactly once."""
import io
import sys

PATH = "TriaNxtEngine-Backend/sql/CTMSScripts.sql"

# New enums appended to section 1 (after signature_type).
NEW_ENUMS = """CREATE TYPE access_request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'DENIED',
    'CANCELLED'
);

CREATE TYPE amendment_status AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'APPROVED',
    'PUBLISHED',
    'SUPERSEDED'
);

CREATE TYPE irb_submission_type AS ENUM (
    'INITIAL',
    'AMENDMENT',
    'RENEWAL',
    'SAFETY_REPORT',
    'CLOSEOUT',
    'OTHER'
);

CREATE TYPE irb_submission_status AS ENUM (
    'PREPARING',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CONDITIONAL_APPROVAL',
    'APPROVED',
    'DISAPPROVED',
    'CLOSED'
);

CREATE TYPE icf_status AS ENUM (
    'DRAFT',
    'REVIEW',
    'APPROVED',
    'ACTIVE',
    'SUPERSEDED',
    'ARCHIVED'
);

CREATE TYPE consent_status AS ENUM (
    'CONSENTED',
    'DECLINED',
    'WITHDRAWN',
    'EXPIRED'
);

CREATE TYPE campaign_status AS ENUM (
    'PLANNED',
    'ACTIVE',
    'COMPLETED',
    'CLOSED'
);

CREATE TYPE ip_lot_status AS ENUM (
    'SHIPPED',
    'RECEIVED',
    'QUARANTINE',
    'AVAILABLE',
    'DISPENSED',
    'DESTROYED',
    'EXPIRED'
);

CREATE TYPE shipment_status AS ENUM (
    'IN_TRANSIT',
    'RECEIVED',
    'DELAYED',
    'LOST'
);

CREATE TYPE excursion_disposition AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'DESTROYED',
    'REVIEWED'
);

CREATE TYPE vendor_status AS ENUM (
    'ONBOARDING',
    'ACTIVE',
    'SUSPENDED',
    'TERMINATED',
    'INACTIVE'
);

CREATE TYPE feasibility_status AS ENUM (
    'IDENTIFIED',
    'CONTACTED',
    'SURVEY_SENT',
    'RESPONDED',
    'SCORED',
    'SELECTED',
    'REJECTED',
    'ON_HOLD'
);

CREATE TYPE ae_status AS ENUM (
    'OPEN',
    'UNDER_REVIEW',
    'RECONCILED',
    'CLOSED'
);

CREATE TYPE subscription_status AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAST_DUE',
    'CANCELLED',
    'EXPIRED'
);

CREATE TYPE signature_request_status AS ENUM (
    'DRAFT',
    'SENT',
    'VIEWED',
    'SIGNED',
    'DECLINED',
    'EXPIRED',
    'CANCELLED'
);

CREATE TYPE signer_status AS ENUM (
    'PENDING',
    'SIGNED',
    'DECLINED'
);"""

# New table sections 38-51 (inserted before the original INDEXES section).
NEW_TABLES = """-- ============================================================
-- 38. ACCESS REQUESTS
-- AccessRequestForm / PermissionApproval screens
-- ============================================================

CREATE TABLE access_requests (
    access_request_id   BIGSERIAL PRIMARY KEY,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    org_id              BIGINT
                        REFERENCES organizations(org_id)
                        ON DELETE CASCADE,

    requested_role_id   BIGINT
                        REFERENCES roles(role_id)
                        ON DELETE SET NULL,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    reason              TEXT,

    status              access_request_status NOT NULL DEFAULT 'PENDING',

    requested_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    decided_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    decided_at          TIMESTAMP,

    decision_note       TEXT
);

-- ============================================================
-- 39. PROTOCOL AMENDMENTS
-- AmendmentManagement screen (M18)
-- ============================================================

CREATE TABLE amendments (
    amendment_id        BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    amendment_no        VARCHAR(50) NOT NULL,
    version             VARCHAR(50),

    classification      VARCHAR(50),

    title               VARCHAR(500) NOT NULL,
    summary             TEXT,

    effective_date      DATE,

    status              amendment_status NOT NULL DEFAULT 'DRAFT',

    re_consent_required BOOLEAN NOT NULL DEFAULT FALSE,
    binder_update_required BOOLEAN NOT NULL DEFAULT FALSE,
    training_required   BOOLEAN NOT NULL DEFAULT FALSE,

    irb_submission_ref  VARCHAR(100),

    impacted_site_codes JSONB,
    sites               JSONB,
    history             JSONB,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(study_id, amendment_no)
);

-- ============================================================
-- 40. IRB / IEC SUBMISSIONS
-- IrbSubmissions screen (M20)
-- ============================================================

CREATE TABLE irb_submissions (
    submission_id       BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    submission_no       VARCHAR(50) NOT NULL,

    type                irb_submission_type NOT NULL,

    title               VARCHAR(500),
    committee           VARCHAR(255),
    linked_ref          VARCHAR(100),

    status              irb_submission_status NOT NULL DEFAULT 'PREPARING',

    submitted_at        TIMESTAMP,
    approved_at         TIMESTAMP,
    next_due_date       DATE,
    review_cycle_months INT,

    conditions          JSONB,
    correspondence      JSONB,
    outcome_note        TEXT,
    history             JSONB,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(study_id, site_id, submission_no)
);

-- ============================================================
-- 41. ICF / ECONSENT
-- IcfManagement / ReConsent screens (M21)
-- ============================================================

CREATE TABLE icf_versions (
    icf_version_id      BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    version_no          VARCHAR(50) NOT NULL,
    language            VARCHAR(50) NOT NULL DEFAULT 'English',

    title               VARCHAR(500),

    amendment_id        BIGINT
                        REFERENCES amendments(amendment_id)
                        ON DELETE SET NULL,

    witness_required    BOOLEAN NOT NULL DEFAULT FALSE,

    document_id         BIGINT
                        REFERENCES documents(document_id)
                        ON DELETE SET NULL,

    status              icf_status NOT NULL DEFAULT 'DRAFT',

    approved_by         BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    approved_at         TIMESTAMP,
    activated_at        TIMESTAMP,

    history             JSONB,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(study_id, site_id, version_no)
);

CREATE TABLE consent_events (
    consent_event_id    BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    subject_id          BIGINT NOT NULL
                        REFERENCES subjects(subject_id)
                        ON DELETE CASCADE,

    icf_version_id      BIGINT NOT NULL
                        REFERENCES icf_versions(icf_version_id)
                        ON DELETE RESTRICT,

    consent_date        DATE NOT NULL,

    method              VARCHAR(50),
    witness_name        VARCHAR(255),

    status              consent_status NOT NULL DEFAULT 'CONSENTED',

    consent_form_document_id BIGINT
                        REFERENCES documents(document_id)
                        ON DELETE SET NULL,

    captured_by         BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reconsent_campaigns (
    campaign_id         BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    icf_version_id      BIGINT
                        REFERENCES icf_versions(icf_version_id)
                        ON DELETE SET NULL,

    reason              TEXT,

    status              campaign_status NOT NULL DEFAULT 'PLANNED',

    target_subjects     JSONB,

    due_date            DATE,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 42. IP / SUPPLY ACCOUNTABILITY
-- IpAccountability screen (M19)
-- ============================================================

CREATE TABLE ip_lots (
    lot_id              BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    lot_number          VARCHAR(100) NOT NULL,
    kit_number          VARCHAR(100),

    quantity_received   INT NOT NULL DEFAULT 0,
    quantity_on_hand    INT NOT NULL DEFAULT 0,

    status              ip_lot_status NOT NULL DEFAULT 'SHIPPED',
    condition           VARCHAR(50),

    received_at         TIMESTAMP,
    received_by         BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    reconciliation_status VARCHAR(50) NOT NULL DEFAULT 'UNDER_INVESTIGATION',

    transactions        JSONB,
    history             JSONB,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    UNIQUE(study_id, site_id, lot_number)
);

CREATE TABLE ip_shipments (
    shipment_id         BIGSERIAL PRIMARY KEY,

    lot_id              BIGINT NOT NULL
                        REFERENCES ip_lots(lot_id)
                        ON DELETE CASCADE,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    from_site_id        BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE SET NULL,

    to_site_id          BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE SET NULL,

    tracking_no         VARCHAR(100),

    quantity            INT NOT NULL DEFAULT 0,

    status              shipment_status NOT NULL DEFAULT 'IN_TRANSIT',

    shipped_at          TIMESTAMP,
    received_at         TIMESTAMP,

    notes               TEXT
);

CREATE TABLE ip_excursions (
    excursion_id        BIGSERIAL PRIMARY KEY,

    lot_id              BIGINT NOT NULL
                        REFERENCES ip_lots(lot_id)
                        ON DELETE CASCADE,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE SET NULL,

    excursion_type      VARCHAR(50),

    min_temp            NUMERIC(6,2),
    max_temp            NUMERIC(6,2),
    duration_minutes    INT,

    detected_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    disposition         excursion_disposition NOT NULL DEFAULT 'PENDING',
    disposition_reason  TEXT,

    disposition_by      BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    notes               TEXT
);

-- ============================================================
-- 43. VENDOR & LAB MANAGEMENT
-- VendorManagement / CROContracts screens (M22)
-- ============================================================

CREATE TABLE vendors (
    vendor_id           BIGSERIAL PRIMARY KEY,

    org_id              BIGINT NOT NULL
                        REFERENCES organizations(org_id)
                        ON DELETE RESTRICT,

    name                VARCHAR(255) NOT NULL,
    vendor_type         VARCHAR(100),

    scope               VARCHAR(500),

    contract_ref        VARCHAR(100),
    contract_expiry_date DATE,

    contact_name        VARCHAR(255),
    contact_email       VARCHAR(255),
    contact_phone       VARCHAR(50),

    status              vendor_status NOT NULL DEFAULT 'ONBOARDING',

    notes               TEXT,
    history             JSONB,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendor_contracts (
    contract_id         BIGSERIAL PRIMARY KEY,

    vendor_id           BIGINT NOT NULL
                        REFERENCES vendors(vendor_id)
                        ON DELETE CASCADE,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    contract_no         VARCHAR(100) NOT NULL,
    title               VARCHAR(500),

    amount              NUMERIC(18,2),
    currency            VARCHAR(10) NOT NULL DEFAULT 'USD',

    start_date          DATE,
    end_date            DATE,

    status              VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',

    document_id         BIGINT
                        REFERENCES documents(document_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(vendor_id, contract_no)
);

-- ============================================================
-- 44. SITE FEASIBILITY & SELECTION
-- SiteFeasibility screen (M23)
-- ============================================================

CREATE TABLE feasibility_candidates (
    candidate_id        BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE SET NULL,

    org_id              BIGINT
                        REFERENCES organizations(org_id)
                        ON DELETE SET NULL,

    institution         VARCHAR(255) NOT NULL,
    contact_name        VARCHAR(255),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    department          VARCHAR(100),

    status              feasibility_status NOT NULL DEFAULT 'IDENTIFIED',

    sent_date           DATE,
    response_date       DATE,
    response_submitted_at TIMESTAMP,

    scores              JSONB,
    score               NUMERIC(6,2),
    min_score_required  NUMERIC(6,2),

    rationale           TEXT,

    decided_at          TIMESTAMP,
    converted           BOOLEAN,

    notes               TEXT,
    history             JSONB,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    UNIQUE(study_id, institution)
);

CREATE TABLE feasibility_scores (
    score_id            BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL UNIQUE
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    criteria            JSONB NOT NULL,
    weights             JSONB,

    min_score           NUMERIC(6,2),

    updated_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 45. SAFETY / AE-SAE CASES
-- SafetyCenter screen
-- ============================================================

CREATE TABLE adverse_events (
    ae_id               BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    subject_id          BIGINT
                        REFERENCES subjects(subject_id)
                        ON DELETE SET NULL,

    case_no             VARCHAR(100) NOT NULL UNIQUE,
    ae_type             VARCHAR(50),

    severity            VARCHAR(20),
    causality           VARCHAR(50),
    outcome             VARCHAR(50),

    description         TEXT,
    onset_date          DATE,

    pv_reference        VARCHAR(100),

    status              ae_status NOT NULL DEFAULT 'OPEN',

    reported_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    reconciled_at       TIMESTAMP,
    reconciled_by       BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 46. MONITORING ACCESS REQUESTS
-- MonitoringAccess screen
-- ============================================================

CREATE TABLE monitoring_access_requests (
    request_id          BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    requester_id        BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    monitor_id          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    purpose             TEXT,

    requested_from      DATE,
    requested_to        DATE,

    status              access_request_status NOT NULL DEFAULT 'PENDING',

    decided_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    decided_at          TIMESTAMP,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 47. NOTIFICATIONS
-- Notifications screens (all roles + navbar dropdown)
-- ============================================================

CREATE TABLE notifications (
    notification_id     BIGSERIAL PRIMARY KEY,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    title               VARCHAR(255) NOT NULL,
    body                TEXT,

    notification_type   VARCHAR(20) NOT NULL DEFAULT 'INFO',
    severity            VARCHAR(20),

    link                VARCHAR(500),

    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    read_at             TIMESTAMP,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 48. COMMENTS & PROGRESS NOTES
-- Comments / StudyComments / SubjectComments / ProgressNotes / StudyLogs
-- ============================================================

CREATE TABLE comments (
    comment_id          BIGSERIAL PRIMARY KEY,

    entity_type         VARCHAR(100) NOT NULL,
    entity_id           BIGINT NOT NULL,

    parent_comment_id   BIGINT
                        REFERENCES comments(comment_id)
                        ON DELETE CASCADE,

    author_id           BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    body                TEXT NOT NULL,

    status              VARCHAR(20) NOT NULL DEFAULT 'OPEN',

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE progress_notes (
    note_id             BIGSERIAL PRIMARY KEY,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    subject_id          BIGINT
                        REFERENCES subjects(subject_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE SET NULL,

    note_type           VARCHAR(50),
    title               VARCHAR(500),
    body                TEXT NOT NULL,

    author_id           BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 49. ELECTRONIC SIGNATURE REQUESTS
-- eSignature workflow (M08) — request -> signers -> certificates
-- ============================================================

CREATE TABLE signature_requests (
    request_id          BIGSERIAL PRIMARY KEY,

    document_id         BIGINT NOT NULL
                        REFERENCES documents(document_id)
                        ON DELETE CASCADE,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    subject_id          BIGINT
                        REFERENCES subjects(subject_id)
                        ON DELETE SET NULL,

    requested_by        BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE RESTRICT,

    title               VARCHAR(500),

    status              signature_request_status NOT NULL DEFAULT 'DRAFT',

    sent_at             TIMESTAMP,
    expires_at          TIMESTAMP,
    completed_at        TIMESTAMP,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE signature_request_signers (
    signer_id           BIGSERIAL PRIMARY KEY,

    request_id          BIGINT NOT NULL
                        REFERENCES signature_requests(request_id)
                        ON DELETE CASCADE,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE RESTRICT,

    signer_role         VARCHAR(100),
    signer_name         VARCHAR(255) NOT NULL,

    status              signer_status NOT NULL DEFAULT 'PENDING',

    meaning             VARCHAR(255),

    signed_at           TIMESTAMP,
    verification_status VARCHAR(50),

    certificate         JSONB,

    UNIQUE(request_id, user_id)
);

-- ============================================================
-- 50. SUBSCRIPTIONS, PLANS & LICENSES
-- SubscriptionManagement / MyLicense / SubscriptionEditModal screens
-- ============================================================

CREATE TABLE plans (
    plan_id             BIGSERIAL PRIMARY KEY,

    plan_code           VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,

    price_monthly       NUMERIC(12,2),
    price_yearly        NUMERIC(12,2),
    currency            VARCHAR(10) NOT NULL DEFAULT 'USD',

    max_users           INT,
    max_studies         INT,
    storage_gb          INT,

    features            JSONB,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
    subscription_id     BIGSERIAL PRIMARY KEY,

    org_id              BIGINT NOT NULL UNIQUE
                        REFERENCES organizations(org_id)
                        ON DELETE CASCADE,

    plan_id             BIGINT NOT NULL
                        REFERENCES plans(plan_id)
                        ON DELETE RESTRICT,

    status              subscription_status NOT NULL DEFAULT 'TRIAL',

    current_period_start DATE,
    current_period_end  DATE,

    auto_renew          BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE licenses (
    license_id          BIGSERIAL PRIMARY KEY,

    org_id              BIGINT NOT NULL
                        REFERENCES organizations(org_id)
                        ON DELETE CASCADE,

    license_key         VARCHAR(255) NOT NULL UNIQUE,
    entitlement         JSONB,

    status              VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',

    issued_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TIMESTAMP
);

-- ============================================================
-- 51. REFERRAL PROGRAM
-- Referral screens (Sponsor / PI / CRO / Admin)
-- ============================================================

CREATE TABLE referral_programs (
    program_id          BIGSERIAL PRIMARY KEY,

    org_id              BIGINT NOT NULL
                        REFERENCES organizations(org_id)
                        ON DELETE CASCADE,

    name                VARCHAR(255) NOT NULL,

    reward              JSONB,
    settings            JSONB,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE referral_codes (
    code_id             BIGSERIAL PRIMARY KEY,

    program_id          BIGINT NOT NULL
                        REFERENCES referral_programs(program_id)
                        ON DELETE CASCADE,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    code                VARCHAR(100) NOT NULL UNIQUE,

    usage_count         INT NOT NULL DEFAULT 0,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE referral_usages (
    usage_id            BIGSERIAL PRIMARY KEY,

    code_id             BIGINT NOT NULL
                        REFERENCES referral_codes(code_id)
                        ON DELETE CASCADE,

    referred_user_id    BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE SET NULL,

    status              VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reward_amount       NUMERIC(12,2),

    used_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

# Additional relational indexes appended to the INDEXES section.
EXTRA_INDEXES = """CREATE INDEX idx_user_roles_study
    ON user_roles(study_id);

CREATE INDEX idx_user_roles_site
    ON user_roles(site_id);

CREATE INDEX idx_study_versions_study
    ON study_versions(study_id);

CREATE INDEX idx_study_teams_study
    ON study_teams(study_id);

CREATE INDEX idx_study_milestones_study
    ON study_milestones(study_id);

CREATE INDEX idx_site_contacts_site
    ON site_contacts(site_id);

CREATE INDEX idx_investigators_site
    ON investigators(site_id);

CREATE INDEX idx_site_staff_site
    ON site_staff(site_id);

CREATE INDEX idx_subject_status_history_subject
    ON subject_status_history(subject_id);

CREATE INDEX idx_visit_activities_visit
    ON visit_activities(visit_id);

CREATE INDEX idx_document_versions_document
    ON document_versions(document_id);

CREATE INDEX idx_document_approvals_document
    ON document_approvals(document_id);

CREATE INDEX idx_capa_issue
    ON capa(issue_id);

CREATE INDEX idx_budgets_study
    ON budgets(study_id);

CREATE INDEX idx_site_budgets_budget
    ON site_budgets(budget_id);

CREATE INDEX idx_site_budgets_site
    ON site_budgets(site_id);

CREATE INDEX idx_payments_site_budget
    ON payments(site_budget_id);

CREATE INDEX idx_report_schedules_report
    ON report_schedules(report_id);

CREATE INDEX idx_electronic_signatures_user
    ON electronic_signatures(user_id);

CREATE INDEX idx_electronic_signatures_document
    ON electronic_signatures(document_id);

CREATE INDEX idx_ai_conversations_user
    ON ai_conversations(user_id);

CREATE INDEX idx_amendments_study
    ON amendments(study_id);

CREATE INDEX idx_irb_submissions_study
    ON irb_submissions(study_id);

CREATE INDEX idx_icf_versions_study
    ON icf_versions(study_id);

CREATE INDEX idx_consent_events_subject
    ON consent_events(subject_id);

CREATE INDEX idx_ip_lots_study
    ON ip_lots(study_id);

CREATE INDEX idx_ip_lots_site
    ON ip_lots(site_id);

CREATE INDEX idx_ip_shipments_lot
    ON ip_shipments(lot_id);

CREATE INDEX idx_ip_excursions_lot
    ON ip_excursions(lot_id);

CREATE INDEX idx_vendors_org
    ON vendors(org_id);

CREATE INDEX idx_vendor_contracts_vendor
    ON vendor_contracts(vendor_id);

CREATE INDEX idx_feasibility_candidates_study
    ON feasibility_candidates(study_id);

CREATE INDEX idx_adverse_events_study
    ON adverse_events(study_id);

CREATE INDEX idx_adverse_events_status
    ON adverse_events(status);

CREATE INDEX idx_monitoring_access_requests_site
    ON monitoring_access_requests(site_id);

CREATE INDEX idx_notifications_user
    ON notifications(user_id, is_read);

CREATE INDEX idx_comments_entity
    ON comments(entity_type, entity_id);

CREATE INDEX idx_progress_notes_study
    ON progress_notes(study_id);

CREATE INDEX idx_signature_requests_document
    ON signature_requests(document_id);

CREATE INDEX idx_signature_request_signers_request
    ON signature_request_signers(request_id);

CREATE INDEX idx_referral_codes_user
    ON referral_codes(user_id);

"""

# Extra JSONB/GIN indexes appended to the JSONB INDEXES section.
EXTRA_JSONB_INDEXES = """CREATE INDEX idx_amendments_sites
    ON amendments
    USING GIN(sites);

CREATE INDEX idx_ip_lots_transactions
    ON ip_lots
    USING GIN(transactions);

CREATE INDEX idx_feasibility_candidates_scores
    ON feasibility_candidates
    USING GIN(scores);

CREATE INDEX idx_signature_request_signers_certificate
    ON signature_request_signers
    USING GIN(certificate);

CREATE INDEX idx_notifications_severity
    ON notifications
    USING GIN(to_tsvector('english', body));

"""

# Additional permissions for the new modules (appended in section 41/55).
EXTRA_PERMISSIONS = """    ('VIEW_AMENDMENT', 'AMENDMENT', 'VIEW', 'View protocol amendments'),
    ('CREATE_AMENDMENT', 'AMENDMENT', 'CREATE', 'Create protocol amendment'),
    ('APPROVE_AMENDMENT', 'AMENDMENT', 'APPROVE', 'Approve protocol amendment'),

    ('VIEW_IRB', 'IRB', 'VIEW', 'View IRB/IEC submissions'),
    ('CREATE_IRB', 'IRB', 'CREATE', 'Create IRB/IEC submission'),

    ('VIEW_ICF', 'ICF', 'VIEW', 'View ICF/eConsent versions'),
    ('APPROVE_ICF', 'ICF', 'APPROVE', 'Approve ICF/eConsent version'),

    ('VIEW_IP', 'IP', 'VIEW', 'View IP/supply lots'),
    ('MANAGE_IP', 'IP', 'UPDATE', 'Manage IP/supply lots'),

    ('VIEW_VENDOR', 'VENDOR', 'VIEW', 'View vendors'),
    ('MANAGE_VENDOR', 'VENDOR', 'UPDATE', 'Manage vendors'),

    ('VIEW_FEASIBILITY', 'FEASIBILITY', 'VIEW', 'View feasibility candidates'),
    ('MANAGE_FEASIBILITY', 'FEASIBILITY', 'UPDATE', 'Manage feasibility scoring'),

    ('VIEW_SAFETY', 'SAFETY', 'VIEW', 'View AE/SAE cases'),
    ('MANAGE_SAFETY', 'SAFETY', 'UPDATE', 'Manage AE/SAE cases'),

    ('VIEW_MONITORING_ACCESS', 'MONITORING_ACCESS', 'VIEW', 'View monitoring access requests'),
    ('APPROVE_MONITORING_ACCESS', 'MONITORING_ACCESS', 'APPROVE', 'Approve monitoring access requests'),

    ('VIEW_NOTIFICATION', 'NOTIFICATION', 'VIEW', 'View notifications'),

    ('VIEW_COMMENT', 'COMMENT', 'VIEW', 'View comments'),
    ('CREATE_COMMENT', 'COMMENT', 'CREATE', 'Create comment'),

    ('VIEW_PROGRESS_NOTE', 'PROGRESS_NOTE', 'VIEW', 'View progress notes'),
    ('CREATE_PROGRESS_NOTE', 'PROGRESS_NOTE', 'CREATE', 'Create progress note'),

    ('VIEW_SIGNATURE', 'SIGNATURE', 'VIEW', 'View signature requests'),
    ('SIGN_DOCUMENT', 'SIGNATURE', 'SIGN', 'Sign a document electronically'),

    ('VIEW_SUBSCRIPTION', 'SUBSCRIPTION', 'VIEW', 'View subscription'),
    ('MANAGE_SUBSCRIPTION', 'SUBSCRIPTION', 'UPDATE', 'Manage subscription'),

    ('VIEW_LICENSE', 'LICENSE', 'VIEW', 'View license'),
    ('MANAGE_LICENSE', 'LICENSE', 'UPDATE', 'Manage license'),

    ('VIEW_REFERRAL', 'REFERRAL', 'VIEW', 'View referral program'),
    ('MANAGE_REFERRAL', 'REFERRAL', 'UPDATE', 'Manage referral program'),

    ('VIEW_PAYMENT', 'PAYMENT', 'VIEW', 'View payments'),
    ('MANAGE_PAYMENT', 'PAYMENT', 'UPDATE', 'Manage payments'),

    ('VIEW_MILESTONE', 'MILESTONE', 'VIEW', 'View study milestones'),
    ('MANAGE_MILESTONE', 'MILESTONE', 'UPDATE', 'Manage study milestones'),

    ('VIEW_MONITORING_VISIT', 'MONITORING_VISIT', 'VIEW', 'View monitoring visits'),
    ('SCHEDULE_MONITORING_VISIT', 'MONITORING_VISIT', 'CREATE', 'Schedule monitoring visits'),

    ('VIEW_CAPA', 'CAPA', 'VIEW', 'View CAPAs'),
    ('MANAGE_CAPA', 'CAPA', 'UPDATE', 'Manage CAPAs'),

    ('VIEW_ACCESS_REQUEST', 'ACCESS_REQUEST', 'VIEW', 'View access requests'),
    ('APPROVE_ACCESS_REQUEST', 'ACCESS_REQUEST', 'APPROVE', 'Approve access requests'),

"""

HEADER_NOTE = """-- ============================================================
-- SCREEN COVERAGE NOTE (extended 2026-09-04)
-- This schema backs every TriaNXT screen module:
--   Studies/Dashboard/Reports/Visits ..... studies, study_versions,
--                                            study_teams, milestones, visits
--   Sites/Investigators/Staff ............. sites, site_contacts,
--                                            investigators, site_staff
--   Subjects/Screening .................... subjects, subject_status_history
--   eISF/Documents ....................... documents, document_versions,
--                                            document_approvals,
--                                            document_extractions
--   Monitoring ........................... monitoring_visits,
--                                            monitoring_access_requests
--   Queries/Deviations ................... issues, capa
--   Financials/Payments .................. budgets, site_budgets, payments
--   Risk/AI .............................. risk_rules, risk_events,
--                                            ai_conversations, ai_messages
--   Audit/Signatures ..................... audit_events, electronic_signatures,
--                                            signature_requests,
--                                            signature_request_signers
--   Amendments ........................... amendments                  (38)
--   IRB/IEC .............................. irb_submissions             (39)
--   ICF/eConsent ......................... icf_versions, consent_events,
--                                            reconsent_campaigns        (40)
--   IP/Supply ............................ ip_lots, ip_shipments,
--                                            ip_excursions              (41)
--   Vendors .............................. vendors, vendor_contracts    (42)
--   Feasibility .......................... feasibility_candidates,
--                                            feasibility_scores         (43)
--   Safety ............................... adverse_events              (44)
--   Notifications ........................ notifications               (46)
--   Comments/Notes ....................... comments, progress_notes    (47)
--   Billing/Licenses ..................... plans, subscriptions,
--                                            licenses                  (49)
--   Referral ............................. referral_programs,
--                                            referral_codes,
--                                            referral_usages            (50)
-- ============================================================

"""


def sub(content, old, new, label):
    count = content.count(old)
    if count != 1:
        print(f"FAIL [{label}]: expected 1 occurrence, found {count}")
        print("  old:", repr(old[:140]))
        sys.exit(1)
    return content.replace(old, new)


def main():
    with io.open(PATH, encoding="utf-8", newline="") as f:
        content = f.read()
    content = content.replace("\r\n", "\n")

    # 0. Header coverage note
    content = sub(
        content,
        "-- PostgreSQL 15+\n-- ============================================================\n\nBEGIN;",
        "-- PostgreSQL 15+\n-- ============================================================\n\n"
        + HEADER_NOTE
        + "BEGIN;",
        "header-note",
    )

    # 1. Extend existing enums
    content = sub(
        content,
        """CREATE TYPE study_status AS ENUM (
    'PLANNED',
    'ACTIVE',
    'ON_HOLD',
    'COMPLETED',
    'TERMINATED'
);""",
        """CREATE TYPE study_status AS ENUM (
    'DRAFT',
    'PLANNED',
    'STARTUP',
    'RECRUITMENT',
    'CONDUCT',
    'ACTIVE',
    'ON_HOLD',
    'COMPLETED',
    'EARLY_TERMINATION',
    'ARCHIVED'
);""",
        "study_status",
    )

    content = sub(
        content,
        """CREATE TYPE site_status AS ENUM (
    'PLANNED',
    'ACTIVE',
    'ON_HOLD',
    'CLOSED'
);""",
        """CREATE TYPE site_status AS ENUM (
    'IDENTIFIED',
    'FEASIBILITY',
    'SELECTED',
    'START_UP',
    'READY',
    'PLANNED',
    'ACTIVE',
    'RECRUITING',
    'ON_HOLD',
    'CLOSED'
);""",
        "site_status",
    )

    content = sub(
        content,
        """CREATE TYPE subject_status AS ENUM (
    'SCREENING',
    'ENROLLED',
    'COMPLETED',
    'DISCONTINUED',
    'WITHDRAWN',
    'SCREEN_FAILED'
);""",
        """CREATE TYPE subject_status AS ENUM (
    'SCREENING',
    'ENROLLED',
    'ACTIVE',
    'COMPLETED',
    'DISCONTINUED',
    'WITHDRAWN',
    'DROPOUT',
    'SCREEN_FAILED'
);""",
        "subject_status",
    )

    content = sub(
        content,
        """CREATE TYPE visit_type AS ENUM (
    'SCREENING',
    'BASELINE',
    'FOLLOW_UP',
    'FINAL'
);""",
        """CREATE TYPE visit_type AS ENUM (
    'SCREENING',
    'BASELINE',
    'FOLLOW_UP',
    'INTERIM',
    'FINAL',
    'UNSCHEDULED'
);""",
        "visit_type",
    )

    content = sub(
        content,
        """CREATE TYPE visit_status AS ENUM (
    'SCHEDULED',
    'COMPLETED',
    'MISSED',
    'CANCELLED'
);""",
        """CREATE TYPE visit_status AS ENUM (
    'PLANNED',
    'SCHEDULED',
    'CONFIRMED',
    'IN_PROGRESS',
    'SUBMITTED',
    'REVIEWED',
    'COMPLETED',
    'MISSED',
    'CANCELLED',
    'CLOSED'
);""",
        "visit_status",
    )

    content = sub(
        content,
        """CREATE TYPE document_status AS ENUM (
    'DRAFT',
    'UPLOADED',
    'APPROVED',
    'SUPERSEDED',
    'ARCHIVED'
);""",
        """CREATE TYPE document_status AS ENUM (
    'DRAFT',
    'UPLOADED',
    'AI_REVIEW',
    'UNDER_REVIEW',
    'CHANGES_REQUIRED',
    'APPROVED',
    'SIGNED',
    'SUPERSEDED',
    'ARCHIVED'
);""",
        "document_status",
    )

    # 2. Append new enums after signature_type
    content = sub(
        content,
        """CREATE TYPE signature_type AS ENUM (
    'ELECTRONIC',
    'DIGITAL',
    'MANUAL'
);""",
        """CREATE TYPE signature_type AS ENUM (
    'ELECTRONIC',
    'DIGITAL',
    'MANUAL'
);

""" + NEW_ENUMS,
        "new-enums",
    )

    # 3. Fix erroneous sites.dob (date-of-birth belongs on subjects)
    content = sub(
        content,
        """    site_no             VARCHAR(100) NOT NULL,
    name                VARCHAR(255) NOT NULL,

    dob                 DATE,

    address             TEXT,""",
        """    site_no             VARCHAR(100) NOT NULL,
    name                VARCHAR(255) NOT NULL,

    address             TEXT,""",
        "sites-dob-fix",
    )

    # 4. user_roles.site_id FK (sites defined in section 12)
    content = sub(
        content,
        """-- ============================================================
-- 13. SITE CONTACTS
-- ============================================================

CREATE TABLE site_contacts (""",
        """-- Add site FK references to user_roles
ALTER TABLE user_roles
ADD CONSTRAINT fk_user_roles_site
FOREIGN KEY (site_id)
REFERENCES sites(site_id)
ON DELETE CASCADE;

-- ============================================================
-- 13. SITE CONTACTS
-- ============================================================

CREATE TABLE site_contacts (""",
        "user_roles-site-fk",
    )

    # 5. study_versions.document_id FK (documents defined in section 20)
    content = sub(
        content,
        """-- ============================================================
-- 21. DOCUMENT VERSIONS
-- ============================================================

CREATE TABLE document_versions (""",
        """-- Add document FK references to study_versions
ALTER TABLE study_versions
ADD CONSTRAINT fk_study_versions_document
FOREIGN KEY (document_id)
REFERENCES documents(document_id)
ON DELETE SET NULL;

-- ============================================================
-- 21. DOCUMENT VERSIONS
-- ============================================================

CREATE TABLE document_versions (""",
        "study_versions-document-fk",
    )

    # 6. electronic_signatures: Part 11 certificate columns
    content = sub(
        content,
        """    signed_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    verification_status VARCHAR(50)
);""",
        """    signed_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    verification_status VARCHAR(50),

    meaning             VARCHAR(255),
    document_version    VARCHAR(50),
    certificate_hash    TEXT
);""",
        "signature-certificate-cols",
    )

    # 7. Insert new table sections before the INDEXES section, and renumber
    #    the trailing sections 38->52, 39->53, 40->54, 41->55.
    content = sub(
        content,
        """-- ============================================================
-- 38. INDEXES
-- ============================================================""",
        NEW_TABLES
        + """-- ============================================================
-- 52. INDEXES
-- ============================================================""",
        "new-tables",
    )

    # 8. Extra relational indexes at the end of section 52 (before JSONB)
    content = sub(
        content,
        """-- ============================================================
-- 39. JSONB INDEXES
-- ============================================================""",
        EXTRA_INDEXES
        + """-- ============================================================
-- 53. JSONB INDEXES
-- ============================================================""",
        "extra-indexes",
    )

    # 9. Extra JSONB indexes + renumber seed section
    content = sub(
        content,
        """-- ============================================================
-- 40. SEED SYSTEM ROLES
-- ============================================================""",
        EXTRA_JSONB_INDEXES
        + """-- ============================================================
-- 54. SEED SYSTEM ROLES
-- ============================================================""",
        "extra-jsonb-indexes",
    )

    # 10. Renumber permissions section
    content = sub(
        content,
        """-- ============================================================
-- 41. COMMON PERMISSIONS
-- ============================================================""",
        """-- ============================================================
-- 55. COMMON PERMISSIONS
-- ============================================================""",
        "renumber-permissions",
    )

    # 11. Extend seed permissions
    content = sub(
        content,
        """    ('VIEW_AUDIT', 'AUDIT', 'VIEW', 'View audit events'),

    ('USE_AI', 'AI', 'QUERY', 'Use CTMS AI')
ON CONFLICT (permission_name, resource, action) DO NOTHING;""",
        """    ('VIEW_AUDIT', 'AUDIT', 'VIEW', 'View audit events'),

    ('USE_AI', 'AI', 'QUERY', 'Use CTMS AI'),

""" + EXTRA_PERMISSIONS + """    ('VIEW_CAPA', 'CAPA', 'VIEW', 'View CAPAs'),
    ('MANAGE_CAPA', 'CAPA', 'UPDATE', 'Manage CAPAs'),

    ('VIEW_ACCESS_REQUEST', 'ACCESS_REQUEST', 'VIEW', 'View access requests'),
    ('APPROVE_ACCESS_REQUEST', 'ACCESS_REQUEST', 'APPROVE', 'Approve access requests')
ON CONFLICT (permission_name, resource, action) DO NOTHING;""",
        "extra-permissions",
    )

    with io.open(PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

    print("OK — CTMSScripts.sql extended (%d lines)" % content.count("\n"))


if __name__ == "__main__":
    main()