-- Migration: 002_18 - Create organizations projection table
-- Description: Store organization read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS orgs_projection (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    primary_domain TEXT,
    resource_owner TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    change_date TIMESTAMP WITH TIME ZONE,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Constraints
    PRIMARY KEY (instance_id, id),
    CONSTRAINT orgs_state_check CHECK (state IN ('unspecified', 'active', 'inactive', 'removed'))
);

-- Index on instance_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_orgs_instance_id ON orgs_projection(instance_id);

-- Index on name for search
CREATE INDEX IF NOT EXISTS idx_orgs_name ON orgs_projection(instance_id, name);

-- Index on state for filtering
CREATE INDEX IF NOT EXISTS idx_orgs_state ON orgs_projection(instance_id, state);

-- Index on primary_domain
CREATE INDEX IF NOT EXISTS idx_orgs_primary_domain ON orgs_projection(instance_id, primary_domain) WHERE primary_domain IS NOT NULL;

-- Index on resource_owner
CREATE INDEX IF NOT EXISTS idx_orgs_resource_owner ON orgs_projection(instance_id, resource_owner) WHERE resource_owner IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_orgs_created_at ON orgs_projection(instance_id, created_at DESC);

-- Full text search index on name
CREATE INDEX IF NOT EXISTS idx_orgs_name_fts ON orgs_projection USING gin(to_tsvector('english', name));

-- Comment
COMMENT ON TABLE orgs_projection IS 'Read model projection for organizations';
