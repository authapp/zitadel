-- Migration: 002_45 - Create encryption_keys table
-- Description: Store encryption keys for crypto operations (not a projection)
-- Date: 2025-10-23
-- Phase: Phase 3 - New critical tables
-- Priority: HIGH

CREATE TABLE IF NOT EXISTS encryption_keys (
    id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    algorithm TEXT NOT NULL,  -- 'aes256', 'rsa2048', 'rsa4096', etc.
    key_data BYTEA NOT NULL,  -- Encrypted key material
    identifier TEXT NOT NULL,  -- Human-readable identifier
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (instance_id, id)
);

-- Unique constraint on identifier per instance
CREATE UNIQUE INDEX IF NOT EXISTS idx_encryption_keys_identifier 
ON encryption_keys(instance_id, identifier);

-- Index for algorithm lookups
CREATE INDEX IF NOT EXISTS idx_encryption_keys_algorithm 
ON encryption_keys(instance_id, algorithm);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_encryption_keys_created_at 
ON encryption_keys(created_at DESC);

-- Comments
COMMENT ON TABLE encryption_keys IS 'Encryption keys for cryptographic operations - NOT a projection table';
COMMENT ON COLUMN encryption_keys.algorithm IS 'Encryption algorithm: aes256, rsa2048, rsa4096, etc.';
COMMENT ON COLUMN encryption_keys.key_data IS 'Encrypted key material (encrypted at rest)';
COMMENT ON COLUMN encryption_keys.identifier IS 'Human-readable identifier for the key';
