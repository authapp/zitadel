-- Migration: 002_03 - Create projection states position index
CREATE INDEX IF NOT EXISTS idx_projection_states_position ON projection_states(position);
