-- Migration: 001_05 - Create events resource owner index
CREATE INDEX IF NOT EXISTS idx_events_resource_owner ON events (resource_owner);
