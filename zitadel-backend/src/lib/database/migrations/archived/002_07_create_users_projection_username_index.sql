-- Migration: 002_07 - Create users projection username index
CREATE INDEX IF NOT EXISTS idx_users_projection_username ON users_projection(username);
