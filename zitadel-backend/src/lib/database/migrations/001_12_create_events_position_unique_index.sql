-- Migration: 001_12 - Unique constraint for position ordering
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_position_unique 
ON events (position, in_position_order);
