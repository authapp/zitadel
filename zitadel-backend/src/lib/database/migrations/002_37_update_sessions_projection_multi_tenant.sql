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
