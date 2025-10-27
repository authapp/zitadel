-- Consolidated Migration 004: Constraints
-- Generated: 2025-10-27T17:28:28.416Z
-- Source: 68 original migrations consolidated
--
-- This migration creates:
-- - Foreign key constraints
-- - Check constraints
-- - Other table constraints

-- From: 002_16_fix_multitenant_username_constraint.sql
-- Migration: 002_08 - Fix multi-tenant username constraint
-- Description: Allow same username across different organizations
-- Date: 2025-10-05

-- Drop old constraint
ALTER TABLE users_projection 
  DROP CONSTRAINT IF EXISTS users_projection_unique_username;

-- Add new constraint that includes resource_owner (org)
ALTER TABLE users_projection 
  ADD CONSTRAINT users_projection_unique_username 
  UNIQUE (instance_id, resource_owner, username);


-- From: 002_30_restore_user_fk_constraints.sql
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


-- From: 002_59_fix_user_addresses_fk_constraint.sql
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


-- From: 002_60_fix_project_grants_constraint.sql
-- Migration: 002_60 - Fix project_grants PRIMARY KEY constraint after schema migration
-- Description: Ensure PRIMARY KEY constraint exists after table was moved to projections schema
-- Date: 2025-10-27

DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'projections' AND table_name = 'project_grants') THEN
    
    -- Drop old constraint if exists (from old table name)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_grants_projection_pkey') THEN
      ALTER TABLE projections.project_grants DROP CONSTRAINT project_grants_projection_pkey;
    END IF;
    
    -- Add PRIMARY KEY constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_grants_pkey') THEN
      ALTER TABLE projections.project_grants ADD CONSTRAINT project_grants_pkey PRIMARY KEY (id, instance_id);
    END IF;
    
  END IF;
END $$;


