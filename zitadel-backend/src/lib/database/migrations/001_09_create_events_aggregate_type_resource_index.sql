-- Migration: 001_09 - Create events composite index for common queries
CREATE INDEX IF NOT EXISTS idx_events_aggregate_type_resource ON events (aggregate_type, resource_owner);
