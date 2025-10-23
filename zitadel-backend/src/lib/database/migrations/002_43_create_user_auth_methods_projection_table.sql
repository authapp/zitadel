-- Migration: 002_43 - Create user_auth_methods_projection table
-- Description: Track user authentication methods (password, OTP, U2F, passwordless)
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: CRITICAL

CREATE TABLE IF NOT EXISTS user_auth_methods_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    method_type TEXT NOT NULL,  -- 'password', 'otp', 'u2f', 'passwordless', 'totp'
    state TEXT NOT NULL DEFAULT 'active',
    token_id TEXT,
    public_key BYTEA,
    name TEXT,  -- User-friendly name for the method
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Foreign key to users
ALTER TABLE user_auth_methods_projection 
ADD CONSTRAINT fk_user_auth_methods_user 
  FOREIGN KEY (instance_id, user_id) 
  REFERENCES users_projection(instance_id, id) 
  ON DELETE CASCADE;

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_id 
ON user_auth_methods_projection(instance_id, user_id);

-- Index for method type queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_type 
ON user_auth_methods_projection(instance_id, method_type);

-- Index for state queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_state 
ON user_auth_methods_projection(instance_id, state);

-- Composite index for user + type queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_type 
ON user_auth_methods_projection(instance_id, user_id, method_type);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_change_date 
ON user_auth_methods_projection(change_date DESC);

-- Comments
COMMENT ON TABLE user_auth_methods_projection IS 'Tracks all authentication methods configured for users';
COMMENT ON COLUMN user_auth_methods_projection.method_type IS 'Type of auth method: password, otp, u2f, passwordless, totp';
COMMENT ON COLUMN user_auth_methods_projection.state IS 'State of auth method: active, inactive';
COMMENT ON COLUMN user_auth_methods_projection.token_id IS 'Token ID for OTP/U2F methods';
COMMENT ON COLUMN user_auth_methods_projection.public_key IS 'Public key for U2F/passwordless methods';
