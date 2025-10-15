-- Migration: 002_25 - Create instance trusted domains projection table
-- Description: Store trusted domains for CORS and redirect validation
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS instance_trusted_domains_projection (
    instance_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, domain)
);

-- Index for instance-based lookups
CREATE INDEX IF NOT EXISTS idx_instance_trusted_domains_instance ON instance_trusted_domains_projection(instance_id);
