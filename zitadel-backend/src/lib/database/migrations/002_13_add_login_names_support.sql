-- Migration: 002_13 - Add login names support
-- Description: Add preferred_login_name and login_names array for multi-org scenarios
-- Date: 2025-10-05
-- Priority: 3 (Enhanced features)

-- Add preferred login name (user's preferred identifier)
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS preferred_login_name VARCHAR(255);

-- Add login names array (for multi-org scenarios)
-- Each org can have different login names for the same user
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS login_names TEXT[];

-- Create index on preferred_login_name for efficient lookups
CREATE INDEX IF NOT EXISTS users_projection_preferred_login_name_idx 
ON users_projection(preferred_login_name) 
WHERE preferred_login_name IS NOT NULL;

-- Create GIN index on login_names array for efficient array searches
CREATE INDEX IF NOT EXISTS users_projection_login_names_idx 
ON users_projection USING GIN(login_names)
WHERE login_names IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users_projection.preferred_login_name IS 'User preferred login identifier (username, email, or custom)';
COMMENT ON COLUMN users_projection.login_names IS 'Array of login names across different organizations';
