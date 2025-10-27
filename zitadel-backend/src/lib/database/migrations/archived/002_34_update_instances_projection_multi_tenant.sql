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
