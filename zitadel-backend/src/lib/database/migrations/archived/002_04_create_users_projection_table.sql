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
