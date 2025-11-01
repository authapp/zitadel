/**
 * Token Endpoint
 * 
 * OAuth 2.0 and OIDC token endpoint
 * Handles token requests for various grant types
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { TokenResponse, AccessTokenClaims, IDTokenClaims } from './types';
import { getTokenStore } from './token-store';
import { getKeyManager } from './key-manager';
import { verifyCodeChallenge } from './authorize';
import { 
  validateDPoPProof, 
  extractDPoPProof, 
  calculateJWKThumbprint,
  DPoPProof 
} from '../../lib/command/oauth/dpop-commands';
// Device authorization support - will be completed with projection layer
// import { DeviceAuthWriteModel, DeviceAuthState } from '@/lib/command/oauth/device-auth-commands';

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
 * Generate access token
 */
async function generateAccessToken(params: {
  user_id: string;
  client_id: string;
  scope: string;
  audience?: string;
  dpopProof?: DPoPProof; // RFC 9449: DPoP binding
}): Promise<string> {
  const keyManager = await getKeyManager();
  const jti = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const claims: AccessTokenClaims & { cnf?: { jkt: string } } = {
    iss: process.env.ISSUER_URL || 'http://localhost:3000',
    sub: params.user_id,
    aud: params.audience || params.client_id,
    exp: now + 3600, // 1 hour
    iat: now,
    scope: params.scope,
    client_id: params.client_id,
    jti,
  };

  // RFC 9449: Bind token to DPoP key via cnf claim
  if (params.dpopProof) {
    claims.cnf = {
      jkt: calculateJWKThumbprint(params.dpopProof.header.jwk),
    };
  }

  const tokenStore = getTokenStore();
  tokenStore.trackAccessToken(params.user_id, jti);

  return await keyManager.signJWT(claims, { expiresIn: '1h' });
}

/**
 * Generate ID token
 */
async function generateIDToken(params: {
  user_id: string;
  client_id: string;
  nonce?: string;
  auth_time?: number;
  acr?: string;
}): Promise<string> {
  const keyManager = await getKeyManager();
  const now = Math.floor(Date.now() / 1000);

  // TODO: Fetch actual user data from database
  // For now, using mock data
  const claims: IDTokenClaims = {
    iss: process.env.ISSUER_URL || 'http://localhost:3000',
    sub: params.user_id,
    aud: params.client_id,
    exp: now + 3600, // 1 hour
    iat: now,
    auth_time: params.auth_time || now,
    nonce: params.nonce,
    acr: params.acr || '0',
    amr: ['pwd'], // Authentication method: password
    
    // Mock user profile data
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User',
    email: 'test@example.com',
    email_verified: true,
    preferred_username: 'testuser',
  };

  return await keyManager.signJWT(claims, { expiresIn: '1h' });
}

/**
 * Handle authorization code grant
 */
async function handleAuthorizationCodeGrant(
  req: Request
): Promise<TokenResponse | { error: string; error_description: string }> {
  const { code, redirect_uri, code_verifier } = req.body;
  const { client_id } = extractClientCredentials(req);

  if (!code) {
    return {
      error: 'invalid_request',
      error_description: 'Missing code parameter',
    };
  }

  if (!client_id) {
    return {
      error: 'invalid_client',
      error_description: 'Client authentication failed',
    };
  }

  const tokenStore = getTokenStore();
  const authCode = tokenStore.consumeAuthorizationCode(code);

  if (!authCode) {
    return {
      error: 'invalid_grant',
      error_description: 'Invalid or expired authorization code',
    };
  }

  // Verify client_id matches
  if (authCode.client_id !== client_id) {
    return {
      error: 'invalid_grant',
      error_description: 'Authorization code was issued to different client',
    };
  }

  // Verify redirect_uri matches
  if (authCode.redirect_uri !== redirect_uri) {
    return {
      error: 'invalid_grant',
      error_description: 'redirect_uri does not match',
    };
  }

  // Verify PKCE if used
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return {
        error: 'invalid_request',
        error_description: 'code_verifier is required',
      };
    }

    const valid = verifyCodeChallenge(
      code_verifier,
      authCode.code_challenge,
      authCode.code_challenge_method
    );

    if (!valid) {
      return {
        error: 'invalid_grant',
        error_description: 'Invalid code_verifier',
      };
    }
  }

  // RFC 9449: Validate DPoP proof if present
  let dpopProof: DPoPProof | undefined;
  const dpopHeader = extractDPoPProof(req.headers as Record<string, string | string[] | undefined>);
  
  if (dpopHeader) {
    try {
      dpopProof = await validateDPoPProof(dpopHeader, {
        expectedMethod: 'POST',
        expectedUrl: `${process.env.ISSUER_URL || 'http://localhost:3000'}/oauth/v2/token`,
      });
    } catch (error: any) {
      return {
        error: 'invalid_dpop_proof',
        error_description: error.message,
      };
    }
  }

  // Generate tokens
  const accessToken = await generateAccessToken({
    user_id: authCode.user_id,
    client_id: authCode.client_id,
    scope: authCode.scope,
    dpopProof,
  });

  const refreshToken = tokenStore.generateRefreshToken({
    user_id: authCode.user_id,
    client_id: authCode.client_id,
    scope: authCode.scope,
  });

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: dpopProof ? 'DPoP' : 'Bearer', // RFC 9449: token_type indicates binding
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: authCode.scope,
  };

  // Generate ID token if openid scope was requested
  if (authCode.scope.includes('openid')) {
    const idToken = await generateIDToken({
      user_id: authCode.user_id,
      client_id: authCode.client_id,
      nonce: authCode.nonce,
    });
    response.id_token = idToken;
  }

  return response;
}

/**
 * Handle refresh token grant
 */
async function handleRefreshTokenGrant(
  req: Request
): Promise<TokenResponse | { error: string; error_description: string }> {
  const { refresh_token, scope } = req.body;
  const { client_id } = extractClientCredentials(req);

  if (!refresh_token) {
    return {
      error: 'invalid_request',
      error_description: 'Missing refresh_token parameter',
    };
  }

  if (!client_id) {
    return {
      error: 'invalid_client',
      error_description: 'Client authentication failed',
    };
  }

  const tokenStore = getTokenStore();
  const storedRefreshToken = tokenStore.getRefreshToken(refresh_token);

  if (!storedRefreshToken) {
    return {
      error: 'invalid_grant',
      error_description: 'Invalid or expired refresh token',
    };
  }

  // Verify client_id matches
  if (storedRefreshToken.client_id !== client_id) {
    return {
      error: 'invalid_grant',
      error_description: 'Refresh token was issued to different client',
    };
  }

  // Use requested scope or fall back to original scope
  const tokenScope = scope || storedRefreshToken.scope;

  // TODO: Verify requested scope is subset of original scope

  // Generate new access token
  const accessToken = await generateAccessToken({
    user_id: storedRefreshToken.user_id,
    client_id: storedRefreshToken.client_id,
    scope: tokenScope,
  });

  const response: TokenResponse = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refresh_token, // Optionally rotate refresh token
    scope: tokenScope,
  };

  // Generate ID token if openid scope is present
  if (tokenScope.includes('openid')) {
    const idToken = await generateIDToken({
      user_id: storedRefreshToken.user_id,
      client_id: storedRefreshToken.client_id,
    });
    response.id_token = idToken;
  }

  return response;
}

/**
 * Handle client credentials grant
 */
async function handleClientCredentialsGrant(
  req: Request
): Promise<TokenResponse | { error: string; error_description: string }> {
  const { scope } = req.body;
  const { client_id, client_secret } = extractClientCredentials(req);

  if (!client_id || !client_secret) {
    return {
      error: 'invalid_client',
      error_description: 'Client authentication failed',
    };
  }

  // TODO: Validate client credentials against database

  // Generate access token (no refresh token for client credentials)
  const accessToken = await generateAccessToken({
    user_id: client_id, // For client credentials, client is the subject
    client_id,
    scope: scope || '',
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: scope || '',
  };
}

/**
 * Handle device authorization grant (RFC 8628)
 * urn:ietf:params:oauth:grant-type:device_code
 */
async function handleDeviceGrant(
  req: Request
): Promise<TokenResponse | { error: string; error_description: string }> {
  const { device_code, client_id } = req.body;

  // Validate required parameters
  if (!device_code) {
    return {
      error: 'invalid_request',
      error_description: 'Missing device_code parameter',
    };
  }

  if (!client_id) {
    return {
      error: 'invalid_request',
      error_description: 'Missing client_id parameter',
    };
  }

  try {
    // Query device authorization from projection
    const { DeviceAuthQueries } = await import('../../lib/query/device-auth/device-auth-queries');
    const { DatabasePool } = await import('../../lib/database');
    
    // Get database pool from request (injected by middleware)
    const pool = (req as any).pool as typeof DatabasePool.prototype;
    if (!pool) {
      return {
        error: 'server_error',
        error_description: 'Database not available',
      };
    }

    const queries = new DeviceAuthQueries(pool);
    const instanceID = (req.headers['x-zitadel-instance'] as string) || 'default';
    
    const deviceAuth = await queries.getByDeviceCode(device_code, instanceID);

    // Check if device authorization exists
    if (!deviceAuth) {
      return {
        error: 'invalid_grant',
        error_description: 'Device code not found or expired',
      };
    }

    // Verify client_id matches
    if (deviceAuth.clientID !== client_id) {
      return {
        error: 'invalid_client',
        error_description: 'Client ID mismatch',
      };
    }

    // Check if expired
    if (deviceAuth.expiresAt < new Date()) {
      return {
        error: 'expired_token',
        error_description: 'Device code has expired',
      };
    }

    // Check state and return appropriate response
    switch (deviceAuth.state) {
      case 'requested':
        // User hasn't approved yet - device should keep polling
        return {
          error: 'authorization_pending',
          error_description: 'User has not yet approved the device',
        };

      case 'denied':
        // User explicitly denied
        return {
          error: 'access_denied',
          error_description: 'User denied the device authorization',
        };

      case 'cancelled':
        // Authorization was cancelled
        return {
          error: 'access_denied',
          error_description: 'Device authorization was cancelled',
        };

      case 'expired':
        // Explicitly marked as expired
        return {
          error: 'expired_token',
          error_description: 'Device code has expired',
        };

      case 'approved':
        // Device approved! Issue tokens
        if (!deviceAuth.userID) {
          return {
            error: 'server_error',
            error_description: 'Device approved but no user ID found',
          };
        }

        const user_id = deviceAuth.userID;
        const scope = deviceAuth.scope.join(' ');

        // Generate access token
        const accessToken = await generateAccessToken({
          user_id,
          client_id,
          scope,
          audience: instanceID,
        });

        // Generate refresh token
        const refreshToken = randomUUID();

        // Track tokens
        const tokenStore = getTokenStore();
        // Extract jti from access token (simplified - in production would decode JWT)
        const jti = randomUUID();
        tokenStore.trackAccessToken(user_id, jti);

        return {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refreshToken,
          scope,
        };

      default:
        return {
          error: 'invalid_grant',
          error_description: `Device authorization in invalid state: ${deviceAuth.state}`,
        };
    }
  } catch (error) {
    console.error('[Device Grant] Error:', error);
    return {
      error: 'server_error',
      error_description: 'Internal server error',
    };
  }
}

/**
 * Token endpoint handler
 * POST /oauth/v2/token
 */
export async function tokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { grant_type } = req.body;

    if (!grant_type) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing grant_type parameter',
      });
      return;
    }

    let result: TokenResponse | { error: string; error_description: string };

    switch (grant_type) {
      case 'authorization_code':
        result = await handleAuthorizationCodeGrant(req);
        break;

      case 'refresh_token':
        result = await handleRefreshTokenGrant(req);
        break;

      case 'client_credentials':
        result = await handleClientCredentialsGrant(req);
        break;

      case 'urn:ietf:params:oauth:grant-type:device_code':
        result = await handleDeviceGrant(req);
        break;

      default:
        res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: `Unsupported grant_type: ${grant_type}`,
        });
        return;
    }

    // Check if result is an error
    if ('error' in result) {
      res.status(400).json(result);
      return;
    }

    // Success - return tokens
    res.json(result);
  } catch (error) {
    next(error);
  }
}
