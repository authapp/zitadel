-- Create login names projection table
-- This table stores denormalized login names for fast user lookups

CREATE TABLE IF NOT EXISTS login_names_projection (
  user_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  resource_owner TEXT NOT NULL,
  login_name TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite primary key: instance + login_name must be unique
  PRIMARY KEY (instance_id, login_name)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_login_names_user_id ON login_names_projection(user_id);

-- Index for instance lookups
CREATE INDEX IF NOT EXISTS idx_login_names_instance_id ON login_names_projection(instance_id);

-- Index for resource owner (org) lookups
CREATE INDEX IF NOT EXISTS idx_login_names_resource_owner ON login_names_projection(resource_owner);

-- Index for domain name lookups
CREATE INDEX IF NOT EXISTS idx_login_names_domain_name ON login_names_projection(domain_name);

-- Index for primary login name queries
CREATE INDEX IF NOT EXISTS idx_login_names_is_primary ON login_names_projection(is_primary) WHERE is_primary = TRUE;

-- Composite index for user + instance queries
CREATE INDEX IF NOT EXISTS idx_login_names_user_instance ON login_names_projection(user_id, instance_id);

-- Index for fast login name lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_login_names_lookup ON login_names_projection(instance_id, login_name);
