/**
 * JAR (JWT-Secured Authorization Request) Commands (RFC 9101)
 * 
 * Implements JWT-Secured Authorization Request (JAR) for OAuth 2.0
 * https://datatracker.ietf.org/doc/html/rfc9101
 */

import { jwtVerify, type JWTPayload } from 'jose';
import { throwInvalidArgument } from '@/zerrors/errors';

/**
 * JAR Request Object
 */
export interface JARRequest {
  // OAuth 2.0 authorization parameters
  client_id: string;
  response_type: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  nonce?: string;
  
  // PKCE parameters
  code_challenge?: string;
  code_challenge_method?: string;
  
  // Additional OIDC parameters
  prompt?: string;
  max_age?: number;
  login_hint?: string;
  
  // JWT claims
  iss: string;              // Issuer (client_id)
  aud: string | string[];   // Audience (authorization server)
  iat: number;              // Issued at
  exp?: number;             // Expiration
  jti?: string;             // JWT ID
  
  [key: string]: any;
}

/**
 * JAR validation options
 */
export interface JARValidationOptions {
  expectedClientId: string;
  expectedAudience: string;
  maxAge?: number;          // Maximum age in seconds (default: 3600)
  publicKey?: any; // For signed requests (jose.KeyLike)
  requireSignature?: boolean;
}

/**
 * Validate JWT-secured authorization request
 * RFC 9101 Section 2
 */
export async function validateJARRequest(
  requestJwt: string,
  options: JARValidationOptions
): Promise<JARRequest> {
  try {
    let payload: JWTPayload;

    // 1. Check if request is signed
    // Decode header manually
    const parts = requestJwt.split('.');
    if (parts.length !== 3) {
      throwInvalidArgument('Invalid JAR request: invalid JWT structure', 'JAR-000');
    }
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    
    if (header.alg === 'none') {
      // RFC 9101: Unsigned JWTs allowed but not recommended
      if (options.requireSignature) {
        throwInvalidArgument(
          'JAR request must be signed',
          'JAR-001'
        );
      }
      
      // Decode unsigned JWT
      const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      payload = decoded;
    } else {
      // 2. Verify signed JWT
      if (options.publicKey) {
        // Verify signature with public key
        const { payload: verifiedPayload } = await jwtVerify(
          requestJwt,
          options.publicKey
        );
        payload = verifiedPayload;
      } else if (options.requireSignature) {
        // Public key required when signature is mandatory
        throwInvalidArgument(
          'Public key required for signed JAR request',
          'JAR-002'
        );
      } else {
        // Decode without verification (for testing/development)
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        payload = decoded;
      }
    }

    // 3. Validate required claims
    // iss (issuer) must equal client_id
    if (!payload.iss) {
      throwInvalidArgument(
        'JAR request missing iss claim',
        'JAR-003'
      );
    }

    if (payload.iss !== options.expectedClientId) {
      throwInvalidArgument(
        `JAR request iss mismatch (expected ${options.expectedClientId}, got ${payload.iss})`,
        'JAR-004'
      );
    }

    // aud (audience) must include authorization server
    if (!payload.aud) {
      throwInvalidArgument(
        'JAR request missing aud claim',
        'JAR-005'
      );
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(options.expectedAudience)) {
      throwInvalidArgument(
        'JAR request aud does not include authorization server',
        'JAR-006'
      );
    }

    // iat (issued at) - check for freshness
    if (!payload.iat) {
      throwInvalidArgument(
        'JAR request missing iat claim',
        'JAR-007'
      );
    }

    const maxAge = options.maxAge || 3600; // Default 1 hour
    const now = Math.floor(Date.now() / 1000);
    const age = now - payload.iat;

    if (age < 0) {
      throwInvalidArgument(
        'JAR request iat is in the future',
        'JAR-008'
      );
    }

    if (age > maxAge) {
      throwInvalidArgument(
        `JAR request is too old (${age}s > ${maxAge}s)`,
        'JAR-009'
      );
    }

    // exp (expiration) - if present
    if (payload.exp && now >= payload.exp) {
      throwInvalidArgument(
        'JAR request has expired',
        'JAR-010'
      );
    }

    // 4. Extract OAuth parameters
    const jarRequest: JARRequest = {
      client_id: payload.client_id as string || payload.iss,
      response_type: payload.response_type as string,
      redirect_uri: payload.redirect_uri as string,
      scope: payload.scope as string | undefined,
      state: payload.state as string | undefined,
      nonce: payload.nonce as string | undefined,
      code_challenge: payload.code_challenge as string | undefined,
      code_challenge_method: payload.code_challenge_method as string | undefined,
      prompt: payload.prompt as string | undefined,
      max_age: payload.max_age as number | undefined,
      login_hint: payload.login_hint as string | undefined,
      iss: payload.iss,
      aud: payload.aud,
      iat: payload.iat,
      exp: payload.exp,
      jti: payload.jti as string | undefined,
    };

    // 5. Validate OAuth parameters
    if (!jarRequest.response_type) {
      throwInvalidArgument(
        'JAR request missing response_type',
        'JAR-011'
      );
    }

    if (!jarRequest.redirect_uri) {
      throwInvalidArgument(
        'JAR request missing redirect_uri',
        'JAR-012'
      );
    }

    return jarRequest;
  } catch (error: any) {
    if (error.code?.startsWith('JAR-')) {
      throw error;
    }
    throwInvalidArgument(
      `JAR request validation failed: ${error.message}`,
      'JAR-013'
    );
  }
}

/**
 * Parse request parameter or request_uri parameter
 * RFC 9101 Section 2.1
 */
export async function parseJARParameter(
  requestParam?: string,
  requestUriParam?: string
): Promise<string | null> {
  // RFC 9101: request parameter takes precedence over request_uri
  if (requestParam) {
    return requestParam;
  }

  if (requestUriParam) {
    // RFC 9101: request_uri must be fetched
    // In production, this would fetch the JWT from the URI
    // For now, we'll note this needs implementation
    throwInvalidArgument(
      'request_uri parameter not yet implemented (use request parameter)',
      'JAR-014'
    );
  }

  return null;
}

/**
 * Check if authorization request is JAR
 */
export function isJARRequest(params: Record<string, any>): boolean {
  return !!(params.request || params.request_uri);
}

/**
 * Extract OAuth parameters from JAR request
 * Combines parameters from JAR with query parameters
 * RFC 9101 Section 2.3: Request object parameters take precedence
 */
export function mergeJARWithQueryParams(
  jarRequest: JARRequest,
  queryParams: Record<string, any>
): Record<string, any> {
  // JAR parameters take precedence over query parameters
  return {
    ...queryParams,
    ...jarRequest,
    // Remove JWT-specific claims that shouldn't be in OAuth flow
    iss: undefined,
    aud: undefined,
    iat: undefined,
    exp: undefined,
    jti: undefined,
  };
}
