/**
 * OIDC Discovery Endpoint
 * 
 * Implements OpenID Connect Discovery 1.0
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 */

import { Request, Response } from 'express';
import { OIDCDiscoveryMetadata } from './types';

/**
 * Get OIDC discovery configuration
 */
export function getDiscoveryConfiguration(baseUrl: string): OIDCDiscoveryMetadata {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/v2/authorize`,
    token_endpoint: `${baseUrl}/oauth/v2/token`,
    userinfo_endpoint: `${baseUrl}/oidc/v1/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    revocation_endpoint: `${baseUrl}/oauth/v2/revoke`,
    introspection_endpoint: `${baseUrl}/oauth/v2/introspect`,
    end_session_endpoint: `${baseUrl}/oidc/v1/end_session`,

    // Supported response types
    response_types_supported: [
      'code',
      'id_token',
      'id_token token',
      'code id_token',
      'code token',
      'code id_token token',
    ],

    // Supported response modes
    response_modes_supported: ['query', 'fragment', 'form_post'],

    // Supported grant types
    grant_types_supported: [
      'authorization_code',
      'implicit',
      'refresh_token',
      'client_credentials',
      'password', // Resource Owner Password Credentials
      'urn:ietf:params:oauth:grant-type:device_code',
    ],

    // Subject types
    subject_types_supported: ['public'],

    // ID Token signing algorithms
    id_token_signing_alg_values_supported: ['RS256', 'ES256'],

    // Token endpoint auth methods
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'private_key_jwt',
      'none', // For public clients
    ],

    // Supported claims
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'exp',
      'iat',
      'auth_time',
      'nonce',
      'acr',
      'amr',
      'azp',
      'name',
      'given_name',
      'family_name',
      'middle_name',
      'nickname',
      'preferred_username',
      'profile',
      'picture',
      'website',
      'email',
      'email_verified',
      'gender',
      'birthdate',
      'zoneinfo',
      'locale',
      'phone_number',
      'phone_number_verified',
      'address',
      'updated_at',
    ],

    // Supported scopes
    scopes_supported: [
      'openid',
      'profile',
      'email',
      'address',
      'phone',
      'offline_access',
      'urn:zitadel:iam:org:project:id:zitadel:aud',
      'urn:zitadel:iam:org:projects:roles',
    ],

    // PKCE support
    code_challenge_methods_supported: ['S256', 'plain'],

    // Optional features
    request_parameter_supported: true,
    request_uri_parameter_supported: false,
    require_request_uri_registration: false,
    claims_parameter_supported: true,
  };
}

/**
 * Discovery endpoint handler
 * GET /.well-known/openid-configuration
 */
export function discoveryHandler(req: Request, res: Response): void {
  const protocol = req.protocol;
  const host = req.get('host') || 'localhost:3000';
  const baseUrl = `${protocol}://${host}`;

  const config = getDiscoveryConfiguration(baseUrl);

  res.json(config);
}
