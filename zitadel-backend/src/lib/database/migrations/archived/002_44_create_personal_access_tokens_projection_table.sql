-- Migration: 002_44 - Create personal_access_tokens_projection table
-- Description: Track Personal Access Tokens (PATs) for API access
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: CRITICAL

CREATE TABLE IF NOT EXISTS personal_access_tokens_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    expiration_date TIMESTAMPTZ,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Foreign key to users
ALTER TABLE personal_access_tokens_projection 
ADD CONSTRAINT fk_personal_access_tokens_user 
  FOREIGN KEY (instance_id, user_id) 
  REFERENCES users_projection(instance_id, id) 
  ON DELETE CASCADE;

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_user_id 
ON personal_access_tokens_projection(instance_id, user_id);

-- Index for token hash lookups (for authentication)
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_hash 
ON personal_access_tokens_projection(token_hash);

-- Index for expiration date (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_expiration 
ON personal_access_tokens_projection(instance_id, expiration_date);

-- Index for last used (for activity monitoring)
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_last_used 
ON personal_access_tokens_projection(instance_id, last_used DESC);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_change_date 
ON personal_access_tokens_projection(change_date DESC);

-- Comments
COMMENT ON TABLE personal_access_tokens_projection IS 'Personal Access Tokens for API authentication';
COMMENT ON COLUMN personal_access_tokens_projection.token_hash IS 'Hashed token value for secure storage';
COMMENT ON COLUMN personal_access_tokens_projection.scopes IS 'OAuth scopes granted to this token';
COMMENT ON COLUMN personal_access_tokens_projection.expiration_date IS 'When this token expires (NULL = never)';
COMMENT ON COLUMN personal_access_tokens_projection.last_used IS 'Last time this token was used for authentication';
