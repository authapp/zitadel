-- Create auth_requests projection table
-- Migration: 002_56

CREATE TABLE IF NOT EXISTS projections.auth_requests (
  id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  creation_date TIMESTAMPTZ NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  sequence BIGINT NOT NULL,
  resource_owner TEXT NOT NULL,
  login_client TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  state TEXT,
  nonce TEXT,
  scope TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT[],
  response_type TEXT,
  response_mode TEXT,
  code_challenge TEXT,
  code_challenge_method TEXT,
  prompt TEXT[] DEFAULT '{}',
  ui_locales TEXT[],
  max_age INTEGER,
  login_hint TEXT,
  hint_user_id TEXT,
  need_refresh_token BOOLEAN DEFAULT false,
  session_id TEXT,
  user_id TEXT,
  auth_time TIMESTAMPTZ,
  auth_methods TEXT[],
  code TEXT,
  issuer TEXT,
  PRIMARY KEY (instance_id, id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_auth_requests_code 
  ON projections.auth_requests(code, instance_id) 
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_requests_client_id 
  ON projections.auth_requests(client_id, instance_id);

CREATE INDEX IF NOT EXISTS idx_auth_requests_session_id 
  ON projections.auth_requests(session_id, instance_id) 
  WHERE session_id IS NOT NULL;
