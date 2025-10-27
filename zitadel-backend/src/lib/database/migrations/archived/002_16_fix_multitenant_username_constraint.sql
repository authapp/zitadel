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
