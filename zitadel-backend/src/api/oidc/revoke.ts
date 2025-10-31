/**
 * Token Revocation Endpoint
 * 
 * RFC 7009 - OAuth 2.0 Token Revocation
 */

import { Request, Response, NextFunction } from 'express';
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
 * Revoke access token
 */
async function revokeAccessToken(token: string): Promise<boolean> {
  try {
    const keyManager = await getKeyManager();
    const result = await keyManager.verifyJWT(token);
    const payload = result.payload as any;

    const tokenStore = getTokenStore();
    tokenStore.revokeAccessToken(payload.jti);
    return true;
  } catch (error) {
    // Token is invalid or already expired
    return false;
  }
}

/**
 * Revoke refresh token
 */
function revokeRefreshToken(token: string): boolean {
  const tokenStore = getTokenStore();
  return tokenStore.revokeRefreshToken(token);
}

/**
 * Token revocation endpoint handler
 * POST /oauth/v2/revoke
 */
export async function revokeHandler(
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

    // Try to revoke based on hint, or try both
    let revoked = false;

    if (token_type_hint === 'refresh_token') {
      revoked = revokeRefreshToken(token);
      if (!revoked) {
        revoked = await revokeAccessToken(token);
      }
    } else {
      // Default to access_token or try both
      revoked = await revokeAccessToken(token);
      if (!revoked) {
        revoked = revokeRefreshToken(token);
      }
    }

    // RFC 7009: The revocation endpoint responds with HTTP 200
    // whether the token was successfully revoked or not
    res.status(200).send();
  } catch (error) {
    next(error);
  }
}
