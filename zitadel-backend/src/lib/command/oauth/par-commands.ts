/**
 * Pushed Authorization Requests (PAR) Commands (RFC 9126)
 * 
 * Implements OAuth 2.0 Pushed Authorization Requests
 * https://datatracker.ietf.org/doc/html/rfc9126
 */

import { Commands } from '../commands';
import { Context } from '../context';
import { validateRequired } from '../validation';
import { throwInvalidArgument } from '@/zerrors/errors';
import { randomBytes } from 'crypto';

/**
 * PAR Request (RFC 9126 Section 2)
 */
export interface PARRequest {
  // OAuth 2.0 authorization request parameters
  client_id: string;
  response_type: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  
  // PKCE parameters (RFC 7636)
  code_challenge?: string;
  code_challenge_method?: string;
  
  // OIDC parameters
  nonce?: string;
  prompt?: string;
  max_age?: number;
  login_hint?: string;
  
  // Additional parameters
  [key: string]: any;
}

/**
 * PAR Response (RFC 9126 Section 2.2)
 */
export interface PARResponse {
  request_uri: string;
  expires_in: number;
}

/**
 * Generate a unique request URI
 */
function generateRequestURI(): string {
  // RFC 9126: request_uri format should be urn:ietf:params:oauth:request_uri:<unique-id>
  const uniqueId = randomBytes(16).toString('hex');
  return `urn:ietf:params:oauth:request_uri:${uniqueId}`;
}

/**
 * Create Pushed Authorization Request (RFC 9126)
 * 
 * Stores authorization request parameters and returns a request_uri
 * that can be used in subsequent authorization requests.
 * 
 * @param ctx - Command context
 * @param request - PAR request parameters
 * @returns PAR response with request_uri and expiration
 */
export async function createPushedAuthRequest(
  this: Commands,
  ctx: Context,
  request: PARRequest
): Promise<PARResponse> {
  // 1. Validate required parameters
  validateRequired(request.client_id, 'client_id');
  validateRequired(request.response_type, 'response_type');
  validateRequired(request.redirect_uri, 'redirect_uri');

  // 2. Validate client exists and can use PAR
  // In production, you'd verify client authentication here
  // For now, we assume the client is authenticated

  // 3. Validate response_type
  const validResponseTypes = ['code', 'token', 'id_token', 'code id_token', 'code token', 'id_token token', 'code id_token token'];
  if (!validResponseTypes.includes(request.response_type)) {
    throwInvalidArgument(
      'Invalid response_type. Must be one of: ' + validResponseTypes.join(', '),
      'COMMAND-PAR01'
    );
  }

  // 4. Validate PKCE if present
  if (request.code_challenge) {
    if (!request.code_challenge_method) {
      throwInvalidArgument(
        'code_challenge_method is required when code_challenge is provided',
        'COMMAND-PAR02'
      );
    }
    
    const validMethods = ['S256', 'plain'];
    if (!validMethods.includes(request.code_challenge_method)) {
      throwInvalidArgument(
        'Invalid code_challenge_method. Must be S256 or plain',
        'COMMAND-PAR02'
      );
    }
  }

  // 5. Generate request_uri
  const requestURI = generateRequestURI();
  
  // 6. Set expiration (RFC 9126: RECOMMENDED 60-600 seconds, we use 90 seconds)
  const expiresIn = 90; // seconds
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // 7. Store the PAR request
  // Store as a special auth request with PAR flag
  // We encode PAR metadata in the state parameter (prefixed with par:)
  const parState = `par:${requestURI}:${expiresAt.toISOString()}${request.state ? ':' + request.state : ''}`;
  
  await this.addAuthRequest(ctx, {
    clientID: request.client_id,
    redirectURI: request.redirect_uri,
    // RFC 9126: If scope is not provided, default to 'openid' for OIDC compatibility
    scope: request.scope ? request.scope.split(' ') : ['openid'],
    responseType: request.response_type,
    state: parState,
    nonce: request.nonce || '',
    codeChallenge: request.code_challenge || '',
    codeChallengeMethod: request.code_challenge_method || '',
  });

  // 8. Return response
  return {
    request_uri: requestURI,
    expires_in: expiresIn,
  };
}

/**
 * Retrieve Pushed Authorization Request by request_uri
 * 
 * @param ctx - Command context
 * @param requestURI - The request_uri from PAR response
 * @returns The stored authorization request parameters
 */
export async function retrievePushedAuthRequest(
  this: Commands,
  _ctx: Context,
  requestURI: string
): Promise<PARRequest | null> {
  validateRequired(requestURI, 'request_uri');

  // Validate request_uri format (RFC 9126)
  if (!requestURI.startsWith('urn:ietf:params:oauth:request_uri:')) {
    throwInvalidArgument(
      'Invalid request_uri format',
      'COMMAND-PAR03'
    );
  }

  // Retrieve the auth request using the request_uri as ID
  // In a real implementation, you'd query from a PAR-specific projection
  // For now, we'll note that this needs to be implemented with proper storage
  
  // This would query the auth_request aggregate or a PAR-specific projection
  // and return the stored parameters if not expired
  
  return null; // Placeholder - needs projection query implementation
}

/**
 * Delete expired PAR requests (cleanup job)
 * 
 * @param ctx - Command context
 * @param beforeDate - Delete PAR requests that expired before this date
 */
export async function cleanupExpiredPARRequests(
  this: Commands,
  _ctx: Context,
  _beforeDate: Date
): Promise<number> {
  // This would be called by a background job to clean up expired PAR requests
  // Returns the number of deleted requests
  
  // Implementation would:
  // 1. Query all PAR requests with expiresAt < beforeDate
  // 2. Delete each one
  // 3. Return count
  
  return 0; // Placeholder
}
