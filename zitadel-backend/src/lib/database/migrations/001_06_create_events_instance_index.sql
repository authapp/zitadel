-- Migration: 001_06 - Create events instance index
CREATE INDEX IF NOT EXISTS idx_events_instance ON events (instance_id);
