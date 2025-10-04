-- Migration: 001_11 - Unique constraint to prevent duplicate versions for same aggregate
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_aggregate_version_unique 
ON events (aggregate_type, aggregate_id, aggregate_version);
