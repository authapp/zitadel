-- Migration: 002_38 - Update user_addresses for multi-tenant support
-- Description: Add change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists

-- Step 1: Add change_date column
ALTER TABLE user_addresses 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop foreign key constraint (will recreate with composite key)
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS fk_user_addresses_user;

-- Step 3: Drop existing primary key
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS user_addresses_pkey;

-- Step 4: Add new composite primary key (instance_id, id)
ALTER TABLE user_addresses 
ADD PRIMARY KEY (instance_id, id);

-- Step 5: Update indexes to include instance_id
DROP INDEX IF EXISTS user_addresses_user_id_idx;
CREATE INDEX user_addresses_user_id_idx 
ON user_addresses(instance_id, user_id);

DROP INDEX IF EXISTS user_addresses_type_idx;
CREATE INDEX user_addresses_type_idx 
ON user_addresses(instance_id, address_type);

-- Step 6: Update unique primary address constraint
DROP INDEX IF EXISTS user_addresses_primary_unique_idx;
CREATE UNIQUE INDEX user_addresses_primary_unique_idx 
ON user_addresses(instance_id, user_id) 
WHERE is_primary = true;

-- Step 7: Add temporal indexes
CREATE INDEX IF NOT EXISTS user_addresses_change_date 
ON user_addresses(change_date DESC);

CREATE INDEX IF NOT EXISTS user_addresses_created_at 
ON user_addresses(created_at DESC);

-- Step 8: Recreate foreign key with composite key reference
ALTER TABLE user_addresses 
ADD CONSTRAINT fk_user_addresses_user 
  FOREIGN KEY (instance_id, user_id) 
  REFERENCES users_projection(instance_id, id) 
  ON DELETE CASCADE;

-- Comments
COMMENT ON COLUMN user_addresses.change_date IS 'Timestamp of last change to this address';
