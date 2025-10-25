-- Create project_grants projection table
-- Migration: 002_54

CREATE TABLE IF NOT EXISTS projections.project_grants (
  id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  granted_org_id TEXT NOT NULL,
  state SMALLINT NOT NULL DEFAULT 0,
  granted_roles TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, instance_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS project_grants_project_id_idx 
  ON projections.project_grants (project_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grants_granted_org_id_idx 
  ON projections.project_grants (granted_org_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grants_resource_owner_idx 
  ON projections.project_grants (resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS project_grants_state_idx 
  ON projections.project_grants (state, instance_id);
