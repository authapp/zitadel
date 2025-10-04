-- Migration: 001_08 - Create events editor user index
CREATE INDEX IF NOT EXISTS idx_events_editor_user ON events (editor_user);
