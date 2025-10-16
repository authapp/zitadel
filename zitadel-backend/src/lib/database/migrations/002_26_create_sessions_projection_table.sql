-- Create sessions projection table
-- This table stores the read model for session queries

CREATE TABLE IF NOT EXISTS sessions_projection (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  user_id TEXT,
  user_agent TEXT,
  client_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at TIMESTAMPTZ,
  sequence BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  tokens JSONB DEFAULT '[]',
  factors JSONB DEFAULT '[]'
);

-- Index for instance lookups
CREATE INDEX IF NOT EXISTS idx_sessions_instance_id ON sessions_projection(instance_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions_projection(user_id);

-- Index for state queries
CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions_projection(state);

-- Composite index for active sessions by user
CREATE INDEX IF NOT EXISTS idx_sessions_user_state ON sessions_projection(user_id, state);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions_projection(created_at DESC);

-- Index for updated_at sorting
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions_projection(updated_at DESC);

-- Composite index for instance + user queries
CREATE INDEX IF NOT EXISTS idx_sessions_instance_user ON sessions_projection(instance_id, user_id);
