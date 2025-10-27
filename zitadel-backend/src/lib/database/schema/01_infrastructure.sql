-- =============================================================================
-- ZITADEL Backend - Infrastructure Schema
-- =============================================================================
-- Description: Core infrastructure tables (NOT projections)
-- Schema: public and projections
-- =============================================================================

-- Create projections schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS projections;

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

-- ============================================================================
-- EVENT STORE INFRASTRUCTURE
-- ============================================================================

-- Table: public.events
-- Description: Core event store table (Zitadel Go v2 compatible schema)
CREATE TABLE IF NOT EXISTS public.events (
    instance_id TEXT NOT NULL,
    owner TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    revision TEXT NOT NULL DEFAULT '1',
    creator TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    aggregate_version BIGINT NOT NULL,
    in_tx_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position BIGINT NOT NULL,
    sequence BIGINT,
    previous_aggregate_sequence BIGINT,
    previous_aggregate_type_sequence BIGINT,
    PRIMARY KEY (instance_id, aggregate_type, aggregate_id, aggregate_version)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS TRACKING
-- ============================================================================

-- Table: public.unique_constraints  
-- Description: Track unique constraints across aggregates
CREATE TABLE IF NOT EXISTS public.unique_constraints (
    instance_id TEXT NOT NULL,
    unique_type TEXT NOT NULL,
    unique_field TEXT NOT NULL,
    PRIMARY KEY (instance_id, unique_type, unique_field)
);

-- ============================================================================
-- SCHEMA MIGRATIONS
-- ============================================================================

-- Table: public.schema_migrations
-- Description: Track applied database migrations
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- ============================================================================
-- ENCRYPTION & SECURITY
-- ============================================================================

-- Table: public.encryption_keys
-- Description: Store encryption keys for crypto operations
CREATE TABLE IF NOT EXISTS public.encryption_keys (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    key_data BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    identifier TEXT UNIQUE
);

-- ============================================================================
-- NOTIFICATION INFRASTRUCTURE
-- ============================================================================

-- Table: public.email_configs
-- Description: SMTP email configuration
CREATE TABLE IF NOT EXISTS public.email_configs (
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_username TEXT,
    smtp_password TEXT,
    smtp_tls BOOLEAN DEFAULT true,
    sender_address TEXT,
    sender_name TEXT,
    reply_to_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (instance_id, resource_owner)
);

-- Table: public.sms_configs
-- Description: SMS provider configuration
CREATE TABLE IF NOT EXISTS public.sms_configs (
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    provider_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (instance_id, resource_owner)
);

-- Table: public.notification_providers
-- Description: Notification provider configurations
CREATE TABLE IF NOT EXISTS public.notification_providers (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    config JSONB,
    state TEXT NOT NULL DEFAULT 'inactive',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.notification_config_changes
-- Description: Track notification configuration changes
CREATE TABLE IF NOT EXISTS public.notification_config_changes (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    change_type TEXT NOT NULL,
    config_data JSONB,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- QUOTA MANAGEMENT
-- ============================================================================

-- Table: public.quotas
-- Description: Resource quotas per instance/org
CREATE TABLE IF NOT EXISTS public.quotas (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    unit TEXT NOT NULL,
    amount BIGINT NOT NULL,
    from_anchor TIMESTAMP WITH TIME ZONE,
    interval_duration TEXT,
    limit_usage BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.quota_notifications
-- Description: Quota usage notifications
CREATE TABLE IF NOT EXISTS public.quota_notifications (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    quota_id TEXT NOT NULL,
    percent SMALLINT NOT NULL,
    call_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROJECTION SYSTEM SUPPORT
-- ============================================================================

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
-- ENHANCED TRACKING (Optional - for debugging)
-- ============================================================================

-- Table: public.enhanced_tracking_data
-- Description: Enhanced tracking for debugging
CREATE TABLE IF NOT EXISTS public.enhanced_tracking_data (
    id TEXT PRIMARY KEY,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.enhanced_tracking_data_2
-- Description: Additional enhanced tracking
CREATE TABLE IF NOT EXISTS public.enhanced_tracking_data_2 (
    id TEXT PRIMARY KEY,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- END OF INFRASTRUCTURE SCHEMA
-- ============================================================================
