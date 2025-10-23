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
