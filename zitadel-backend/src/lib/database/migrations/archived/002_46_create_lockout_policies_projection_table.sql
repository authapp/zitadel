-- Migration: 002_46 - Create lockout_policies_projection table
-- Description: Configure account lockout policies
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: MEDIUM

CREATE TABLE IF NOT EXISTS lockout_policies_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    max_password_attempts INTEGER NOT NULL DEFAULT 5,
    max_otp_attempts INTEGER NOT NULL DEFAULT 5,
    show_failure BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Index for resource owner lookups
CREATE INDEX IF NOT EXISTS idx_lockout_policies_resource_owner 
ON lockout_policies_projection(instance_id, resource_owner);

-- Index for default policy lookups
CREATE INDEX IF NOT EXISTS idx_lockout_policies_is_default 
ON lockout_policies_projection(instance_id, is_default) 
WHERE is_default = true;

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_lockout_policies_change_date 
ON lockout_policies_projection(change_date DESC);

-- Comments
COMMENT ON TABLE lockout_policies_projection IS 'Account lockout policies for failed authentication attempts';
COMMENT ON COLUMN lockout_policies_projection.max_password_attempts IS 'Maximum failed password attempts before lockout';
COMMENT ON COLUMN lockout_policies_projection.max_otp_attempts IS 'Maximum failed OTP attempts before lockout';
COMMENT ON COLUMN lockout_policies_projection.show_failure IS 'Whether to show failure details to user';
COMMENT ON COLUMN lockout_policies_projection.is_default IS 'Whether this is the default instance policy';
