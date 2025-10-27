-- Migration: 002_58 - Create projections schema and migrate all projection tables
-- Description: Move all projection tables from public schema to projections schema
--              Rename tables from *_projection to match Zitadel Go pattern
-- Date: 2025-10-26

-- Create projections schema
CREATE SCHEMA IF NOT EXISTS projections;

-- ============================================================================
-- Move and rename projection tables from public to projections schema
-- Pattern: public.<table>_projection -> projections.<table>
-- ============================================================================

-- Core projections
ALTER TABLE IF EXISTS users_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.users_projection RENAME TO users;

ALTER TABLE IF EXISTS orgs_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.orgs_projection RENAME TO orgs;

ALTER TABLE IF EXISTS projects_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.projects_projection RENAME TO projects;

ALTER TABLE IF EXISTS applications_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.applications_projection RENAME TO applications;

ALTER TABLE IF EXISTS instances_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.instances_projection RENAME TO instances;

-- Domain projections
ALTER TABLE IF EXISTS org_domains_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.org_domains_projection RENAME TO org_domains;

ALTER TABLE IF EXISTS instance_domains_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.instance_domains_projection RENAME TO instance_domains;

ALTER TABLE IF EXISTS instance_trusted_domains_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.instance_trusted_domains_projection RENAME TO instance_trusted_domains;

-- Role and member projections
ALTER TABLE IF EXISTS project_roles_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.project_roles_projection RENAME TO project_roles;

ALTER TABLE IF EXISTS project_members_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.project_members_projection RENAME TO project_members;

ALTER TABLE IF EXISTS project_grant_members_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.project_grant_members_projection RENAME TO project_grant_members;

-- Session projections
ALTER TABLE IF EXISTS sessions_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.sessions_projection RENAME TO sessions;

ALTER TABLE IF EXISTS auth_requests_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.auth_requests_projection RENAME TO auth_requests;

-- Action projections
ALTER TABLE IF EXISTS actions_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.actions_projection RENAME TO actions;

ALTER TABLE IF EXISTS action_flows_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.action_flows_projection RENAME TO action_flows;

ALTER TABLE IF EXISTS executions_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.executions_projection RENAME TO executions;

ALTER TABLE IF EXISTS execution_states_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.execution_states_projection RENAME TO execution_states;

-- User-related projections
ALTER TABLE IF EXISTS login_names_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.login_names_projection RENAME TO login_names;

ALTER TABLE IF EXISTS user_auth_methods_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.user_auth_methods_projection RENAME TO user_auth_methods;

ALTER TABLE IF EXISTS personal_access_tokens_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.personal_access_tokens_projection RENAME TO personal_access_tokens;

-- Policy projections
ALTER TABLE IF EXISTS lockout_policies_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.lockout_policies_projection RENAME TO lockout_policies;

-- Grant projections  
ALTER TABLE IF EXISTS project_grants_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.project_grants_projection RENAME TO project_grants;

ALTER TABLE IF EXISTS user_grants_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.user_grants_projection RENAME TO user_grants;

-- Milestone projections
ALTER TABLE IF EXISTS milestones_projection SET SCHEMA projections;
ALTER TABLE IF EXISTS projections.milestones_projection RENAME TO milestones;

-- ============================================================================
-- User detail tables (related to users projection)
-- ============================================================================

ALTER TABLE IF EXISTS user_addresses SET SCHEMA projections;
ALTER TABLE IF EXISTS user_metadata SET SCHEMA projections;

-- ============================================================================
-- Email and SMS configuration tables
-- ============================================================================

ALTER TABLE IF EXISTS email_configs SET SCHEMA projections;
ALTER TABLE IF EXISTS sms_configs SET SCHEMA projections;

-- ============================================================================
-- Custom text projections
-- ============================================================================

ALTER TABLE IF EXISTS custom_texts SET SCHEMA projections;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON SCHEMA projections IS 'CQRS read model projections - query-side tables built from events';

-- Verify migration
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'projections';
    
    RAISE NOTICE 'Migration complete: % tables in projections schema', table_count;
END $$;
