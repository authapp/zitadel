/**
 * Database migrations
 * 
 * Manages database schema versioning and migrations
 */

export interface Migration {
  version: number;
  name: string;
  filename: string;
}

/**
 * Migration Registry
 * 
 * All migrations must be registered here in order
 * Each file contains a single SQL statement for reliability
 */

export const migrations = [
  // Migration 001: Event Store
  { version: 1, name: 'Create events table', filename: '001_01_create_events_table.sql' },
  { version: 2, name: 'Create events aggregate index', filename: '001_02_create_events_indexes.sql' },
  { version: 3, name: 'Create events position index', filename: '001_03_create_events_position_index.sql' },
  { version: 4, name: 'Create events type index', filename: '001_04_create_events_type_index.sql' },
  { version: 5, name: 'Create events resource owner index', filename: '001_05_create_events_resource_owner_index.sql' },
  { version: 6, name: 'Create events instance index', filename: '001_06_create_events_instance_index.sql' },
  { version: 7, name: 'Create events creation date index', filename: '001_07_create_events_creation_date_index.sql' },
  { version: 8, name: 'Create events editor user index', filename: '001_08_create_events_editor_user_index.sql' },
  { version: 9, name: 'Create events aggregate type resource index', filename: '001_09_create_events_aggregate_type_resource_index.sql' },
  { version: 10, name: 'Create events instance resource index', filename: '001_10_create_events_instance_resource_index.sql' },
  { version: 11, name: 'Create events aggregate version unique index', filename: '001_11_create_events_aggregate_version_unique_index.sql' },
  { version: 12, name: 'Create events position unique index', filename: '001_12_create_events_position_unique_index.sql' },
  { version: 13, name: 'Create events data GIN index', filename: '001_13_create_events_data_gin_index.sql' },
  
  // Migration 002: Projections (consolidated - all projection_states columns in 002_01)
  { version: 14, name: 'Create projection states table', filename: '002_01_create_projection_states_table.sql' },
  { version: 15, name: 'Create users projection table', filename: '002_04_create_users_projection_table.sql' },
  { version: 16, name: 'Create users projection instance index', filename: '002_05_create_users_projection_indexes.sql' },
  { version: 17, name: 'Create users projection email index', filename: '002_06_create_users_projection_email_index.sql' },
  { version: 18, name: 'Create users projection username index', filename: '002_07_create_users_projection_username_index.sql' },
  { version: 19, name: 'Create users projection state index', filename: '002_08_create_users_projection_state_index.sql' },
  { version: 20, name: 'Create users projection deleted index', filename: '002_09_create_users_projection_deleted_index.sql' },
  { version: 21, name: 'Create update_updated_at function', filename: '002_10_create_update_updated_at_function.sql' },
  { version: 22, name: 'Create users projection trigger', filename: '002_11_create_users_projection_trigger.sql' },
  { version: 23, name: 'Add missing user fields (Priority 2)', filename: '002_12_add_missing_user_fields.sql' },
  { version: 24, name: 'Add login names support (Priority 3)', filename: '002_13_add_login_names_support.sql' },
  { version: 25, name: 'Create user addresses table (Priority 3)', filename: '002_14_create_user_addresses_table.sql' },
  { version: 26, name: 'Create user metadata table (Priority 3)', filename: '002_15_create_user_metadata_table.sql' },
  { version: 27, name: 'Fix multi-tenant username constraint', filename: '002_16_fix_multitenant_username_constraint.sql' },
  { version: 28, name: 'Create unique constraints table', filename: '003_create_unique_constraints_table.sql' },
  { version: 29, name: 'Create notification config table', filename: '011_notification_config.sql' },
  { version: 30, name: 'Create orgs projection table', filename: '002_18_create_orgs_projection_table.sql' },
  { version: 31, name: 'Create org domains projection table', filename: '002_19_create_org_domains_projection_table.sql' },
  { version: 32, name: 'Create projects projection table', filename: '002_20_create_projects_projection_table.sql' },
  { version: 33, name: 'Create project roles projection table', filename: '002_21_create_project_roles_projection_table.sql' },
  { version: 34, name: 'Create applications projection table', filename: '002_22_create_applications_projection_table.sql' },
  { version: 35, name: 'Create instances projection table', filename: '002_23_create_instances_projection_table.sql' },
  { version: 36, name: 'Create instance domains projection table', filename: '002_24_create_instance_domains_projection_table.sql' },
  { version: 37, name: 'Create instance trusted domains projection table', filename: '002_25_create_instance_trusted_domains_projection_table.sql' },
  { version: 38, name: 'Create sessions projection table', filename: '002_26_create_sessions_projection_table.sql' },
  { version: 39, name: 'Create login names projection table', filename: '002_27_create_login_names_projection_table.sql' },
  { version: 40, name: 'Update users projection for multi-tenant (Phase 2)', filename: '002_28_update_users_projection_multi_tenant.sql' },
  { version: 41, name: 'Update user metadata for multi-tenant (Phase 2)', filename: '002_29_update_user_metadata_multi_tenant.sql' },
  { version: 42, name: 'Restore user FK constraints with composite keys (Phase 2)', filename: '002_30_restore_user_fk_constraints.sql' },
  { version: 43, name: 'Update login names projection for multi-tenant (Phase 2)', filename: '002_31_update_login_names_projection_multi_tenant.sql' },
  { version: 44, name: 'Update org domains projection for multi-tenant (Phase 2)', filename: '002_32_update_org_domains_projection_multi_tenant.sql' },
  { version: 45, name: 'Update project roles projection for multi-tenant (Phase 2)', filename: '002_33_update_project_roles_projection_multi_tenant.sql' },
  { version: 46, name: 'Update instances projection for multi-tenant (Phase 2)', filename: '002_34_update_instances_projection_multi_tenant.sql' },
  { version: 47, name: 'Update instance domains projection for multi-tenant (Phase 2)', filename: '002_35_update_instance_domains_projection_multi_tenant.sql' },
  { version: 48, name: 'Update instance trusted domains projection for multi-tenant (Phase 2)', filename: '002_36_update_instance_trusted_domains_projection_multi_tenant.sql' },
  { version: 49, name: 'Update sessions projection for multi-tenant (Phase 2)', filename: '002_37_update_sessions_projection_multi_tenant.sql' },
  { version: 50, name: 'Update user addresses for multi-tenant (Phase 2)', filename: '002_38_update_user_addresses_multi_tenant.sql' },
  { version: 51, name: 'Update notification providers for multi-tenant (Phase 2)', filename: '002_39_update_notification_providers_multi_tenant.sql' },
  { version: 52, name: 'Update email configs for multi-tenant (Phase 2)', filename: '002_40_update_email_configs_multi_tenant.sql' },
  { version: 53, name: 'Update SMS configs for multi-tenant (Phase 2)', filename: '002_41_update_sms_configs_multi_tenant.sql' },
  { version: 54, name: 'Update notification config changes for multi-tenant (Phase 2)', filename: '002_42_update_notification_config_changes_multi_tenant.sql' },
  { version: 55, name: 'Create user auth methods projection (Phase 3)', filename: '002_43_create_user_auth_methods_projection_table.sql' },
  { version: 56, name: 'Create personal access tokens projection (Phase 3)', filename: '002_44_create_personal_access_tokens_projection_table.sql' },
  { version: 57, name: 'Create encryption keys table (Phase 3)', filename: '002_45_create_encryption_keys_table.sql' },
  { version: 58, name: 'Create lockout policies projection (Phase 3)', filename: '002_46_create_lockout_policies_projection_table.sql' },
  { version: 59, name: 'Create projection failed events table (Infrastructure)', filename: '002_47_create_projection_failed_events_table.sql' },
  { version: 60, name: 'Fix projection failed events columns (Infrastructure)', filename: '002_48_fix_projection_failed_events_columns.sql' },
  { version: 61, name: 'Add id to projection failed events (Infrastructure)', filename: '002_49_add_id_to_failed_events.sql' },
  { version: 62, name: 'Create quotas table (Resource Management)', filename: '002_50_create_quotas_table.sql' },
];
