-- Migration: 001_03 - Create events position index
-- Index for position-based streaming and ordering
CREATE INDEX IF NOT EXISTS idx_events_position ON events ("position", in_tx_order);
