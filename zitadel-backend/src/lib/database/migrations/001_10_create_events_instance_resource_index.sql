-- Migration: 001_10 - Create events instance resource composite index
CREATE INDEX IF NOT EXISTS idx_events_instance_resource ON events (instance_id, resource_owner);
