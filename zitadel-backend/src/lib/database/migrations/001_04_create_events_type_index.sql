-- Migration: 001_04 - Create events type index
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
