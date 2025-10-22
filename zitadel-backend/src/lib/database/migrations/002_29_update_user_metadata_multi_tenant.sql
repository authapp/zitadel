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
