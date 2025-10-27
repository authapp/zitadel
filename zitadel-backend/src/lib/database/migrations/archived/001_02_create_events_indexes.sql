-- Migration: 001_02 - Create events table indexes (matching Go v2)
-- Description: Core performance indexes for eventstore
-- Date: 2025-10-04

-- Index for active instances tracking
CREATE INDEX IF NOT EXISTS idx_events_active_instances ON events (created_at DESC, instance_id);

-- Index for write model queries (aggregate lookups)
CREATE INDEX IF NOT EXISTS idx_events_wm ON events (aggregate_id, instance_id, aggregate_type, event_type);

-- Index for projection queries
CREATE INDEX IF NOT EXISTS idx_events_projection ON events (instance_id, aggregate_type, event_type, "position");
