-- Migration: 002_06 - Create users projection email index
CREATE INDEX IF NOT EXISTS idx_users_projection_email ON users_projection(email);
