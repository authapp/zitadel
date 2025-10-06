-- Migration: 002_17 - Alter projection states position column type
-- Description: Change position from BIGINT to DECIMAL to support timestamp positions
-- Date: 2025-10-06

-- Drop existing position column and recreate with correct type
ALTER TABLE projection_states 
ALTER COLUMN position TYPE DECIMAL USING position::DECIMAL;
