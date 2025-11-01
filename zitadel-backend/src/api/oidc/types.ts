/**
 * OIDC Types and Interfaces
 * 
 * Type definitions for OpenID Connect flows and responses
 */

/**
 * OIDC Discovery Metadata
 * Based on OpenID Connect Discovery 1.0
 */
export interface OIDCDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  revocation_endpoint: string;
  introspection_endpoint: string;
  end_session_endpoint?: string;
  
  // Supported features
  response_types_supported: string[];
  response_modes_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  scopes_supported: string[];
  code_challenge_methods_supported: string[];
  
  // Optional features
  request_parameter_supported?: boolean;
  request_uri_parameter_supported?: boolean;
  require_request_uri_registration?: boolean;
  claims_parameter_supported?: boolean;
}

/**
 * Authorization Request Parameters
 */
export interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  nonce?: string;
  response_mode?: string;
  prompt?: string;
  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;
  login_hint?: string;
  acr_values?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  // RFC 9126: Pushed Authorization Requests
  request_uri?: string;
}

/**
 * Token Request Parameters
 */
export interface TokenRequest {
  grant_type: string;
  code?: string;
  refresh_token?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  code_verifier?: string;
  scope?: string;
  username?: string;
  password?: string;
}

/**
 * Token Response
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

/**
 * UserInfo Response
 */
export interface UserInfoResponse {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  updated_at?: number;
}

/**
 * Token Introspection Request
 */
export interface IntrospectionRequest {
  token: string;
  token_type_hint?: 'access_token' | 'refresh_token';
}

/**
 * Token Introspection Response
 */
export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  jti?: string;
}

/**
 * Token Revocation Request
 */
export interface RevocationRequest {
  token: string;
  token_type_hint?: 'access_token' | 'refresh_token';
}

/**
 * JSON Web Key Set
 */
export interface JWKS {
  keys: JWK[];
}

/**
 * JSON Web Key
 */
export interface JWK {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

/**
 * Authorization Code
 */
export interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  user_id: string;
  expires_at: Date;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
}

/**
 * Access Token Claims
 */
export interface AccessTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  scope: string;
  client_id: string;
  jti: string;
}

/**
 * ID Token Claims
 */
export interface IDTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  acr?: string;
  amr?: string[];
  azp?: string;
  
  // Profile claims
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    formatted?: string;
  };
  updated_at?: number;
}

/**
 * Refresh Token
 */
export interface RefreshToken {
  token: string;
  user_id: string;
  client_id: string;
  scope: string;
  expires_at: Date;
  created_at: Date;
}

/**
 * Session
 */
export interface OIDCSession {
  session_id: string;
  user_id: string;
  client_id: string;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
}
