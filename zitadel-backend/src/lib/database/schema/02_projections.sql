-- =============================================================================
-- ZITADEL Backend - Projections Schema
-- =============================================================================
-- Description: All CQRS read-model projections
-- Schema: projections
-- Tables: 50 projection tables
-- =============================================================================

-- Create projections schema
CREATE SCHEMA IF NOT EXISTS projections;

COMMENT ON SCHEMA projections IS 'CQRS read model projections - query-side tables built from events';

-- ============================================================================
-- PROJECTION SYSTEM INFRASTRUCTURE
-- ============================================================================

-- Table: projections.projection_states
-- Description: Track projection processing state with all required columns
CREATE TABLE IF NOT EXISTS projections.projection_states (
    -- Core identification and tracking
    name VARCHAR(255) PRIMARY KEY,
    position DECIMAL NOT NULL DEFAULT 0,
    position_offset INT NOT NULL DEFAULT 0,
    
    -- Timestamps
    last_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'stopped',
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    
    -- Enhanced tracking fields (optional, nullable for backward compatibility)
    event_timestamp TIMESTAMPTZ,
    instance_id TEXT,
    aggregate_type TEXT,
    aggregate_id TEXT,
    sequence BIGINT
);

-- Add indexes for projection_states common queries
CREATE INDEX IF NOT EXISTS idx_projection_states_status ON projections.projection_states(status);
CREATE INDEX IF NOT EXISTS idx_projection_states_position ON projections.projection_states(position);
CREATE INDEX IF NOT EXISTS idx_projection_states_position_offset ON projections.projection_states(name, position, position_offset);
CREATE INDEX IF NOT EXISTS idx_projection_states_updated_at ON projections.projection_states(updated_at DESC);

-- Table: public.projection_locks
-- Description: Distributed locks for projection processing
CREATE TABLE IF NOT EXISTS public.projection_locks (
    projection_name TEXT PRIMARY KEY,
    instance_id TEXT,
    acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Table: public.projection_failed_events
-- Description: Track events that failed projection processing
CREATE TABLE IF NOT EXISTS public.projection_failed_events (
    projection_name TEXT NOT NULL,
    failed_sequence BIGINT NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 1,
    error TEXT NOT NULL,
    event_data JSONB NOT NULL,
    last_failed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    instance_id TEXT NOT NULL,
    UNIQUE(projection_name, failed_sequence)
);

-- ============================================================================
-- PROJECTION TABLES
-- ============================================================================

-- Table: projections.action_flows
CREATE TABLE IF NOT EXISTS projections.action_flows (
    flow_type TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    action_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL,
    trigger_sequence SMALLINT NOT NULL DEFAULT 0
);

-- Table: projections.actions
CREATE TABLE IF NOT EXISTS projections.actions (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL,
    name TEXT NOT NULL,
    script TEXT NOT NULL,
    timeout INTERVAL NOT NULL DEFAULT '00:00:10'::interval,
    allowed_to_fail BOOLEAN NOT NULL DEFAULT false,
    state SMALLINT NOT NULL DEFAULT 1
);

-- Table: projections.applications
CREATE TABLE IF NOT EXISTS projections.applications (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active'::text,
    app_type TEXT NOT NULL,
    client_id TEXT,
    client_secret TEXT,
    redirect_uris JSONB,
    response_types JSONB,
    grant_types JSONB,
    oidc_app_type TEXT,
    auth_method_type TEXT,
    post_logout_redirect_uris JSONB,
    version INTEGER DEFAULT 1,
    dev_mode BOOLEAN DEFAULT false,
    access_token_type TEXT DEFAULT 'bearer'::text,
    access_token_role_assertion BOOLEAN DEFAULT false,
    id_token_role_assertion BOOLEAN DEFAULT false,
    id_token_userinfo_assertion BOOLEAN DEFAULT false,
    clock_skew INTEGER DEFAULT 0,
    additional_origins JSONB,
    skip_native_app_success_page BOOLEAN DEFAULT false,
    entity_id TEXT,
    metadata_url TEXT,
    metadata TEXT,
    acs_urls JSONB,
    single_logout_url TEXT,
    name_id_format TEXT,
    attribute_statements JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ,
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.auth_requests
CREATE TABLE IF NOT EXISTS projections.auth_requests (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    login_client TEXT NOT NULL,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    state TEXT,
    nonce TEXT,
    scope TEXT[] NOT NULL DEFAULT '{}'::text[],
    audience TEXT[],
    response_type TEXT,
    response_mode TEXT,
    code_challenge TEXT,
    code_challenge_method TEXT,
    prompt TEXT[] DEFAULT '{}'::text[],
    ui_locales TEXT[],
    max_age INTEGER,
    login_hint TEXT,
    hint_user_id TEXT,
    need_refresh_token BOOLEAN DEFAULT false,
    session_id TEXT,
    user_id TEXT,
    auth_time TIMESTAMPTZ,
    auth_methods TEXT[],
    code TEXT,
    issuer TEXT
);

-- Table: projections.authn_keys
CREATE TABLE IF NOT EXISTS projections.authn_keys (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    object_id TEXT NOT NULL,
    expiration TIMESTAMPTZ NOT NULL,
    type INTEGER NOT NULL DEFAULT 0,
    public_key BYTEA NOT NULL
);

-- Table: projections.custom_texts
CREATE TABLE IF NOT EXISTS projections.custom_texts (
    instance_id TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    language TEXT NOT NULL,
    key TEXT NOT NULL,
    text TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL
);

-- Table: projections.domain_policies
CREATE TABLE IF NOT EXISTS projections.domain_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    user_login_must_be_domain BOOLEAN NOT NULL DEFAULT false,
    validate_org_domains BOOLEAN NOT NULL DEFAULT false,
    smtp_sender_address_matches_instance_domain BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.email_configs
CREATE TABLE IF NOT EXISTS projections.email_configs (
    id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255),
    smtp_from VARCHAR(255),
    smtp_from_name VARCHAR(255),
    smtp_reply_to VARCHAR(255),
    smtp_secure BOOLEAN DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: projections.execution_states
CREATE TABLE IF NOT EXISTS projections.execution_states (
    execution_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    state SMALLINT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count SMALLINT NOT NULL DEFAULT 0,
    response JSONB
);

-- Table: projections.executions
CREATE TABLE IF NOT EXISTS projections.executions (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type TEXT NOT NULL,
    event_sequence BIGINT NOT NULL,
    targets JSONB
);

-- Table: projections.idp_login_policy_links
CREATE TABLE IF NOT EXISTS projections.idp_login_policy_links (
    idp_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    owner_type TEXT NOT NULL
);

-- Table: projections.idp_templates
CREATE TABLE IF NOT EXISTS projections.idp_templates (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    name TEXT NOT NULL,
    type INTEGER NOT NULL,
    owner_type TEXT NOT NULL,
    is_creation_allowed BOOLEAN DEFAULT true,
    is_linking_allowed BOOLEAN DEFAULT true,
    is_auto_creation BOOLEAN DEFAULT false,
    is_auto_update BOOLEAN DEFAULT false
);

-- Table: projections.idp_user_links
CREATE TABLE IF NOT EXISTS projections.idp_user_links (
    idp_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    idp_name TEXT NOT NULL,
    provided_user_id TEXT NOT NULL,
    provided_user_name TEXT NOT NULL
);

-- Table: projections.idps
CREATE TABLE IF NOT EXISTS projections.idps (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    name TEXT NOT NULL,
    type INTEGER NOT NULL,
    state INTEGER NOT NULL DEFAULT 1,
    styling_type INTEGER DEFAULT 0,
    is_creation_allowed BOOLEAN DEFAULT true,
    is_linking_allowed BOOLEAN DEFAULT true,
    is_auto_creation BOOLEAN DEFAULT false,
    is_auto_update BOOLEAN DEFAULT false,
    config_data JSONB
);

-- Table: projections.instance_domains
CREATE TABLE IF NOT EXISTS projections.instance_domains (
    instance_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_generated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: projections.instance_members
CREATE TABLE IF NOT EXISTS projections.instance_members (
    user_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}'::text[],
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0,
    resource_owner TEXT NOT NULL
);

-- Table: projections.instance_trusted_domains
CREATE TABLE IF NOT EXISTS projections.instance_trusted_domains (
    instance_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: projections.instances
CREATE TABLE IF NOT EXISTS projections.instances (
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    default_org_id TEXT,
    default_language TEXT,
    state TEXT NOT NULL DEFAULT 'active'::text,
    features JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    instance_id TEXT NOT NULL,
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: projections.label_policies
CREATE TABLE IF NOT EXISTS projections.label_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    primary_color TEXT NOT NULL DEFAULT '#5469d4'::text,
    background_color TEXT NOT NULL DEFAULT '#ffffff'::text,
    warn_color TEXT NOT NULL DEFAULT '#ff3b5b'::text,
    font_color TEXT NOT NULL DEFAULT '#000000'::text,
    primary_color_dark TEXT NOT NULL DEFAULT '#2073c4'::text,
    background_color_dark TEXT NOT NULL DEFAULT '#111827'::text,
    warn_color_dark TEXT NOT NULL DEFAULT '#ff3b5b'::text,
    font_color_dark TEXT NOT NULL DEFAULT '#ffffff'::text,
    logo_url TEXT,
    icon_url TEXT,
    logo_url_dark TEXT,
    icon_url_dark TEXT,
    font_url TEXT,
    hide_login_name_suffix BOOLEAN NOT NULL DEFAULT false,
    error_msg_popup BOOLEAN NOT NULL DEFAULT false,
    disable_watermark BOOLEAN NOT NULL DEFAULT false,
    theme_mode TEXT NOT NULL DEFAULT 'auto'::text,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.lockout_policies
CREATE TABLE IF NOT EXISTS projections.lockout_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    max_password_attempts BIGINT NOT NULL DEFAULT 10,
    max_otp_attempts BIGINT NOT NULL DEFAULT 5,
    show_failures BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.lockout_policies_projection
CREATE TABLE IF NOT EXISTS projections.lockout_policies_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    max_password_attempts INTEGER NOT NULL DEFAULT 5,
    max_otp_attempts INTEGER NOT NULL DEFAULT 5,
    show_failure BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.login_names
CREATE TABLE IF NOT EXISTS projections.login_names (
    user_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    login_name TEXT NOT NULL,
    domain_name TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ,
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.login_policies
CREATE TABLE IF NOT EXISTS projections.login_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    allow_username_password BOOLEAN DEFAULT true,
    allow_register BOOLEAN DEFAULT true,
    allow_external_idp BOOLEAN DEFAULT true,
    force_mfa BOOLEAN DEFAULT false,
    force_mfa_local_only BOOLEAN DEFAULT false,
    password_check_lifetime BIGINT DEFAULT 0,
    external_login_check_lifetime BIGINT DEFAULT 0,
    mfa_init_skip_lifetime BIGINT DEFAULT 0,
    second_factor_check_lifetime BIGINT DEFAULT 0,
    multi_factor_check_lifetime BIGINT DEFAULT 0,
    allow_domain_discovery BOOLEAN DEFAULT true,
    disable_login_with_email BOOLEAN DEFAULT false,
    disable_login_with_phone BOOLEAN DEFAULT false,
    ignore_unknown_usernames BOOLEAN DEFAULT false,
    default_redirect_uri TEXT DEFAULT ''::text,
    is_default BOOLEAN DEFAULT false,
    hide_password_reset BOOLEAN DEFAULT false
);

-- Table: projections.login_policy_factors
CREATE TABLE IF NOT EXISTS projections.login_policy_factors (
    policy_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    factor_type INTEGER NOT NULL,
    is_multi_factor BOOLEAN NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL
);

-- Table: projections.mail_templates
CREATE TABLE IF NOT EXISTS projections.mail_templates (
    aggregate_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    template TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.milestones
CREATE TABLE IF NOT EXISTS projections.milestones (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    milestone_type SMALLINT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    name TEXT NOT NULL,
    reached_date TIMESTAMPTZ,
    pushed_date TIMESTAMPTZ,
    primary_domain TEXT,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL
);

-- Table: projections.notification_policies
CREATE TABLE IF NOT EXISTS projections.notification_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    password_change BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.oidc_settings
CREATE TABLE IF NOT EXISTS projections.oidc_settings (
    aggregate_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    access_token_lifetime BIGINT NOT NULL DEFAULT 43200,
    id_token_lifetime BIGINT NOT NULL DEFAULT 43200,
    refresh_token_idle_expiration BIGINT NOT NULL DEFAULT 1296000,
    refresh_token_expiration BIGINT NOT NULL DEFAULT 2592000
);

-- Table: projections.org_domains
CREATE TABLE IF NOT EXISTS projections.org_domains (
    org_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    validation_type TEXT NOT NULL DEFAULT 'dns'::text,
    validation_code TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    instance_id TEXT NOT NULL DEFAULT 'default-instance'::text,
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: projections.org_members
CREATE TABLE IF NOT EXISTS projections.org_members (
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}'::text[],
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0,
    resource_owner TEXT NOT NULL
);

-- Table: projections.orgs
CREATE TABLE IF NOT EXISTS projections.orgs (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active'::text,
    primary_domain TEXT,
    resource_owner TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ,
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.password_age_policies
CREATE TABLE IF NOT EXISTS projections.password_age_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    max_age_days INTEGER NOT NULL DEFAULT 0,
    expire_warn_days INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.password_complexity_policies
CREATE TABLE IF NOT EXISTS projections.password_complexity_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    min_length INTEGER NOT NULL DEFAULT 8,
    has_uppercase BOOLEAN NOT NULL DEFAULT true,
    has_lowercase BOOLEAN NOT NULL DEFAULT true,
    has_number BOOLEAN NOT NULL DEFAULT true,
    has_symbol BOOLEAN NOT NULL DEFAULT false,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.personal_access_tokens
CREATE TABLE IF NOT EXISTS projections.personal_access_tokens (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{}'::text[],
    expiration_date TIMESTAMPTZ,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.privacy_policies
CREATE TABLE IF NOT EXISTS projections.privacy_policies (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    organization_id TEXT,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    tos_link TEXT,
    privacy_link TEXT,
    help_link TEXT,
    support_email TEXT,
    docs_link TEXT,
    custom_link TEXT,
    custom_link_text TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.project_grant_members
CREATE TABLE IF NOT EXISTS projections.project_grant_members (
    project_id TEXT NOT NULL,
    grant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}'::text[]
);

-- Table: projections.project_grants
CREATE TABLE IF NOT EXISTS projections.project_grants (
    id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    granted_org_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    state SMALLINT NOT NULL DEFAULT 1,
    granted_roles TEXT[] NOT NULL DEFAULT '{}'::text[],
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.project_grants_projection
CREATE TABLE IF NOT EXISTS projections.project_grants_projection (
    id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    granted_org_id TEXT NOT NULL,
    state SMALLINT NOT NULL DEFAULT 0,
    granted_roles TEXT[] NOT NULL DEFAULT '{}'::text[]
);

-- Table: projections.project_members
CREATE TABLE IF NOT EXISTS projections.project_members (
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}'::text[],
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0,
    resource_owner TEXT NOT NULL
);

-- Table: projections.project_roles
CREATE TABLE IF NOT EXISTS projections.project_roles (
    project_id TEXT NOT NULL,
    role_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role_group TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    instance_id TEXT NOT NULL DEFAULT 'default-instance'::text,
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: projections.projects
CREATE TABLE IF NOT EXISTS projections.projects (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    name TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active'::text,
    project_role_assertion BOOLEAN NOT NULL DEFAULT false,
    project_role_check BOOLEAN NOT NULL DEFAULT false,
    has_project_check BOOLEAN NOT NULL DEFAULT false,
    private_labeling_setting TEXT NOT NULL DEFAULT 'unspecified'::text,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ,
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.security_policies
CREATE TABLE IF NOT EXISTS projections.security_policies (
    aggregate_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    resource_owner TEXT NOT NULL,
    enable_iframe_embedding BOOLEAN NOT NULL DEFAULT false,
    allowed_origins TEXT[],
    enable_impersonation BOOLEAN NOT NULL DEFAULT false
);

-- Table: projections.sessions
CREATE TABLE IF NOT EXISTS projections.sessions (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active'::text,
    user_id TEXT,
    user_agent TEXT,
    client_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    terminated_at TIMESTAMPTZ,
    sequence BIGINT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    tokens JSONB DEFAULT '[]'::jsonb,
    factors JSONB DEFAULT '[]'::jsonb,
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    oidc_data JSONB,
    termination_reason TEXT,
    logout_method TEXT,
    resource_owner TEXT
);

-- Table: projections.sms_configs
CREATE TABLE IF NOT EXISTS projections.sms_configs (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    description TEXT,
    state INTEGER NOT NULL DEFAULT 1,
    provider_type TEXT NOT NULL DEFAULT 'twilio'::text,
    twilio_sid TEXT,
    twilio_sender_number TEXT,
    twilio_verify_service_sid TEXT,
    http_endpoint TEXT
);

-- Table: projections.smtp_configs
CREATE TABLE IF NOT EXISTS projections.smtp_configs (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL,
    change_date TIMESTAMPTZ NOT NULL,
    sequence BIGINT NOT NULL,
    description TEXT,
    state INTEGER NOT NULL DEFAULT 1,
    tls BOOLEAN NOT NULL DEFAULT true,
    sender_address TEXT NOT NULL,
    sender_name TEXT,
    reply_to_address TEXT,
    host TEXT NOT NULL,
    smtp_user TEXT
);

-- Table: projections.user_addresses
CREATE TABLE IF NOT EXISTS projections.user_addresses (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    locality VARCHAR(255),
    postal_code VARCHAR(20),
    region VARCHAR(255),
    street_address VARCHAR(500),
    formatted_address TEXT,
    address_type VARCHAR(50) DEFAULT 'primary'::character varying,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: projections.user_auth_methods
CREATE TABLE IF NOT EXISTS projections.user_auth_methods (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    method_type TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active'::text,
    token_id TEXT,
    public_key BYTEA,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.user_grants
CREATE TABLE IF NOT EXISTS projections.user_grants (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    state SMALLINT NOT NULL DEFAULT 1,
    roles TEXT[] NOT NULL DEFAULT '{}'::text[],
    creation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Table: projections.user_metadata
CREATE TABLE IF NOT EXISTS projections.user_metadata (
    id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    metadata_key VARCHAR(255) NOT NULL,
    metadata_value JSONB NOT NULL,
    metadata_type VARCHAR(50) DEFAULT 'custom'::character varying,
    scope VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    change_date TIMESTAMPTZ,
    sequence BIGINT NOT NULL DEFAULT 0,
    resource_owner TEXT
);

-- Table: projections.users
CREATE TABLE IF NOT EXISTS projections.users (
    id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    resource_owner VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMPTZ,
    phone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT false,
    phone_verified_at TIMESTAMPTZ,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    nickname VARCHAR(255),
    preferred_language VARCHAR(10),
    gender VARCHAR(50),
    avatar_url TEXT,
    preferred_login_name VARCHAR(255),
    login_names TEXT[],
    state VARCHAR(50) NOT NULL DEFAULT 'active'::character varying,
    user_type VARCHAR(50) NOT NULL DEFAULT 'human'::character varying,
    password_hash TEXT,
    password_changed_at TIMESTAMPTZ,
    password_change_required BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    change_date TIMESTAMPTZ,
    sequence BIGINT NOT NULL DEFAULT 0
);

