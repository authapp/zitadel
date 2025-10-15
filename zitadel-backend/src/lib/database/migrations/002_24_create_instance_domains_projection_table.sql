-- Migration: 002_24 - Create instance domains projection table
-- Description: Store instance domain mappings for host-based resolution
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS instance_domains_projection (
    instance_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_generated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (instance_id, domain)
);

-- Index for domain lookups (critical for host-based instance resolution)
CREATE INDEX IF NOT EXISTS idx_instance_domains_domain ON instance_domains_projection(domain);

-- Index for primary domain lookups
CREATE INDEX IF NOT EXISTS idx_instance_domains_primary ON instance_domains_projection(instance_id, is_primary);
