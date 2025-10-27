-- Migration: 002_50 - Create quotas table
-- Description: Track resource usage quotas and limits per instance/org
-- Date: 2025-10-23
-- Phase: Immediate - Resource Management
-- Priority: MEDIUM

CREATE TABLE IF NOT EXISTS quotas (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,  -- instance or org ID
    unit TEXT NOT NULL,  -- 'requests_all_authenticated', 'actions_all_runs_seconds', etc.
    amount BIGINT NOT NULL DEFAULT 0,  -- Quota limit
    limit_usage BOOLEAN NOT NULL DEFAULT false,  -- Whether to enforce limit
    from_anchor TIMESTAMPTZ NOT NULL,  -- Start of quota period
    interval INTERVAL,  -- Quota reset interval (e.g., '1 month')
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Index for querying by resource owner
CREATE INDEX IF NOT EXISTS idx_quotas_resource_owner 
ON quotas(instance_id, resource_owner);

-- Index for querying by unit type
CREATE INDEX IF NOT EXISTS idx_quotas_unit 
ON quotas(instance_id, unit);

-- Index for querying active quotas
CREATE INDEX IF NOT EXISTS idx_quotas_limit_usage 
ON quotas(instance_id, limit_usage) WHERE limit_usage = true;

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_quotas_change_date 
ON quotas(change_date DESC);

-- Comments
COMMENT ON TABLE quotas IS 'Resource usage quotas and limits per instance/organization';
COMMENT ON COLUMN quotas.unit IS 'Type of resource being limited (requests, actions, users, etc.)';
COMMENT ON COLUMN quotas.amount IS 'Maximum allowed amount for the quota period';
COMMENT ON COLUMN quotas.limit_usage IS 'Whether to actively enforce this quota limit';
COMMENT ON COLUMN quotas.from_anchor IS 'Start timestamp for quota period calculation';
COMMENT ON COLUMN quotas.interval IS 'Time period for quota reset (e.g., monthly, yearly)';

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS quota_notifications (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    quota_id TEXT NOT NULL,
    call_url TEXT NOT NULL,  -- Webhook URL to call when threshold reached
    percent INTEGER NOT NULL,  -- Percentage threshold (e.g., 80, 100)
    repeat BOOLEAN NOT NULL DEFAULT false,  -- Whether to repeat notification
    latest_notified_at TIMESTAMPTZ,  -- Last time notification was sent
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id),
    FOREIGN KEY (instance_id, quota_id) REFERENCES quotas(instance_id, id) ON DELETE CASCADE
);

-- Index for querying notifications by quota
CREATE INDEX IF NOT EXISTS idx_quota_notifications_quota 
ON quota_notifications(instance_id, quota_id);

-- Index for querying by percentage threshold
CREATE INDEX IF NOT EXISTS idx_quota_notifications_percent 
ON quota_notifications(percent);

COMMENT ON TABLE quota_notifications IS 'Webhook notifications for quota threshold alerts';
COMMENT ON COLUMN quota_notifications.percent IS 'Percentage of quota that triggers notification (0-100)';
COMMENT ON COLUMN quota_notifications.repeat IS 'Whether to send repeated notifications';
