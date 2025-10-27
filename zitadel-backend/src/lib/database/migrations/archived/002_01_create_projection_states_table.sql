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
