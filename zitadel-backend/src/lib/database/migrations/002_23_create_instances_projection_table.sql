-- Migration: 002_23 - Create instances projection table
-- Description: Store instance data for multi-tenant management
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS instances_projection (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_org_id TEXT,
    default_language TEXT,
    state TEXT NOT NULL DEFAULT 'active',
    features JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0
);

-- Index for state-based queries
CREATE INDEX IF NOT EXISTS idx_instances_state ON instances_projection(state);

-- Index for name lookups
CREATE INDEX IF NOT EXISTS idx_instances_name ON instances_projection(name);
