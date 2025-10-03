-- Query module database schema
-- Supports projection state tracking and read models

-- Projection states table
-- Tracks the current position and status of each projection
CREATE TABLE IF NOT EXISTS projection_states (
    name VARCHAR(255) PRIMARY KEY,
    position BIGINT NOT NULL DEFAULT 0,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'stopped',
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projection_states_status ON projection_states(status);
CREATE INDEX IF NOT EXISTS idx_projection_states_position ON projection_states(position);

-- Example projection table: users
-- This is a read model materialized from user events
CREATE TABLE IF NOT EXISTS users_projection (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    resource_owner VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    preferred_language VARCHAR(10),
    gender VARCHAR(50),
    avatar_url TEXT,
    state VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT users_projection_unique_username UNIQUE (instance_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_projection_instance ON users_projection(instance_id);
CREATE INDEX IF NOT EXISTS idx_users_projection_email ON users_projection(email);
CREATE INDEX IF NOT EXISTS idx_users_projection_username ON users_projection(username);
CREATE INDEX IF NOT EXISTS idx_users_projection_state ON users_projection(state);
CREATE INDEX IF NOT EXISTS idx_users_projection_deleted ON users_projection(deleted_at);

-- Example projection table: organizations
-- Materialized from organization events
CREATE TABLE IF NOT EXISTS organizations_projection (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    primary_domain VARCHAR(255),
    state VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT organizations_projection_unique_domain UNIQUE (instance_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_organizations_projection_instance ON organizations_projection(instance_id);
CREATE INDEX IF NOT EXISTS idx_organizations_projection_domain ON organizations_projection(domain);
CREATE INDEX IF NOT EXISTS idx_organizations_projection_state ON organizations_projection(state);
CREATE INDEX IF NOT EXISTS idx_organizations_projection_deleted ON organizations_projection(deleted_at);

-- Example projection table: projects
-- Materialized from project events
CREATE TABLE IF NOT EXISTS projects_projection (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    resource_owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    project_role_assertion BOOLEAN DEFAULT FALSE,
    project_role_check BOOLEAN DEFAULT FALSE,
    has_project_check BOOLEAN DEFAULT FALSE,
    private_labeling_setting VARCHAR(50),
    state VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_projects_projection_instance ON projects_projection(instance_id);
CREATE INDEX IF NOT EXISTS idx_projects_projection_owner ON projects_projection(resource_owner);
CREATE INDEX IF NOT EXISTS idx_projects_projection_state ON projects_projection(state);
CREATE INDEX IF NOT EXISTS idx_projects_projection_deleted ON projects_projection(deleted_at);

-- Example projection table: sessions
-- Materialized from session events
CREATE TABLE IF NOT EXISTS sessions_projection (
    id VARCHAR(255) PRIMARY KEY,
    instance_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    creation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL,
    expiration TIMESTAMP WITH TIME ZONE,
    state VARCHAR(50) NOT NULL DEFAULT 'active',
    user_agent TEXT,
    ip_address VARCHAR(50),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sessions_projection_instance ON sessions_projection(instance_id);
CREATE INDEX IF NOT EXISTS idx_sessions_projection_user ON sessions_projection(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_projection_state ON sessions_projection(state);
CREATE INDEX IF NOT EXISTS idx_sessions_projection_expiration ON sessions_projection(expiration);
CREATE INDEX IF NOT EXISTS idx_sessions_projection_deleted ON sessions_projection(deleted_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_projection_states_updated_at BEFORE UPDATE ON projection_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_projection_updated_at BEFORE UPDATE ON users_projection
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_projection_updated_at BEFORE UPDATE ON organizations_projection
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_projection_updated_at BEFORE UPDATE ON projects_projection
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
