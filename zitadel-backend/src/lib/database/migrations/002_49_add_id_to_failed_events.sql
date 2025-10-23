-- Migration: 002_49 - Add id column to projection_failed_events
-- Description: Add id column for easier reference (projection_name:failed_sequence)
-- Date: 2025-10-23
-- Phase: Immediate - Fix
-- Priority: HIGH

-- Add id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projection_failed_events' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE projection_failed_events ADD COLUMN id TEXT;
        
        -- Populate existing rows with generated id
        UPDATE projection_failed_events 
        SET id = projection_name || ':' || failed_sequence::TEXT
        WHERE id IS NULL;
    END IF;
END $$;
