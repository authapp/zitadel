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
