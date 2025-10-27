-- =============================================================================
-- ZITADEL Backend - Constraints and Unique Indexes
-- =============================================================================
-- Description: UNIQUE constraints required for projection ON CONFLICT clauses
-- Note: These are implemented as UNIQUE indexes for better performance
-- =============================================================================

-- ============================================================================
-- PROJECTION TABLE UNIQUE CONSTRAINTS (Required for ON CONFLICT)
-- ============================================================================

-- Org Members: Unique per (org_id, user_id, instance_id)
CREATE UNIQUE INDEX IF NOT EXISTS org_members_unique_member 
  ON projections.org_members (org_id, user_id, instance_id);

-- Project Members: Unique per (project_id, user_id, instance_id)
CREATE UNIQUE INDEX IF NOT EXISTS project_members_unique_member 
  ON projections.project_members (project_id, user_id, instance_id);

-- Project Grant Members: Unique per (project_id, grant_id, user_id, instance_id)  
CREATE UNIQUE INDEX IF NOT EXISTS project_grant_members_unique_member 
  ON projections.project_grant_members (project_id, grant_id, user_id, instance_id);

-- Instance Members: Unique per (instance_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS instance_members_unique_member 
  ON projections.instance_members (instance_id, user_id);

-- IDP User Links: Unique per (instance_id, user_id, idp_id)
CREATE UNIQUE INDEX IF NOT EXISTS idp_user_links_unique_link 
  ON projections.idp_user_links (instance_id, user_id, idp_id);

-- IDP Login Policy Links: Unique per (instance_id, resource_owner, idp_id)
CREATE UNIQUE INDEX IF NOT EXISTS idp_login_policy_links_unique_link 
  ON projections.idp_login_policy_links (instance_id, resource_owner, idp_id);

-- Instance Domains: Unique per (instance_id, domain)
CREATE UNIQUE INDEX IF NOT EXISTS instance_domains_unique_domain 
  ON projections.instance_domains (instance_id, domain);

-- Org Domains: Unique per (instance_id, org_id, domain)
CREATE UNIQUE INDEX IF NOT EXISTS org_domains_unique_domain 
  ON projections.org_domains (instance_id, org_id, domain);

-- Project Roles: Unique per (instance_id, project_id, role_key)
CREATE UNIQUE INDEX IF NOT EXISTS project_roles_unique_role 
  ON projections.project_roles (instance_id, project_id, role_key);

-- Login Names: Unique per (instance_id, login_name)
CREATE UNIQUE INDEX IF NOT EXISTS login_names_unique_name 
  ON projections.login_names (instance_id, login_name);

-- Custom Text: Unique per (instance_id, aggregate_id, aggregate_type, language, key)
CREATE UNIQUE INDEX IF NOT EXISTS custom_texts_unique_entry 
  ON projections.custom_texts (instance_id, aggregate_id, aggregate_type, language, key);

-- Actions: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS actions_unique_id 
  ON projections.actions (instance_id, id);

-- Action Flows: Unique per (instance_id, flow_type, trigger_type, action_id)
CREATE UNIQUE INDEX IF NOT EXISTS action_flows_unique_flow 
  ON projections.action_flows (instance_id, flow_type, trigger_type, action_id);

-- Applications: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS applications_unique_id 
  ON projections.applications (instance_id, id);

-- Auth Requests: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS auth_requests_unique_id 
  ON projections.auth_requests (instance_id, id);

-- Authn Keys: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS authn_keys_unique_id 
  ON projections.authn_keys (instance_id, id);

-- Label Policies: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS label_policies_unique_id 
  ON projections.label_policies (instance_id, id);

-- IDPs: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS idps_unique_id 
  ON projections.idps (instance_id, id);

-- IDP Templates: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS idp_templates_unique_id 
  ON projections.idp_templates (instance_id, id);

-- Instances: Unique per (id) - id is the primary key
CREATE UNIQUE INDEX IF NOT EXISTS instances_unique_id 
  ON projections.instances (id);

-- Instance Trusted Domains: Unique per (instance_id, domain)
CREATE UNIQUE INDEX IF NOT EXISTS instance_trusted_domains_unique_domain 
  ON projections.instance_trusted_domains (instance_id, domain);

-- Orgs: Unique per (id, instance_id)
CREATE UNIQUE INDEX IF NOT EXISTS orgs_unique_id 
  ON projections.orgs (id, instance_id);

-- Projects: Unique per (id, instance_id)
CREATE UNIQUE INDEX IF NOT EXISTS projects_unique_id 
  ON projections.projects (id, instance_id);

-- Sessions: Unique per (id, instance_id)
CREATE UNIQUE INDEX IF NOT EXISTS sessions_unique_id 
  ON projections.sessions (id, instance_id);

-- Users: Unique per (id, instance_id)
CREATE UNIQUE INDEX IF NOT EXISTS users_unique_id 
  ON projections.users (id, instance_id);

-- Login Policies: Unique per (instance_id, id)
CREATE UNIQUE INDEX IF NOT EXISTS login_policies_unique_id 
  ON projections.login_policies (instance_id, id);

-- Login Policy Factors: Unique per (instance_id, policy_id, factor_type, is_multi_factor)
CREATE UNIQUE INDEX IF NOT EXISTS login_policy_factors_unique_factor 
  ON projections.login_policy_factors (instance_id, policy_id, factor_type, is_multi_factor);

-- ============================================================================
-- ADDITIONAL CONSTRAINTS
-- ============================================================================

-- Note: projection_states table has PRIMARY KEY on name column,
-- which automatically creates a unique constraint (no additional index needed)

-- None at this time - all constraints implemented as unique indexes above
