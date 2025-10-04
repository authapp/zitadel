-- Migration: 001_02 - Create events table indexes
-- Description: Performance and unique constraint indexes
-- Date: 2025-10-04

CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_type, aggregate_id, aggregate_version);
