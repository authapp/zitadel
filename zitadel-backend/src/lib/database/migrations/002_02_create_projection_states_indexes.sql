-- Migration: 002_02 - Create projection states indexes
CREATE INDEX IF NOT EXISTS idx_projection_states_status ON projection_states(status);
