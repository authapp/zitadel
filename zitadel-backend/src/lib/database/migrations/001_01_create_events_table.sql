-- Migration: 001_01 - Create events table
-- Description: Create events table for event sourcing
-- Date: 2025-10-04

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
