-- Migration: 002_33 - Update project_roles_projection for multi-tenant support
-- Description: Add instance_id, change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment

-- Step 1: Add instance_id column if not exists
ALTER TABLE project_roles_projection 
ADD COLUMN IF NOT EXISTS instance_id TEXT NOT NULL DEFAULT 'default-instance';

-- Step 2: Add change_date column if not exists
ALTER TABLE project_roles_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Drop existing primary key
ALTER TABLE project_roles_projection DROP CONSTRAINT IF EXISTS project_roles_projection_pkey;

-- Step 4: Add new composite primary key (instance_id, project_id, role_key)
ALTER TABLE project_roles_projection 
ADD PRIMARY KEY (instance_id, project_id, role_key);

-- Step 5: Update project_id index to include instance_id
DROP INDEX IF EXISTS idx_project_roles_project_id;
CREATE INDEX idx_project_roles_project_id 
ON project_roles_projection(instance_id, project_id);

-- Step 6: Update role_key index to include instance_id
DROP INDEX IF EXISTS idx_project_roles_role_key;
CREATE INDEX idx_project_roles_role_key 
ON project_roles_projection(instance_id, project_id, role_key);

-- Step 7: Update role_group index to include instance_id
DROP INDEX IF EXISTS idx_project_roles_group;
CREATE INDEX idx_project_roles_group 
ON project_roles_projection(instance_id, role_group) WHERE role_group IS NOT NULL;

-- Step 8: Update display_name index to include instance_id
DROP INDEX IF EXISTS idx_project_roles_display_name;
CREATE INDEX idx_project_roles_display_name 
ON project_roles_projection(instance_id, project_id, display_name);

-- Step 9: Add temporal indexes for auditing
CREATE INDEX IF NOT EXISTS idx_project_roles_change_date 
ON project_roles_projection(change_date DESC);

CREATE INDEX IF NOT EXISTS idx_project_roles_created_at 
ON project_roles_projection(created_at DESC);

-- Comment
COMMENT ON COLUMN project_roles_projection.instance_id IS 'Instance ID for multi-tenant isolation';
COMMENT ON COLUMN project_roles_projection.change_date IS 'Timestamp of last event that changed this role';
