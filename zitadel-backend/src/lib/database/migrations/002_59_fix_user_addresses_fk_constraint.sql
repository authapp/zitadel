-- Migration: 002_59 - Fix user_addresses foreign key constraint
-- Description: Update FK to reference projections.users after schema migration
-- Date: 2025-10-27
-- Depends on: 002_58 (schema migration)

-- Drop old FK constraint that references users_projection (now projections.users)
ALTER TABLE projections.user_addresses 
DROP CONSTRAINT IF EXISTS fk_user_addresses_user;

-- Add new FK constraint referencing projections.users
ALTER TABLE projections.user_addresses
ADD CONSTRAINT fk_user_addresses_user 
    FOREIGN KEY (user_id, instance_id) 
    REFERENCES projections.users(id, instance_id) 
    ON DELETE CASCADE;

-- Add comment
COMMENT ON CONSTRAINT fk_user_addresses_user ON projections.user_addresses 
IS 'Foreign key to projections.users - updated for projections schema';
