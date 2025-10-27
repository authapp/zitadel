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
