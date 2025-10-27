-- Migration: 002_57 - Add OIDC session columns to projections.sessions
-- Description: Add columns needed for OIDC sessions and logout tracking
-- Date: 2025-10-26

-- Step 1: Add OIDC-specific data column (JSONB for flexibility)
ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS oidc_data JSONB DEFAULT NULL;

-- Step 2: Add termination tracking columns
ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS termination_reason TEXT DEFAULT NULL;

ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS logout_method TEXT DEFAULT NULL;

-- Step 3: Add resource owner for org-wide operations
ALTER TABLE projections.sessions 
ADD COLUMN IF NOT EXISTS resource_owner TEXT DEFAULT NULL;

-- Step 4: Create index for OIDC data queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_sessions_oidc_data_gin 
ON projections.sessions USING gin(oidc_data);

-- Step 5: Create index for resource_owner (for org-wide logout queries)
CREATE INDEX IF NOT EXISTS idx_sessions_resource_owner 
ON projections.sessions(instance_id, resource_owner) 
WHERE resource_owner IS NOT NULL;

-- Comments
COMMENT ON COLUMN projections.sessions.oidc_data IS 'OIDC-specific session data (clientID, scope, redirectURI, token IDs)';
COMMENT ON COLUMN projections.sessions.termination_reason IS 'Reason why session was terminated (user_logout, org_security_event, etc.)';
COMMENT ON COLUMN projections.sessions.logout_method IS 'Method used for logout (frontchannel, backchannel)';
COMMENT ON COLUMN projections.sessions.resource_owner IS 'Organization ID that owns this session (for org-wide logout)';
