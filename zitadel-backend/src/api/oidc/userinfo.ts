/**
 * UserInfo Endpoint
 * 
 * Returns user profile information
 */

import { Request, Response, NextFunction } from 'express';
import { UserInfoResponse } from './types';
import { getKeyManager } from './key-manager';
import { getTokenStore } from './token-store';

/**
 * Extract bearer token from request
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  return null;
}

/**
 * UserInfo endpoint handler
 * GET/POST /oidc/v1/userinfo
 */
export async function userinfoHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const accessToken = extractBearerToken(req);

    if (!accessToken) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing or invalid access token',
      });
      return;
    }

    // Verify and decode token
    const keyManager = await getKeyManager();
    let tokenPayload: any;

    try {
      const result = await keyManager.verifyJWT(accessToken);
      tokenPayload = result.payload;
    } catch (error) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token verification failed',
      });
      return;
    }

    // Check if token is revoked (if it has a jti)
    const tokenStore = getTokenStore();
    if (tokenPayload.jti && tokenStore.isAccessTokenRevoked(tokenPayload.jti)) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token has been revoked',
      });
      return;
    }

    // Build UserInfo response based on requested scopes
    const scopes = tokenPayload.scope?.split(' ') || [];
    const userId = tokenPayload.sub;

    // TODO: Fetch actual user data from database
    // For now, returning mock data
    const userInfo: UserInfoResponse = {
      sub: userId,
    };

    // Profile scope
    if (scopes.includes('profile')) {
      userInfo.name = 'Test User';
      userInfo.given_name = 'Test';
      userInfo.family_name = 'User';
      userInfo.preferred_username = 'testuser';
      userInfo.profile = 'https://example.com/profile/testuser';
      userInfo.picture = 'https://example.com/avatar/testuser.jpg';
      userInfo.website = 'https://example.com';
      userInfo.gender = 'other';
      userInfo.birthdate = '1990-01-01';
      userInfo.zoneinfo = 'America/Los_Angeles';
      userInfo.locale = 'en-US';
      userInfo.updated_at = Math.floor(Date.now() / 1000);
    }

    // Email scope
    if (scopes.includes('email')) {
      userInfo.email = 'test@example.com';
      userInfo.email_verified = true;
    }

    // Phone scope
    if (scopes.includes('phone')) {
      userInfo.phone_number = '+1234567890';
      userInfo.phone_number_verified = true;
    }

    // Address scope
    if (scopes.includes('address')) {
      userInfo.address = {
        formatted: '123 Main St\nSan Francisco, CA 94101\nUSA',
        street_address: '123 Main St',
        locality: 'San Francisco',
        region: 'CA',
        postal_code: '94101',
        country: 'USA',
      };
    }

    res.json(userInfo);
  } catch (error) {
    next(error);
  }
}
