-- ============================================================================
-- SAML IDENTITY PROVIDER PROJECTIONS
-- Migration: 04 - SAML Tables
-- Description: SAML request tracking and session management for IdP functionality
-- ============================================================================

-- Table: projections.saml_requests
-- Description: Tracks SAML authentication requests from Service Providers
CREATE TABLE IF NOT EXISTS projections.saml_requests (
    instance_id TEXT NOT NULL,
    id TEXT NOT NULL,
    login_client TEXT,
    application_id TEXT NOT NULL,
    acs_url TEXT NOT NULL,
    relay_state TEXT,
    request_id TEXT NOT NULL,
    binding TEXT NOT NULL,
    issuer TEXT NOT NULL,
    destination TEXT NOT NULL,
    response_issuer TEXT,
    session_id TEXT,
    user_id TEXT,
    auth_methods TEXT[],
    auth_time TIMESTAMPTZ,
    state TEXT NOT NULL DEFAULT 'added', -- added, succeeded, failed
    error_reason TEXT,
    error_description TEXT,
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (instance_id, id)
);

-- Indexes for SAML requests
CREATE INDEX IF NOT EXISTS idx_saml_requests_instance_user 
    ON projections.saml_requests(instance_id, user_id) 
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saml_requests_instance_app 
    ON projections.saml_requests(instance_id, application_id);

CREATE INDEX IF NOT EXISTS idx_saml_requests_instance_state 
    ON projections.saml_requests(instance_id, state);

CREATE INDEX IF NOT EXISTS idx_saml_requests_creation_date 
    ON projections.saml_requests(instance_id, creation_date DESC);

COMMENT ON TABLE projections.saml_requests IS 'Tracks SAML authentication requests from Service Providers (SP-initiated SSO)';
COMMENT ON COLUMN projections.saml_requests.login_client IS 'User ID of the login client (if known upfront)';
COMMENT ON COLUMN projections.saml_requests.acs_url IS 'Assertion Consumer Service URL where response will be sent';
COMMENT ON COLUMN projections.saml_requests.relay_state IS 'Opaque string passed through SSO flow';
COMMENT ON COLUMN projections.saml_requests.request_id IS 'ID from original SAMLRequest (for InResponseTo)';
COMMENT ON COLUMN projections.saml_requests.binding IS 'SAML binding type (HTTP-POST, HTTP-Redirect)';
COMMENT ON COLUMN projections.saml_requests.issuer IS 'SP entity ID (typically application entity ID)';
COMMENT ON COLUMN projections.saml_requests.response_issuer IS 'IdP entity ID (this instance)';
COMMENT ON COLUMN projections.saml_requests.state IS 'Request lifecycle: added → succeeded/failed';

-- Table: projections.saml_sessions
-- Description: Tracks active SAML sessions for Single Logout and auditing
CREATE TABLE IF NOT EXISTS projections.saml_sessions (
    instance_id TEXT NOT NULL,
    id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    saml_response_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    audience TEXT[] NOT NULL,
    expiration TIMESTAMPTZ NOT NULL,
    auth_methods TEXT[] NOT NULL,
    auth_time TIMESTAMPTZ NOT NULL,
    preferred_language TEXT,
    state TEXT NOT NULL DEFAULT 'active', -- active, terminated
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (instance_id, id)
);

-- Indexes for SAML sessions
CREATE INDEX IF NOT EXISTS idx_saml_sessions_instance_user 
    ON projections.saml_sessions(instance_id, user_id);

CREATE INDEX IF NOT EXISTS idx_saml_sessions_instance_session 
    ON projections.saml_sessions(instance_id, session_id);

CREATE INDEX IF NOT EXISTS idx_saml_sessions_instance_entity 
    ON projections.saml_sessions(instance_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_saml_sessions_expiration 
    ON projections.saml_sessions(instance_id, expiration) 
    WHERE state = 'active';

CREATE INDEX IF NOT EXISTS idx_saml_sessions_response_id 
    ON projections.saml_sessions(instance_id, saml_response_id);

COMMENT ON TABLE projections.saml_sessions IS 'Tracks active SAML sessions for Single Logout and auditing';
COMMENT ON COLUMN projections.saml_sessions.saml_response_id IS 'Unique ID of the SAML response/assertion';
COMMENT ON COLUMN projections.saml_sessions.entity_id IS 'Service Provider entity ID';
COMMENT ON COLUMN projections.saml_sessions.audience IS 'Audience restriction values (typically SP entity ID)';
COMMENT ON COLUMN projections.saml_sessions.auth_methods IS 'Authentication methods used (password, otp, totp, etc.)';
COMMENT ON COLUMN projections.saml_sessions.preferred_language IS 'User preferred language for SAML attributes';