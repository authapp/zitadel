/**
 * Authorization Endpoint
 * 
 * OAuth 2.0 and OIDC authorization endpoint
 * Implements Authorization Code Flow and Implicit Flow
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { AuthorizationRequest } from './types';
import { getTokenStore } from './token-store';

/**
 * Validate authorization request
 */
function validateAuthorizationRequest(params: Partial<AuthorizationRequest>): {
  valid: boolean;
  error?: string;
  error_description?: string;
} {
  // Required parameters
  if (!params.client_id) {
    return {
      valid: false,
      error: 'invalid_request',
      error_description: 'Missing client_id parameter',
    };
  }

  if (!params.redirect_uri) {
    return {
      valid: false,
      error: 'invalid_request',
      error_description: 'Missing redirect_uri parameter',
    };
  }

  if (!params.response_type) {
    return {
      valid: false,
      error: 'invalid_request',
      error_description: 'Missing response_type parameter',
    };
  }

  // Validate response_type
  const validResponseTypes = [
    'code',
    'id_token',
    'token',
    'id_token token',
    'code id_token',
    'code token',
    'code id_token token',
  ];

  if (!validResponseTypes.includes(params.response_type)) {
    return {
      valid: false,
      error: 'unsupported_response_type',
      error_description: `Unsupported response_type: ${params.response_type}`,
    };
  }

  // Validate scope (must include 'openid' for OIDC)
  const scopes = params.scope?.split(' ') || [];
  if (params.response_type.includes('id_token') && !scopes.includes('openid')) {
    return {
      valid: false,
      error: 'invalid_scope',
      error_description: 'openid scope is required for OpenID Connect requests',
    };
  }

  // Validate PKCE if present
  if (params.code_challenge) {
    if (!params.code_challenge_method) {
      return {
        valid: false,
        error: 'invalid_request',
        error_description: 'code_challenge_method is required when using PKCE',
      };
    }

    if (!['S256', 'plain'].includes(params.code_challenge_method)) {
      return {
        valid: false,
        error: 'invalid_request',
        error_description: 'Unsupported code_challenge_method',
      };
    }
  }

  // Validate nonce (required for implicit and hybrid flows)
  if (
    params.response_type.includes('id_token') &&
    params.response_type !== 'code' &&
    !params.nonce
  ) {
    return {
      valid: false,
      error: 'invalid_request',
      error_description: 'nonce is required for implicit and hybrid flows',
    };
  }

  return { valid: true };
}

/**
 * Verify code challenge (PKCE)
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string = 'S256'
): boolean {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }

  if (method === 'S256') {
    const hash = createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }

  return false;
}

/**
 * Authorization endpoint handler
 * GET/POST /oauth/v2/authorize
 */
export async function authorizeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Support both GET and POST
    const params: Partial<AuthorizationRequest> =
      req.method === 'POST' ? req.body : req.query;

    // Validate request
    const validation = validateAuthorizationRequest(params);
    if (!validation.valid) {
      // Return error to redirect_uri if possible
      if (params.redirect_uri && params.state) {
        const errorUrl = new URL(params.redirect_uri);
        errorUrl.searchParams.set('error', validation.error!);
        errorUrl.searchParams.set('error_description', validation.error_description!);
        errorUrl.searchParams.set('state', params.state);
        res.redirect(errorUrl.toString());
        return;
      }

      res.status(400).json({
        error: validation.error,
        error_description: validation.error_description,
      });
      return;
    }

    // TODO: Check if user is authenticated
    // For now, we'll use a mock user_id for testing
    // In production, this should check session/cookie and redirect to login if needed
    const isTest = process.env.NODE_ENV === 'test';
    const userId = req.session?.userId || (isTest ? 'test-user-123' : null);

    if (!userId) {
      // User not authenticated - redirect to login
      // TODO: Implement login flow
      res.status(401).json({
        error: 'login_required',
        error_description: 'User must be authenticated',
        login_url: '/login', // TODO: Build proper login URL with return_to
      });
      return;
    }

    // TODO: Check if user has consented to the requested scopes
    // For now, we'll assume consent is granted

    const tokenStore = getTokenStore();
    const responseType = params.response_type!;

    // Authorization Code Flow
    if (responseType === 'code') {
      const code = tokenStore.generateAuthorizationCode({
        client_id: params.client_id!,
        redirect_uri: params.redirect_uri!,
        scope: params.scope || 'openid',
        user_id: userId,
        code_challenge: params.code_challenge,
        code_challenge_method: params.code_challenge_method,
        nonce: params.nonce,
      });

      const redirectUrl = new URL(params.redirect_uri!);
      redirectUrl.searchParams.set('code', code);
      if (params.state) {
        redirectUrl.searchParams.set('state', params.state);
      }

      res.redirect(redirectUrl.toString());
      return;
    }

    // Implicit/Hybrid Flows
    // TODO: Implement implicit and hybrid flows
    // These are less commonly used and less secure

    res.status(400).json({
      error: 'unsupported_response_type',
      error_description: 'Only authorization code flow is currently supported',
    });
  } catch (error) {
    next(error);
  }
}
