-- Migration: Create Milestones Table
-- Description: Add table for tracking system, organization, and project milestones
-- Version: 002_53
-- Date: 2025-10-23

-- Milestones table: Tracks important system/org/project milestones
CREATE TABLE IF NOT EXISTS projections.milestones (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    
    -- Milestone type and scope
    milestone_type SMALLINT NOT NULL, -- 1=instance, 2=org, 3=project, 4=user
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    
    -- Milestone details
    name TEXT NOT NULL,
    reached_date TIMESTAMPTZ,
    pushed_date TIMESTAMPTZ, -- When milestone was pushed/triggered
    
    -- Primary state
    primary_domain TEXT,
    
    -- Metadata
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL,
    
    PRIMARY KEY (instance_id, id)
);

-- Indexes for milestones
CREATE INDEX IF NOT EXISTS idx_milestones_aggregate 
    ON projections.milestones(instance_id, aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_milestones_type 
    ON projections.milestones(instance_id, milestone_type);

CREATE INDEX IF NOT EXISTS idx_milestones_reached 
    ON projections.milestones(instance_id, reached_date DESC)
    WHERE reached_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_milestones_name 
    ON projections.milestones(instance_id, name);

CREATE INDEX IF NOT EXISTS idx_milestones_unreached 
    ON projections.milestones(instance_id, milestone_type, reached_date)
    WHERE reached_date IS NULL;

-- Milestone types enum view for reference
CREATE OR REPLACE VIEW projections.milestone_types AS
SELECT 1 AS type_id, 'INSTANCE' AS type_name
UNION ALL
SELECT 2, 'ORGANIZATION'
UNION ALL
SELECT 3, 'PROJECT'
UNION ALL
SELECT 4, 'USER';

-- Common milestone names (for reference)
CREATE OR REPLACE VIEW projections.common_milestones AS
SELECT 'instance_created' AS milestone_name, 1 AS milestone_type, 'Instance first created' AS description
UNION ALL
SELECT 'instance_custom_domain', 1, 'Custom domain configured'
UNION ALL
SELECT 'org_created', 2, 'Organization created'
UNION ALL
SELECT 'org_custom_domain', 2, 'Organization custom domain added'
UNION ALL
SELECT 'org_smtp_configured', 2, 'SMTP configuration completed'
UNION ALL
SELECT 'project_created', 3, 'Project created'
UNION ALL
SELECT 'project_app_added', 3, 'First application added to project'
UNION ALL
SELECT 'project_role_added', 3, 'First role added to project'
UNION ALL
SELECT 'user_created', 4, 'User account created'
UNION ALL
SELECT 'user_email_verified', 4, 'User email verified'
UNION ALL
SELECT 'user_phone_verified', 4, 'User phone verified'
UNION ALL
SELECT 'user_mfa_enabled', 4, 'Multi-factor authentication enabled'
UNION ALL
SELECT 'user_first_login', 4, 'User first successful login';

-- Comments
COMMENT ON TABLE projections.milestones IS 'Tracks achievement of important system/org/project/user milestones';
COMMENT ON COLUMN projections.milestones.milestone_type IS '1=instance, 2=org, 3=project, 4=user';
COMMENT ON COLUMN projections.milestones.reached_date IS 'When the milestone was actually achieved';
COMMENT ON COLUMN projections.milestones.pushed_date IS 'When the milestone was triggered/pushed';
COMMENT ON VIEW projections.milestone_types IS 'Reference view for milestone type codes';
COMMENT ON VIEW projections.common_milestones IS 'Reference view for common milestone names and descriptions';
