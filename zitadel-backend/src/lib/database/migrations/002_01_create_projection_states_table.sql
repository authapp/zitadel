-- Migration: 002_01 - Create projection states table
-- Description: Track projection processing state
-- Date: 2025-10-04

CREATE TABLE IF NOT EXISTS projection_states (
    name VARCHAR(255) PRIMARY KEY,
    position DECIMAL NOT NULL DEFAULT 0,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'stopped',
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
