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
  
  // Migration 002: Projections
  { version: 14, name: 'Create projection states table', filename: '002_01_create_projection_states_table.sql' },
  { version: 15, name: 'Create projection states status index', filename: '002_02_create_projection_states_indexes.sql' },
  { version: 16, name: 'Create projection states position index', filename: '002_03_create_projection_states_position_index.sql' },
  { version: 17, name: 'Create users projection table', filename: '002_04_create_users_projection_table.sql' },
  { version: 18, name: 'Create users projection instance index', filename: '002_05_create_users_projection_indexes.sql' },
  { version: 19, name: 'Create users projection email index', filename: '002_06_create_users_projection_email_index.sql' },
  { version: 20, name: 'Create users projection username index', filename: '002_07_create_users_projection_username_index.sql' },
  { version: 21, name: 'Create users projection state index', filename: '002_08_create_users_projection_state_index.sql' },
  { version: 22, name: 'Create users projection deleted index', filename: '002_09_create_users_projection_deleted_index.sql' },
  { version: 23, name: 'Create update_updated_at function', filename: '002_10_create_update_updated_at_function.sql' },
  { version: 24, name: 'Create users projection trigger', filename: '002_11_create_users_projection_trigger.sql' },
  { version: 25, name: 'Add missing user fields (Priority 2)', filename: '002_12_add_missing_user_fields.sql' },
  { version: 26, name: 'Add login names support (Priority 3)', filename: '002_13_add_login_names_support.sql' },
  { version: 27, name: 'Create user addresses table (Priority 3)', filename: '002_14_create_user_addresses_table.sql' },
  { version: 28, name: 'Create user metadata table (Priority 3)', filename: '002_15_create_user_metadata_table.sql' },
];
