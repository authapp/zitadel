-- Migration: 002_30 - Restore user FK constraints with composite keys
-- Description: Recreate FK constraints after users_projection PK update
-- Phase: Phase 2 - Add Audit Columns
-- Date: 2025-10-22

-- Note: user_metadata FK is recreated in 002_29

-- Restore FK for user_addresses with composite key (instance_id, user_id)
ALTER TABLE user_addresses 
ADD CONSTRAINT fk_user_addresses_user 
    FOREIGN KEY (instance_id, user_id) 
    REFERENCES users_projection(instance_id, id) 
    ON DELETE CASCADE;
