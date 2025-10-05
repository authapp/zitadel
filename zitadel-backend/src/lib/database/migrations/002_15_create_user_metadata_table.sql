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
