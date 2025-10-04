-- Migration: 001_07 - Create events creation date index
CREATE INDEX IF NOT EXISTS idx_events_creation_date ON events (creation_date);
