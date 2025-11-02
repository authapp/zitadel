/**
 * SCIM Authentication Middleware
 * Validates Bearer tokens for SCIM API access
 */

import { Request, Response, NextFunction } from 'express';
import { createSCIMError } from './scim-error-handler';

export async function scimAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Allow discovery endpoints without authentication
    if (isDiscoveryEndpoint(req.path)) {
      return next();
    }

    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createSCIMError(401, 'unauthorized', 'Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Validate token
    // TODO: Implement actual token validation against Zitadel
    // For now, just check token is not empty
    if (!token || token.trim() === '') {
      throw createSCIMError(401, 'unauthorized', 'Invalid access token');
    }

    // TODO: Extract user/instance context from token
    // Store in req for use by handlers
    (req as any).scimContext = {
      userId: 'system', // Extract from token
      instanceId: 'test-instance', // Extract from token
      orgId: undefined, // Extract from token if present
      token,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if endpoint is a discovery endpoint (no auth required)
 */
function isDiscoveryEndpoint(path: string): boolean {
  return (
    path === '/Schemas' ||
    path.startsWith('/Schemas/') ||
    path === '/ServiceProviderConfig' ||
    path === '/ResourceTypes' ||
    path.startsWith('/ResourceTypes/')
  );
}
