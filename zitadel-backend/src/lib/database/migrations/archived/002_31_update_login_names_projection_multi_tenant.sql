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
