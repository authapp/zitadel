-- =============================================================================
-- ZITADEL Backend - Indexes
-- =============================================================================
-- Description: All performance indexes for events and projections
-- =============================================================================

-- ============================================================================
-- EVENT STORE INDEXES
-- ============================================================================

-- Index: idx_events_wm on public.events
-- Description: Write model query optimization
CREATE INDEX IF NOT EXISTS idx_events_wm ON public.events USING btree (
    instance_id, 
    aggregate_type, 
    aggregate_id, 
    aggregate_version DESC
);

-- Index: idx_events_position on public.events
-- Description: Position-based event streaming
CREATE INDEX IF NOT EXISTS idx_events_position ON public.events USING btree (
    position DESC
);

-- Index: idx_events_projection on public.events  
-- Description: Projection processing optimization
CREATE INDEX IF NOT EXISTS idx_events_projection ON public.events USING btree (
    instance_id,
    aggregate_type,
    created_at DESC
);

-- Index: idx_failed_events_last_failed on public.projection_failed_events
-- Description: Failed events tracking by time
CREATE INDEX IF NOT EXISTS idx_failed_events_last_failed ON public.projection_failed_events USING btree (
    last_failed DESC
);

-- Index: idx_projection_locks_expires_at on public.projection_locks
-- Description: Cleanup of expired locks
CREATE INDEX IF NOT EXISTS idx_projection_locks_expires_at ON public.projection_locks USING btree (
    expires_at
);

-- ============================================================================
-- PROJECTION INDEXES
-- ============================================================================

-- Index: idx_action_flows_action on projections.action_flows
CREATE INDEX IF NOT EXISTS idx_action_flows_action ON projections.action_flows USING btree (instance_id, action_id);

-- Index: idx_action_flows_trigger on projections.action_flows
CREATE INDEX IF NOT EXISTS idx_action_flows_trigger ON projections.action_flows USING btree (instance_id, flow_type, trigger_type);

-- Index: idx_actions_change_date on projections.actions
CREATE INDEX IF NOT EXISTS idx_actions_change_date ON projections.actions USING btree (instance_id, change_date DESC);

-- Index: idx_actions_resource_owner on projections.actions
CREATE INDEX IF NOT EXISTS idx_actions_resource_owner ON projections.actions USING btree (resource_owner, instance_id);

-- Index: idx_actions_state on projections.actions
CREATE INDEX IF NOT EXISTS idx_actions_state ON projections.actions USING btree (instance_id, state);

-- Index: idx_applications_client_id on projections.applications
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_client_id ON projections.applications USING btree (instance_id, client_id) WHERE (client_id IS NOT NULL);

-- Index: idx_applications_entity_id on projections.applications
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_entity_id ON projections.applications USING btree (instance_id, entity_id) WHERE (entity_id IS NOT NULL);

-- Index: idx_applications_instance_id on projections.applications
CREATE INDEX IF NOT EXISTS idx_applications_instance_id ON projections.applications USING btree (instance_id);

-- Index: idx_applications_name on projections.applications
CREATE INDEX IF NOT EXISTS idx_applications_name ON projections.applications USING btree (instance_id, name);

-- Index: idx_applications_project_app on projections.applications
CREATE INDEX IF NOT EXISTS idx_applications_project_app ON projections.applications USING btree (instance_id, project_id, id);

-- Index: idx_applications_project_id on projections.applications
CREATE INDEX IF NOT EXISTS idx_applications_project_id ON projections.applications USING btree (instance_id, project_id);

-- Index: idx_applications_resource_owner on projections.applications
CREATE INDEX IF NOT EXISTS idx_applications_resource_owner ON projections.applications USING btree (instance_id, resource_owner);

-- Index: idx_applications_state on projections.applications
CREATE INDEX IF NOT EXISTS idx_applications_state ON projections.applications USING btree (instance_id, state);

-- Index: idx_applications_type on projections.applications
CREATE INDEX IF NOT EXISTS idx_applications_type ON projections.applications USING btree (instance_id, app_type);

-- Index: idx_auth_requests_client_id on projections.auth_requests
CREATE INDEX IF NOT EXISTS idx_auth_requests_client_id ON projections.auth_requests USING btree (client_id, instance_id);

-- Index: idx_auth_requests_code on projections.auth_requests
CREATE INDEX IF NOT EXISTS idx_auth_requests_code ON projections.auth_requests USING btree (code, instance_id) WHERE (code IS NOT NULL);

-- Index: idx_auth_requests_session_id on projections.auth_requests
CREATE INDEX IF NOT EXISTS idx_auth_requests_session_id ON projections.auth_requests USING btree (session_id, instance_id) WHERE (session_id IS NOT NULL);

-- Index: idx_authn_keys_aggregate_id on projections.authn_keys
CREATE INDEX IF NOT EXISTS idx_authn_keys_aggregate_id ON projections.authn_keys USING btree (aggregate_id, instance_id);

-- Index: idx_authn_keys_expiration on projections.authn_keys
CREATE INDEX IF NOT EXISTS idx_authn_keys_expiration ON projections.authn_keys USING btree (expiration) WHERE (expiration IS NOT NULL);

-- Index: idx_authn_keys_object_id on projections.authn_keys
CREATE INDEX IF NOT EXISTS idx_authn_keys_object_id ON projections.authn_keys USING btree (object_id, instance_id);

-- Index: idx_custom_texts_aggregate on projections.custom_texts
CREATE INDEX IF NOT EXISTS idx_custom_texts_aggregate ON projections.custom_texts USING btree (instance_id, aggregate_id, aggregate_type);

-- Index: idx_custom_texts_key on projections.custom_texts
CREATE INDEX IF NOT EXISTS idx_custom_texts_key ON projections.custom_texts USING btree (instance_id, key);

-- Index: idx_custom_texts_language on projections.custom_texts
CREATE INDEX IF NOT EXISTS idx_custom_texts_language ON projections.custom_texts USING btree (instance_id, language);

-- Index: idx_domain_policies_default on projections.domain_policies
CREATE INDEX IF NOT EXISTS idx_domain_policies_default ON projections.domain_policies USING btree (is_default, instance_id);

-- Index: idx_domain_policies_org on projections.domain_policies
CREATE INDEX IF NOT EXISTS idx_domain_policies_org ON projections.domain_policies USING btree (organization_id, instance_id);

-- Index: idx_email_configs_change_date on projections.email_configs
CREATE INDEX IF NOT EXISTS idx_email_configs_change_date ON projections.email_configs USING btree (change_date DESC);

-- Index: idx_email_configs_enabled on projections.email_configs
CREATE INDEX IF NOT EXISTS idx_email_configs_enabled ON projections.email_configs USING btree (instance_id, enabled);

-- Index: idx_email_configs_instance on projections.email_configs
CREATE INDEX IF NOT EXISTS idx_email_configs_instance ON projections.email_configs USING btree (instance_id);

-- Index: idx_execution_states_execution on projections.execution_states
CREATE INDEX IF NOT EXISTS idx_execution_states_execution ON projections.execution_states USING btree (instance_id, execution_id);

-- Index: idx_execution_states_finished on projections.execution_states
CREATE INDEX IF NOT EXISTS idx_execution_states_finished ON projections.execution_states USING btree (instance_id, finished_at DESC) WHERE (finished_at IS NOT NULL);

-- Index: idx_execution_states_state on projections.execution_states
CREATE INDEX IF NOT EXISTS idx_execution_states_state ON projections.execution_states USING btree (instance_id, state);

-- Index: idx_executions_action on projections.executions
CREATE INDEX IF NOT EXISTS idx_executions_action ON projections.executions USING btree (instance_id, action_id);

-- Index: idx_executions_aggregate on projections.executions
CREATE INDEX IF NOT EXISTS idx_executions_aggregate ON projections.executions USING btree (instance_id, aggregate_type, aggregate_id);

-- Index: idx_executions_date on projections.executions
CREATE INDEX IF NOT EXISTS idx_executions_date ON projections.executions USING btree (instance_id, creation_date DESC);

-- Index: idx_executions_event on projections.executions
CREATE INDEX IF NOT EXISTS idx_executions_event ON projections.executions USING btree (instance_id, event_type, event_sequence);

-- Index: idx_idp_login_policy_links_idp_id on projections.idp_login_policy_links
CREATE INDEX IF NOT EXISTS idx_idp_login_policy_links_idp_id ON projections.idp_login_policy_links USING btree (idp_id, instance_id);

-- Index: idx_idp_login_policy_links_owner on projections.idp_login_policy_links
CREATE INDEX IF NOT EXISTS idx_idp_login_policy_links_owner ON projections.idp_login_policy_links USING btree (resource_owner, instance_id);

-- Index: idx_idp_templates_owner_type on projections.idp_templates
CREATE INDEX IF NOT EXISTS idx_idp_templates_owner_type ON projections.idp_templates USING btree (owner_type, instance_id);

-- Index: idx_idp_templates_resource_owner on projections.idp_templates
CREATE INDEX IF NOT EXISTS idx_idp_templates_resource_owner ON projections.idp_templates USING btree (resource_owner, instance_id);

-- Index: idx_idp_user_links_idp_id on projections.idp_user_links
CREATE INDEX IF NOT EXISTS idx_idp_user_links_idp_id ON projections.idp_user_links USING btree (idp_id, instance_id);

-- Index: idx_idp_user_links_user_id on projections.idp_user_links
CREATE INDEX IF NOT EXISTS idx_idp_user_links_user_id ON projections.idp_user_links USING btree (user_id, instance_id);

-- Index: idx_idps_name on projections.idps
CREATE INDEX IF NOT EXISTS idx_idps_name ON projections.idps USING btree (name, instance_id);

-- Index: idx_idps_resource_owner on projections.idps
CREATE INDEX IF NOT EXISTS idx_idps_resource_owner ON projections.idps USING btree (resource_owner, instance_id);

-- Index: idx_idps_type on projections.idps
CREATE INDEX IF NOT EXISTS idx_idps_type ON projections.idps USING btree (type, instance_id);

-- Index: idx_instance_domains_change_date on projections.instance_domains
CREATE INDEX IF NOT EXISTS idx_instance_domains_change_date ON projections.instance_domains USING btree (change_date DESC);

-- Index: idx_instance_domains_domain on projections.instance_domains
CREATE INDEX IF NOT EXISTS idx_instance_domains_domain ON projections.instance_domains USING btree (domain);

-- Index: idx_instance_domains_primary on projections.instance_domains
CREATE INDEX IF NOT EXISTS idx_instance_domains_primary ON projections.instance_domains USING btree (instance_id, is_primary);

-- Index: instance_members_resource_owner_idx on projections.instance_members
CREATE INDEX IF NOT EXISTS instance_members_resource_owner_idx ON projections.instance_members USING btree (resource_owner);

-- Index: instance_members_user_id_idx on projections.instance_members
CREATE INDEX IF NOT EXISTS instance_members_user_id_idx ON projections.instance_members USING btree (user_id);

-- Index: idx_instance_trusted_domains_change_date on projections.instance_trusted_domains
CREATE INDEX IF NOT EXISTS idx_instance_trusted_domains_change_date ON projections.instance_trusted_domains USING btree (change_date DESC);

-- Index: idx_instance_trusted_domains_instance on projections.instance_trusted_domains
CREATE INDEX IF NOT EXISTS idx_instance_trusted_domains_instance ON projections.instance_trusted_domains USING btree (instance_id);

-- Index: idx_instances_change_date on projections.instances
CREATE INDEX IF NOT EXISTS idx_instances_change_date ON projections.instances USING btree (change_date DESC);

-- Index: idx_instances_instance_id on projections.instances
CREATE INDEX IF NOT EXISTS idx_instances_instance_id ON projections.instances USING btree (instance_id);

-- Index: idx_instances_name on projections.instances
CREATE INDEX IF NOT EXISTS idx_instances_name ON projections.instances USING btree (name);

-- Index: idx_instances_state on projections.instances
CREATE INDEX IF NOT EXISTS idx_instances_state ON projections.instances USING btree (state);

-- Index: idx_label_policies_default on projections.label_policies
CREATE INDEX IF NOT EXISTS idx_label_policies_default ON projections.label_policies USING btree (is_default, instance_id);

-- Index: idx_label_policies_org on projections.label_policies
CREATE INDEX IF NOT EXISTS idx_label_policies_org ON projections.label_policies USING btree (organization_id, instance_id);

-- Index: lockout_policies_instance_id_idx on projections.lockout_policies
CREATE INDEX IF NOT EXISTS lockout_policies_instance_id_idx ON projections.lockout_policies USING btree (instance_id);

-- Index: lockout_policies_org_id_idx on projections.lockout_policies
CREATE INDEX IF NOT EXISTS lockout_policies_org_id_idx ON projections.lockout_policies USING btree (instance_id, organization_id);

-- Index: idx_lockout_policies_change_date on projections.lockout_policies_projection
CREATE INDEX IF NOT EXISTS idx_lockout_policies_change_date ON projections.lockout_policies_projection USING btree (change_date DESC);

-- Index: idx_lockout_policies_is_default on projections.lockout_policies_projection
CREATE INDEX IF NOT EXISTS idx_lockout_policies_is_default ON projections.lockout_policies_projection USING btree (instance_id, is_default) WHERE (is_default = true);

-- Index: idx_lockout_policies_resource_owner on projections.lockout_policies_projection
CREATE INDEX IF NOT EXISTS idx_lockout_policies_resource_owner ON projections.lockout_policies_projection USING btree (instance_id, resource_owner);

-- Index: idx_login_names_change_date on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_change_date ON projections.login_names USING btree (instance_id, change_date DESC) WHERE (change_date IS NOT NULL);

-- Index: idx_login_names_domain_name on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_domain_name ON projections.login_names USING btree (domain_name);

-- Index: idx_login_names_instance_id on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_instance_id ON projections.login_names USING btree (instance_id);

-- Index: idx_login_names_is_primary on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_is_primary ON projections.login_names USING btree (is_primary) WHERE (is_primary = true);

-- Index: idx_login_names_lookup on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_lookup ON projections.login_names USING btree (instance_id, login_name);

-- Index: idx_login_names_resource_owner on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_resource_owner ON projections.login_names USING btree (resource_owner);

-- Index: idx_login_names_sequence on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_sequence ON projections.login_names USING btree (instance_id, sequence DESC) WHERE (sequence > 0);

-- Index: idx_login_names_user_id on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_user_id ON projections.login_names USING btree (user_id);

-- Index: idx_login_names_user_instance on projections.login_names
CREATE INDEX IF NOT EXISTS idx_login_names_user_instance ON projections.login_names USING btree (user_id, instance_id);

-- Index: idx_login_policies_is_default on projections.login_policies
CREATE INDEX IF NOT EXISTS idx_login_policies_is_default ON projections.login_policies USING btree (is_default, instance_id);

-- Index: idx_login_policies_resource_owner on projections.login_policies
CREATE INDEX IF NOT EXISTS idx_login_policies_resource_owner ON projections.login_policies USING btree (resource_owner, instance_id);

-- Index: idx_login_policy_factors_policy_id on projections.login_policy_factors
CREATE INDEX IF NOT EXISTS idx_login_policy_factors_policy_id ON projections.login_policy_factors USING btree (policy_id, instance_id);

-- Index: mail_templates_instance_id_idx on projections.mail_templates
CREATE INDEX IF NOT EXISTS mail_templates_instance_id_idx ON projections.mail_templates USING btree (instance_id);

-- Index: mail_templates_org_id_idx on projections.mail_templates
CREATE INDEX IF NOT EXISTS mail_templates_org_id_idx ON projections.mail_templates USING btree (instance_id, organization_id);

-- Index: idx_milestones_aggregate on projections.milestones
CREATE INDEX IF NOT EXISTS idx_milestones_aggregate ON projections.milestones USING btree (instance_id, aggregate_type, aggregate_id);

-- Index: idx_milestones_name on projections.milestones
CREATE INDEX IF NOT EXISTS idx_milestones_name ON projections.milestones USING btree (instance_id, name);

-- Index: idx_milestones_reached on projections.milestones
CREATE INDEX IF NOT EXISTS idx_milestones_reached ON projections.milestones USING btree (instance_id, reached_date DESC) WHERE (reached_date IS NOT NULL);

-- Index: idx_milestones_type on projections.milestones
CREATE INDEX IF NOT EXISTS idx_milestones_type ON projections.milestones USING btree (instance_id, milestone_type);

-- Index: idx_milestones_unreached on projections.milestones
CREATE INDEX IF NOT EXISTS idx_milestones_unreached ON projections.milestones USING btree (instance_id, milestone_type, reached_date) WHERE (reached_date IS NULL);

-- Index: notification_policies_instance_id_idx on projections.notification_policies
CREATE INDEX IF NOT EXISTS notification_policies_instance_id_idx ON projections.notification_policies USING btree (instance_id);

-- Index: notification_policies_org_id_idx on projections.notification_policies
CREATE INDEX IF NOT EXISTS notification_policies_org_id_idx ON projections.notification_policies USING btree (instance_id, organization_id);

-- Index: oidc_settings_instance_id_idx on projections.oidc_settings
CREATE INDEX IF NOT EXISTS oidc_settings_instance_id_idx ON projections.oidc_settings USING btree (instance_id);

-- Index: idx_org_domains_change_date on projections.org_domains
CREATE INDEX IF NOT EXISTS idx_org_domains_change_date ON projections.org_domains USING btree (instance_id, change_date DESC);

-- Index: idx_org_domains_domain_unique on projections.org_domains
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domains_domain_unique ON projections.org_domains USING btree (instance_id, domain);

-- Index: idx_org_domains_org_id on projections.org_domains
CREATE INDEX IF NOT EXISTS idx_org_domains_org_id ON projections.org_domains USING btree (instance_id, org_id);

-- Index: idx_org_domains_primary on projections.org_domains
CREATE INDEX IF NOT EXISTS idx_org_domains_primary ON projections.org_domains USING btree (instance_id, org_id, is_primary) WHERE (is_primary = true);

-- Index: idx_org_domains_sequence on projections.org_domains
CREATE INDEX IF NOT EXISTS idx_org_domains_sequence ON projections.org_domains USING btree (instance_id, sequence DESC);

-- Index: idx_org_domains_verified on projections.org_domains
CREATE INDEX IF NOT EXISTS idx_org_domains_verified ON projections.org_domains USING btree (instance_id, is_verified);

-- Index: org_members_org_id_idx on projections.org_members
CREATE INDEX IF NOT EXISTS org_members_org_id_idx ON projections.org_members USING btree (org_id, instance_id);

-- Index: org_members_resource_owner_idx on projections.org_members
CREATE INDEX IF NOT EXISTS org_members_resource_owner_idx ON projections.org_members USING btree (resource_owner, instance_id);

-- Index: org_members_user_id_idx on projections.org_members
CREATE INDEX IF NOT EXISTS org_members_user_id_idx ON projections.org_members USING btree (user_id, instance_id);

-- Index: idx_orgs_created_at on projections.orgs
CREATE INDEX IF NOT EXISTS idx_orgs_created_at ON projections.orgs USING btree (instance_id, created_at DESC);

-- Index: idx_orgs_instance_id on projections.orgs
CREATE INDEX IF NOT EXISTS idx_orgs_instance_id ON projections.orgs USING btree (instance_id);

-- Index: idx_orgs_name on projections.orgs
CREATE INDEX IF NOT EXISTS idx_orgs_name ON projections.orgs USING btree (instance_id, name);

-- Index: idx_orgs_name_fts on projections.orgs
CREATE INDEX IF NOT EXISTS idx_orgs_name_fts ON projections.orgs USING gin (to_tsvector('english'::regconfig, name));

-- Index: idx_orgs_primary_domain on projections.orgs
CREATE INDEX IF NOT EXISTS idx_orgs_primary_domain ON projections.orgs USING btree (instance_id, primary_domain) WHERE (primary_domain IS NOT NULL);

-- Index: idx_orgs_resource_owner on projections.orgs
CREATE INDEX IF NOT EXISTS idx_orgs_resource_owner ON projections.orgs USING btree (instance_id, resource_owner) WHERE (resource_owner IS NOT NULL);

-- Index: idx_orgs_state on projections.orgs
CREATE INDEX IF NOT EXISTS idx_orgs_state ON projections.orgs USING btree (instance_id, state);

-- Index: idx_password_age_policies_default on projections.password_age_policies
CREATE INDEX IF NOT EXISTS idx_password_age_policies_default ON projections.password_age_policies USING btree (is_default, instance_id);

-- Index: idx_password_age_policies_org on projections.password_age_policies
CREATE INDEX IF NOT EXISTS idx_password_age_policies_org ON projections.password_age_policies USING btree (organization_id, instance_id);

-- Index: idx_password_complexity_policies_default on projections.password_complexity_policies
CREATE INDEX IF NOT EXISTS idx_password_complexity_policies_default ON projections.password_complexity_policies USING btree (is_default, instance_id);

-- Index: idx_password_complexity_policies_org on projections.password_complexity_policies
CREATE INDEX IF NOT EXISTS idx_password_complexity_policies_org ON projections.password_complexity_policies USING btree (organization_id, instance_id);

-- Index: idx_personal_access_tokens_change_date on projections.personal_access_tokens
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_change_date ON projections.personal_access_tokens USING btree (change_date DESC);

-- Index: idx_personal_access_tokens_expiration on projections.personal_access_tokens
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_expiration ON projections.personal_access_tokens USING btree (instance_id, expiration_date);

-- Index: idx_personal_access_tokens_hash on projections.personal_access_tokens
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_hash ON projections.personal_access_tokens USING btree (token_hash);

-- Index: idx_personal_access_tokens_last_used on projections.personal_access_tokens
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_last_used ON projections.personal_access_tokens USING btree (instance_id, last_used DESC);

-- Index: idx_personal_access_tokens_user_id on projections.personal_access_tokens
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_user_id ON projections.personal_access_tokens USING btree (instance_id, user_id);

-- Index: privacy_policies_instance_id_idx on projections.privacy_policies
CREATE INDEX IF NOT EXISTS privacy_policies_instance_id_idx ON projections.privacy_policies USING btree (instance_id);

-- Index: privacy_policies_org_id_idx on projections.privacy_policies
CREATE INDEX IF NOT EXISTS privacy_policies_org_id_idx ON projections.privacy_policies USING btree (instance_id, organization_id);

-- Index: project_grant_members_grant_id_idx on projections.project_grant_members
CREATE INDEX IF NOT EXISTS project_grant_members_grant_id_idx ON projections.project_grant_members USING btree (grant_id, instance_id);

-- Index: project_grant_members_project_id_idx on projections.project_grant_members
CREATE INDEX IF NOT EXISTS project_grant_members_project_id_idx ON projections.project_grant_members USING btree (project_id, instance_id);

-- Index: project_grant_members_resource_owner_idx on projections.project_grant_members
CREATE INDEX IF NOT EXISTS project_grant_members_resource_owner_idx ON projections.project_grant_members USING btree (resource_owner, instance_id);

-- Index: project_grant_members_user_id_idx on projections.project_grant_members
CREATE INDEX IF NOT EXISTS project_grant_members_user_id_idx ON projections.project_grant_members USING btree (user_id, instance_id);

-- Index: project_grants_granted_org_id_idx on projections.project_grants_projection
CREATE INDEX IF NOT EXISTS project_grants_granted_org_id_idx ON projections.project_grants_projection USING btree (granted_org_id, instance_id);

-- Index: project_grants_project_id_idx on projections.project_grants_projection
CREATE INDEX IF NOT EXISTS project_grants_project_id_idx ON projections.project_grants_projection USING btree (project_id, instance_id);

-- Index: project_grants_resource_owner_idx on projections.project_grants_projection
CREATE INDEX IF NOT EXISTS project_grants_resource_owner_idx ON projections.project_grants_projection USING btree (resource_owner, instance_id);

-- Index: project_grants_state_idx on projections.project_grants_projection
CREATE INDEX IF NOT EXISTS project_grants_state_idx ON projections.project_grants_projection USING btree (state, instance_id);

-- Index: project_members_project_id_idx on projections.project_members
CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON projections.project_members USING btree (project_id, instance_id);

-- Index: project_members_resource_owner_idx on projections.project_members
CREATE INDEX IF NOT EXISTS project_members_resource_owner_idx ON projections.project_members USING btree (resource_owner, instance_id);

-- Index: project_members_user_id_idx on projections.project_members
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON projections.project_members USING btree (user_id, instance_id);

-- Index: idx_project_roles_change_date on projections.project_roles
CREATE INDEX IF NOT EXISTS idx_project_roles_change_date ON projections.project_roles USING btree (change_date DESC);

-- Index: idx_project_roles_created_at on projections.project_roles
CREATE INDEX IF NOT EXISTS idx_project_roles_created_at ON projections.project_roles USING btree (created_at DESC);

-- Index: idx_project_roles_display_name on projections.project_roles
CREATE INDEX IF NOT EXISTS idx_project_roles_display_name ON projections.project_roles USING btree (instance_id, project_id, display_name);

-- Index: idx_project_roles_group on projections.project_roles
CREATE INDEX IF NOT EXISTS idx_project_roles_group ON projections.project_roles USING btree (instance_id, role_group) WHERE (role_group IS NOT NULL);

-- Index: idx_project_roles_project_id on projections.project_roles
CREATE INDEX IF NOT EXISTS idx_project_roles_project_id ON projections.project_roles USING btree (instance_id, project_id);

-- Index: idx_project_roles_role_key on projections.project_roles
CREATE INDEX IF NOT EXISTS idx_project_roles_role_key ON projections.project_roles USING btree (instance_id, project_id, role_key);

-- Index: idx_projects_created_at on projections.projects
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projections.projects USING btree (instance_id, created_at DESC);

-- Index: idx_projects_instance_id on projections.projects
CREATE INDEX IF NOT EXISTS idx_projects_instance_id ON projections.projects USING btree (instance_id);

-- Index: idx_projects_name on projections.projects
CREATE INDEX IF NOT EXISTS idx_projects_name ON projections.projects USING btree (instance_id, name);

-- Index: idx_projects_name_fts on projections.projects
CREATE INDEX IF NOT EXISTS idx_projects_name_fts ON projections.projects USING gin (to_tsvector('english'::regconfig, name));

-- Index: idx_projects_resource_owner on projections.projects
CREATE INDEX IF NOT EXISTS idx_projects_resource_owner ON projections.projects USING btree (instance_id, resource_owner);

-- Index: idx_projects_state on projections.projects
CREATE INDEX IF NOT EXISTS idx_projects_state ON projections.projects USING btree (instance_id, state);

-- Index: security_policies_instance_id_idx on projections.security_policies
CREATE INDEX IF NOT EXISTS security_policies_instance_id_idx ON projections.security_policies USING btree (instance_id);

-- Index: idx_sessions_change_date on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_change_date ON projections.sessions USING btree (change_date DESC);

-- Index: idx_sessions_created_at on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON projections.sessions USING btree (instance_id, created_at DESC);

-- Index: idx_sessions_instance_id on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_instance_id ON projections.sessions USING btree (instance_id);

-- Index: idx_sessions_instance_user on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_instance_user ON projections.sessions USING btree (instance_id, user_id);

-- Index: idx_sessions_oidc_data_gin on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_oidc_data_gin ON projections.sessions USING gin (oidc_data);

-- Index: idx_sessions_resource_owner on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_resource_owner ON projections.sessions USING btree (instance_id, resource_owner, state);

-- Index: idx_sessions_state on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_state ON projections.sessions USING btree (instance_id, state);

-- Index: idx_sessions_updated_at on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON projections.sessions USING btree (instance_id, updated_at DESC);

-- Index: idx_sessions_user_id on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON projections.sessions USING btree (instance_id, user_id);

-- Index: idx_sessions_user_state on projections.sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_state ON projections.sessions USING btree (instance_id, user_id, state);

-- Index: sms_configs_instance_id_idx on projections.sms_configs
CREATE INDEX IF NOT EXISTS sms_configs_instance_id_idx ON projections.sms_configs USING btree (instance_id);

-- Index: sms_configs_resource_owner_idx on projections.sms_configs
CREATE INDEX IF NOT EXISTS sms_configs_resource_owner_idx ON projections.sms_configs USING btree (instance_id, resource_owner);

-- Index: sms_configs_state_idx on projections.sms_configs
CREATE INDEX IF NOT EXISTS sms_configs_state_idx ON projections.sms_configs USING btree (instance_id, resource_owner, state);

-- Index: smtp_configs_instance_id_idx on projections.smtp_configs
CREATE INDEX IF NOT EXISTS smtp_configs_instance_id_idx ON projections.smtp_configs USING btree (instance_id);

-- Index: smtp_configs_resource_owner_idx on projections.smtp_configs
CREATE INDEX IF NOT EXISTS smtp_configs_resource_owner_idx ON projections.smtp_configs USING btree (instance_id, resource_owner);

-- Index: smtp_configs_state_idx on projections.smtp_configs
CREATE INDEX IF NOT EXISTS smtp_configs_state_idx ON projections.smtp_configs USING btree (instance_id, resource_owner, state);

-- Index: user_addresses_change_date on projections.user_addresses
CREATE INDEX IF NOT EXISTS user_addresses_change_date ON projections.user_addresses USING btree (change_date DESC);

-- Index: user_addresses_created_at on projections.user_addresses
CREATE INDEX IF NOT EXISTS user_addresses_created_at ON projections.user_addresses USING btree (created_at DESC);

-- Index: user_addresses_instance_id_idx on projections.user_addresses
CREATE INDEX IF NOT EXISTS user_addresses_instance_id_idx ON projections.user_addresses USING btree (instance_id);

-- Index: user_addresses_primary_unique_idx on projections.user_addresses
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_primary_unique_idx ON projections.user_addresses USING btree (instance_id, user_id) WHERE (is_primary = true);

-- Index: user_addresses_type_idx on projections.user_addresses
CREATE INDEX IF NOT EXISTS user_addresses_type_idx ON projections.user_addresses USING btree (instance_id, address_type);

-- Index: user_addresses_user_id_idx on projections.user_addresses
CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON projections.user_addresses USING btree (instance_id, user_id);

-- Index: idx_user_auth_methods_change_date on projections.user_auth_methods
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_change_date ON projections.user_auth_methods USING btree (change_date DESC);

-- Index: idx_user_auth_methods_state on projections.user_auth_methods
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_state ON projections.user_auth_methods USING btree (instance_id, state);

-- Index: idx_user_auth_methods_type on projections.user_auth_methods
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_type ON projections.user_auth_methods USING btree (instance_id, method_type);

-- Index: idx_user_auth_methods_user_id on projections.user_auth_methods
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_id ON projections.user_auth_methods USING btree (instance_id, user_id);

-- Index: idx_user_auth_methods_user_type on projections.user_auth_methods
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_type ON projections.user_auth_methods USING btree (instance_id, user_id, method_type);

-- Index: idx_user_metadata_change_date on projections.user_metadata
CREATE INDEX IF NOT EXISTS idx_user_metadata_change_date ON projections.user_metadata USING btree (instance_id, change_date DESC);

-- Index: idx_user_metadata_resource_owner on projections.user_metadata
CREATE INDEX IF NOT EXISTS idx_user_metadata_resource_owner ON projections.user_metadata USING btree (instance_id, resource_owner);

-- Index: idx_user_metadata_sequence on projections.user_metadata
CREATE INDEX IF NOT EXISTS idx_user_metadata_sequence ON projections.user_metadata USING btree (instance_id, sequence DESC);

-- Index: user_metadata_instance_id_idx on projections.user_metadata
CREATE INDEX IF NOT EXISTS user_metadata_instance_id_idx ON projections.user_metadata USING btree (instance_id);

-- Index: user_metadata_key_idx on projections.user_metadata
CREATE INDEX IF NOT EXISTS user_metadata_key_idx ON projections.user_metadata USING btree (instance_id, metadata_key);

-- Index: user_metadata_scope_idx on projections.user_metadata
CREATE INDEX IF NOT EXISTS user_metadata_scope_idx ON projections.user_metadata USING btree (instance_id, scope) WHERE (scope IS NOT NULL);

-- Index: user_metadata_type_idx on projections.user_metadata
CREATE INDEX IF NOT EXISTS user_metadata_type_idx ON projections.user_metadata USING btree (instance_id, metadata_type);

-- Index: user_metadata_unique_key_null_scope_idx on projections.user_metadata
CREATE UNIQUE INDEX IF NOT EXISTS user_metadata_unique_key_null_scope_idx ON projections.user_metadata USING btree (instance_id, user_id, metadata_key) WHERE (scope IS NULL);

-- Index: user_metadata_unique_key_with_scope_idx on projections.user_metadata
CREATE UNIQUE INDEX IF NOT EXISTS user_metadata_unique_key_with_scope_idx ON projections.user_metadata USING btree (instance_id, user_id, metadata_key, scope) WHERE (scope IS NOT NULL);

-- Index: user_metadata_user_id_idx on projections.user_metadata
CREATE INDEX IF NOT EXISTS user_metadata_user_id_idx ON projections.user_metadata USING btree (instance_id, user_id);

-- Index: user_metadata_value_gin_idx on projections.user_metadata
CREATE INDEX IF NOT EXISTS user_metadata_value_gin_idx ON projections.user_metadata USING gin (metadata_value);

-- Index: idx_users_change_date on projections.users
CREATE INDEX IF NOT EXISTS idx_users_change_date ON projections.users USING btree (instance_id, change_date DESC) WHERE (deleted_at IS NULL);

-- Index: idx_users_projection_created_at on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_created_at ON projections.users USING btree (created_at DESC) WHERE (deleted_at IS NULL);

-- Index: idx_users_projection_deleted on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_deleted ON projections.users USING btree (deleted_at);

-- Index: idx_users_projection_email on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_email ON projections.users USING btree (email) WHERE (deleted_at IS NULL);

-- Index: idx_users_projection_instance on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_instance ON projections.users USING btree (instance_id) WHERE (deleted_at IS NULL);

-- Index: idx_users_projection_login_names on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_login_names ON projections.users USING gin (login_names) WHERE (deleted_at IS NULL);

-- Index: idx_users_projection_resource_owner on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_resource_owner ON projections.users USING btree (resource_owner) WHERE (deleted_at IS NULL);

-- Index: idx_users_projection_state on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_state ON projections.users USING btree (state) WHERE (deleted_at IS NULL);

-- Index: idx_users_projection_username on projections.users
CREATE INDEX IF NOT EXISTS idx_users_projection_username ON projections.users USING btree (username);

-- Index: idx_users_sequence on projections.users
CREATE INDEX IF NOT EXISTS idx_users_sequence ON projections.users USING btree (instance_id, sequence DESC) WHERE (deleted_at IS NULL);

-- Index: users_projection_login_names_idx on projections.users
CREATE INDEX IF NOT EXISTS users_projection_login_names_idx ON projections.users USING gin (login_names) WHERE (login_names IS NOT NULL);

-- Index: users_projection_nickname_idx on projections.users
CREATE INDEX IF NOT EXISTS users_projection_nickname_idx ON projections.users USING btree (nickname) WHERE (nickname IS NOT NULL);

-- Index: users_projection_preferred_login_name_idx on projections.users
CREATE INDEX IF NOT EXISTS users_projection_preferred_login_name_idx ON projections.users USING btree (preferred_login_name) WHERE (preferred_login_name IS NOT NULL);

-- Index: users_projection_unique_email on projections.users
CREATE UNIQUE INDEX IF NOT EXISTS users_projection_unique_email ON projections.users USING btree (instance_id, email);

-- Index: users_projection_unique_username on projections.users
CREATE UNIQUE INDEX IF NOT EXISTS users_projection_unique_username ON projections.users USING btree (instance_id, resource_owner, username);

