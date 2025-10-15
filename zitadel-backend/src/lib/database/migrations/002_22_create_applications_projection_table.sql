-- Migration: 002_22 - Create applications projection table
-- Description: Store application read models (OIDC/SAML/API) for query side
-- Date: 2025-10-15

CREATE TABLE IF NOT EXISTS applications_projection (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    app_type TEXT NOT NULL,  -- 'oidc', 'saml', 'api'
    
    -- OIDC specific fields
    client_id TEXT,
    client_secret TEXT,
    redirect_uris JSONB,
    response_types JSONB,
    grant_types JSONB,
    oidc_app_type TEXT,  -- 'web', 'user_agent', 'native'
    auth_method_type TEXT,
    post_logout_redirect_uris JSONB,
    version INTEGER DEFAULT 1,
    dev_mode BOOLEAN DEFAULT false,
    access_token_type TEXT DEFAULT 'bearer',
    access_token_role_assertion BOOLEAN DEFAULT false,
    id_token_role_assertion BOOLEAN DEFAULT false,
    id_token_userinfo_assertion BOOLEAN DEFAULT false,
    clock_skew INTEGER DEFAULT 0,
    additional_origins JSONB,
    skip_native_app_success_page BOOLEAN DEFAULT false,
    
    -- SAML specific fields
    entity_id TEXT,
    metadata_url TEXT,
    metadata TEXT,  -- XML metadata
    acs_urls JSONB,
    single_logout_url TEXT,
    name_id_format TEXT,
    attribute_statements JSONB,
    
    -- API specific fields (uses client_id, client_secret, auth_method_type from OIDC)
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sequence BIGINT NOT NULL DEFAULT 0
    
    -- Note: No foreign key to avoid race conditions between projections
);

-- Index on project_id for listing apps by project
CREATE INDEX IF NOT EXISTS idx_applications_project_id ON applications_projection(project_id);

-- Index on app_type for filtering
CREATE INDEX IF NOT EXISTS idx_applications_type ON applications_projection(app_type);

-- Index on state for filtering
CREATE INDEX IF NOT EXISTS idx_applications_state ON applications_projection(state);

-- Index on name for search
CREATE INDEX IF NOT EXISTS idx_applications_name ON applications_projection(name);

-- Unique index on client_id for OIDC/API apps (allows NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_client_id ON applications_projection(client_id) WHERE client_id IS NOT NULL;

-- Unique index on entity_id for SAML apps (allows NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_entity_id ON applications_projection(entity_id) WHERE entity_id IS NOT NULL;

-- Composite index for project + app lookup
CREATE INDEX IF NOT EXISTS idx_applications_project_app ON applications_projection(project_id, id);

-- Comment
COMMENT ON TABLE applications_projection IS 'Read model for applications (OIDC, SAML, API)';
COMMENT ON COLUMN applications_projection.app_type IS 'Application type: oidc, saml, or api';
COMMENT ON COLUMN applications_projection.client_id IS 'OAuth2/OIDC client identifier (OIDC and API apps)';
COMMENT ON COLUMN applications_projection.entity_id IS 'SAML entity identifier (SAML apps only)';
