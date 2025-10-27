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
