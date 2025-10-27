-- Migration: 002_19 - Create organization domains projection table
-- Description: Store organization domain read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS org_domains_projection (
    org_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    validation_type TEXT NOT NULL DEFAULT 'dns',
    validation_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Primary key on org_id and domain
    PRIMARY KEY (org_id, domain)
    
    -- Note: Foreign key removed to avoid race conditions between projections
    -- CONSTRAINT fk_org_domains_org_id FOREIGN KEY (org_id) REFERENCES orgs_projection(id) ON DELETE CASCADE
);

-- Index on domain for global lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domains_domain_unique ON org_domains_projection(domain);

-- Index on org_id for listing org domains
CREATE INDEX IF NOT EXISTS idx_org_domains_org_id ON org_domains_projection(org_id);

-- Index on is_verified for filtering
CREATE INDEX IF NOT EXISTS idx_org_domains_verified ON org_domains_projection(is_verified);

-- Index on is_primary for lookups
CREATE INDEX IF NOT EXISTS idx_org_domains_primary ON org_domains_projection(org_id, is_primary) WHERE is_primary = TRUE;

-- Comment
COMMENT ON TABLE org_domains_projection IS 'Read model projection for organization domains';
