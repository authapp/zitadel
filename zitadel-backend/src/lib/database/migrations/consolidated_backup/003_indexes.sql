-- Consolidated Migration 003: Indexes
-- Generated: 2025-10-27T17:28:28.416Z
-- Source: 68 original migrations consolidated
--
-- This migration creates all indexes for:
-- - Fast querying
-- - Multi-tenant isolation
-- - Performance optimization

-- From: 002_04_create_users_projection_table.sql
-- Migration: 002_04 - Create users projection table
-- Description: CQRS read model for users
-- Date: 2025-10-04
-- Updated: 2025-10-14 - Added missing columns for full Zitadel compatibility

CREATE TABLE IF NOT EXISTS users_projection (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    resource_owner VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    phone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verified_at TIMESTAMP WITH TIME ZONE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    nickname VARCHAR(255),
    preferred_language VARCHAR(10),
    gender VARCHAR(50),
    avatar_url TEXT,
    preferred_login_name VARCHAR(255),
    login_names TEXT[], -- Array of login names for fast lookup
    state VARCHAR(50) NOT NULL DEFAULT 'active',
    user_type VARCHAR(50) NOT NULL DEFAULT 'human',
    password_hash TEXT,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    password_change_required BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT users_projection_unique_username UNIQUE (instance_id, username),
    CONSTRAINT users_projection_unique_email UNIQUE (instance_id, email)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_users_projection_instance ON users_projection(instance_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_projection_resource_owner ON users_projection(resource_owner) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_projection_email ON users_projection(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_projection_login_names ON users_projection USING GIN(login_names) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_projection_state ON users_projection(state) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_projection_created_at ON users_projection(created_at DESC) WHERE deleted_at IS NULL;


-- From: 002_05_create_users_projection_indexes.sql
-- Migration: 002_05 - Create users projection indexes
CREATE INDEX IF NOT EXISTS idx_users_projection_instance ON users_projection(instance_id);


-- From: 002_06_create_users_projection_email_index.sql
-- Migration: 002_06 - Create users projection email index
CREATE INDEX IF NOT EXISTS idx_users_projection_email ON users_projection(email);


-- From: 002_07_create_users_projection_username_index.sql
-- Migration: 002_07 - Create users projection username index
CREATE INDEX IF NOT EXISTS idx_users_projection_username ON users_projection(username);


-- From: 002_08_create_users_projection_state_index.sql
-- Migration: 002_08 - Create users projection state index
CREATE INDEX IF NOT EXISTS idx_users_projection_state ON users_projection(state);


-- From: 002_09_create_users_projection_deleted_index.sql
-- Migration: 002_09 - Create users projection deleted index
CREATE INDEX IF NOT EXISTS idx_users_projection_deleted ON users_projection(deleted_at);


-- From: 002_12_add_missing_user_fields.sql
-- Migration: 002_12 - Add missing user fields
-- Description: Add nickname, verified_at timestamps, and password change tracking
-- Date: 2025-10-05
-- Priority: 2 (Schema completeness)

-- Add nickname field (matches Zitadel's NickName)
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- Add email verification timestamp
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Add phone verification timestamp  
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE;

-- Add password change timestamp
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Add password change required flag
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;

-- Create index on nickname for search/lookup
CREATE INDEX IF NOT EXISTS users_projection_nickname_idx 
ON users_projection(nickname) 
WHERE nickname IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users_projection.nickname IS 'User nickname, optional alternative display name';
COMMENT ON COLUMN users_projection.email_verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users_projection.phone_verified_at IS 'Timestamp when phone was verified';
COMMENT ON COLUMN users_projection.password_changed_at IS 'Timestamp of last password change';
COMMENT ON COLUMN users_projection.password_change_required IS 'Flag indicating if user must change password on next login';


-- From: 002_13_add_login_names_support.sql
-- Migration: 002_13 - Add login names support
-- Description: Add preferred_login_name and login_names array for multi-org scenarios
-- Date: 2025-10-05
-- Priority: 3 (Enhanced features)

-- Add preferred login name (user's preferred identifier)
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS preferred_login_name VARCHAR(255);

-- Add login names array (for multi-org scenarios)
-- Each org can have different login names for the same user
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS login_names TEXT[];

-- Create index on preferred_login_name for efficient lookups
CREATE INDEX IF NOT EXISTS users_projection_preferred_login_name_idx 
ON users_projection(preferred_login_name) 
WHERE preferred_login_name IS NOT NULL;

-- Create GIN index on login_names array for efficient array searches
CREATE INDEX IF NOT EXISTS users_projection_login_names_idx 
ON users_projection USING GIN(login_names)
WHERE login_names IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users_projection.preferred_login_name IS 'User preferred login identifier (username, email, or custom)';
COMMENT ON COLUMN users_projection.login_names IS 'Array of login names across different organizations';


-- From: 002_14_create_user_addresses_table.sql
-- Migration: 002_14 - Create user addresses table
-- Description: Full address support for users (matches Zitadel's HumanAddress)
-- Date: 2025-10-05
-- Priority: 3 (Enhanced features)

CREATE TABLE IF NOT EXISTS user_addresses (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    
    -- Address fields (following Zitadel's HumanAddress structure)
    country VARCHAR(100),
    locality VARCHAR(255),           -- City
    postal_code VARCHAR(20),
    region VARCHAR(255),              -- State/Province
    street_address VARCHAR(500),
    formatted_address TEXT,           -- Full formatted address
    
    -- Address type and metadata
    address_type VARCHAR(50) DEFAULT 'primary',  -- primary, billing, shipping, other
    is_primary BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_user_addresses_user 
        FOREIGN KEY (user_id) 
        REFERENCES users_projection(id) 
        ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx 
ON user_addresses(user_id);

CREATE INDEX IF NOT EXISTS user_addresses_instance_id_idx 
ON user_addresses(instance_id);

CREATE INDEX IF NOT EXISTS user_addresses_type_idx 
ON user_addresses(address_type);

-- Ensure only one primary address per user
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_primary_unique_idx 
ON user_addresses(user_id, instance_id) 
WHERE is_primary = true;

-- Add comments for documentation
COMMENT ON TABLE user_addresses IS 'User addresses following Zitadel HumanAddress structure';
COMMENT ON COLUMN user_addresses.locality IS 'City or locality';
COMMENT ON COLUMN user_addresses.region IS 'State, province, or region';
COMMENT ON COLUMN user_addresses.formatted_address IS 'Full formatted address string';
COMMENT ON COLUMN user_addresses.address_type IS 'Address type: primary, billing, shipping, other';


-- From: 002_15_create_user_metadata_table.sql
-- Migration: 002_15 - Create user metadata table
-- Description: Flexible key-value metadata storage for users
-- Date: 2025-10-05
-- Priority: 3 (Enhanced features)

CREATE TABLE IF NOT EXISTS user_metadata (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    
    -- Metadata key-value pair
    metadata_key VARCHAR(255) NOT NULL,
    metadata_value JSONB NOT NULL,
    
    -- Metadata type and scope
    metadata_type VARCHAR(50) DEFAULT 'custom',  -- custom, system, application
    scope VARCHAR(255),                           -- Optional scope (e.g., app_id, org_id)
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Foreign key constraint
    CONSTRAINT fk_user_metadata_user 
        FOREIGN KEY (user_id) 
        REFERENCES users_projection(id) 
        ON DELETE CASCADE
);

-- Unique constraint: one key per user per scope (handling NULL scopes)
-- For NULL scopes, use a unique index
CREATE UNIQUE INDEX IF NOT EXISTS user_metadata_unique_key_null_scope_idx
ON user_metadata(user_id, metadata_key)
WHERE scope IS NULL;

-- For non-NULL scopes, use a different unique index
CREATE UNIQUE INDEX IF NOT EXISTS user_metadata_unique_key_with_scope_idx
ON user_metadata(user_id, metadata_key, scope)
WHERE scope IS NOT NULL;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS user_metadata_user_id_idx 
ON user_metadata(user_id);

CREATE INDEX IF NOT EXISTS user_metadata_instance_id_idx 
ON user_metadata(instance_id);

CREATE INDEX IF NOT EXISTS user_metadata_key_idx 
ON user_metadata(metadata_key);

CREATE INDEX IF NOT EXISTS user_metadata_type_idx 
ON user_metadata(metadata_type);

CREATE INDEX IF NOT EXISTS user_metadata_scope_idx 
ON user_metadata(scope) 
WHERE scope IS NOT NULL;

-- GIN index on JSONB value for efficient JSON queries
CREATE INDEX IF NOT EXISTS user_metadata_value_gin_idx 
ON user_metadata USING GIN(metadata_value);

-- Add comments for documentation
COMMENT ON TABLE user_metadata IS 'Flexible key-value metadata storage for users';
COMMENT ON COLUMN user_metadata.metadata_key IS 'Metadata key (e.g., "department", "employee_id")';
COMMENT ON COLUMN user_metadata.metadata_value IS 'Metadata value stored as JSONB for flexibility';
COMMENT ON COLUMN user_metadata.metadata_type IS 'Type: custom, system, application';
COMMENT ON COLUMN user_metadata.scope IS 'Optional scope (e.g., application or organization ID)';


-- From: 002_18_create_orgs_projection_table.sql
-- Migration: 002_18 - Create organizations projection table
-- Description: Store organization read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS orgs_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    primary_domain TEXT,
    resource_owner TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    change_date TIMESTAMP WITH TIME ZONE,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Constraints
    PRIMARY KEY (instance_id, id),
    CONSTRAINT orgs_state_check CHECK (state IN ('unspecified', 'active', 'inactive', 'removed'))
);

-- Index on instance_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_orgs_instance_id ON orgs_projection(instance_id);

-- Index on name for search
CREATE INDEX IF NOT EXISTS idx_orgs_name ON orgs_projection(instance_id, name);

-- Index on state for filtering
CREATE INDEX IF NOT EXISTS idx_orgs_state ON orgs_projection(instance_id, state);

-- Index on primary_domain
CREATE INDEX IF NOT EXISTS idx_orgs_primary_domain ON orgs_projection(instance_id, primary_domain) WHERE primary_domain IS NOT NULL;

-- Index on resource_owner
CREATE INDEX IF NOT EXISTS idx_orgs_resource_owner ON orgs_projection(instance_id, resource_owner) WHERE resource_owner IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_orgs_created_at ON orgs_projection(instance_id, created_at DESC);

-- Full text search index on name
CREATE INDEX IF NOT EXISTS idx_orgs_name_fts ON orgs_projection USING gin(to_tsvector('english', name));

-- Comment
COMMENT ON TABLE orgs_projection IS 'Read model projection for organizations';


-- From: 002_19_create_org_domains_projection_table.sql
-- Migration: 002_19 - Create organization domains projection table
-- Description: Store organization domain read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS org_domains_projection (
    org_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    validation_type TEXT NOT NULL DEFAULT 'dns',
    validation_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Primary key on org_id and domain
    PRIMARY KEY (org_id, domain)
    
    -- Note: Foreign key removed to avoid race conditions between projections
    -- CONSTRAINT fk_org_domains_org_id FOREIGN KEY (org_id) REFERENCES orgs_projection(id) ON DELETE CASCADE
);

-- Index on domain for global lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domains_domain_unique ON org_domains_projection(domain);

-- Index on org_id for listing org domains
CREATE INDEX IF NOT EXISTS idx_org_domains_org_id ON org_domains_projection(org_id);

-- Index on is_verified for filtering
CREATE INDEX IF NOT EXISTS idx_org_domains_verified ON org_domains_projection(is_verified);

-- Index on is_primary for lookups
CREATE INDEX IF NOT EXISTS idx_org_domains_primary ON org_domains_projection(org_id, is_primary) WHERE is_primary = TRUE;

-- Comment
COMMENT ON TABLE org_domains_projection IS 'Read model projection for organization domains';


-- From: 002_20_create_projects_projection_table.sql
-- Migration: 002_20 - Create projects projection table
-- Description: Store project read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS projects_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    name TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    project_role_assertion BOOLEAN NOT NULL DEFAULT FALSE,
    project_role_check BOOLEAN NOT NULL DEFAULT FALSE,
    has_project_check BOOLEAN NOT NULL DEFAULT FALSE,
    private_labeling_setting TEXT NOT NULL DEFAULT 'unspecified',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    change_date TIMESTAMP WITH TIME ZONE,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Constraints
    PRIMARY KEY (instance_id, id)
);

-- Index on instance_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_projects_instance_id ON projects_projection(instance_id);

-- Index on resource_owner for listing org projects
CREATE INDEX IF NOT EXISTS idx_projects_resource_owner ON projects_projection(instance_id, resource_owner);

-- Index on state for filtering
CREATE INDEX IF NOT EXISTS idx_projects_state ON projects_projection(instance_id, state);

-- Index on name for search
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects_projection(instance_id, name);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects_projection(instance_id, created_at DESC);

-- Full-text search index on name
CREATE INDEX IF NOT EXISTS idx_projects_name_fts ON projects_projection USING gin(to_tsvector('english', name));

-- Comment
COMMENT ON TABLE projects_projection IS 'Read model projection for projects';


-- From: 002_21_create_project_roles_projection_table.sql
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


-- From: 002_22_create_applications_projection_table.sql
-- Migration: 002_22 - Create applications projection table
-- Description: Store application read models (OIDC/SAML/API) for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS applications_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    app_type TEXT NOT NULL,  -- 'oidc', 'saml', 'api'
    
    -- OIDC specific fields
    client_id TEXT,
    client_secret TEXT,
    redirect_uris JSONB,
    response_types JSONB,
    grant_types JSONB,
    oidc_app_type TEXT,  -- 'web', 'user_agent', 'native'
    auth_method_type TEXT,
    post_logout_redirect_uris JSONB,
    version INTEGER DEFAULT 1,
    dev_mode BOOLEAN DEFAULT false,
    access_token_type TEXT DEFAULT 'bearer',
    access_token_role_assertion BOOLEAN DEFAULT false,
    id_token_role_assertion BOOLEAN DEFAULT false,
    id_token_userinfo_assertion BOOLEAN DEFAULT false,
    clock_skew INTEGER DEFAULT 0,
    additional_origins JSONB,
    skip_native_app_success_page BOOLEAN DEFAULT false,
    
    -- SAML specific fields
    entity_id TEXT,
    metadata_url TEXT,
    metadata TEXT,  -- XML metadata
    acs_urls JSONB,
    single_logout_url TEXT,
    name_id_format TEXT,
    attribute_statements JSONB,
    
    -- API specific fields (uses client_id, client_secret, auth_method_type from OIDC)
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    change_date TIMESTAMP WITH TIME ZONE,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Constraints
    PRIMARY KEY (instance_id, id)
    -- Note: No foreign key to avoid race conditions between projections
);

-- Index on instance_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_applications_instance_id ON applications_projection(instance_id);

-- Index on project_id for listing apps by project
CREATE INDEX IF NOT EXISTS idx_applications_project_id ON applications_projection(instance_id, project_id);

-- Index on resource_owner
CREATE INDEX IF NOT EXISTS idx_applications_resource_owner ON applications_projection(instance_id, resource_owner);

-- Index on app_type for filtering
CREATE INDEX IF NOT EXISTS idx_applications_type ON applications_projection(instance_id, app_type);

-- Index on state for filtering
CREATE INDEX IF NOT EXISTS idx_applications_state ON applications_projection(instance_id, state);

-- Index on name for search
CREATE INDEX IF NOT EXISTS idx_applications_name ON applications_projection(instance_id, name);

-- Unique index on client_id for OIDC/API apps (allows NULL) - scoped by instance
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_client_id ON applications_projection(instance_id, client_id) WHERE client_id IS NOT NULL;

-- Unique index on entity_id for SAML apps (allows NULL) - scoped by instance
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_entity_id ON applications_projection(instance_id, entity_id) WHERE entity_id IS NOT NULL;

-- Composite index for project + app lookup
CREATE INDEX IF NOT EXISTS idx_applications_project_app ON applications_projection(instance_id, project_id, id);

-- Comment
COMMENT ON TABLE applications_projection IS 'Read model for applications (OIDC, SAML, API)';
COMMENT ON COLUMN applications_projection.app_type IS 'Application type: oidc, saml, or api';
COMMENT ON COLUMN applications_projection.client_id IS 'OAuth2/OIDC client identifier (OIDC and API apps)';
COMMENT ON COLUMN applications_projection.entity_id IS 'SAML entity identifier (SAML apps only)';


-- From: 002_23_create_instances_projection_table.sql
-- Migration: 002_23 - Create instances projection table
-- Description: Store instance data for multi-tenant management
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS instances_projection (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_org_id TEXT,
    default_language TEXT,
    state TEXT NOT NULL DEFAULT 'active',
    features JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Index for state-based queries
CREATE INDEX IF NOT EXISTS idx_instances_state ON instances_projection(state);

-- Index for name lookups
CREATE INDEX IF NOT EXISTS idx_instances_name ON instances_projection(name);


-- From: 002_24_create_instance_domains_projection_table.sql
-- Migration: 002_24 - Create instance domains projection table
-- Description: Store instance domain mappings for host-based resolution
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS instance_domains_projection (
    instance_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_generated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, domain)
);

-- Index for domain lookups (critical for host-based instance resolution)
CREATE INDEX IF NOT EXISTS idx_instance_domains_domain ON instance_domains_projection(domain);

-- Index for primary domain lookups
CREATE INDEX IF NOT EXISTS idx_instance_domains_primary ON instance_domains_projection(instance_id, is_primary);


-- From: 002_25_create_instance_trusted_domains_projection_table.sql
-- Migration: 002_25 - Create instance trusted domains projection table
-- Description: Store trusted domains for CORS and redirect validation
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS instance_trusted_domains_projection (
    instance_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, domain)
);

-- Index for instance-based lookups
CREATE INDEX IF NOT EXISTS idx_instance_trusted_domains_instance ON instance_trusted_domains_projection(instance_id);


-- From: 002_26_create_sessions_projection_table.sql
-- Create sessions projection table
-- This table stores the read model for session queries

CREATE TABLE IF NOT EXISTS sessions_projection (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  user_id TEXT,
  user_agent TEXT,
  client_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at TIMESTAMPTZ,
  sequence BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  tokens JSONB DEFAULT '[]',
  factors JSONB DEFAULT '[]'
);

-- Index for instance lookups
CREATE INDEX IF NOT EXISTS idx_sessions_instance_id ON sessions_projection(instance_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions_projection(user_id);

-- Index for state queries
CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions_projection(state);

-- Composite index for active sessions by user
CREATE INDEX IF NOT EXISTS idx_sessions_user_state ON sessions_projection(user_id, state);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions_projection(created_at DESC);

-- Index for updated_at sorting
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions_projection(updated_at DESC);

-- Composite index for instance + user queries
CREATE INDEX IF NOT EXISTS idx_sessions_instance_user ON sessions_projection(instance_id, user_id);


-- From: 002_27_create_login_names_projection_table.sql
-- Create login names projection table
-- This table stores denormalized login names for fast user lookups

CREATE TABLE IF NOT EXISTS login_names_projection (
  user_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  resource_owner TEXT NOT NULL,
  login_name TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite primary key: instance + login_name must be unique
  PRIMARY KEY (instance_id, login_name)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_login_names_user_id ON login_names_projection(user_id);

-- Index for instance lookups
CREATE INDEX IF NOT EXISTS idx_login_names_instance_id ON login_names_projection(instance_id);

-- Index for resource owner (org) lookups
CREATE INDEX IF NOT EXISTS idx_login_names_resource_owner ON login_names_projection(resource_owner);

-- Index for domain name lookups
CREATE INDEX IF NOT EXISTS idx_login_names_domain_name ON login_names_projection(domain_name);

-- Index for primary login name queries
CREATE INDEX IF NOT EXISTS idx_login_names_is_primary ON login_names_projection(is_primary) WHERE is_primary = TRUE;

-- Composite index for user + instance queries
CREATE INDEX IF NOT EXISTS idx_login_names_user_instance ON login_names_projection(user_id, instance_id);

-- Index for fast login name lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_login_names_lookup ON login_names_projection(instance_id, login_name);


-- From: 002_28_update_users_projection_multi_tenant.sql
-- Migration: 002_28 - Update users_projection for multi-tenant support
-- Description: Add change_date, sequence, update primary key to (instance_id, id)
-- Phase: Phase 2 - Add Audit Columns
-- Date: 2025-10-22

-- Step 1: Add missing columns
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sequence BIGINT NOT NULL DEFAULT 0;

-- Step 2: Drop foreign keys from dependent tables before updating PK
ALTER TABLE user_metadata DROP CONSTRAINT IF EXISTS fk_user_metadata_user;
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS fk_user_addresses_user;

-- Step 3: Update primary key to include instance_id
-- Note: This requires dropping and recreating the constraint
ALTER TABLE users_projection DROP CONSTRAINT IF EXISTS users_projection_pkey;
ALTER TABLE users_projection ADD PRIMARY KEY (instance_id, id);

-- Step 3: Update unique constraints to be scoped by instance_id (already correct)
-- users_projection_unique_username already has (instance_id, username)
-- users_projection_unique_email already has (instance_id, email)

-- Step 4: Update indexes to include instance_id where appropriate
-- Most indexes already correctly use instance_id
-- Add index on change_date for temporal queries
CREATE INDEX IF NOT EXISTS idx_users_change_date ON users_projection(instance_id, change_date DESC) WHERE deleted_at IS NULL;

-- Add index on sequence for event ordering
CREATE INDEX IF NOT EXISTS idx_users_sequence ON users_projection(instance_id, sequence DESC) WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN users_projection.change_date IS 'Timestamp of last change from event';
COMMENT ON COLUMN users_projection.sequence IS 'Event sequence number for ordering';
COMMENT ON TABLE users_projection IS 'Multi-tenant user projection with composite primary key (instance_id, id)';


-- From: 002_29_update_user_metadata_multi_tenant.sql
-- Migration: 002_29 - Update user_metadata for multi-tenant support
-- Description: Add change_date, sequence, update primary key to (instance_id, id)
-- Phase: Phase 2 - Add Audit Columns
-- Date: 2025-10-22

-- Step 1: Add missing columns
ALTER TABLE user_metadata 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sequence BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS resource_owner TEXT;

-- Step 2: Drop existing foreign key constraint (references old PK)
ALTER TABLE user_metadata DROP CONSTRAINT IF EXISTS fk_user_metadata_user;

-- Step 3: Update primary key to include instance_id
ALTER TABLE user_metadata DROP CONSTRAINT IF EXISTS user_metadata_pkey;
ALTER TABLE user_metadata ADD PRIMARY KEY (instance_id, id);

-- Step 4: Update foreign key to use composite key (after users_projection migration)
-- Note: This assumes users_projection already has (instance_id, id) PK
ALTER TABLE user_metadata 
ADD CONSTRAINT fk_user_metadata_user 
    FOREIGN KEY (instance_id, user_id) 
    REFERENCES users_projection(instance_id, id) 
    ON DELETE CASCADE;

-- Step 5: Drop old unique indexes and recreate with instance_id
DROP INDEX IF EXISTS user_metadata_unique_key_null_scope_idx;
DROP INDEX IF EXISTS user_metadata_unique_key_with_scope_idx;

-- Unique constraint for NULL scopes (scoped by instance)
CREATE UNIQUE INDEX IF NOT EXISTS user_metadata_unique_key_null_scope_idx
ON user_metadata(instance_id, user_id, metadata_key)
WHERE scope IS NULL;

-- Unique constraint for non-NULL scopes (scoped by instance)
CREATE UNIQUE INDEX IF NOT EXISTS user_metadata_unique_key_with_scope_idx
ON user_metadata(instance_id, user_id, metadata_key, scope)
WHERE scope IS NOT NULL;

-- Step 6: Update existing indexes to include instance_id
DROP INDEX IF EXISTS user_metadata_user_id_idx;
CREATE INDEX IF NOT EXISTS user_metadata_user_id_idx 
ON user_metadata(instance_id, user_id);

DROP INDEX IF EXISTS user_metadata_key_idx;
CREATE INDEX IF NOT EXISTS user_metadata_key_idx 
ON user_metadata(instance_id, metadata_key);

DROP INDEX IF EXISTS user_metadata_type_idx;
CREATE INDEX IF NOT EXISTS user_metadata_type_idx 
ON user_metadata(instance_id, metadata_type);

DROP INDEX IF EXISTS user_metadata_scope_idx;
CREATE INDEX IF NOT EXISTS user_metadata_scope_idx 
ON user_metadata(instance_id, scope) 
WHERE scope IS NOT NULL;

-- Step 7: Add new temporal indexes
CREATE INDEX IF NOT EXISTS idx_user_metadata_change_date 
ON user_metadata(instance_id, change_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_metadata_sequence 
ON user_metadata(instance_id, sequence DESC);

-- Step 8: Add index on resource_owner
CREATE INDEX IF NOT EXISTS idx_user_metadata_resource_owner 
ON user_metadata(instance_id, resource_owner);

-- Comments for documentation
COMMENT ON COLUMN user_metadata.change_date IS 'Timestamp of last change from event';
COMMENT ON COLUMN user_metadata.sequence IS 'Event sequence number for ordering';
COMMENT ON COLUMN user_metadata.resource_owner IS 'Organization that owns this metadata';
COMMENT ON TABLE user_metadata IS 'Multi-tenant flexible key-value metadata storage with composite PK (instance_id, id)';


-- From: 002_31_update_login_names_projection_multi_tenant.sql
-- Migration: 002_31 - Update login_names_projection for multi-tenant support
-- Description: Add change_date, sequence columns (PK already correct)
-- Phase: Phase 2 - Add Audit Columns
-- Date: 2025-10-22

-- Step 1: Add missing audit columns
ALTER TABLE login_names_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sequence BIGINT NOT NULL DEFAULT 0;

-- Step 2: Primary key is already correct: (instance_id, login_name)
-- No changes needed

-- Step 3: Add indexes on audit columns for temporal queries
CREATE INDEX IF NOT EXISTS idx_login_names_change_date 
ON login_names_projection(instance_id, change_date DESC) 
WHERE change_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_login_names_sequence 
ON login_names_projection(instance_id, sequence DESC) 
WHERE sequence > 0;

-- Add comments for documentation
COMMENT ON COLUMN login_names_projection.change_date IS 'Timestamp of last change from event';
COMMENT ON COLUMN login_names_projection.sequence IS 'Event sequence number for ordering';
COMMENT ON TABLE login_names_projection IS 'Multi-tenant login names projection with composite primary key (instance_id, login_name)';


-- From: 002_32_update_org_domains_projection_multi_tenant.sql
-- Migration: 002_32 - Update org_domains_projection for multi-tenant support
-- Description: Add instance_id, change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment

-- Step 1: Add instance_id column if not exists
ALTER TABLE org_domains_projection 
ADD COLUMN IF NOT EXISTS instance_id TEXT NOT NULL DEFAULT 'default-instance';

-- Step 2: Add change_date column if not exists
ALTER TABLE org_domains_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Drop existing unique constraint on domain (will be recreated with instance_id)
DROP INDEX IF EXISTS idx_org_domains_domain_unique;

-- Step 4: Drop existing primary key
ALTER TABLE org_domains_projection DROP CONSTRAINT IF EXISTS org_domains_projection_pkey;

-- Step 5: Add new composite primary key (instance_id, org_id, domain)
ALTER TABLE org_domains_projection 
ADD PRIMARY KEY (instance_id, org_id, domain);

-- Step 6: Recreate unique domain index with instance_id
CREATE UNIQUE INDEX idx_org_domains_domain_unique 
ON org_domains_projection(instance_id, domain);

-- Step 7: Update org_id index to include instance_id
DROP INDEX IF EXISTS idx_org_domains_org_id;
CREATE INDEX idx_org_domains_org_id 
ON org_domains_projection(instance_id, org_id);

-- Step 8: Update verified index to include instance_id
DROP INDEX IF EXISTS idx_org_domains_verified;
CREATE INDEX idx_org_domains_verified 
ON org_domains_projection(instance_id, is_verified);

-- Step 9: Update primary domain index to include instance_id
DROP INDEX IF EXISTS idx_org_domains_primary;
CREATE INDEX idx_org_domains_primary 
ON org_domains_projection(instance_id, org_id, is_primary) 
WHERE is_primary = TRUE;

-- Step 10: Add temporal index for change tracking
CREATE INDEX IF NOT EXISTS idx_org_domains_change_date 
ON org_domains_projection(instance_id, change_date DESC);

-- Step 11: Add sequence index for ordering
CREATE INDEX IF NOT EXISTS idx_org_domains_sequence 
ON org_domains_projection(instance_id, sequence DESC);

-- Step 12: Add foreign key to orgs_projection
-- Note: orgs_projection already has composite key (instance_id, id) from Phase 1
ALTER TABLE org_domains_projection 
DROP CONSTRAINT IF EXISTS fk_org_domains_org;

ALTER TABLE org_domains_projection 
ADD CONSTRAINT fk_org_domains_org 
FOREIGN KEY (instance_id, org_id) 
REFERENCES orgs_projection(instance_id, id) 
ON DELETE CASCADE;

-- Comment
COMMENT ON COLUMN org_domains_projection.instance_id IS 'Multi-tenant instance identifier';
COMMENT ON COLUMN org_domains_projection.change_date IS 'Timestamp of last change for audit tracking';


-- From: 002_33_update_project_roles_projection_multi_tenant.sql
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


-- From: 002_34_update_instances_projection_multi_tenant.sql
-- Migration: 002_34 - Update instances_projection for multi-tenant support
-- Description: Add instance_id (equals id) and change_date columns
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Special Case: For instances_projection, instance_id = id

-- Step 1: Add instance_id column (should equal id for this table)
ALTER TABLE instances_projection 
ADD COLUMN IF NOT EXISTS instance_id TEXT;

-- Step 2: Set instance_id to equal id for existing rows
UPDATE instances_projection SET instance_id = id WHERE instance_id IS NULL;

-- Step 3: Make instance_id NOT NULL
ALTER TABLE instances_projection 
ALTER COLUMN instance_id SET NOT NULL;

-- Step 4: Add change_date column
ALTER TABLE instances_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 5: Add check constraint to ensure instance_id = id
ALTER TABLE instances_projection 
ADD CONSTRAINT chk_instances_id_equals_instance_id 
CHECK (instance_id = id);

-- Step 6: Add index on instance_id for consistency with other tables
CREATE INDEX IF NOT EXISTS idx_instances_instance_id 
ON instances_projection(instance_id);

-- Step 7: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_instances_change_date 
ON instances_projection(change_date DESC);

-- Comments
COMMENT ON COLUMN instances_projection.instance_id IS 'Instance ID (equals id for this table, for consistency with multi-tenant schema)';
COMMENT ON COLUMN instances_projection.change_date IS 'Timestamp of last event that changed this instance';
COMMENT ON CONSTRAINT chk_instances_id_equals_instance_id ON instances_projection IS 'Ensures instance_id always equals id';


-- From: 002_35_update_instance_domains_projection_multi_tenant.sql
-- Migration: 002_35 - Update instance_domains_projection for multi-tenant support
-- Description: Add change_date column (PK already has instance_id)
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists in PK (instance_id, domain)

-- Step 1: Add change_date column
ALTER TABLE instance_domains_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_instance_domains_change_date 
ON instance_domains_projection(change_date DESC);

-- Comment
COMMENT ON COLUMN instance_domains_projection.change_date IS 'Timestamp of last event that changed this domain mapping';


-- From: 002_36_update_instance_trusted_domains_projection_multi_tenant.sql
-- Migration: 002_36 - Update instance_trusted_domains_projection for multi-tenant support
-- Description: Add change_date column (PK already has instance_id)
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists in PK (instance_id, domain)

-- Step 1: Add change_date column
ALTER TABLE instance_trusted_domains_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_instance_trusted_domains_change_date 
ON instance_trusted_domains_projection(change_date DESC);

-- Comment
COMMENT ON COLUMN instance_trusted_domains_projection.change_date IS 'Timestamp of last event that changed this trusted domain';


-- From: 002_37_update_sessions_projection_multi_tenant.sql
-- Migration: 002_37 - Update sessions_projection for multi-tenant support
-- Description: Add change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists, need to update PK

-- Step 1: Add change_date column
ALTER TABLE sessions_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop existing primary key
ALTER TABLE sessions_projection DROP CONSTRAINT IF EXISTS sessions_projection_pkey;

-- Step 3: Add new composite primary key (instance_id, id)
ALTER TABLE sessions_projection 
ADD PRIMARY KEY (instance_id, id);

-- Step 4: Update indexes to include instance_id
DROP INDEX IF EXISTS idx_sessions_user_id;
CREATE INDEX idx_sessions_user_id 
ON sessions_projection(instance_id, user_id);

DROP INDEX IF EXISTS idx_sessions_state;
CREATE INDEX idx_sessions_state 
ON sessions_projection(instance_id, state);

DROP INDEX IF EXISTS idx_sessions_user_state;
CREATE INDEX idx_sessions_user_state 
ON sessions_projection(instance_id, user_id, state);

DROP INDEX IF EXISTS idx_sessions_created_at;
CREATE INDEX idx_sessions_created_at 
ON sessions_projection(instance_id, created_at DESC);

DROP INDEX IF EXISTS idx_sessions_updated_at;
CREATE INDEX idx_sessions_updated_at 
ON sessions_projection(instance_id, updated_at DESC);

-- Step 5: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_sessions_change_date 
ON sessions_projection(change_date DESC);

-- Comment
COMMENT ON COLUMN sessions_projection.change_date IS 'Timestamp of last event that changed this session';


-- From: 002_38_update_user_addresses_multi_tenant.sql
-- Migration: 002_38 - Update user_addresses for multi-tenant support
-- Description: Add change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists

-- Step 1: Add change_date column
ALTER TABLE user_addresses 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop foreign key constraint (will recreate with composite key)
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS fk_user_addresses_user;

-- Step 3: Drop existing primary key
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS user_addresses_pkey;

-- Step 4: Add new composite primary key (instance_id, id)
ALTER TABLE user_addresses 
ADD PRIMARY KEY (instance_id, id);

-- Step 5: Update indexes to include instance_id
DROP INDEX IF EXISTS user_addresses_user_id_idx;
CREATE INDEX user_addresses_user_id_idx 
ON user_addresses(instance_id, user_id);

DROP INDEX IF EXISTS user_addresses_type_idx;
CREATE INDEX user_addresses_type_idx 
ON user_addresses(instance_id, address_type);

-- Step 6: Update unique primary address constraint
DROP INDEX IF EXISTS user_addresses_primary_unique_idx;
CREATE UNIQUE INDEX user_addresses_primary_unique_idx 
ON user_addresses(instance_id, user_id) 
WHERE is_primary = true;

-- Step 7: Add temporal indexes
CREATE INDEX IF NOT EXISTS user_addresses_change_date 
ON user_addresses(change_date DESC);

CREATE INDEX IF NOT EXISTS user_addresses_created_at 
ON user_addresses(created_at DESC);

-- Step 8: Recreate foreign key with composite key reference
ALTER TABLE user_addresses 
ADD CONSTRAINT fk_user_addresses_user 
  FOREIGN KEY (instance_id, user_id) 
  REFERENCES users_projection(instance_id, id) 
  ON DELETE CASCADE;

-- Comments
COMMENT ON COLUMN user_addresses.change_date IS 'Timestamp of last change to this address';


-- From: 002_39_update_notification_providers_multi_tenant.sql
-- Migration: 002_39 - Update notification_providers for multi-tenant support
-- Description: Add change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists

-- Step 1: Add change_date column
ALTER TABLE notification_providers 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop existing UNIQUE constraint
ALTER TABLE notification_providers 
DROP CONSTRAINT IF EXISTS notification_providers_instance_id_provider_type_key;

-- Step 3: Drop existing primary key
ALTER TABLE notification_providers DROP CONSTRAINT IF EXISTS notification_providers_pkey;

-- Step 4: Add new composite primary key (instance_id, id)
ALTER TABLE notification_providers 
ADD PRIMARY KEY (instance_id, id);

-- Step 5: Recreate unique constraint with instance_id awareness
ALTER TABLE notification_providers 
ADD CONSTRAINT notification_providers_instance_provider_unique 
UNIQUE (instance_id, provider_type);

-- Step 6: Update indexes to include instance_id
DROP INDEX IF EXISTS idx_notification_providers_type;
CREATE INDEX idx_notification_providers_type 
ON notification_providers(instance_id, provider_type);

DROP INDEX IF EXISTS idx_notification_providers_enabled;
CREATE INDEX idx_notification_providers_enabled 
ON notification_providers(instance_id, enabled);

-- Step 7: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_notification_providers_change_date 
ON notification_providers(change_date DESC);

-- Comments
COMMENT ON COLUMN notification_providers.change_date IS 'Timestamp of last change to this provider configuration';


-- From: 002_40_update_email_configs_multi_tenant.sql
-- Migration: 002_40 - Update email_configs for multi-tenant support
-- Description: Add change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists with UNIQUE constraint

-- Step 1: Add change_date column
ALTER TABLE email_configs 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop existing UNIQUE constraint on instance_id
ALTER TABLE email_configs 
DROP CONSTRAINT IF EXISTS email_configs_instance_id_key;

-- Step 3: Drop existing primary key
ALTER TABLE email_configs DROP CONSTRAINT IF EXISTS email_configs_pkey;

-- Step 4: Add new composite primary key (instance_id, id)
ALTER TABLE email_configs 
ADD PRIMARY KEY (instance_id, id);

-- Step 5: Update indexes to include instance_id explicitly
DROP INDEX IF EXISTS idx_email_configs_enabled;
CREATE INDEX idx_email_configs_enabled 
ON email_configs(instance_id, enabled);

-- Step 6: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_email_configs_change_date 
ON email_configs(change_date DESC);

-- Comments
COMMENT ON COLUMN email_configs.change_date IS 'Timestamp of last change to this email configuration';


-- From: 002_41_update_sms_configs_multi_tenant.sql
-- Migration: 002_41 - Update sms_configs for multi-tenant support
-- Description: Add change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists with UNIQUE constraint

-- Step 1: Add change_date column
ALTER TABLE sms_configs 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop existing UNIQUE constraint on instance_id
ALTER TABLE sms_configs 
DROP CONSTRAINT IF EXISTS sms_configs_instance_id_key;

-- Step 3: Drop existing primary key
ALTER TABLE sms_configs DROP CONSTRAINT IF EXISTS sms_configs_pkey;

-- Step 4: Add new composite primary key (instance_id, id)
ALTER TABLE sms_configs 
ADD PRIMARY KEY (instance_id, id);

-- Step 5: Update indexes to include instance_id explicitly
DROP INDEX IF EXISTS idx_sms_configs_provider;
CREATE INDEX idx_sms_configs_provider 
ON sms_configs(instance_id, provider);

DROP INDEX IF EXISTS idx_sms_configs_enabled;
CREATE INDEX idx_sms_configs_enabled 
ON sms_configs(instance_id, enabled);

-- Step 6: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_sms_configs_change_date 
ON sms_configs(change_date DESC);

-- Comments
COMMENT ON COLUMN sms_configs.change_date IS 'Timestamp of last change to this SMS configuration';


-- From: 002_42_update_notification_config_changes_multi_tenant.sql
-- Migration: 002_42 - Update notification_config_changes for multi-tenant support
-- Description: Update to composite primary key (audit table)
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists, no change_date needed (audit log)

-- Step 1: Drop existing primary key
ALTER TABLE notification_config_changes DROP CONSTRAINT IF EXISTS notification_config_changes_pkey;

-- Step 2: Add new composite primary key (instance_id, id)
ALTER TABLE notification_config_changes 
ADD PRIMARY KEY (instance_id, id);

-- Step 3: Update indexes to include instance_id
DROP INDEX IF EXISTS idx_config_changes_type;
CREATE INDEX idx_config_changes_type 
ON notification_config_changes(instance_id, config_type);

DROP INDEX IF EXISTS idx_config_changes_created;
CREATE INDEX idx_config_changes_created 
ON notification_config_changes(instance_id, created_at DESC);

-- Comments
COMMENT ON TABLE notification_config_changes IS 'Audit log for configuration changes - per instance isolation via composite PK';


-- From: 002_43_create_user_auth_methods_projection_table.sql
-- Migration: 002_43 - Create user_auth_methods_projection table
-- Description: Track user authentication methods (password, OTP, U2F, passwordless)
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: CRITICAL

CREATE TABLE IF NOT EXISTS user_auth_methods_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    method_type TEXT NOT NULL,  -- 'password', 'otp', 'u2f', 'passwordless', 'totp'
    state TEXT NOT NULL DEFAULT 'active',
    token_id TEXT,
    public_key BYTEA,
    name TEXT,  -- User-friendly name for the method
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Foreign key to users
ALTER TABLE user_auth_methods_projection 
ADD CONSTRAINT fk_user_auth_methods_user 
  FOREIGN KEY (instance_id, user_id) 
  REFERENCES users_projection(instance_id, id) 
  ON DELETE CASCADE;

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_id 
ON user_auth_methods_projection(instance_id, user_id);

-- Index for method type queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_type 
ON user_auth_methods_projection(instance_id, method_type);

-- Index for state queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_state 
ON user_auth_methods_projection(instance_id, state);

-- Composite index for user + type queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_user_type 
ON user_auth_methods_projection(instance_id, user_id, method_type);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_user_auth_methods_change_date 
ON user_auth_methods_projection(change_date DESC);

-- Comments
COMMENT ON TABLE user_auth_methods_projection IS 'Tracks all authentication methods configured for users';
COMMENT ON COLUMN user_auth_methods_projection.method_type IS 'Type of auth method: password, otp, u2f, passwordless, totp';
COMMENT ON COLUMN user_auth_methods_projection.state IS 'State of auth method: active, inactive';
COMMENT ON COLUMN user_auth_methods_projection.token_id IS 'Token ID for OTP/U2F methods';
COMMENT ON COLUMN user_auth_methods_projection.public_key IS 'Public key for U2F/passwordless methods';


-- From: 002_44_create_personal_access_tokens_projection_table.sql
-- Migration: 002_44 - Create personal_access_tokens_projection table
-- Description: Track Personal Access Tokens (PATs) for API access
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: CRITICAL

CREATE TABLE IF NOT EXISTS personal_access_tokens_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{}',
    expiration_date TIMESTAMPTZ,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Foreign key to users
ALTER TABLE personal_access_tokens_projection 
ADD CONSTRAINT fk_personal_access_tokens_user 
  FOREIGN KEY (instance_id, user_id) 
  REFERENCES users_projection(instance_id, id) 
  ON DELETE CASCADE;

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_user_id 
ON personal_access_tokens_projection(instance_id, user_id);

-- Index for token hash lookups (for authentication)
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_hash 
ON personal_access_tokens_projection(token_hash);

-- Index for expiration date (for cleanup queries)
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_expiration 
ON personal_access_tokens_projection(instance_id, expiration_date);

-- Index for last used (for activity monitoring)
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_last_used 
ON personal_access_tokens_projection(instance_id, last_used DESC);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_change_date 
ON personal_access_tokens_projection(change_date DESC);

-- Comments
COMMENT ON TABLE personal_access_tokens_projection IS 'Personal Access Tokens for API authentication';
COMMENT ON COLUMN personal_access_tokens_projection.token_hash IS 'Hashed token value for secure storage';
COMMENT ON COLUMN personal_access_tokens_projection.scopes IS 'OAuth scopes granted to this token';
COMMENT ON COLUMN personal_access_tokens_projection.expiration_date IS 'When this token expires (NULL = never)';
COMMENT ON COLUMN personal_access_tokens_projection.last_used IS 'Last time this token was used for authentication';


-- From: 002_46_create_lockout_policies_projection_table.sql
-- Migration: 002_46 - Create lockout_policies_projection table
-- Description: Configure account lockout policies
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: MEDIUM

CREATE TABLE IF NOT EXISTS lockout_policies_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    max_password_attempts INTEGER NOT NULL DEFAULT 5,
    max_otp_attempts INTEGER NOT NULL DEFAULT 5,
    show_failure BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Index for resource owner lookups
CREATE INDEX IF NOT EXISTS idx_lockout_policies_resource_owner 
ON lockout_policies_projection(instance_id, resource_owner);

-- Index for default policy lookups
CREATE INDEX IF NOT EXISTS idx_lockout_policies_is_default 
ON lockout_policies_projection(instance_id, is_default) 
WHERE is_default = true;

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_lockout_policies_change_date 
ON lockout_policies_projection(change_date DESC);

-- Comments
COMMENT ON TABLE lockout_policies_projection IS 'Account lockout policies for failed authentication attempts';
COMMENT ON COLUMN lockout_policies_projection.max_password_attempts IS 'Maximum failed password attempts before lockout';
COMMENT ON COLUMN lockout_policies_projection.max_otp_attempts IS 'Maximum failed OTP attempts before lockout';
COMMENT ON COLUMN lockout_policies_projection.show_failure IS 'Whether to show failure details to user';
COMMENT ON COLUMN lockout_policies_projection.is_default IS 'Whether this is the default instance policy';


-- From: 002_50_create_quotas_table.sql
-- Migration: 002_50 - Create quotas table
-- Description: Track resource usage quotas and limits per instance/org
-- Date: 2025-10-23
-- Phase: Immediate - Resource Management
-- Priority: MEDIUM

CREATE TABLE IF NOT EXISTS quotas (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,  -- instance or org ID
    unit TEXT NOT NULL,  -- 'requests_all_authenticated', 'actions_all_runs_seconds', etc.
    amount BIGINT NOT NULL DEFAULT 0,  -- Quota limit
    limit_usage BOOLEAN NOT NULL DEFAULT false,  -- Whether to enforce limit
    from_anchor TIMESTAMPTZ NOT NULL,  -- Start of quota period
    interval INTERVAL,  -- Quota reset interval (e.g., '1 month')
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id)
);

-- Index for querying by resource owner
CREATE INDEX IF NOT EXISTS idx_quotas_resource_owner 
ON quotas(instance_id, resource_owner);

-- Index for querying by unit type
CREATE INDEX IF NOT EXISTS idx_quotas_unit 
ON quotas(instance_id, unit);

-- Index for querying active quotas
CREATE INDEX IF NOT EXISTS idx_quotas_limit_usage 
ON quotas(instance_id, limit_usage) WHERE limit_usage = true;

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_quotas_change_date 
ON quotas(change_date DESC);

-- Comments
COMMENT ON TABLE quotas IS 'Resource usage quotas and limits per instance/organization';
COMMENT ON COLUMN quotas.unit IS 'Type of resource being limited (requests, actions, users, etc.)';
COMMENT ON COLUMN quotas.amount IS 'Maximum allowed amount for the quota period';
COMMENT ON COLUMN quotas.limit_usage IS 'Whether to actively enforce this quota limit';
COMMENT ON COLUMN quotas.from_anchor IS 'Start timestamp for quota period calculation';
COMMENT ON COLUMN quotas.interval IS 'Time period for quota reset (e.g., monthly, yearly)';

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS quota_notifications (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    quota_id TEXT NOT NULL,
    call_url TEXT NOT NULL,  -- Webhook URL to call when threshold reached
    percent INTEGER NOT NULL,  -- Percentage threshold (e.g., 80, 100)
    repeat BOOLEAN NOT NULL DEFAULT false,  -- Whether to repeat notification
    latest_notified_at TIMESTAMPTZ,  -- Last time notification was sent
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (instance_id, id),
    FOREIGN KEY (instance_id, quota_id) REFERENCES quotas(instance_id, id) ON DELETE CASCADE
);

-- Index for querying notifications by quota
CREATE INDEX IF NOT EXISTS idx_quota_notifications_quota 
ON quota_notifications(instance_id, quota_id);

-- Index for querying by percentage threshold
CREATE INDEX IF NOT EXISTS idx_quota_notifications_percent 
ON quota_notifications(percent);

COMMENT ON TABLE quota_notifications IS 'Webhook notifications for quota threshold alerts';
COMMENT ON COLUMN quota_notifications.percent IS 'Percentage of quota that triggers notification (0-100)';
COMMENT ON COLUMN quota_notifications.repeat IS 'Whether to send repeated notifications';


-- From: 002_51_create_actions_tables.sql
-- Migration: Create Actions and Executions Tables
-- Description: Add tables for workflow actions and their execution tracking
-- Version: 002_51
-- Date: 2025-10-23

-- Actions table: Stores workflow actions that can be triggered by events
CREATE TABLE IF NOT EXISTS actions_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL,
    
    -- Action metadata
    name TEXT NOT NULL,
    script TEXT NOT NULL,
    timeout INTERVAL NOT NULL DEFAULT '10 seconds',
    allowed_to_fail BOOLEAN NOT NULL DEFAULT false,
    
    -- State
    state SMALLINT NOT NULL DEFAULT 1, -- 1=active, 2=inactive
    
    PRIMARY KEY (instance_id, id)
);

-- Indexes for actions
CREATE INDEX IF NOT EXISTS idx_actions_resource_owner 
    ON actions_projection(resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS idx_actions_state 
    ON actions_projection(instance_id, state);

CREATE INDEX IF NOT EXISTS idx_actions_change_date 
    ON actions_projection(instance_id, change_date DESC);

-- Action flows table: Maps actions to event triggers
CREATE TABLE IF NOT EXISTS action_flows_projection (
    flow_type TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    action_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_owner TEXT NOT NULL,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence BIGINT NOT NULL,
    
    -- Trigger configuration
    trigger_sequence SMALLINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, flow_type, trigger_type, action_id)
);

-- Indexes for action_flows
CREATE INDEX IF NOT EXISTS idx_action_flows_action 
    ON action_flows_projection(instance_id, action_id);

CREATE INDEX IF NOT EXISTS idx_action_flows_trigger 
    ON action_flows_projection(instance_id, flow_type, trigger_type);

-- Executions table: Tracks action execution history
CREATE TABLE IF NOT EXISTS executions_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    
    -- Execution metadata
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    event_sequence BIGINT NOT NULL,
    
    -- Execution details
    targets JSONB, -- Array of targets (methods, functions, webhooks)
    
    PRIMARY KEY (instance_id, id)
);

-- Indexes for executions
CREATE INDEX IF NOT EXISTS idx_executions_aggregate 
    ON executions_projection(instance_id, aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_executions_action 
    ON executions_projection(instance_id, action_id);

CREATE INDEX IF NOT EXISTS idx_executions_date 
    ON executions_projection(instance_id, creation_date DESC);

CREATE INDEX IF NOT EXISTS idx_executions_event 
    ON executions_projection(instance_id, event_type, event_sequence);

-- Execution states table: Tracks execution progress and results
CREATE TABLE IF NOT EXISTS execution_states_projection (
    execution_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    
    -- State tracking
    state SMALLINT NOT NULL DEFAULT 0, -- 0=pending, 1=running, 2=success, 3=failed, 4=timeout
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    retry_count SMALLINT NOT NULL DEFAULT 0,
    
    -- Response data
    response JSONB,
    
    PRIMARY KEY (instance_id, execution_id, target_id)
);

-- Indexes for execution_states
CREATE INDEX IF NOT EXISTS idx_execution_states_execution 
    ON execution_states_projection(instance_id, execution_id);

CREATE INDEX IF NOT EXISTS idx_execution_states_state 
    ON execution_states_projection(instance_id, state);

CREATE INDEX IF NOT EXISTS idx_execution_states_finished 
    ON execution_states_projection(instance_id, finished_at DESC)
    WHERE finished_at IS NOT NULL;

-- Comments
COMMENT ON TABLE actions_projection IS 'Workflow actions that can be triggered by events';
COMMENT ON TABLE action_flows_projection IS 'Maps actions to event triggers';
COMMENT ON TABLE executions_projection IS 'Action execution history';
COMMENT ON TABLE execution_states_projection IS 'Tracks execution progress and results for each target';


-- From: 002_52_create_logstore_tables.sql
-- Migration: Create Logstore Tables
-- Description: Add tables for comprehensive audit logging beyond events
-- Version: 002_52
-- Date: 2025-10-23

-- Create logstore schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS logstore;

-- Logstore table: Comprehensive audit trail
-- Note: Partitioning can be added later for scale; starting simple for reliability
CREATE TABLE IF NOT EXISTS logstore.logs (
    instance_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Occurrence metadata
    occurrence_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_sequence BIGINT,
    event_type TEXT,
    
    -- User context
    user_id TEXT,
    resource_owner TEXT NOT NULL,
    
    -- Request metadata
    protocol SMALLINT NOT NULL DEFAULT 0, -- 0=unknown, 1=http, 2=grpc, 3=graphql
    request_url TEXT,
    request_method TEXT,
    request_headers JSONB,
    
    -- Response metadata
    response_status INTEGER,
    response_time_ms INTEGER,
    
    -- Additional data
    log_level SMALLINT NOT NULL DEFAULT 1, -- 1=info, 2=warn, 3=error, 4=debug
    message TEXT,
    metadata JSONB,
    
    PRIMARY KEY (instance_id, log_id)
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_logs_date 
    ON logstore.logs(instance_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_logs_aggregate 
    ON logstore.logs(instance_id, aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_logs_user 
    ON logstore.logs(instance_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_event 
    ON logstore.logs(instance_id, event_type, event_sequence)
    WHERE event_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_logs_level 
    ON logstore.logs(instance_id, log_level, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_logs_resource_owner 
    ON logstore.logs(instance_id, resource_owner, log_date DESC);

-- Execution logs table: Detailed logs for action executions
CREATE TABLE IF NOT EXISTS logstore.execution_logs (
    instance_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Log details
    log_level SMALLINT NOT NULL DEFAULT 1,
    message TEXT NOT NULL,
    stack_trace TEXT,
    
    -- Context
    metadata JSONB,
    
    PRIMARY KEY (instance_id, log_id)
);

-- Indexes for execution_logs
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution 
    ON logstore.execution_logs(instance_id, execution_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_execution_logs_target 
    ON logstore.execution_logs(instance_id, target_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_execution_logs_level 
    ON logstore.execution_logs(instance_id, log_level, log_date DESC);

-- Quota logs table: Track quota usage and violations
CREATE TABLE IF NOT EXISTS logstore.quota_logs (
    instance_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    quota_id TEXT NOT NULL,
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Usage tracking
    previous_usage BIGINT NOT NULL,
    current_usage BIGINT NOT NULL,
    quota_limit BIGINT NOT NULL,
    
    -- Context
    resource_owner TEXT NOT NULL,
    user_id TEXT,
    action TEXT, -- What action triggered the quota check
    
    -- Result
    allowed BOOLEAN NOT NULL,
    threshold_exceeded BOOLEAN NOT NULL DEFAULT false,
    
    PRIMARY KEY (instance_id, log_id)
);

-- Indexes for quota_logs
CREATE INDEX IF NOT EXISTS idx_quota_logs_quota 
    ON logstore.quota_logs(instance_id, quota_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_quota_logs_user 
    ON logstore.quota_logs(instance_id, user_id, log_date DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quota_logs_violations 
    ON logstore.quota_logs(instance_id, log_date DESC)
    WHERE NOT allowed;

-- Comments
COMMENT ON SCHEMA logstore IS 'Comprehensive audit logging system';
COMMENT ON TABLE logstore.logs IS 'Main audit trail for comprehensive system logging';
COMMENT ON TABLE logstore.execution_logs IS 'Detailed logs for action/workflow executions';
COMMENT ON TABLE logstore.quota_logs IS 'Quota usage tracking and violation logs';


-- From: 002_53_create_milestones_table.sql
-- Migration: Create Milestones Table
-- Description: Add table for tracking system, organization, and project milestones
-- Version: 002_53
-- Date: 2025-10-23

-- Milestones table: Tracks important system/org/project milestones
CREATE TABLE IF NOT EXISTS milestones_projection (
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
    ON milestones_projection(instance_id, aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_milestones_type 
    ON milestones_projection(instance_id, milestone_type);

CREATE INDEX IF NOT EXISTS idx_milestones_reached 
    ON milestones_projection(instance_id, reached_date DESC)
    WHERE reached_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_milestones_name 
    ON milestones_projection(instance_id, name);

CREATE INDEX IF NOT EXISTS idx_milestones_unreached 
    ON milestones_projection(instance_id, milestone_type, reached_date)
    WHERE reached_date IS NULL;

-- Milestone types enum view for reference
CREATE OR REPLACE VIEW milestone_types_view AS
SELECT 1 AS type_id, 'INSTANCE' AS type_name
UNION ALL
SELECT 2, 'ORGANIZATION'
UNION ALL
SELECT 3, 'PROJECT'
UNION ALL
SELECT 4, 'USER';

-- Common milestone names (for reference)
CREATE OR REPLACE VIEW common_milestones_view AS
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
COMMENT ON TABLE milestones_projection IS 'Tracks achievement of important system/org/project/user milestones';
COMMENT ON COLUMN milestones_projection.milestone_type IS '1=instance, 2=org, 3=project, 4=user';
COMMENT ON COLUMN milestones_projection.reached_date IS 'When the milestone was actually achieved';
COMMENT ON COLUMN milestones_projection.pushed_date IS 'When the milestone was triggered/pushed';
COMMENT ON VIEW milestone_types_view IS 'Reference view for milestone type codes';
COMMENT ON VIEW common_milestones_view IS 'Reference view for common milestone names and descriptions';


-- From: 002_54_create_project_grants_table.sql
-- Create project_grants projection table
-- Migration: 002_54

CREATE TABLE IF NOT EXISTS project_grants_projection (
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
  ON project_grants_projection (project_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grants_granted_org_id_idx 
  ON project_grants_projection (granted_org_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grants_resource_owner_idx 
  ON project_grants_projection (resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS project_grants_state_idx 
  ON project_grants_projection (state, instance_id);


-- From: 002_55_create_project_grant_members_table.sql
-- Create project_grant_members projection table
-- Migration: 002_55

CREATE TABLE IF NOT EXISTS project_grant_members_projection (
  project_id TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (project_id, grant_id, user_id, instance_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS project_grant_members_project_id_idx 
  ON project_grant_members_projection (project_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grant_members_grant_id_idx 
  ON project_grant_members_projection (grant_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grant_members_user_id_idx 
  ON project_grant_members_projection (user_id, instance_id);

CREATE INDEX IF NOT EXISTS project_grant_members_resource_owner_idx 
  ON project_grant_members_projection (resource_owner, instance_id);


-- From: 002_56_create_auth_requests_table.sql
-- Create auth_requests projection table
-- Migration: 002_56

CREATE TABLE IF NOT EXISTS auth_requests_projection (
  id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  login_client TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  state TEXT,
  nonce TEXT,
  scope TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT[],
  response_type TEXT,
  response_mode TEXT,
  code_challenge TEXT,
  code_challenge_method TEXT,
  prompt TEXT[] DEFAULT '{}',
  ui_locales TEXT[],
  max_age INTEGER,
  login_hint TEXT,
  hint_user_id TEXT,
  need_refresh_token BOOLEAN DEFAULT false,
  session_id TEXT,
  user_id TEXT,
  auth_time TIMESTAMPTZ,
  auth_methods TEXT[],
  code TEXT,
  issuer TEXT,
  PRIMARY KEY (instance_id, id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_auth_requests_code 
  ON auth_requests_projection(code, instance_id) 
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_requests_client_id 
  ON auth_requests_projection(client_id, instance_id);

CREATE INDEX IF NOT EXISTS idx_auth_requests_session_id 
  ON auth_requests_projection(session_id, instance_id) 
  WHERE session_id IS NOT NULL;


-- From: 002_57_add_oidc_session_columns.sql
-- Migration: 002_57 - Add OIDC session columns to projections.sessions
-- Description: Add columns needed for OIDC sessions and logout tracking
-- Date: 2025-10-26

-- Step 1: Add OIDC-specific data column (JSONB for flexibility)
ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS oidc_data JSONB DEFAULT NULL;

-- Step 2: Add termination tracking columns
ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS termination_reason TEXT DEFAULT NULL;

ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS logout_method TEXT DEFAULT NULL;

-- Step 3: Add resource owner for org-wide operations
ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS resource_owner TEXT DEFAULT NULL;

-- Step 4: Create index for OIDC data queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_sessions_oidc_data_gin 
ON projections.sessions USING gin(oidc_data);

-- Step 5: Create index for resource_owner (for org-wide logout queries)
CREATE INDEX IF NOT EXISTS idx_sessions_resource_owner 
ON projections.sessions(instance_id, resource_owner) 
WHERE resource_owner IS NOT NULL;

-- Comments
COMMENT ON COLUMN projections.sessions.oidc_data IS 'OIDC-specific session data (clientID, scope, redirectURI, token IDs)';
COMMENT ON COLUMN projections.sessions.termination_reason IS 'Reason why session was terminated (user_logout, org_security_event, etc.)';
COMMENT ON COLUMN projections.sessions.logout_method IS 'Method used for logout (frontchannel, backchannel)';
COMMENT ON COLUMN projections.sessions.resource_owner IS 'Organization ID that owns this session (for org-wide logout)';


-- From: 002_57_create_user_grants_table.sql
-- Create user_grants projection table (OLD naming convention)
-- Migration: 002_57
-- Description: Create user grants table to track user access to projects
-- Note: Will be renamed to projections.user_grants by migration 002_58
-- Date: 2025-10-27

CREATE TABLE IF NOT EXISTS user_grants_projection (
  id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  project_grant_id TEXT,
  state SMALLINT NOT NULL DEFAULT 1,
  roles TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, instance_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS user_grants_user_id_idx 
  ON user_grants_projection (user_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_id_idx 
  ON user_grants_projection (project_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_grant_id_idx 
  ON user_grants_projection (project_grant_id, instance_id)
  WHERE project_grant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_grants_resource_owner_idx 
  ON user_grants_projection (resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_state_idx 
  ON user_grants_projection (state, instance_id);


-- From: 002_61_create_user_grants_table.sql
-- Create user_grants projection table
-- Migration: 002_61
-- Description: Create table for user grants (user permissions on projects)
-- Date: 2025-10-27

CREATE TABLE IF NOT EXISTS projections.user_grants (
  id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  project_grant_id TEXT,
  state SMALLINT NOT NULL DEFAULT 1,
  roles TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, instance_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS user_grants_user_id_idx 
  ON projections.user_grants (user_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_id_idx 
  ON projections.user_grants (project_id, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_project_grant_id_idx 
  ON projections.user_grants (project_grant_id, instance_id)
  WHERE project_grant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_grants_resource_owner_idx 
  ON projections.user_grants (resource_owner, instance_id);

CREATE INDEX IF NOT EXISTS user_grants_state_idx 
  ON projections.user_grants (state, instance_id);


-- From: 011_notification_config.sql
-- Notification Configuration Tables
-- Based on Zitadel Go: internal/notification/repository/eventsourcing

-- Notification provider configurations
CREATE TABLE IF NOT EXISTS notification_providers (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL, -- 'smtp', 'twilio', 'webhook', etc.
    config JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(instance_id, provider_type)
);

CREATE INDEX idx_notification_providers_instance ON notification_providers(instance_id);
CREATE INDEX idx_notification_providers_type ON notification_providers(provider_type);
CREATE INDEX idx_notification_providers_enabled ON notification_providers(enabled);

-- Email-specific configurations
CREATE TABLE IF NOT EXISTS email_configs (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255), -- Encrypted
    smtp_from VARCHAR(255),
    smtp_from_name VARCHAR(255),
    smtp_reply_to VARCHAR(255),
    smtp_secure BOOLEAN DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(instance_id)
);

CREATE INDEX idx_email_configs_instance ON email_configs(instance_id);
CREATE INDEX idx_email_configs_enabled ON email_configs(enabled);

-- SMS-specific configurations
CREATE TABLE IF NOT EXISTS sms_configs (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'twilio', -- 'twilio', 'webhook'
    twilio_account_sid VARCHAR(255),
    twilio_auth_token VARCHAR(255), -- Encrypted
    twilio_phone_number VARCHAR(50),
    twilio_verify_service_sid VARCHAR(255),
    webhook_url VARCHAR(500),
    webhook_headers JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(instance_id)
);

CREATE INDEX idx_sms_configs_instance ON sms_configs(instance_id);
CREATE INDEX idx_sms_configs_provider ON sms_configs(provider);
CREATE INDEX idx_sms_configs_enabled ON sms_configs(enabled);

-- Configuration change log for audit
CREATE TABLE IF NOT EXISTS notification_config_changes (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    config_type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'provider'
    config_id VARCHAR(255) NOT NULL,
    changed_by VARCHAR(255),
    changes JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_config_changes_instance ON notification_config_changes(instance_id);
CREATE INDEX idx_config_changes_type ON notification_config_changes(config_type);
CREATE INDEX idx_config_changes_created ON notification_config_changes(created_at);

-- Comments
COMMENT ON TABLE notification_providers IS 'Generic notification provider configurations per instance';
COMMENT ON TABLE email_configs IS 'Email/SMTP configurations per instance';
COMMENT ON TABLE sms_configs IS 'SMS provider configurations per instance';
COMMENT ON TABLE notification_config_changes IS 'Audit log for configuration changes';


