-- Migration: 002_39 - Update notification_providers for multi-tenant support
-- Description: Add change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists

-- Step 1: Add change_date column
ALTER TABLE notification_providers 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop existing UNIQUE constraint
ALTER TABLE notification_providers 
DROP CONSTRAINT IF EXISTS notification_providers_instance_id_provider_type_key;

-- Step 3: Drop existing primary key
ALTER TABLE notification_providers DROP CONSTRAINT IF EXISTS notification_providers_pkey;

-- Step 4: Add new composite primary key (instance_id, id)
ALTER TABLE notification_providers 
ADD PRIMARY KEY (instance_id, id);

-- Step 5: Recreate unique constraint with instance_id awareness
ALTER TABLE notification_providers 
ADD CONSTRAINT notification_providers_instance_provider_unique 
UNIQUE (instance_id, provider_type);

-- Step 6: Update indexes to include instance_id
DROP INDEX IF EXISTS idx_notification_providers_type;
CREATE INDEX idx_notification_providers_type 
ON notification_providers(instance_id, provider_type);

DROP INDEX IF EXISTS idx_notification_providers_enabled;
CREATE INDEX idx_notification_providers_enabled 
ON notification_providers(instance_id, enabled);

-- Step 7: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_notification_providers_change_date 
ON notification_providers(change_date DESC);

-- Comments
COMMENT ON COLUMN notification_providers.change_date IS 'Timestamp of last change to this provider configuration';
