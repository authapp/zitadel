-- Migration: 002_21 - Create project roles projection table
-- Description: Store project role read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS project_roles_projection (
    project_id TEXT NOT NULL,
    role_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role_group TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Primary key on project_id and role_key
    PRIMARY KEY (project_id, role_key)
    
    -- Note: No foreign key to avoid race conditions between projections
    -- CONSTRAINT fk_project_roles_project_id FOREIGN KEY (project_id) REFERENCES projects_projection(id) ON DELETE CASCADE
);

-- Index on project_id for listing roles
CREATE INDEX IF NOT EXISTS idx_project_roles_project_id ON project_roles_projection(project_id);

-- Index on role_key for lookups
CREATE INDEX IF NOT EXISTS idx_project_roles_role_key ON project_roles_projection(role_key);

-- Index on role_group for filtering
CREATE INDEX IF NOT EXISTS idx_project_roles_group ON project_roles_projection(role_group) WHERE role_group IS NOT NULL;

-- Index on display_name for search
CREATE INDEX IF NOT EXISTS idx_project_roles_display_name ON project_roles_projection(display_name);

-- Comment
COMMENT ON TABLE project_roles_projection IS 'Read model projection for project roles';
