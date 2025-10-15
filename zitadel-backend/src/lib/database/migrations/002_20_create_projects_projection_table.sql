-- Migration: 002_20 - Create projects projection table
-- Description: Store project read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS projects_projection (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    project_role_assertion BOOLEAN NOT NULL DEFAULT FALSE,
    project_role_check BOOLEAN NOT NULL DEFAULT FALSE,
    has_project_check BOOLEAN NOT NULL DEFAULT FALSE,
    private_labeling_setting TEXT NOT NULL DEFAULT 'unspecified',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Index on resource_owner for listing org projects
CREATE INDEX IF NOT EXISTS idx_projects_resource_owner ON projects_projection(resource_owner);

-- Index on state for filtering
CREATE INDEX IF NOT EXISTS idx_projects_state ON projects_projection(state);

-- Index on name for search
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects_projection(name);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects_projection(created_at DESC);

-- Full-text search index on name
CREATE INDEX IF NOT EXISTS idx_projects_name_fts ON projects_projection USING gin(to_tsvector('english', name));

-- Comment
COMMENT ON TABLE projects_projection IS 'Read model projection for projects';
