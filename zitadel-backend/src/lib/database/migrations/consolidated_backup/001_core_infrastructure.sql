-- Consolidated Migration 001: Core Infrastructure
-- Generated: 2025-10-27T17:28:28.414Z
-- Source: 68 original migrations consolidated
--
-- This migration creates:
-- - Event store (events table with all indexes)
-- - Projection infrastructure (states, locks, failed events)
-- - Utility tables (unique_constraints, encryption_keys)

-- From: 001_01_create_events_table.sql
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


-- From: 001_02_create_events_indexes.sql
-- Migration: 001_02 - Create events table indexes (matching Go v2)
-- Description: Core performance indexes for eventstore
-- Date: 2025-10-04

-- Index for active instances tracking
CREATE INDEX IF NOT EXISTS idx_events_active_instances ON events (created_at DESC, instance_id);

-- Index for write model queries (aggregate lookups)
CREATE INDEX IF NOT EXISTS idx_events_wm ON events (aggregate_id, instance_id, aggregate_type, event_type);

-- Index for projection queries
CREATE INDEX IF NOT EXISTS idx_events_projection ON events (instance_id, aggregate_type, event_type, "position");


-- From: 001_03_create_events_position_index.sql
-- Migration: 001_03 - Create events position index
-- Index for position-based streaming and ordering
CREATE INDEX IF NOT EXISTS idx_events_position ON events ("position", in_tx_order);


-- From: 001_04_create_events_type_index.sql
-- Migration: 001_04 - No-op (removed in favor of composite indexes in Go v2)
-- Event type queries are covered by idx_events_wm and idx_events_projection


-- From: 001_05_create_events_resource_owner_index.sql
-- Migration: 001_05 - No-op (removed in Go v2 simplification)
-- Owner queries are covered by composite indexes


-- From: 001_06_create_events_instance_index.sql
-- Migration: 001_06 - No-op (removed in Go v2 simplification)
-- Instance queries are covered by idx_events_active_instances and idx_events_projection


-- From: 001_07_create_events_creation_date_index.sql
-- Migration: 001_07 - No-op (removed in Go v2 simplification)
-- Creation date queries are covered by idx_events_active_instances


-- From: 001_08_create_events_editor_user_index.sql
-- Migration: 001_08 - No-op (removed in Go v2 simplification)
-- Creator queries are less common and can use table scan if needed


-- From: 001_09_create_events_aggregate_type_resource_index.sql
-- Migration: 001_09 - No-op (removed in Go v2 simplification)
-- Covered by idx_events_wm and idx_events_projection


-- From: 001_10_create_events_instance_resource_index.sql
-- Migration: 001_10 - No-op (removed in Go v2 simplification)
-- Covered by idx_events_projection and other composite indexes


-- From: 001_11_create_events_aggregate_version_unique_index.sql
-- Migration: 001_11 - No-op (uniqueness enforced by primary key)
-- Primary key (instance_id, aggregate_type, aggregate_id, aggregate_version) ensures uniqueness


-- From: 001_12_create_events_position_unique_index.sql
-- Migration: 001_12 - No-op (position uniqueness not enforced in Go v2)
-- Position is timestamp-based (DECIMAL) and may have duplicates within same transaction
-- in_tx_order handles ordering within same position


-- From: 001_13_create_events_data_gin_index.sql
-- Migration: 001_13 - Optional GIN index for JSONB payload queries
-- Uncomment if payload searches are needed (not in base Go v2 schema)
-- CREATE INDEX IF NOT EXISTS idx_events_payload_gin ON events USING GIN (payload);


-- From: 002_01_create_projection_states_table.sql
-- Migration: 002_01 - Create projection states table
-- Description: Track projection processing state with all required columns
-- Date: 2025-10-04
-- Updated: 2025-10-20 - Consolidated all projection_states columns into initial creation

CREATE TABLE IF NOT EXISTS projection_states (
    -- Core identification and tracking
    name VARCHAR(255) PRIMARY KEY,
    position DECIMAL NOT NULL DEFAULT 0,
    position_offset INT NOT NULL DEFAULT 0,
    
    -- Timestamps
    last_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'stopped',
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    
    -- Enhanced tracking fields (optional, nullable for backward compatibility)
    event_timestamp TIMESTAMPTZ,
    instance_id TEXT,
    aggregate_type TEXT,
    aggregate_id TEXT,
    sequence BIGINT
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projection_states_status ON projection_states(status);
CREATE INDEX IF NOT EXISTS idx_projection_states_position ON projection_states(position);
CREATE INDEX IF NOT EXISTS idx_projection_states_position_offset ON projection_states(name, position, position_offset);
CREATE INDEX IF NOT EXISTS idx_projection_states_updated_at ON projection_states(updated_at DESC);

-- Add helpful comments
COMMENT ON COLUMN projection_states.position_offset IS 
'Offset within same position for multiple events in single transaction. Required for exact deduplication.';

COMMENT ON COLUMN projection_states.event_timestamp IS 
'Timestamp of last processed event. Nullable for backward compatibility.';

COMMENT ON COLUMN projection_states.instance_id IS 
'Instance ID of the handler that last updated this projection. Nullable.';

COMMENT ON COLUMN projection_states.aggregate_type IS 
'Type of last processed aggregate. Used for exact deduplication. Nullable.';

COMMENT ON COLUMN projection_states.aggregate_id IS 
'ID of last processed aggregate. Used for exact deduplication. Nullable.';

COMMENT ON COLUMN projection_states.sequence IS 
'Sequence number of last processed event. Used for exact deduplication. Nullable.';


-- From: 002_45_create_encryption_keys_table.sql
-- Migration: 002_45 - Create encryption_keys table
-- Description: Store encryption keys for crypto operations (not a projection)
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: HIGH

CREATE TABLE IF NOT EXISTS encryption_keys (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    algorithm TEXT NOT NULL,  -- 'aes256', 'rsa2048', 'rsa4096', etc.
    key_data BYTEA NOT NULL,  -- Encrypted key material
    identifier TEXT NOT NULL,  -- Human-readable identifier
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (instance_id, id)
);

-- Unique constraint on identifier per instance
CREATE UNIQUE INDEX IF NOT EXISTS idx_encryption_keys_identifier 
ON encryption_keys(instance_id, identifier);

-- Index for algorithm lookups
CREATE INDEX IF NOT EXISTS idx_encryption_keys_algorithm 
ON encryption_keys(instance_id, algorithm);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_encryption_keys_created_at 
ON encryption_keys(created_at DESC);

-- Comments
COMMENT ON TABLE encryption_keys IS 'Encryption keys for cryptographic operations - NOT a projection table';
COMMENT ON COLUMN encryption_keys.algorithm IS 'Encryption algorithm: aes256, rsa2048, rsa4096, etc.';
COMMENT ON COLUMN encryption_keys.key_data IS 'Encrypted key material (encrypted at rest)';
COMMENT ON COLUMN encryption_keys.identifier IS 'Human-readable identifier for the key';


-- From: 002_47_create_projection_failed_events_table.sql
-- Migration: 002_47 - Create projection_failed_events table
-- Description: Track failed projection events for retry and debugging
-- Date: 2025-10-23
-- Phase: Immediate - Infrastructure
-- Priority: HIGH

CREATE TABLE IF NOT EXISTS projection_failed_events (
    projection_name TEXT NOT NULL,
    failed_sequence BIGINT NOT NULL,
    failure_count SMALLINT NOT NULL DEFAULT 1,
    error TEXT,
    instance_id TEXT NOT NULL,
    event_data JSONB,
    last_failed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT,
    aggregate_type TEXT,
    aggregate_id TEXT,
    PRIMARY KEY (projection_name, failed_sequence, instance_id)
);

-- Index for querying failures by projection
CREATE INDEX IF NOT EXISTS idx_projection_failed_events_projection 
ON projection_failed_events(projection_name, instance_id);

-- Index for querying recent failures
CREATE INDEX IF NOT EXISTS idx_projection_failed_events_last_failed 
ON projection_failed_events(last_failed DESC);

-- Index for querying failures by failure count (for retry prioritization)
CREATE INDEX IF NOT EXISTS idx_projection_failed_events_failure_count 
ON projection_failed_events(failure_count);

-- Index for querying failures by instance
CREATE INDEX IF NOT EXISTS idx_projection_failed_events_instance 
ON projection_failed_events(instance_id);

-- Comments
COMMENT ON TABLE projection_failed_events IS 'Tracks projection event processing failures for retry and debugging';
COMMENT ON COLUMN projection_failed_events.projection_name IS 'Name of the projection that failed';
COMMENT ON COLUMN projection_failed_events.failed_sequence IS 'Event sequence that failed to process';
COMMENT ON COLUMN projection_failed_events.failure_count IS 'Number of times processing has failed';
COMMENT ON COLUMN projection_failed_events.error IS 'Error message from last failure';
COMMENT ON COLUMN projection_failed_events.event_data IS 'JSONB data of the failed event for replay';
COMMENT ON COLUMN projection_failed_events.last_failed IS 'Most recent failure timestamp';


-- From: 002_48_fix_projection_failed_events_columns.sql
-- Migration: 002_48 - Fix projection_failed_events columns
-- Description: Rename columns and add missing event_data column to match code expectations
-- Date: 2025-10-23
-- Phase: Immediate - Fix
-- Priority: HIGH

-- Check if old columns exist and rename/add as needed
DO $$ 
BEGIN
    -- Add event_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'event_data'
    ) THEN
        ALTER TABLE projection_failed_events ADD COLUMN event_data JSONB;
    END IF;

    -- Rename last_failed_at to last_failed if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'last_failed_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'last_failed'
    ) THEN
        ALTER TABLE projection_failed_events RENAME COLUMN last_failed_at TO last_failed;
    END IF;

    -- Drop failed_at column if it exists (not needed)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'failed_at'
    ) THEN
        ALTER TABLE projection_failed_events DROP COLUMN failed_at;
    END IF;
END $$;

-- Recreate index with correct column name if needed
DROP INDEX IF EXISTS idx_projection_failed_events_last_failed;
CREATE INDEX IF NOT EXISTS idx_projection_failed_events_last_failed 
ON projection_failed_events(last_failed DESC);


-- From: 003_create_unique_constraints_table.sql
-- Create unique_constraints table for enforcing business-level uniqueness
-- Matching Go implementation: internal/repository/eventsourcing/eventstore_v2.go

CREATE TABLE IF NOT EXISTS unique_constraints (
  unique_type TEXT NOT NULL,
  unique_field TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  CONSTRAINT unique_constraints_pkey PRIMARY KEY (unique_type, unique_field, instance_id)
);

-- Index for efficient lookup by instance
CREATE INDEX IF NOT EXISTS unique_constraints_instance_idx 
  ON unique_constraints(instance_id);

-- Index for efficient lookup by type
CREATE INDEX IF NOT EXISTS unique_constraints_type_idx 
  ON unique_constraints(unique_type, instance_id);

COMMENT ON TABLE unique_constraints IS 'Stores unique constraints for business rules enforcement at event level';
COMMENT ON COLUMN unique_constraints.unique_type IS 'Type/table name for the constraint (e.g., user_username, org_domain)';
COMMENT ON COLUMN unique_constraints.unique_field IS 'Unique value/key being constrained';
COMMENT ON COLUMN unique_constraints.instance_id IS 'Instance ID for multi-tenant isolation';


