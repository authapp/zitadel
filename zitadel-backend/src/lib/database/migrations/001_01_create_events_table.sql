-- Migration: 001_01 - Create events table
-- Description: Create events table for event sourcing (matching Go v2 schema)
-- Date: 2025-10-04

CREATE TABLE IF NOT EXISTS events (
    -- Instance and aggregate identification
    instance_id TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    
    -- Event information
    event_type TEXT NOT NULL,
    aggregate_version BIGINT NOT NULL,
    revision SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB,
    creator TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    
    -- Positioning and ordering
    "position" DECIMAL NOT NULL,
    in_tx_order INTEGER NOT NULL,
    
    -- Composite primary key (instance_id, aggregate_type, aggregate_id, aggregate_version)
    PRIMARY KEY (instance_id, aggregate_type, aggregate_id, aggregate_version)
);
