-- Migration: 002_08 - Create users projection state index
CREATE INDEX IF NOT EXISTS idx_users_projection_state ON users_projection(state);
