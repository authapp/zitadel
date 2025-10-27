-- Migration: 002_09 - Create users projection deleted index
CREATE INDEX IF NOT EXISTS idx_users_projection_deleted ON users_projection(deleted_at);
