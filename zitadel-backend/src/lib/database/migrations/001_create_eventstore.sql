-- Migration: 001_create_eventstore
-- Description: Create events table for event sourcing
-- Date: 2025-10-04

-- Events table for event sourcing
CREATE TABLE IF NOT EXISTS events (
    -- Event identification
    id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    
    -- Aggregate identification
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_version INTEGER NOT NULL,
    
    -- Event data
    event_data JSONB NOT NULL,
    
    -- Audit information
    editor_user VARCHAR(255) NOT NULL,
    editor_service VARCHAR(255),
    resource_owner VARCHAR(255) NOT NULL,
    instance_id VARCHAR(255) NOT NULL,
    
    -- Positioning and ordering
    position BIGINT NOT NULL,
    in_position_order INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    creation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revision INTEGER NOT NULL DEFAULT 1
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_type, aggregate_id, aggregate_version);
CREATE INDEX IF NOT EXISTS idx_events_position ON events (position, in_position_order);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_resource_owner ON events (resource_owner);
CREATE INDEX IF NOT EXISTS idx_events_instance ON events (instance_id);
CREATE INDEX IF NOT EXISTS idx_events_creation_date ON events (creation_date);
CREATE INDEX IF NOT EXISTS idx_events_editor_user ON events (editor_user);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_aggregate_type_resource ON events (aggregate_type, resource_owner);
CREATE INDEX IF NOT EXISTS idx_events_instance_resource ON events (instance_id, resource_owner);

-- Unique constraint to prevent duplicate versions for same aggregate
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_aggregate_version_unique 
ON events (aggregate_type, aggregate_id, aggregate_version);

-- Unique constraint for position ordering
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_position_unique 
ON events (position, in_position_order);

-- GIN index for JSONB event_data for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_events_data_gin ON events USING GIN (event_data);
