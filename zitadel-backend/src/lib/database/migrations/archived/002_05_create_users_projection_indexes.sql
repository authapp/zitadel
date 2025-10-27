-- Migration: 002_05 - Create users projection indexes
CREATE INDEX IF NOT EXISTS idx_users_projection_instance ON users_projection(instance_id);
