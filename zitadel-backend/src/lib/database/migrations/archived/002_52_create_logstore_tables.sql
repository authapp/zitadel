-- Migration: Create Logstore Tables
-- Description: Add tables for comprehensive audit logging beyond events
-- Version: 002_52
-- Date: 2025-10-23

-- Create logstore schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS logstore;

-- Logstore table: Comprehensive audit trail
-- Note: Partitioning can be added later for scale; starting simple for reliability
CREATE TABLE IF NOT EXISTS logstore.logs (
    instance_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Occurrence metadata
    occurrence_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_sequence BIGINT,
    event_type TEXT,
    
    -- User context
    user_id TEXT,
    resource_owner TEXT NOT NULL,
    
    -- Request metadata
    protocol SMALLINT NOT NULL DEFAULT 0, -- 0=unknown, 1=http, 2=grpc, 3=graphql
    request_url TEXT,
    request_method TEXT,
    request_headers JSONB,
    
    -- Response metadata
    response_status INTEGER,
    response_time_ms INTEGER,
    
    -- Additional data
    log_level SMALLINT NOT NULL DEFAULT 1, -- 1=info, 2=warn, 3=error, 4=debug
    message TEXT,
    metadata JSONB,
    
    PRIMARY KEY (instance_id, log_id)
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_logs_date 
    ON logstore.logs(instance_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_logs_aggregate 
    ON logstore.logs(instance_id, aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_logs_user 
    ON logstore.logs(instance_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_event 
    ON logstore.logs(instance_id, event_type, event_sequence)
    WHERE event_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_level 
    ON logstore.logs(instance_id, log_level, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_logs_resource_owner 
    ON logstore.logs(instance_id, resource_owner, log_date DESC);

-- Execution logs table: Detailed logs for action executions
CREATE TABLE IF NOT EXISTS logstore.execution_logs (
    instance_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Log details
    log_level SMALLINT NOT NULL DEFAULT 1,
    message TEXT NOT NULL,
    stack_trace TEXT,
    
    -- Context
    metadata JSONB,
    
    PRIMARY KEY (instance_id, log_id)
);

-- Indexes for execution_logs
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution 
    ON logstore.execution_logs(instance_id, execution_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_execution_logs_target 
    ON logstore.execution_logs(instance_id, target_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_execution_logs_level 
    ON logstore.execution_logs(instance_id, log_level, log_date DESC);

-- Quota logs table: Track quota usage and violations
CREATE TABLE IF NOT EXISTS logstore.quota_logs (
    instance_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    quota_id TEXT NOT NULL,
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Usage tracking
    previous_usage BIGINT NOT NULL,
    current_usage BIGINT NOT NULL,
    quota_limit BIGINT NOT NULL,
    
    -- Context
    resource_owner TEXT NOT NULL,
    user_id TEXT,
    action TEXT, -- What action triggered the quota check
    
    -- Result
    allowed BOOLEAN NOT NULL,
    threshold_exceeded BOOLEAN NOT NULL DEFAULT false,
    
    PRIMARY KEY (instance_id, log_id)
);

-- Indexes for quota_logs
CREATE INDEX IF NOT EXISTS idx_quota_logs_quota 
    ON logstore.quota_logs(instance_id, quota_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_quota_logs_user 
    ON logstore.quota_logs(instance_id, user_id, log_date DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quota_logs_violations 
    ON logstore.quota_logs(instance_id, log_date DESC)
    WHERE NOT allowed;

-- Comments
COMMENT ON SCHEMA logstore IS 'Comprehensive audit logging system';
COMMENT ON TABLE logstore.logs IS 'Main audit trail for comprehensive system logging';
COMMENT ON TABLE logstore.execution_logs IS 'Detailed logs for action/workflow executions';
COMMENT ON TABLE logstore.quota_logs IS 'Quota usage tracking and violation logs';
