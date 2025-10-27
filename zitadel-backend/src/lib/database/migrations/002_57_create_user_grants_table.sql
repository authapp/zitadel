-- Create user_grants projection table (OLD naming convention)
-- Migration: 002_57
-- Description: Create user grants table to track user access to projects
-- Note: Will be renamed to projections.user_grants by migration 002_58
-- Date: 2025-10-27

CREATE TABLE IF NOT EXISTS user_grants_projection (
  id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  project_grant_id TEXT,
  state SMALLINT NOT NULL DEFAULT 1,
  roles TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, instance_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS user_grants_user_id_idx 
  ON user_grants_projection (user_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_id_idx 
  ON user_grants_projection (project_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_grant_id_idx 
  ON user_grants_projection (project_grant_id, instance_id)
  WHERE project_grant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_grants_resource_owner_idx 
  ON user_grants_projection (resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_state_idx 
  ON user_grants_projection (state, instance_id);
