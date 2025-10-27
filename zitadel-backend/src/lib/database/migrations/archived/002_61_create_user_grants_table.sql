-- Create user_grants projection table
-- Migration: 002_61
-- Description: Create table for user grants (user permissions on projects)
-- Date: 2025-10-27

CREATE TABLE IF NOT EXISTS projections.user_grants (
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
  ON projections.user_grants (user_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_id_idx 
  ON projections.user_grants (project_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_grant_id_idx 
  ON projections.user_grants (project_grant_id, instance_id)
  WHERE project_grant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_grants_resource_owner_idx 
  ON projections.user_grants (resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_state_idx 
  ON projections.user_grants (state, instance_id);
