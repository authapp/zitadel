/**
 * Dynamic Client Registration Commands (RFC 7591)
 * 
 * Implements OAuth 2.0 Dynamic Client Registration Protocol
 * https://datatracker.ietf.org/doc/html/rfc7591
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { validateRequired, validateURL } from '../validation';
import { throwInvalidArgument } from '@/zerrors/errors';
import { OIDCAppType, OIDCAuthMethodType } from '../application/app-write-model';
import { randomUUID } from 'crypto';

/**
 * Client Registration Request (RFC 7591 Section 2)
 */
export interface ClientRegistrationRequest {
  // Required client metadata
  redirect_uris: string[];
  
  // Optional client metadata
  token_endpoint_auth_method?: 'none' | 'client_secret_post' | 'client_secret_basic' | 'client_secret_jwt' | 'private_key_jwt';
  grant_types?: string[];
  response_types?: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: object;
  software_id?: string;
  software_version?: string;
  
  // Application type
  application_type?: 'web' | 'native';
  
  // Post-logout
  post_logout_redirect_uris?: string[];
}

/**
 * Client Registration Response (RFC 7591 Section 3.2.1)
 */
export interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  client_id_issued_at: number;
  client_secret_expires_at?: number;
  
  // Client metadata
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  response_types: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: object;
  software_id?: string;
  software_version?: string;
  
  // Zitadel extensions
  registration_access_token?: string;
  registration_client_uri?: string;
}

/**
 * Client Update Request (RFC 7592 Section 2)
 */
export interface ClientUpdateRequest extends Partial<ClientRegistrationRequest> {
  client_id: string;
}

/**
 * Register client dynamically (RFC 7591)
 * 
 * Creates a new OAuth 2.0 client application via dynamic registration.
 * Implements RFC 7591 with support for web and native applications.
 */
export async function registerClient(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  request: ClientRegistrationRequest
): Promise<ClientRegistrationResponse> {
  // 1. Validate required fields per RFC 7591
  if (!request.redirect_uris || request.redirect_uris.length === 0) {
    throwInvalidArgument('redirect_uris is required', 'COMMAND-DCR01');
  }
  
  // Validate all redirect URIs
  for (const uri of request.redirect_uris) {
    validateURL(uri, 'redirect_uri');
    
    // RFC 7591: redirect URIs for native apps may use custom schemes or localhost
    // For web apps, must be https (except localhost for dev)
    if (request.application_type === 'web') {
      const parsedUri = new URL(uri);
      if (parsedUri.protocol !== 'https:' && parsedUri.hostname !== 'localhost') {
        throwInvalidArgument(
          'Web application redirect URIs must use HTTPS (except localhost)',
          'COMMAND-DCR02'
        );
      }
    }
  }
  
  // 2. Validate optional URIs
  if (request.client_uri) {
    validateURL(request.client_uri, 'client_uri');
  }
  if (request.logo_uri) {
    validateURL(request.logo_uri, 'logo_uri');
  }
  if (request.tos_uri) {
    validateURL(request.tos_uri, 'tos_uri');
  }
  if (request.policy_uri) {
    validateURL(request.policy_uri, 'policy_uri');
  }
  if (request.jwks_uri) {
    validateURL(request.jwks_uri, 'jwks_uri');
  }
  
  // 3. Validate grant types and response types compatibility
  const grantTypes = request.grant_types || ['authorization_code'];
  const responseTypes = request.response_types || ['code'];
  
  // RFC 7591: Validate grant_types and response_types are compatible
  if (grantTypes.includes('authorization_code') && !responseTypes.includes('code')) {
    throwInvalidArgument(
      'authorization_code grant requires code response type',
      'COMMAND-DCR03'
    );
  }
  
  if (grantTypes.includes('implicit') && 
      !responseTypes.some(rt => rt.includes('token') || rt.includes('id_token'))) {
    throwInvalidArgument(
      'implicit grant requires token or id_token response type',
      'COMMAND-DCR04'
    );
  }
  
  // 4. Determine authentication method
  const authMethod = request.token_endpoint_auth_method || 'client_secret_basic';
  let oidcAuthMethod: OIDCAuthMethodType;
  let generateSecret = true;
  
  switch (authMethod) {
    case 'none':
      oidcAuthMethod = OIDCAuthMethodType.NONE;
      generateSecret = false;
      break;
    case 'client_secret_post':
      oidcAuthMethod = OIDCAuthMethodType.POST;
      break;
    case 'client_secret_basic':
      oidcAuthMethod = OIDCAuthMethodType.BASIC;
      break;
    case 'private_key_jwt':
      oidcAuthMethod = OIDCAuthMethodType.PRIVATE_KEY_JWT;
      generateSecret = false;
      break;
    default:
      throwInvalidArgument(
        `Unsupported token_endpoint_auth_method: ${authMethod}`,
        'COMMAND-DCR05'
      );
  }
  
  // 5. Determine application type
  let oidcAppType: OIDCAppType;
  const appType = request.application_type || 'web';
  
  switch (appType) {
    case 'web':
      oidcAppType = OIDCAppType.WEB;
      break;
    case 'native':
      oidcAppType = OIDCAppType.NATIVE;
      break;
    default:
      throwInvalidArgument(
        `Unsupported application_type: ${appType}`,
        'COMMAND-DCR06'
      );
  }
  
  // 6. Generate client credentials
  const clientID = randomUUID();
  const clientSecret = generateSecret ? randomUUID() : undefined;
  const issuedAt = Math.floor(Date.now() / 1000);
  
  // 7. Create OIDC app via existing command
  await this.addOIDCApp(ctx, {
    appID: clientID,
    projectID,
    orgID,
    name: request.client_name || `Client ${clientID.substring(0, 8)}`,
    oidcAppType,
    redirectURIs: request.redirect_uris,
    responseTypes,
    grantTypes,
    authMethodType: oidcAuthMethod,
    postLogoutRedirectURIs: request.post_logout_redirect_uris || [],
    devMode: false, // DCR clients are production by default
    additionalOrigins: [],
  });
  
  // 8. Build RFC 7591 compliant response
  const response: ClientRegistrationResponse = {
    client_id: clientID,
    client_secret: clientSecret,
    client_id_issued_at: issuedAt,
    client_secret_expires_at: 0, // 0 = never expires per RFC 7591
    
    // Echo back the registered metadata
    redirect_uris: request.redirect_uris,
    token_endpoint_auth_method: authMethod,
    grant_types: grantTypes,
    response_types: responseTypes,
    client_name: request.client_name,
    client_uri: request.client_uri,
    logo_uri: request.logo_uri,
    scope: request.scope,
    contacts: request.contacts,
    tos_uri: request.tos_uri,
    policy_uri: request.policy_uri,
    jwks_uri: request.jwks_uri,
    jwks: request.jwks,
    software_id: request.software_id,
    software_version: request.software_version,
  };
  
  return response;
}

/**
 * Update registered client (RFC 7592)
 * 
 * Updates an existing dynamically registered client.
 */
export async function updateClient(
  this: Commands,
  ctx: Context,
  projectID: string,
  orgID: string,
  request: ClientUpdateRequest
): Promise<ClientRegistrationResponse> {
  validateRequired(request.client_id, 'client_id');
  
  // Build update data
  const updateData: any = {};
  
  if (request.client_name) {
    updateData.name = request.client_name;
  }
  
  if (request.redirect_uris) {
    // Validate redirect URIs
    for (const uri of request.redirect_uris) {
      validateURL(uri, 'redirect_uri');
    }
    updateData.redirectURIs = request.redirect_uris;
  }
  
  if (request.response_types) {
    updateData.responseTypes = request.response_types;
  }
  
  if (request.grant_types) {
    updateData.grantTypes = request.grant_types;
  }
  
  if (request.post_logout_redirect_uris) {
    updateData.postLogoutRedirectURIs = request.post_logout_redirect_uris;
  }
  
  if (request.token_endpoint_auth_method) {
    // Map to internal auth method type
    switch (request.token_endpoint_auth_method) {
      case 'none':
        updateData.authMethodType = OIDCAuthMethodType.NONE;
        break;
      case 'client_secret_post':
        updateData.authMethodType = OIDCAuthMethodType.POST;
        break;
      case 'client_secret_basic':
        updateData.authMethodType = OIDCAuthMethodType.BASIC;
        break;
      case 'private_key_jwt':
        updateData.authMethodType = OIDCAuthMethodType.PRIVATE_KEY_JWT;
        break;
    }
  }
  
  // Update via existing command
  await this.updateOIDCApp(ctx, request.client_id, projectID, orgID, updateData);
  
  // Build response (would need to query current state)
  const response: ClientRegistrationResponse = {
    client_id: request.client_id,
    client_id_issued_at: 0, // Would need to query
    redirect_uris: request.redirect_uris || [],
    token_endpoint_auth_method: request.token_endpoint_auth_method || 'client_secret_basic',
    grant_types: request.grant_types || ['authorization_code'],
    response_types: request.response_types || ['code'],
    client_name: request.client_name,
  };
  
  return response;
}

/**
 * Delete registered client (RFC 7592)
 * 
 * Deletes a dynamically registered client.
 */
export async function deleteClient(
  this: Commands,
  ctx: Context,
  clientID: string,
  projectID: string,
  _orgID: string
): Promise<void> {
  validateRequired(clientID, 'client_id');
  
  // Use existing deactivate + remove commands
  await this.deactivateApplication(ctx, projectID, clientID);
  await this.removeApplication(ctx, projectID, clientID);
}
