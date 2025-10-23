-- Migration: 002_35 - Update instance_domains_projection for multi-tenant support
-- Description: Add change_date column (PK already has instance_id)
-- Date: 2025-10-23
-- Phase: Phase 2 - Multi-tenant schema alignment
-- Note: instance_id already exists in PK (instance_id, domain)

-- Step 1: Add change_date column
ALTER TABLE instance_domains_projection 
ADD COLUMN IF NOT EXISTS change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Add temporal index for change_date
CREATE INDEX IF NOT EXISTS idx_instance_domains_change_date 
ON instance_domains_projection(change_date DESC);

-- Comment
COMMENT ON COLUMN instance_domains_projection.change_date IS 'Timestamp of last event that changed this domain mapping';
