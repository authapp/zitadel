-- Migration: 001_03 - Create events position index
CREATE INDEX IF NOT EXISTS idx_events_position ON events (position, in_position_order);
