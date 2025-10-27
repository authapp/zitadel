-- Migration: 002_32 - Update org_domains_projection for multi-tenant support
-- Description: Add instance_id, change_date and update to composite primary key
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment

-- Step 1: Add instance_id column if not exists
ALTER TABLE org_domains_projection 
ADD COLUMN IF NOT EXISTS instance_id TEXT NOT NULL DEFAULT 'default-instance';

-- Step 2: Add change_date column if not exists
ALTER TABLE org_domains_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Drop existing unique constraint on domain (will be recreated with instance_id)
DROP INDEX IF EXISTS idx_org_domains_domain_unique;

-- Step 4: Drop existing primary key
ALTER TABLE org_domains_projection DROP CONSTRAINT IF EXISTS org_domains_projection_pkey;

-- Step 5: Add new composite primary key (instance_id, org_id, domain)
ALTER TABLE org_domains_projection 
ADD PRIMARY KEY (instance_id, org_id, domain);

-- Step 6: Recreate unique domain index with instance_id
CREATE UNIQUE INDEX idx_org_domains_domain_unique 
ON org_domains_projection(instance_id, domain);

-- Step 7: Update org_id index to include instance_id
DROP INDEX IF EXISTS idx_org_domains_org_id;
CREATE INDEX idx_org_domains_org_id 
ON org_domains_projection(instance_id, org_id);

-- Step 8: Update verified index to include instance_id
DROP INDEX IF EXISTS idx_org_domains_verified;
CREATE INDEX idx_org_domains_verified 
ON org_domains_projection(instance_id, is_verified);

-- Step 9: Update primary domain index to include instance_id
DROP INDEX IF EXISTS idx_org_domains_primary;
CREATE INDEX idx_org_domains_primary 
ON org_domains_projection(instance_id, org_id, is_primary) 
WHERE is_primary = TRUE;

-- Step 10: Add temporal index for change tracking
CREATE INDEX IF NOT EXISTS idx_org_domains_change_date 
ON org_domains_projection(instance_id, change_date DESC);

-- Step 11: Add sequence index for ordering
CREATE INDEX IF NOT EXISTS idx_org_domains_sequence 
ON org_domains_projection(instance_id, sequence DESC);

-- Step 12: Add foreign key to orgs_projection
-- Note: orgs_projection already has composite key (instance_id, id) from Phase 1
ALTER TABLE org_domains_projection 
DROP CONSTRAINT IF EXISTS fk_org_domains_org;

ALTER TABLE org_domains_projection 
ADD CONSTRAINT fk_org_domains_org 
FOREIGN KEY (instance_id, org_id) 
REFERENCES orgs_projection(instance_id, id) 
ON DELETE CASCADE;

-- Comment
COMMENT ON COLUMN org_domains_projection.instance_id IS 'Multi-tenant instance identifier';
COMMENT ON COLUMN org_domains_projection.change_date IS 'Timestamp of last change for audit tracking';
