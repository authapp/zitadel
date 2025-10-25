-- Create project_grant_members projection table
-- Migration: 002_55

CREATE TABLE IF NOT EXISTS projections.project_grant_members (
  project_id TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, grant_id, user_id, instance_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS project_grant_members_project_id_idx 
  ON projections.project_grant_members (project_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grant_members_grant_id_idx 
  ON projections.project_grant_members (grant_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grant_members_user_id_idx 
  ON projections.project_grant_members (user_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grant_members_resource_owner_idx 
  ON projections.project_grant_members (resource_owner, instance_id);
