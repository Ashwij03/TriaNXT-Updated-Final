-- ============================================================
-- CTMS - Clinical Trial Management System
-- PostgreSQL Database Schema
-- PostgreSQL 15+
-- ============================================================

-- ============================================================
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

BEGIN;

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE org_type AS ENUM (
    'SPONSOR',
    'CRO',
    'SITE',
    'OTHER'
);

CREATE TYPE user_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

CREATE TYPE role_type AS ENUM (
    'ADMIN',
    'SPONSOR',
    'CRO',
    'PI',
    'SITE_STAFF',
    'MONITOR',
    'OTHER'
);

CREATE TYPE study_status AS ENUM (
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
);

CREATE TYPE phase_type AS ENUM (
    'PHASE_I',
    'PHASE_II',
    'PHASE_III',
    'PHASE_IV'
);

CREATE TYPE site_status AS ENUM (
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
);

CREATE TYPE subject_status AS ENUM (
    'SCREENING',
    'ENROLLED',
    'ACTIVE',
    'COMPLETED',
    'DISCONTINUED',
    'WITHDRAWN',
    'DROPOUT',
    'SCREEN_FAILED'
);

CREATE TYPE gender_type AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER',
    'UNKNOWN'
);

CREATE TYPE visit_type AS ENUM (
    'SCREENING',
    'BASELINE',
    'FOLLOW_UP',
    'INTERIM',
    'FINAL',
    'UNSCHEDULED'
);

CREATE TYPE visit_status AS ENUM (
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
);

CREATE TYPE document_type AS ENUM (
    'PROTOCOL',
    'ICF',
    'INVESTIGATOR_BROCHURE',
    'REGULATORY',
    'SITE_DOCUMENT',
    'SAFETY',
    'FINANCIAL',
    'OTHER'
);

CREATE TYPE document_status AS ENUM (
    'DRAFT',
    'UPLOADED',
    'AI_REVIEW',
    'UNDER_REVIEW',
    'CHANGES_REQUIRED',
    'APPROVED',
    'SIGNED',
    'SUPERSEDED',
    'ARCHIVED'
);

CREATE TYPE monitoring_visit_type AS ENUM (
    'SIV',
    'IMV',
    'COV',
    'REMOTE'
);

CREATE TYPE issue_type AS ENUM (
    'QUERY',
    'DEVIATION',
    'SAFETY',
    'DOCUMENT',
    'OPERATIONAL',
    'OTHER'
);

CREATE TYPE severity_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE issue_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);

CREATE TYPE risk_type AS ENUM (
    'ENROLLMENT',
    'SITE',
    'VISIT',
    'DOCUMENT',
    'SAFETY',
    'FINANCIAL',
    'OPERATIONAL',
    'COMPLIANCE',
    'OTHER'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'SUBMITTED',
    'APPROVED',
    'PAID',
    'REJECTED'
);

CREATE TYPE milestone_status AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'DELAYED'
);

CREATE TYPE signature_type AS ENUM (
    'ELECTRONIC',
    'DIGITAL',
    'MANUAL'
);

CREATE TYPE access_request_status AS ENUM (
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
);

-- ============================================================
-- 2. ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
    org_id              BIGSERIAL PRIMARY KEY,
    org_type            org_type NOT NULL,
    name                VARCHAR(255) NOT NULL,
    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(100),
    status              VARCHAR(50) DEFAULT 'ACTIVE',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. USERS
-- ============================================================

CREATE TABLE users (
    user_id             BIGSERIAL PRIMARY KEY,
    org_id              BIGINT NOT NULL
                        REFERENCES organizations(org_id)
                        ON DELETE RESTRICT,

    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,

    password_hash       TEXT,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,

    status              user_status NOT NULL DEFAULT 'ACTIVE',

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. ROLES
-- ============================================================

CREATE TABLE roles (
    role_id             BIGSERIAL PRIMARY KEY,
    role_name           VARCHAR(100) NOT NULL UNIQUE,
    description         TEXT,
    org_type            role_type,
    is_system_role      BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- 5. PERMISSIONS
-- ============================================================

CREATE TABLE permissions (
    permission_id       BIGSERIAL PRIMARY KEY,
    permission_name     VARCHAR(100) NOT NULL,
    resource            VARCHAR(100) NOT NULL,
    action              VARCHAR(50) NOT NULL,
    description         TEXT,

    UNIQUE(permission_name, resource, action)
);

-- ============================================================
-- 6. ROLE PERMISSIONS
-- ============================================================

CREATE TABLE role_permissions (
    role_id             BIGINT NOT NULL
                        REFERENCES roles(role_id)
                        ON DELETE CASCADE,

    permission_id       BIGINT NOT NULL
                        REFERENCES permissions(permission_id)
                        ON DELETE CASCADE,

    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 7. USER ROLES
-- Supports organization / study / site scoped access
-- ============================================================

CREATE TABLE user_roles (
    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    role_id             BIGINT NOT NULL
                        REFERENCES roles(role_id)
                        ON DELETE CASCADE,

    org_id              BIGINT
                        REFERENCES organizations(org_id)
                        ON DELETE CASCADE,

    study_id            BIGINT,

    site_id             BIGINT,

    assigned_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, role_id, org_id, study_id, site_id)
);

-- ============================================================
-- 8. STUDIES
-- ============================================================

CREATE TABLE studies (
    study_id            BIGSERIAL PRIMARY KEY,

    org_id              BIGINT NOT NULL
                        REFERENCES organizations(org_id)
                        ON DELETE RESTRICT,

    protocol_no         VARCHAR(100) NOT NULL,
    title               VARCHAR(500) NOT NULL,

    phase               phase_type,
    therapeutic_area    VARCHAR(200),

    start_date          DATE,
    end_date            DATE,

    status              study_status NOT NULL DEFAULT 'PLANNED',

    created_by          BIGINT
                        REFERENCES users(user_id),

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(org_id, protocol_no)
);

-- Add study FK references to user_roles
ALTER TABLE user_roles
ADD CONSTRAINT fk_user_roles_study
FOREIGN KEY (study_id)
REFERENCES studies(study_id)
ON DELETE CASCADE;

-- ============================================================
-- 9. STUDY VERSIONS
-- ============================================================

CREATE TABLE study_versions (
    version_id          BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    version_no          VARCHAR(50) NOT NULL,
    effective_date      DATE,

    summary_of_changes  TEXT,

    document_id         BIGINT,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(study_id, version_no)
);

-- ============================================================
-- 10. STUDY TEAM
-- ============================================================

CREATE TABLE study_teams (
    study_team_id       BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    role_in_study       VARCHAR(100) NOT NULL,

    start_date          DATE,
    end_date            DATE,

    UNIQUE(study_id, user_id, role_in_study)
);

-- ============================================================
-- 11. STUDY MILESTONES
-- ============================================================

CREATE TABLE study_milestones (
    milestone_id        BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    name                VARCHAR(255) NOT NULL,
    description         TEXT,

    planned_date        DATE,
    actual_date         DATE,

    status              milestone_status NOT NULL DEFAULT 'PLANNED',

    depends_on_id       BIGINT
                        REFERENCES study_milestones(milestone_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 12. SITES
-- ============================================================

CREATE TABLE sites (
    site_id             BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    org_id              BIGINT NOT NULL
                        REFERENCES organizations(org_id)
                        ON DELETE RESTRICT,

    site_no             VARCHAR(100) NOT NULL,
    name                VARCHAR(255) NOT NULL,

    address             TEXT,
    city                VARCHAR(100),
    country             VARCHAR(100),

    status              site_status NOT NULL DEFAULT 'PLANNED',

    activation_date     DATE,
    closeout_date       DATE,

    UNIQUE(study_id, site_no)
);

-- Add site FK references to user_roles
ALTER TABLE user_roles
ADD CONSTRAINT fk_user_roles_site
FOREIGN KEY (site_id)
REFERENCES sites(site_id)
ON DELETE CASCADE;

-- ============================================================
-- 13. SITE CONTACTS
-- ============================================================

CREATE TABLE site_contacts (
    contact_id          BIGSERIAL PRIMARY KEY,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    name                VARCHAR(255) NOT NULL,
    role                VARCHAR(100),

    email               VARCHAR(255),
    phone               VARCHAR(50)
);

-- ============================================================
-- 14. INVESTIGATORS
-- ============================================================

CREATE TABLE investigators (
    investigator_id     BIGSERIAL PRIMARY KEY,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    user_id             BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    investigator_type   VARCHAR(50),
    license_no          VARCHAR(100),

    status              VARCHAR(50) DEFAULT 'ACTIVE'
);

-- ============================================================
-- 15. SITE STAFF
-- ============================================================

CREATE TABLE site_staff (
    site_staff_id       BIGSERIAL PRIMARY KEY,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    job_title           VARCHAR(100),

    start_date          DATE,
    end_date            DATE,

    UNIQUE(site_id, user_id)
);

-- ============================================================
-- 16. SUBJECTS
-- ============================================================

CREATE TABLE subjects (
    subject_id          BIGSERIAL PRIMARY KEY,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    subject_no          VARCHAR(100) NOT NULL,

    initials            VARCHAR(20),
    dob                 DATE,
    gender              gender_type,

    enrollment_date     DATE,

    status              subject_status NOT NULL DEFAULT 'SCREENING',

    screen_failure_reason TEXT,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(study_id, subject_no)
);

-- ============================================================
-- 17. SUBJECT STATUS HISTORY
-- ============================================================

CREATE TABLE subject_status_history (
    status_id           BIGSERIAL PRIMARY KEY,

    subject_id          BIGINT NOT NULL
                        REFERENCES subjects(subject_id)
                        ON DELETE CASCADE,

    status              subject_status NOT NULL,

    reason              TEXT,

    changed_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    changed_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL
);

-- ============================================================
-- 18. VISITS
-- ============================================================

CREATE TABLE visits (
    visit_id            BIGSERIAL PRIMARY KEY,

    subject_id          BIGINT NOT NULL
                        REFERENCES subjects(subject_id)
                        ON DELETE CASCADE,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE SET NULL,

    visit_no            VARCHAR(100) NOT NULL,
    visit_type          visit_type NOT NULL,

    scheduled_date      DATE,
    actual_date         DATE,

    status              visit_status NOT NULL DEFAULT 'SCHEDULED',

    notes               TEXT
);

-- ============================================================
-- 19. VISIT ACTIVITIES
-- ============================================================

CREATE TABLE visit_activities (
    activity_id         BIGSERIAL PRIMARY KEY,

    visit_id            BIGINT NOT NULL
                        REFERENCES visits(visit_id)
                        ON DELETE CASCADE,

    activity_name       VARCHAR(255) NOT NULL,

    status              VARCHAR(50),

    completed_at        TIMESTAMP,

    performed_by        BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    notes               TEXT
);

-- ============================================================
-- 20. DOCUMENTS / eISF
-- ============================================================

CREATE TABLE documents (
    document_id         BIGSERIAL PRIMARY KEY,

    org_id              BIGINT NOT NULL
                        REFERENCES organizations(org_id)
                        ON DELETE RESTRICT,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    subject_id          BIGINT
                        REFERENCES subjects(subject_id)
                        ON DELETE CASCADE,

    title               VARCHAR(500) NOT NULL,

    document_type       document_type NOT NULL,

    version             VARCHAR(50),

    file_name           VARCHAR(500),
    file_size           BIGINT,

    mime_type           VARCHAR(100),

    s3_key              TEXT NOT NULL,

    status              document_status NOT NULL DEFAULT 'UPLOADED',

    uploaded_by         BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    uploaded_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    expiry_date         DATE
);

-- Add document FK references to study_versions
ALTER TABLE study_versions
ADD CONSTRAINT fk_study_versions_document
FOREIGN KEY (document_id)
REFERENCES documents(document_id)
ON DELETE SET NULL;

-- ============================================================
-- 21. DOCUMENT VERSIONS
-- ============================================================

CREATE TABLE document_versions (
    version_id          BIGSERIAL PRIMARY KEY,

    document_id         BIGINT NOT NULL
                        REFERENCES documents(document_id)
                        ON DELETE CASCADE,

    version_no          VARCHAR(50) NOT NULL,

    s3_key              TEXT NOT NULL,

    uploaded_by         BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    uploaded_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    change_note         TEXT,

    UNIQUE(document_id, version_no)
);

-- ============================================================
-- 22. DOCUMENT APPROVALS
-- ============================================================

CREATE TABLE document_approvals (
    approval_id         BIGSERIAL PRIMARY KEY,

    document_id         BIGINT NOT NULL
                        REFERENCES documents(document_id)
                        ON DELETE CASCADE,

    approved_by         BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    approval_date       TIMESTAMP,

    status              VARCHAR(50),

    comments            TEXT,

    expiry_date         DATE
);

-- ============================================================
-- 23. DOCUMENT EXTRACTIONS
-- OCR / AI extracted information
-- ============================================================

CREATE TABLE document_extractions (
    extraction_id       BIGSERIAL PRIMARY KEY,

    document_id         BIGINT NOT NULL
                        REFERENCES documents(document_id)
                        ON DELETE CASCADE,

    extraction_type     VARCHAR(100) NOT NULL,

    extracted_text      TEXT,

    structured_data     JSONB,

    confidence_score    NUMERIC(5,4),

    review_status       VARCHAR(50) DEFAULT 'PENDING',

    reviewed_by         BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    reviewed_at         TIMESTAMP
);

-- ============================================================
-- 24. MONITORING VISITS
-- ============================================================

CREATE TABLE monitoring_visits (
    monitoring_visit_id BIGSERIAL PRIMARY KEY,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    monitor_id          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    visit_type          monitoring_visit_type NOT NULL,

    scheduled_date      DATE,
    actual_date         DATE,

    status              VARCHAR(50),

    protocol_version    VARCHAR(50),

    document_id         BIGINT
                        REFERENCES documents(document_id)
                        ON DELETE SET NULL,

    notes               TEXT
);

-- ============================================================
-- 25. ISSUES
-- ============================================================

CREATE TABLE issues (
    issue_id            BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id             BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    subject_id          BIGINT
                        REFERENCES subjects(subject_id)
                        ON DELETE SET NULL,

    issue_type          issue_type NOT NULL,

    title               VARCHAR(500) NOT NULL,
    description         TEXT,

    severity            severity_level NOT NULL DEFAULT 'MEDIUM',

    status              issue_status NOT NULL DEFAULT 'OPEN',

    identified_date     DATE,
    due_date            DATE,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 26. CAPA
-- ============================================================

CREATE TABLE capa (
    capa_id             BIGSERIAL PRIMARY KEY,

    issue_id            BIGINT
                        REFERENCES issues(issue_id)
                        ON DELETE CASCADE,

    root_cause          TEXT,

    corrective_action   TEXT,
    preventive_action   TEXT,

    owner_id            BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    target_date         DATE,

    status              VARCHAR(50) DEFAULT 'OPEN',

    completed_date      DATE,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 27. FINANCIALS - BUDGETS
-- ============================================================

CREATE TABLE budgets (
    budget_id           BIGSERIAL PRIMARY KEY,

    study_id            BIGINT NOT NULL
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    total_budget        NUMERIC(18,2) NOT NULL DEFAULT 0,

    currency            VARCHAR(10) NOT NULL DEFAULT 'USD',

    start_date          DATE,
    end_date            DATE
);

-- ============================================================
-- 28. SITE BUDGETS
-- ============================================================

CREATE TABLE site_budgets (
    site_budget_id      BIGSERIAL PRIMARY KEY,

    budget_id           BIGINT NOT NULL
                        REFERENCES budgets(budget_id)
                        ON DELETE CASCADE,

    site_id             BIGINT NOT NULL
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    amount              NUMERIC(18,2) NOT NULL DEFAULT 0,

    payment_schedule    JSONB,

    status              VARCHAR(50) DEFAULT 'ACTIVE',

    UNIQUE(budget_id, site_id)
);

-- ============================================================
-- 29. PAYMENTS
-- ============================================================

CREATE TABLE payments (
    payment_id          BIGSERIAL PRIMARY KEY,

    site_budget_id      BIGINT NOT NULL
                        REFERENCES site_budgets(site_budget_id)
                        ON DELETE CASCADE,

    payment_no          VARCHAR(100),

    amount              NUMERIC(18,2) NOT NULL,

    payment_date        DATE,

    payment_type        VARCHAR(100),

    status              payment_status NOT NULL DEFAULT 'PENDING',

    invoice_ref         VARCHAR(255),

    notes               TEXT
);

-- ============================================================
-- 30. REPORTS
-- ============================================================

CREATE TABLE reports (
    report_id           BIGSERIAL PRIMARY KEY,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    name                VARCHAR(255) NOT NULL,

    report_type         VARCHAR(100) NOT NULL,

    description         TEXT,

    parameters          JSONB,

    created_by          BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 31. REPORT SCHEDULES
-- ============================================================

CREATE TABLE report_schedules (
    schedule_id         BIGSERIAL PRIMARY KEY,

    report_id           BIGINT NOT NULL
                        REFERENCES reports(report_id)
                        ON DELETE CASCADE,

    frequency           VARCHAR(50) NOT NULL,

    recipients          JSONB,

    next_run_date       TIMESTAMP,

    is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 32. RISK RULES
-- ============================================================

CREATE TABLE risk_rules (
    rule_id             BIGSERIAL PRIMARY KEY,

    rule_name           VARCHAR(255) NOT NULL,

    category            VARCHAR(100) NOT NULL,

    condition            JSONB NOT NULL,

    weight              NUMERIC(10,4) NOT NULL DEFAULT 1,

    threshold            NUMERIC(10,4),

    is_active            BOOLEAN NOT NULL DEFAULT TRUE,

    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 33. RISK EVENTS
-- ============================================================

CREATE TABLE risk_events (
    risk_event_id       BIGSERIAL PRIMARY KEY,

    rule_id             BIGINT
                        REFERENCES risk_rules(rule_id)
                        ON DELETE SET NULL,

    study_id             BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    site_id              BIGINT
                        REFERENCES sites(site_id)
                        ON DELETE CASCADE,

    subject_id           BIGINT
                        REFERENCES subjects(subject_id)
                        ON DELETE SET NULL,

    risk_type            risk_type NOT NULL,

    risk_score           NUMERIC(10,4),

    severity             severity_level,

    description          TEXT,

    status               VARCHAR(50) DEFAULT 'OPEN',

    detected_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    resolved_at          TIMESTAMP
);

-- ============================================================
-- 34. AI CONVERSATIONS
-- ============================================================

CREATE TABLE ai_conversations (
    conversation_id     BIGSERIAL PRIMARY KEY,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE CASCADE,

    study_id            BIGINT
                        REFERENCES studies(study_id)
                        ON DELETE CASCADE,

    title               VARCHAR(500),

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 35. AI MESSAGES
-- ============================================================

CREATE TABLE ai_messages (
    message_id          BIGSERIAL PRIMARY KEY,

    conversation_id     BIGINT NOT NULL
                        REFERENCES ai_conversations(conversation_id)
                        ON DELETE CASCADE,

    role                VARCHAR(50) NOT NULL,

    content             TEXT NOT NULL,

    citations            JSONB,

    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 36. AUDIT EVENTS
-- ============================================================

CREATE TABLE audit_events (
    audit_id            BIGSERIAL PRIMARY KEY,

    user_id             BIGINT
                        REFERENCES users(user_id)
                        ON DELETE SET NULL,

    entity_type         VARCHAR(100) NOT NULL,
    entity_id           BIGINT,

    action              VARCHAR(50) NOT NULL,

    old_values          JSONB,
    new_values          JSONB,

    ip_address          INET,

    timestamp            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 37. ELECTRONIC SIGNATURES
-- ============================================================

CREATE TABLE electronic_signatures (
    signature_id        BIGSERIAL PRIMARY KEY,

    user_id             BIGINT NOT NULL
                        REFERENCES users(user_id)
                        ON DELETE RESTRICT,

    document_id         BIGINT
                        REFERENCES documents(document_id)
                        ON DELETE CASCADE,

    signature_type      signature_type NOT NULL,

    ip_address          INET,

    signed_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    verification_status VARCHAR(50),

    meaning             VARCHAR(255),
    document_version    VARCHAR(50),
    certificate_hash    TEXT
);

-- ============================================================
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
-- ============================================================
-- 52. INDEXES
-- ============================================================

CREATE INDEX idx_users_org
    ON users(org_id);

CREATE INDEX idx_users_email
    ON users(email);

CREATE INDEX idx_studies_org
    ON studies(org_id);

CREATE INDEX idx_studies_status
    ON studies(status);

CREATE INDEX idx_sites_study
    ON sites(study_id);

CREATE INDEX idx_sites_org
    ON sites(org_id);

CREATE INDEX idx_sites_status
    ON sites(status);

CREATE INDEX idx_subjects_study
    ON subjects(study_id);

CREATE INDEX idx_subjects_site
    ON subjects(site_id);

CREATE INDEX idx_subjects_status
    ON subjects(status);

CREATE INDEX idx_visits_subject
    ON visits(subject_id);

CREATE INDEX idx_visits_study
    ON visits(study_id);

CREATE INDEX idx_visits_site
    ON visits(site_id);

CREATE INDEX idx_visits_scheduled_date
    ON visits(scheduled_date);

CREATE INDEX idx_documents_study
    ON documents(study_id);

CREATE INDEX idx_documents_site
    ON documents(site_id);

CREATE INDEX idx_documents_subject
    ON documents(subject_id);

CREATE INDEX idx_documents_type
    ON documents(document_type);

CREATE INDEX idx_document_extractions_document
    ON document_extractions(document_id);

CREATE INDEX idx_monitoring_visits_site
    ON monitoring_visits(site_id);

CREATE INDEX idx_issues_study
    ON issues(study_id);

CREATE INDEX idx_issues_site
    ON issues(site_id);

CREATE INDEX idx_issues_status
    ON issues(status);

CREATE INDEX idx_risk_events_study
    ON risk_events(study_id);

CREATE INDEX idx_risk_events_site
    ON risk_events(site_id);

CREATE INDEX idx_risk_events_status
    ON risk_events(status);

CREATE INDEX idx_risk_events_detected
    ON risk_events(detected_at);

CREATE INDEX idx_audit_events_user
    ON audit_events(user_id);

CREATE INDEX idx_audit_events_entity
    ON audit_events(entity_type, entity_id);

CREATE INDEX idx_audit_events_timestamp
    ON audit_events(timestamp);

CREATE INDEX idx_ai_messages_conversation
    ON ai_messages(conversation_id);

CREATE INDEX idx_user_roles_study
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

-- ============================================================
-- 53. JSONB INDEXES
-- ============================================================

CREATE INDEX idx_document_extractions_structured
    ON document_extractions
    USING GIN(structured_data);

CREATE INDEX idx_risk_rules_condition
    ON risk_rules
    USING GIN(condition);

CREATE INDEX idx_risk_events_description
    ON risk_events
    USING GIN(to_tsvector('english', description));

CREATE INDEX idx_amendments_sites
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

-- ============================================================
-- 54. SEED SYSTEM ROLES
-- ============================================================

INSERT INTO roles
    (role_name, description, org_type, is_system_role)
VALUES
    ('ADMIN', 'System Administrator', 'ADMIN', TRUE),
    ('SPONSOR', 'Sponsor User', 'SPONSOR', TRUE),
    ('CRO', 'CRO User', 'CRO', TRUE),
    ('PI', 'Principal Investigator', 'PI', TRUE),
    ('SITE_STAFF', 'Clinical Site Staff', 'SITE_STAFF', TRUE),
    ('MONITOR', 'Clinical Trial Monitor', 'MONITOR', TRUE)
ON CONFLICT (role_name) DO NOTHING;

-- ============================================================
-- 55. COMMON PERMISSIONS
-- ============================================================

INSERT INTO permissions
    (permission_name, resource, action, description)
VALUES
    ('VIEW_STUDY', 'STUDY', 'VIEW', 'View study'),
    ('CREATE_STUDY', 'STUDY', 'CREATE', 'Create study'),
    ('EDIT_STUDY', 'STUDY', 'UPDATE', 'Update study'),
    ('DELETE_STUDY', 'STUDY', 'DELETE', 'Delete study'),

    ('VIEW_SITE', 'SITE', 'VIEW', 'View site'),
    ('CREATE_SITE', 'SITE', 'CREATE', 'Create site'),
    ('EDIT_SITE', 'SITE', 'UPDATE', 'Update site'),

    ('VIEW_SUBJECT', 'SUBJECT', 'VIEW', 'View subject'),
    ('CREATE_SUBJECT', 'SUBJECT', 'CREATE', 'Create subject'),
    ('EDIT_SUBJECT', 'SUBJECT', 'UPDATE', 'Update subject'),

    ('VIEW_VISIT', 'VISIT', 'VIEW', 'View visit'),
    ('CREATE_VISIT', 'VISIT', 'CREATE', 'Create visit'),
    ('EDIT_VISIT', 'VISIT', 'UPDATE', 'Update visit'),

    ('VIEW_DOCUMENT', 'DOCUMENT', 'VIEW', 'View document'),
    ('UPLOAD_DOCUMENT', 'DOCUMENT', 'CREATE', 'Upload document'),
    ('APPROVE_DOCUMENT', 'DOCUMENT', 'APPROVE', 'Approve document'),

    ('VIEW_REPORT', 'REPORT', 'VIEW', 'View reports'),
    ('CREATE_REPORT', 'REPORT', 'CREATE', 'Create reports'),

    ('VIEW_RISK', 'RISK', 'VIEW', 'View risks'),
    ('MANAGE_RISK', 'RISK', 'UPDATE', 'Manage risks'),

    ('VIEW_AUDIT', 'AUDIT', 'VIEW', 'View audit events'),

    ('USE_AI', 'AI', 'QUERY', 'Use CTMS AI'),

    ('VIEW_AMENDMENT', 'AMENDMENT', 'VIEW', 'View protocol amendments'),
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
    ('APPROVE_ACCESS_REQUEST', 'ACCESS_REQUEST', 'APPROVE', 'Approve access requests')
ON CONFLICT (permission_name, resource, action) DO NOTHING;

COMMIT;