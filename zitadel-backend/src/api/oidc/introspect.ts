/**
 * Token Introspection Endpoint
 * 
 * RFC 7662 - OAuth 2.0 Token Introspection
 */

import { Request, Response, NextFunction } from 'express';
import { IntrospectionResponse } from './types';
import { getKeyManager } from './key-manager';
import { getTokenStore } from './token-store';

/**
 * Extract client credentials from request
 */
function extractClientCredentials(req: Request): {
  client_id?: string;
  client_secret?: string;
} {
  // Check Authorization header (Basic auth)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [client_id, client_secret] = credentials.split(':');
    return { client_id, client_secret };
  }

  // Check request body
  return {
    client_id: req.body.client_id,
    client_secret: req.body.client_secret,
  };
}

/**
 * Introspect access token
 */
async function introspectAccessToken(token: string): Promise<IntrospectionResponse> {
  try {
    const keyManager = await getKeyManager();
    const result = await keyManager.verifyJWT(token);
    const payload = result.payload as any;

    // Check if token is revoked (if it has a jti)
    const tokenStore = getTokenStore();
    if (payload.jti && tokenStore.isAccessTokenRevoked(payload.jti)) {
      return { active: false };
    }

    return {
      active: true,
      scope: payload.scope,
      client_id: payload.client_id,
      username: payload.username,
      token_type: 'Bearer',
      exp: payload.exp,
      iat: payload.iat,
      nbf: payload.nbf,
      sub: payload.sub,
      aud: payload.aud,
      iss: payload.iss,
      jti: payload.jti,
    };
  } catch (error) {
    // Token is invalid
    return { active: false };
  }
}

/**
 * Introspect refresh token
 */
function introspectRefreshToken(token: string): IntrospectionResponse {
  const tokenStore = getTokenStore();
  const refreshToken = tokenStore.getRefreshToken(token);

  if (!refreshToken) {
    return { active: false };
  }

  const exp = Math.floor(refreshToken.expires_at.getTime() / 1000);
  const iat = Math.floor(refreshToken.created_at.getTime() / 1000);

  return {
    active: true,
    scope: refreshToken.scope,
    client_id: refreshToken.client_id,
    token_type: 'refresh_token',
    exp,
    iat,
    sub: refreshToken.user_id,
  };
}

/**
 * Token introspection endpoint handler
 * POST /oauth/v2/introspect
 */
export async function introspectHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, token_type_hint } = req.body;
    const { client_id, client_secret } = extractClientCredentials(req);

    // Client authentication required
    if (!client_id || !client_secret) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      });
      return;
    }

    // TODO: Validate client credentials against database

    if (!token) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing token parameter',
      });
      return;
    }

    let introspectionResult: IntrospectionResponse;

    // Try to introspect based on hint, or try both
    if (token_type_hint === 'refresh_token') {
      introspectionResult = introspectRefreshToken(token);
      if (!introspectionResult.active) {
        introspectionResult = await introspectAccessToken(token);
      }
    } else {
      // Default to access_token or try both
      introspectionResult = await introspectAccessToken(token);
      if (!introspectionResult.active) {
        introspectionResult = introspectRefreshToken(token);
      }
    }

    res.json(introspectionResult);
  } catch (error) {
    next(error);
  }
}
