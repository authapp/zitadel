-- Migration: 002_48 - Fix projection_failed_events columns
-- Description: Rename columns and add missing event_data column to match code expectations
-- Date: 2025-10-23
-- Phase: Immediate - Fix
-- Priority: HIGH

-- Check if old columns exist and rename/add as needed
DO $$ 
BEGIN
    -- Add event_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'event_data'
    ) THEN
        ALTER TABLE projection_failed_events ADD COLUMN event_data JSONB;
    END IF;

    -- Rename last_failed_at to last_failed if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'last_failed_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'last_failed'
    ) THEN
        ALTER TABLE projection_failed_events RENAME COLUMN last_failed_at TO last_failed;
    END IF;

    -- Drop failed_at column if it exists (not needed)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'failed_at'
    ) THEN
        ALTER TABLE projection_failed_events DROP COLUMN failed_at;
    END IF;
END $$;

-- Recreate index with correct column name if needed
DROP INDEX IF EXISTS idx_projection_failed_events_last_failed;
CREATE INDEX IF NOT EXISTS idx_projection_failed_events_last_failed 
ON projection_failed_events(last_failed DESC);
