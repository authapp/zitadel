-- Migration: 001_13 - GIN index for JSONB event_data for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_events_data_gin ON events USING GIN (event_data);
