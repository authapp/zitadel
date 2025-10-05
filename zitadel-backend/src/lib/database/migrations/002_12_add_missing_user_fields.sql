-- Migration: 002_12 - Add missing user fields
-- Description: Add nickname, verified_at timestamps, and password change tracking
-- Date: 2025-10-05
-- Priority: 2 (Schema completeness)

-- Add nickname field (matches Zitadel's NickName)
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS nickname VARCHAR(255);

-- Add email verification timestamp
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Add phone verification timestamp  
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE;

-- Add password change timestamp
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Add password change required flag
ALTER TABLE users_projection 
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;

-- Create index on nickname for search/lookup
CREATE INDEX IF NOT EXISTS users_projection_nickname_idx 
ON users_projection(nickname) 
WHERE nickname IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users_projection.nickname IS 'User nickname, optional alternative display name';
COMMENT ON COLUMN users_projection.email_verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users_projection.phone_verified_at IS 'Timestamp when phone was verified';
COMMENT ON COLUMN users_projection.password_changed_at IS 'Timestamp of last password change';
COMMENT ON COLUMN users_projection.password_change_required IS 'Flag indicating if user must change password on next login';
