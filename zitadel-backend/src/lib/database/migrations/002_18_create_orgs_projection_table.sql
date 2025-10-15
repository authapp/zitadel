-- Migration: 002_18 - Create organizations projection table
-- Description: Store organization read models for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS orgs_projection (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    primary_domain TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0,
    
    -- Constraints
    CONSTRAINT orgs_state_check CHECK (state IN ('unspecified', 'active', 'inactive', 'removed'))
);

-- Index on name for search
CREATE INDEX IF NOT EXISTS idx_orgs_name ON orgs_projection(name);

-- Index on state for filtering
CREATE INDEX IF NOT EXISTS idx_orgs_state ON orgs_projection(state);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_orgs_created_at ON orgs_projection(created_at DESC);

-- Full text search index on name
CREATE INDEX IF NOT EXISTS idx_orgs_name_fts ON orgs_projection USING gin(to_tsvector('english', name));

-- Comment
COMMENT ON TABLE orgs_projection IS 'Read model projection for organizations';
